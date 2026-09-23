'use client';

import { useSyncExternalStore } from 'react';

/** True when the query matches now; false with no window, so a server
 *  render and the first client render agree. */
export function matches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

function subscribe(query: string, onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const list = window.matchMedia(query);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

/**
 * A media query as state. Server and hydration render with `false`; the
 * real value arrives on the client's first effect, which is what keeps the
 * markup from disagreeing with itself during hydration.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribe(query, onChange),
    () => matches(query),
    () => false,
  );
}
