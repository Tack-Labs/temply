'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * One-shot visibility: flips to true the first time the element comes within
 * 200px of the viewport and never goes back — the consumer fetches once, so
 * re-observing after that buys nothing. Where IntersectionObserver does not
 * exist the hook reports visible immediately; degrading to "load everything"
 * beats degrading to "load nothing".
 */
export function useInView() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}
