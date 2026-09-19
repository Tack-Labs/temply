import { Extension, type Editor } from '@tiptap/core';
import { NodeSelection, Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { clearBlockSelection, selectBlockAt, selectedBlock } from '../commands/block';

export const blockSelectionKey = new PluginKey('blockSelection');

/** The format bar shows for a caret or text range inside a textblock; the
 *  action bar shows for a selected node. */
export function isEditingText(editor: Editor): boolean {
  const { selection } = editor.state;
  return selection instanceof TextSelection && selection.$from.parent.isTextblock;
}

/**
 * What a tap at `pos` (the caret position the view resolved) inside `inside`
 * (the innermost node the tap landed in, or -1) does. `select` is the
 * transaction that selects the tapped block; `edit` is the second tap on an
 * already selected textblock, whose transaction puts the caret where the
 * finger is. Null when the tap resolved to nothing to act on.
 */
export function tapTransaction(state: EditorState, pos: number, inside: number, focused = true): { tr: Transaction; edit: boolean } | null {
  const current = state.selection instanceof NodeSelection ? state.selection.from : null;
  const insideNode = inside >= 0 ? state.doc.nodeAt(inside) : null;
  // A selectable inline atom — a variable pill — is its own target: it has
  // controls of its own, and the walk below would land on the paragraph
  // around it.
  if (insideNode && insideNode.isInline && insideNode.isAtom && insideNode.type.spec.selectable !== false) {
    if (current === inside) return { tr: state.tr, edit: false }; // already selected: nothing to change
    return { tr: state.tr.setSelection(NodeSelection.create(state.doc, inside)), edit: false };
  }
  const $pos = state.doc.resolve(pos);
  // The block to select is the innermost textblock or leaf at the tap,
  // never a wrapper like a column or section.
  let depth = $pos.depth;
  while (depth > 0 && !$pos.node(depth).isTextblock && !$pos.node(depth).isAtom) depth--;
  const targetPos = depth === 0 ? inside : $pos.before(depth);
  if (targetPos < 0) return null;
  const target = state.doc.nodeAt(targetPos);
  if (!target) return null;
  // Already typing in this block: the tap is the browser's — it moves the
  // caret, and a long press selects a word — not a step back to the block.
  // Typing means the editor has the focus. A template opens with a caret
  // parked in its first block by autofocus and no keyboard up; that caret
  // used to read as "already typing", so the first tap on the first block
  // raised the keyboard instead of the bar.
  const { selection } = state;
  if (focused && selection instanceof TextSelection && selection.$from.parent.isTextblock && selection.$from.before(selection.$from.depth) === targetPos) {
    return null;
  }
  if (current === targetPos && target.isTextblock) {
    // Second tap: edit here. Placed by hand rather than left to the browser,
    // whose default would first turn the node selection into a DOM range
    // over the whole block — which ProseMirror then reads back as a text
    // selection of everything, and the first key typed replaces the block.
    return { tr: state.tr.setSelection(TextSelection.create(state.doc, pos)), edit: true };
  }
  return { tr: state.tr.setSelection(NodeSelection.create(state.doc, targetPos)), edit: false };
}

/**
 * Touch selection model. A finger has no hover and a tap that lands in text
 * would otherwise raise the keyboard every time someone only wanted to move
 * a block. So: the first tap on a block selects it as a node (the action bar
 * appears, the keyboard does not); a second tap on the same block falls
 * through to ProseMirror, which places the caret and starts editing. A tap
 * on a different block selects that one. Leaf blocks (image, divider,
 * spacer, button) have nothing to edit inline, so every tap selects.
 *
 * Done on mousedown, not click, and with the default prevented: the default
 * is what focuses the contenteditable, and a focused editor holding a node
 * selection is a DOM range over the block's text — which iOS dresses with
 * its own selection handles and highlight, and reads back as a caret on an
 * empty paragraph. An unfocused editor keeps the ProseMirror selection and
 * draws the outline, and the keyboard stays down until the second tap.
 */
export const BlockSelection = Extension.create({
  name: 'blockSelection',

  // A document that opens with a leaf block — a logo, an image — starts on
  // `Selection.atStart`, which is a NodeSelection. On a phone that draws the
  // block's selected outline while the bar is still on its idle face, so the
  // canvas claims a selection nothing acts on. Nothing is selected until a
  // finger says so.
  onCreate() {
    if (!(this.editor.state.selection instanceof NodeSelection)) return;
    clearBlockSelection(this.editor);
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: blockSelectionKey,
        props: {
          handleDOMEvents: {
            mousedown(view: EditorView, event: MouseEvent) {
              if (event.button !== 0) return false;
              // A read-only view is a covered one, and a covered canvas takes
              // no taps at all. The phone shell turns editing off while a
              // sheet or a field surface sits over the canvas, and those
              // surfaces commit against the selection they were opened on — a
              // tap that moved it underneath them landed their edit on
              // whatever had just been tapped instead. Returning false is not
              // enough: the browser's own default then puts a DOM selection
              // into the read-only text and takes the focus off the field, and
              // ProseMirror reads that selection back. A plugin handler runs
              // whether or not the view is editable, so the tap has to be
              // stopped here. The desktop view is never read-only.
              if (!view.editable) {
                event.preventDefault();
                return true;
              }
              const found = view.posAtCoords({ left: event.clientX, top: event.clientY });
              if (!found) return false;
              const tap = tapTransaction(view.state, found.pos, found.inside, view.hasFocus());
              if (!tap) return false;
              event.preventDefault();
              if (tap.tr.selectionSet) view.dispatch(tap.tr);
              if (tap.edit) {
                // Still inside the tap, so the browser treats the focus as
                // the person's own and raises the keyboard.
                view.focus();
                return true;
              }
              // Tapping another block while typing ends the typing: the
              // keyboard goes with the focus. After the event, not inside
              // it — the browser's own handling of this tap can focus the
              // editor back, and a DOM range left behind would keep it.
              if (view.hasFocus()) {
                requestAnimationFrame(() => {
                  view.dom.blur();
                  document.getSelection()?.removeAllRanges();
                });
              }
              return true;
            },
          },
        },
      }),
    ];
  },
});

/** Whether this editor runs the touch selection model — the one place a node
 *  view can ask, since the `touch` prop stops at the extension list. */
export function isTouchEditor(editor: Editor): boolean {
  return editor.extensionManager.extensions.some((extension) => extension.name === BlockSelection.name);
}

export { clearBlockSelection, selectBlockAt, selectedBlock };
