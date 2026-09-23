import { findParentNode, type Editor } from '@tiptap/core';
import { selectedNodeOfType } from './selected-node';

/**
 * Deletes the nearest `nodeType` the selection belongs to. `findParentNode`
 * only ever looks at ancestors, which is all a caret can be inside, so the
 * selection itself is tried first — the shape a tap leaves, and the one
 * Delete Columns on the phone always has.
 */
export function deleteNode(editor: Editor, nodeType: string) {
  const { state } = editor.view;
  const { selection } = state;
  const selected = selectedNodeOfType(state, nodeType);
  const target = selected
    ? { pos: selection.from, node: selected }
    : findParentNode((node) => node.type.name === nodeType)(selection);

  if (!target) {
    return;
  }

  const from = target.pos;
  const to = from + target.node.nodeSize;

  const { tr } = state;
  const transaction = tr.delete(from, to);
  editor.view.dispatch(transaction);
}
