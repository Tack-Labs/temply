/**
 * The playground kept unsaved work under this key in an earlier version,
 * offering it back on return. That mechanism is gone — every visit now opens
 * the same seeded document — but a draft an earlier visit already wrote is
 * still sitting in some visitors' browsers, and it must not resurface. This
 * module is only the one-time purge for that leftover.
 *
 * Delete it, and its call, after 2027-03-01: six months of visits is far
 * longer than the gap between a playground visitor's two sessions, so by then
 * anyone who was going to come back has come back and had their leftover
 * cleared. What is left is browsers that will never return, and a key nobody
 * reads harms nobody.
 */
export const PLAYGROUND_DRAFT_ID = 'playground';

const key = (templateId: string) => `temply:draft:${templateId}`;

/**
 * Swallows its own failures: storage throws for reasons that have nothing to
 * do with the draft — a full quota, private browsing, a policy that blocks
 * it — and none of them are a reason to take the editor down.
 */
export function clearDraft(templateId: string): void {
  try {
    window.localStorage.removeItem(key(templateId));
  } catch {
    // Nothing to tell the visitor: the leftover simply stays, same as before.
  }
}
