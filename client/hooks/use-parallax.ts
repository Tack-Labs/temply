'use client';
import { useEffect, useRef } from 'react';
import { clampedParallax } from '~/lib/scroll-motion';

/** Writes a bounded `--parallax-y` (px) onto the ref element on scroll, throttled
 *  to one rAF. Disabled entirely when the user prefers reduced motion.
 *
 *  `relative: true` measures from the element's own distance to the middle of
 *  the viewport instead of from the top of the document. Anything below the
 *  fold needs this: page-absolute scroll pins to `max` within the first screen,
 *  which would leave a panel further down sitting at a constant offset — a
 *  displacement, not a drift. */
export function useParallax(speed: number, max: number, options?: { relative?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const relative = options?.relative ?? false;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      let offset = window.scrollY;
      if (relative) {
        const rect = el.getBoundingClientRect();
        offset = window.innerHeight / 2 - (rect.top + rect.height / 2);
      }
      el.style.setProperty('--parallax-y', `${clampedParallax(offset, speed, max)}px`);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [speed, max, relative]);

  return ref;
}
