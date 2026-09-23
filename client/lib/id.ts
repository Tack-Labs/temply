/**
 * A throwaway id for something that lives only in this tab — a pending
 * upload card, say. `crypto.randomUUID` exists only in a secure context,
 * which a phone on the LAN opening the dev server over plain http is not;
 * the fallback is not unique across machines and does not need to be.
 */
export function localId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
