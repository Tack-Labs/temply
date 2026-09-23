import type { Editor } from '@tiptap/core';

/**
 * Room above a block for the menu that arrives with it: the toolbar plus the
 * offset every bubble menu is placed with.
 */
const MENU_ROOM = 48;

/**
 * Brings the block the selection is in back into view, once it has a size.
 *
 * ProseMirror scrolls the selection into view as part of the transaction that
 * makes it, which is too early for anything drawn by a React node view — a
 * Section, a Repeat, an Image are all a placeholder of no height at that
 * moment, so the scroll is asked for against a block that does not exist yet
 * and lands nowhere. A block inserted at the end of a canvas already scrolled
 * to its bottom then sits below the fold with its menu, and the menu is the
 * only way to reach what the block can be told to do.
 *
 * A frame later the node view has mounted and the block can be measured. It
 * is only moved if it is not already where the customer can work on it —
 * scrolling a block that was in view the whole time is the canvas jumping
 * under the pointer for no reason anyone asked for. The phone's
 * `revealSelectedBlock` centres whatever it is given instead: there the block
 * can be in the window and still be under the bottom bar.
 */
export function revealInsertedBlock(editor: Editor | null): void {
  if (!editor) return;
  requestAnimationFrame(() => {
    // A block the insert selected outright — a Spacer, a Divider — is a
    // selection with no depth to ask about, and its own position is already
    // the block's. Anything else is a caret somewhere inside one.
    const { $from, from } = editor.state.selection;
    const block = editor.view.nodeDOM($from.depth > 0 ? $from.before(1) : from);
    const element = block instanceof HTMLElement ? block : editor.view.dom.querySelector('.ProseMirror-selectednode');
    if (!(element instanceof HTMLElement)) return;

    const rect = element.getBoundingClientRect();
    if (rect.top >= MENU_ROOM && rect.bottom <= window.innerHeight) return;

    element.scrollIntoView({ block: 'center' });
  });
}
