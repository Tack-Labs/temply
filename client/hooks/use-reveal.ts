'use client';
import { useLayoutEffect, useRef } from 'react';

const READY = 'data-reveal-ready';

// The observer's own margin and threshold. `isInView` restates them because
// the first paint cannot wait for the observer's first callback.
const ROOT_MARGIN_BOTTOM_PERCENT = 10;
const THRESHOLD = 0.15;

type Box = { top: number; bottom: number; left: number; right: number; width: number; height: number };

/** Whether an element of this area is too big for a root `ceiling` square
 *  pixels large ever to show THRESHOLD of it. A ratio rule alone would keep it
 *  hidden however far it was scrolled, and the pricing section is one on a
 *  phone held sideways, where 15% of it is taller than the screen. Such an
 *  element counts as in once any of it is. */
const tooBigToReach = (area: number, ceiling: number) => ceiling < THRESHOLD * area;

/** Whether the observer below would report this box intersecting right now: at
 *  least THRESHOLD of it inside the observer's inset viewport, or any of
 *  it when it is too big for that. Marking by any looser rule would show an
 *  element for a frame and then fade it out when the observer disagrees. */
export function isInView(box: Box, viewport: { width: number; height: number }): boolean {
  const area = box.width * box.height;
  if (area <= 0) return false;
  // IntersectionObserver resolves percentage margins against root width,
  // including a vertical margin, so a square viewport cannot test this rule.
  const rootHeight = Math.max(0, viewport.height - viewport.width * ROOT_MARGIN_BOTTOM_PERCENT / 100);
  const visibleHeight = Math.min(box.bottom, rootHeight) - Math.max(box.top, 0);
  const visibleWidth = Math.min(box.right, viewport.width) - Math.max(box.left, 0);
  if (visibleHeight <= 0 || visibleWidth <= 0) return false;
  return (visibleHeight * visibleWidth) / area >= THRESHOLD || tooBigToReach(area, rootHeight * visibleWidth);
}

/** The same rule from what the observer reports. Zero is among its thresholds
 *  so that it reports an element too big to reach THRESHOLD at all. */
function reveals(entry: IntersectionObserverEntry): boolean {
  if (!entry.isIntersecting) return false;
  if (entry.intersectionRatio >= THRESHOLD) return true;
  const { boundingClientRect: box, intersectionRect: seen, rootBounds: root } = entry;
  const rootHeight = root?.height ?? Math.max(0, window.innerHeight - window.innerWidth * ROOT_MARGIN_BOTTOM_PERCENT / 100);
  return tooBigToReach(box.width * box.height, rootHeight * seen.width);
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
          el.setAttribute('data-revealed', String(reveals(entry)));
        }
      },
      { rootMargin: `0px 0px -${ROOT_MARGIN_BOTTOM_PERCENT}% 0px`, threshold: [0, THRESHOLD] },
    );
    el.setAttribute(
      'data-revealed',
      String(isInView(el.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight })),
    );
    observer.observe(el);
    observers += 1;
    document.documentElement.setAttribute(READY, '');

    return () => {
      observer.disconnect();
      observers -= 1;
      if (observers === 0) document.documentElement.removeAttribute(READY);
    };
  }, []);

  return ref;
}
