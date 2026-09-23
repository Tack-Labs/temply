import { useEffect, useRef, useState } from 'react';

/**
 * Keeps a loading state on screen for at least `minimumMs` once it has
 * appeared. A fetch that settles in 40ms would otherwise show the loader for
 * a frame or two — a flash that reads as a glitch, worse than either no
 * loader or a steady one. Data already in the query cache never trips this:
 * the state is never active, so nothing is held.
 */
export function useMinimumDisplay(active: boolean, minimumMs = 300): boolean {
  const [shown, setShown] = useState(active);
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    if (active) {
      shownAt.current ??= Date.now();
      setShown(true);
      return;
    }
    if (shownAt.current === null) return;

    const remaining = Math.max(0, minimumMs - (Date.now() - shownAt.current));
    const timer = setTimeout(() => {
      shownAt.current = null;
      setShown(false);
    }, remaining);
    return () => clearTimeout(timer);
  }, [active, minimumMs]);

  // `active` on its own covers the render before the effect has run, so a
  // query that starts fetching again never shows a frame of empty state
  // while the timer catches up.
  return shown || active;
}
