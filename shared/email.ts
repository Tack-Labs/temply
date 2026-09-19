/**
 * The shape of an address, as loosely as an inbox would take it: something,
 * an @, something with a dot in it. The server checks recipients and
 * reply-to against it; the client checks the addresses typed into an
 * invite. One expression, so the two cannot disagree about what counts.
 */
export const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailAddress(value: string): boolean {
  return EMAIL_ADDRESS.test(value);
}
