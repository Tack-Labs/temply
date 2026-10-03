import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False on the server and during hydration, true from the first client render
 * after it. For what only the browser can know (the reader's locale, a width):
 * the server's markup and the client's first render must agree, so the
 * browser-only part waits for this and fills in on the render after.
 *
 * It is a store rather than an effect that sets state: a client that is not
 * hydrating (a route change) reads `true` on its very first render instead of
 * painting the server's version for a frame first.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
