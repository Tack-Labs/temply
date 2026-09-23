'use client';
import { useEffect, useRef } from 'react';

/** Tracks the element in and out of the viewport, toggling `data-revealed`
 *  both ways — so the reveal replays every time you scroll back to it, not
 *  just on first approach. Under reduced motion the element is simply marked
 *  revealed and never observed. */
export function useReveal() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.setAttribute('data-revealed', 'true');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          el.setAttribute('data-revealed', entry.isIntersecting ? 'true' : 'false');
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}
