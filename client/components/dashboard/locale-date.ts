/**
 * What a date reads like in the reader's own locale, which the server cannot
 * know. Anything that calls this on a component the server renders has to
 * wait for `useHydrated` (~/hooks/use-hydrated), or the server's "Nov 1" and
 * the browser's "1 Nov" mismatch on hydration.
 */
export function editedOn(iso: string | null): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
