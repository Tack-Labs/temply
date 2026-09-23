/**
 * Anything Radix positions sits in a popper wrapper; a dialog positions
 * itself and is named by its role instead. A tooltip is in a wrapper too, and
 * the `role="tooltip"` element Radix puts inside its own is what tells the
 * two apart.
 */
const OPEN_LAYER = '[data-radix-popper-content-wrapper], [role="dialog"], [role="alertdialog"]';

/**
 * Whether something in front of the caller will answer the Escape itself.
 *
 * Radix answers Escape on `document` in the capture phase and does not stop
 * the event, so a layer that took the press can already be gone by the time a
 * bubble-phase listener runs — but a dropdown leaves on an animation and is
 * still there, and one keystroke aimed at Padding would otherwise close it
 * and take the whole menu down behind it.
 *
 * Two shapes can be in front. Anything Radix positions sits in a popper
 * wrapper: the dropdowns and Padding, portaled out of a menu, and Show if and
 * the colour popovers, rendered inside one. A dialog positions itself, so its
 * role is what names it.
 *
 * A tooltip is the one open layer that does not count. It answers Escape too,
 * but nobody asked for it — it is on screen because the pointer is resting
 * somewhere — so letting a hint swallow the press would cost a second one.
 * Measured, a tooltip has already left by this phase; the exclusion is so the
 * rule does not quietly depend on that.
 */
export function layerWillTakeEscape(): boolean {
  return Array.from(document.querySelectorAll(OPEN_LAYER)).some((layer) => {
    const hint = layer.querySelector('[role="tooltip"]');
    return !hint || hint.closest(OPEN_LAYER) !== layer;
  });
}
