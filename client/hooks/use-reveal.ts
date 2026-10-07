'use client';
import { useLayoutEffect, useRef } from 'react';

const READY = 'data-reveal-ready';

// The observer's own margin and threshold. `isInView` restates them because
// the first paint cannot wait for the observer's first callback.
const ROOT_MARGIN_BOTTOM_PERCENT = 10;
const THRESHOLD = 0.15;

// Past this many roots tall, an element is a place to scroll through, not a
// block to take in at once, and counts as in once any of it is. A 15% ratio
// asked of anything between one and about seven roots needs most of the root
// filled by that element: a 1742px section is 261px of a 288px root at 568x320,
// and stays blank until its top is within 27px of the screen's. Two roots
// leaves the ratio rule to what a screen can hold a fair share of, and holds
// whichever axis the engine insets the root by.
const TALL_ROOTS = 2;

type Box = { top: number; bottom: number; left: number; right: number; width: number; height: number };

/** The one rule both paths below apply: any of an element taller than
 *  TALL_ROOTS roots, otherwise THRESHOLD of it. */
function shouldReveal({
  intersecting,
  ratio,
  boxHeight,
  rootHeight,
}: {
  intersecting: boolean;
  ratio: number;
  boxHeight: number;
  rootHeight: number;
}): boolean {
  if (!intersecting) return false;
  return ratio >= THRESHOLD || boxHeight > TALL_ROOTS * rootHeight;
}

/** The root heights an engine could resolve the bottom inset to. The
 *  specification resolves every percentage margin against the root's width, a
 *  vertical one included (`rootMargin`, "relative to the width of the
 *  undilated rectangle"). Chromium measured otherwise: at 568x300 its
 *  `rootBounds.height` was 270, nine tenths of the height, not the 243 the
 *  width gives. Firefox and WebKit could not be run here, so neither is
 *  assumed. */
function rootHeights(viewport: { width: number; height: number }): number[] {
  const byHeight = viewport.height * (1 - ROOT_MARGIN_BOTTOM_PERCENT / 100);
  const byWidth = viewport.height - viewport.width * ROOT_MARGIN_BOTTOM_PERCENT / 100;
  return [byHeight, byWidth].map((height) => Math.max(0, height));
}

/** Whether the observer below would report this box revealed right now. The
 *  root's real height is not known until its first callback, so this asks the
 *  rule under each height the engine might use and marks the box only when
 *  every one agrees. Marking by any looser rule would show an element for a
 *  frame and then fade it out when the observer disagrees. */
export function isInView(box: Box, viewport: { width: number; height: number }): boolean {
  const area = box.width * box.height;
  if (area <= 0) return false;
  const visibleWidth = Math.min(box.right, viewport.width) - Math.max(box.left, 0);
  return rootHeights(viewport).every((rootHeight) => {
    const visibleHeight = Math.min(box.bottom, rootHeight) - Math.max(box.top, 0);
    return shouldReveal({
      intersecting: visibleHeight > 0 && visibleWidth > 0,
      ratio: (visibleHeight * visibleWidth) / area,
      boxHeight: box.height,
      rootHeight,
    });
  });
}

// How far the hidden state sits below where the layout puts the element: the
// `translateY` on `[data-reveal]` in globals.css. The observer measures the
// transformed box, so every decision moves the box it is about to be asked
// about by this much.
const TRAVEL_PX = 16;

/** The same rule from what the observer reports, with the root height it
 *  actually used. Zero is among its thresholds so that it reports an element
 *  taller than TALL_ROOTS roots the moment any of it is in.
 *
 *  An element leaving through the top is judged by where it has been, not by
 *  the ratio alone. Revealing it lifts it TRAVEL_PX, which can take the last
 *  stretch of it back under THRESHOLD, which hides it, which drops it back
 *  over: it flipped for as long as the page stood still. So once clipped at
 *  the top, a revealed element stays revealed until none of it is in. And a
 *  hidden one has to show more than TRAVEL_PX before it counts as arriving:
 *  once out, its hidden offset alone puts that much of it back in the root. */
function reveals(entry: IntersectionObserverEntry, revealed: boolean): boolean {
  if (!entry.isIntersecting) return false;
  // No root bounds means the observer is not telling; the smaller root errs
  // toward showing, which a later report can still undo.
  const rootHeight =
    entry.rootBounds?.height ?? Math.min(...rootHeights({ width: window.innerWidth, height: window.innerHeight }));
  const arrived = shouldReveal({
    intersecting: true,
    ratio: entry.intersectionRatio,
    boxHeight: entry.boundingClientRect.height,
    rootHeight,
  });
  const clippedAtTop = entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0);
  if (!clippedAtTop) return arrived;
  return revealed || (arrived && entry.intersectionRect.height > TRAVEL_PX);
}

// The flag below is a claim that an observer is running, so it leaves with the
// last one: a page client-navigated to afterwards must not inherit a hiding
// rule nothing is left to lift.
let observers = 0;

/** Tracks the element in and out of the viewport, toggling `data-revealed`
 *  both ways — so the reveal replays every time you scroll back to it, not
 *  just on first approach.
 *
 *  The hidden start state is the stylesheet's, and it applies only under
 *  `html[data-reveal-ready]`, which this sets once an observer is running and
 *  the elements already on screen are marked revealed — in a layout effect, so
 *  all of it lands before the paint it affects. Until then, and wherever this
 *  never runs (scripts off or failed, reduced motion, no IntersectionObserver),
 *  the content is shown as written. The server renders none of it, so the first
 *  client render matches the server's. */
export function useReveal() {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          el.setAttribute('data-revealed', String(reveals(entry, el.getAttribute('data-revealed') === 'true')));
        }
      },
      { rootMargin: `0px 0px -${ROOT_MARGIN_BOTTOM_PERCENT}% 0px`, threshold: [0, THRESHOLD] },
    );
    const box = el.getBoundingClientRect();
    el.setAttribute('data-revealed', String(isInView(box, { width: window.innerWidth, height: window.innerHeight })));
    observer.observe(el);
    observers += 1;
    document.documentElement.setAttribute(READY, '');

    // The observer reports only a crossing of zero or THRESHOLD, and whether
    // the element is taller than TALL_ROOTS roots moves with the window and
    // with its own height without crossing either, so a resize can leave it in
    // a state the rule no longer gives. Observing it again is what asks: an
    // observer reports a target as it stands the moment it starts watching it.
    const recheck = () => {
      observer.unobserve(el);
      observer.observe(el);
    };
    window.addEventListener('resize', recheck);
    // An observer's first report is the size the element had when watching
    // began, which the paint above has already decided on, so a report of the
    // size it already has is not a change.
    let lastSize = box.height;
    const sizes =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver((entries) => {
            const size = entries[entries.length - 1]?.borderBoxSize?.[0]?.blockSize;
            if (size !== undefined && size === lastSize) return;
            if (size !== undefined) lastSize = size;
            recheck();
          });
    sizes?.observe(el, { box: 'border-box' });

    return () => {
      window.removeEventListener('resize', recheck);
      sizes?.disconnect();
      observer.disconnect();
      observers -= 1;
      if (observers === 0) document.documentElement.removeAttribute(READY);
    };
  }, []);

  return ref;
}
