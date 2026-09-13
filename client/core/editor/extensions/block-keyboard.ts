import { Extension } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/**
 * Keyboard access to block manipulation.
 *
 * Reordering, duplicating and removing a block were all mouse-only: the drag
 * handle listens for dragstart and mousemove, and the block menu only appears
 * once the pointer is over a block. That left the product's headline
 * interaction unreachable without a mouse.
 *
 * Insertion already had a path — the slash menu — so this covers the rest.
 */

/** The index of the top-level block containing the selection. */
function topLevelIndex(doc: ProseMirrorNode, pos: number): number | null {
  let index: number | null = null;
  doc.forEach((_node, offset, i) => {
    if (index !== null) return;
    const start = offset;
    const end = offset + _node.nodeSize;
    if (pos >= start && pos < end) index = i;
  });
  return index;
}

function offsetOfIndex(doc: ProseMirrorNode, index: number): number {
  let offset = 0;
  for (let i = 0; i < index; i++) offset += doc.child(i).nodeSize;
  return offset;
}

export const BlockKeyboardShortcuts = Extension.create({
  name: 'blockKeyboardShortcuts',

  addKeyboardShortcuts() {
    const moveBy = (direction: -1 | 1) => () => {
      const { state, view } = this.editor;
      const { doc, selection } = state;
      const index = topLevelIndex(doc, selection.from);
      if (index === null) return false;

      const target = index + direction;
      if (target < 0 || target >= doc.childCount) return false;

      const node = doc.child(index);
      const from = offsetOfIndex(doc, index);
      const to = from + node.nodeSize;

      const tr = state.tr.delete(from, to);
      // Recompute the destination against the shortened document rather than
      // guessing, otherwise moving down lands one block short.
      const insertAt = offsetOfIndex(tr.doc, direction === -1 ? target : target);
      tr.insert(insertAt, node);
      tr.setSelection(TextSelection.near(tr.doc.resolve(insertAt + 1)));
      tr.scrollIntoView();
      view.dispatch(tr);
      return true;
    };

    const duplicate = () => {
      const { state, view } = this.editor;
      const { doc, selection } = state;
      const index = topLevelIndex(doc, selection.from);
      if (index === null) return false;

      const node = doc.child(index);
      const from = offsetOfIndex(doc, index);
      const insertAt = from + node.nodeSize;

      const tr = state.tr.insert(insertAt, node.copy(node.content));
      tr.setSelection(TextSelection.near(tr.doc.resolve(insertAt + 1)));
      tr.scrollIntoView();
      view.dispatch(tr);
      return true;
    };

    const removeBlock = () => {
      const { state, view } = this.editor;
      const { doc, selection } = state;
      // A single remaining block would leave an empty document with no cursor.
      if (doc.childCount <= 1) return false;

      const index = topLevelIndex(doc, selection.from);
      if (index === null) return false;

      const node = doc.child(index);
      const from = offsetOfIndex(doc, index);
      const tr = state.tr.delete(from, from + node.nodeSize);
      tr.setSelection(TextSelection.near(tr.doc.resolve(Math.max(1, from))));
      tr.scrollIntoView();
      view.dispatch(tr);
      return true;
    };

    /** Select the whole block, which is how you reach a block that holds no
     *  text — an image or a spacer — without a pointer. */
    const selectBlock = () => {
      const { state, view } = this.editor;
      const { doc, selection } = state;
      const index = topLevelIndex(doc, selection.from);
      if (index === null) return false;

      const from = offsetOfIndex(doc, index);
      const tr = state.tr.setSelection(NodeSelection.create(doc, from));
      view.dispatch(tr);
      return true;
    };

    return {
      'Mod-Shift-ArrowUp': moveBy(-1),
      'Mod-Shift-ArrowDown': moveBy(1),
      'Mod-Shift-d': duplicate,
      'Mod-Shift-Backspace': removeBlock,
      'Mod-Shift-Delete': removeBlock,
      // Not Mod-Shift-L: TextAlign binds that to "align left" and answers
      // first, so the shortcut never reached here. Space is the one key no
      // extension or browser claims with these modifiers.
      'Mod-Shift-Space': selectBlock,
    };
  },
});
