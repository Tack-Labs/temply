import type { Editor } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import { NodeSelection, Selection, TextSelection } from '@tiptap/pm/state';
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, Trash2Icon } from 'lucide-react';
import type { EditorCommand } from './types';

/**
 * The block a node-specific bubble menu (Repeat, Button, Variable) or the
 * Style sheet's wrapper controls act on. For a NodeSelection the selected
 * node is already the answer — and it is the only route a leaf block (a
 * spacer, a divider, a button) ever arrives by, since a cursor cannot sit
 * inside one. Otherwise the walk starts at the deepest resolved depth, which
 * is already the textblock directly holding the cursor's inline content:
 * inside a column or a section the inner block is what was clicked, never
 * the wrapping column/section/columns/repeat node. The `isLeaf` test in the
 * walk is unreachable today and kept as the correct guard for a future
 * block-level atom.
 */
export function selectedBlock(editor: Editor): { node: Node; pos: number; depth: number } | null {
  const { selection, doc } = editor.state;
  if (selection instanceof NodeSelection) {
    return { node: selection.node, pos: selection.from, depth: selection.$from.depth + 1 };
  }
  const $from = selection.$from;
  for (let depth = $from.depth; depth >= 1; depth--) {
    const node = $from.node(depth);
    if (node.isTextblock || node.isLeaf) return { node, pos: $from.before(depth), depth };
  }
  const first = doc.firstChild;
  return first ? { node: first, pos: 0, depth: 1 } : null;
}

/**
 * The nodes of the given types strictly around the selected block — the
 * Section and the Columns a paragraph sits in, say — from the outside in.
 * Empty when there are none, and never including the selected block itself.
 * This is how the Style sheet finds a wrapper's settings from a caret in one
 * of its blocks, without the wrapper itself ever being selected.
 */
export function enclosingNodes(editor: Editor, typeNames: readonly string[]): Array<{ node: Node; pos: number }> {
  const block = selectedBlock(editor);
  if (!block) return [];
  const $pos = editor.state.doc.resolve(block.pos);
  const found: Array<{ node: Node; pos: number }> = [];
  for (let depth = 1; depth <= $pos.depth; depth++) {
    const node = $pos.node(depth);
    if (typeNames.includes(node.type.name)) found.push({ node, pos: $pos.before(depth) });
  }
  return found;
}

/**
 * Whether the selection is an inline atom — a variable pill — rather than a
 * block. A pill can be node-selected because it has settings of its own, but
 * it lives among words, not among blocks: its siblings are the text runs on
 * either side of it, so Move up, Move down and Duplicate would act on those
 * runs instead of a sibling block.
 */
export function isInlineAtomSelected(editor: Editor): boolean {
  const { selection } = editor.state;
  return selection instanceof NodeSelection && selection.node.isInline && selection.node.isAtom;
}

/** Selects the node starting at `pos`. A position that is not a node start
 *  has nothing to select and NodeSelection.create throws on it, which would
 *  surface as a crash inside whatever handler asked — a Checks row, say — so
 *  it is a no-op instead. */
export function selectBlockAt(editor: Editor, pos: number): void {
  if (!editor.state.doc.resolve(pos).nodeAfter) return;
  const tr = editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos));
  editor.view.dispatch(tr);
}

/**
 * Nothing selected: a caret in the first textblock. A document with no
 * textblock at all keeps the selection it has — there is nowhere for a caret
 * to go.
 */
export function clearBlockSelection(editor: Editor): void {
  const caret = Selection.findFrom(editor.state.doc.resolve(0), 1, true);
  if (!caret) return;
  editor.view.dispatch(editor.state.tr.setSelection(caret).setMeta('addToHistory', false));
}

/** Swaps the block with its sibling in the same parent. False at an edge, or
 *  when the selection is an inline atom rather than a block — a pill's
 *  siblings are the text runs on either side of it, and swapping with one of
 *  those merges the paragraph's two text runs into one. The command refuses
 *  it directly rather than trust every caller to check first. */
export function moveBlock(editor: Editor, direction: 'up' | 'down'): boolean {
  if (isInlineAtomSelected(editor)) return false;
  const block = selectedBlock(editor);
  if (!block) return false;
  const $pos = editor.state.doc.resolve(block.pos);
  const parent = $pos.parent;
  const index = $pos.index();
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= parent.childCount) return false;

  const sibling = parent.child(targetIndex);
  const tr = editor.state.tr;
  tr.delete(block.pos, block.pos + block.node.nodeSize);
  const insertPos = direction === 'up' ? block.pos - sibling.nodeSize : block.pos + sibling.nodeSize;
  tr.insert(insertPos, block.node);
  tr.setSelection(NodeSelection.create(tr.doc, insertPos));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

export function duplicateBlock(editor: Editor): boolean {
  const block = selectedBlock(editor);
  if (!block) return false;
  const after = block.pos + block.node.nodeSize;
  const tr = editor.state.tr.insert(after, block.node.copy(block.node.content));
  tr.setSelection(NodeSelection.create(tr.doc, after));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/** Whether Delete would change anything for the current selection: always,
 *  since there is always a selected block to remove. Kept as its own
 *  function because `blockCommands.remove` reads enablement and effect
 *  through the same question. */
export function canDeleteBlock(editor: Editor): boolean {
  return selectedBlock(editor) !== null;
}

export function deleteBlock(editor: Editor): boolean {
  const block = selectedBlock(editor);
  if (!block) return false;
  const { pos, node } = block;
  const tr = editor.state.tr.delete(pos, pos + node.nodeSize);
  // Something must stay selected. Prefer the block that slid into the
  // deleted one's place, then the block before it, and otherwise a caret at
  // the gap the deletion left. Both neighbours are tested for being blocks:
  // an inline atom's neighbours are the text runs of the paragraph it stood
  // in, and selecting one of those as a node would select a text run rather
  // than a block. The caret is taken from that gap rather than the start of
  // the document so deleting a pill that opened its paragraph does not jump
  // to the top of the email.
  const doc = tr.doc;
  const $at = doc.resolve(Math.min(pos, doc.content.size));
  const next = $at.nodeAfter;
  const before = $at.nodeBefore;
  if (next && next.isBlock) tr.setSelection(NodeSelection.create(doc, pos));
  else if (before && before.isBlock) tr.setSelection(NodeSelection.create(doc, pos - before.nodeSize));
  else tr.setSelection(TextSelection.near($at));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/** Where a block sits among its siblings, and how many there are. A resolved
 *  position always has a parent, so there is no "no answer" case. */
function siblingIndex(editor: Editor, pos: number): { index: number; count: number } {
  const $pos = editor.state.doc.resolve(pos);
  return { index: $pos.index(), count: $pos.parent.childCount };
}

export const blockCommands = {
  moveUp: {
    id: 'move-up',
    label: 'Move up',
    icon: ArrowUpIcon,
    isEnabled: (editor: Editor) => {
      if (isInlineAtomSelected(editor)) return false;
      const block = selectedBlock(editor);
      if (!block) return false;
      return siblingIndex(editor, block.pos).index > 0;
    },
    run: (editor: Editor) => {
      moveBlock(editor, 'up');
    },
  },
  moveDown: {
    id: 'move-down',
    label: 'Move down',
    icon: ArrowDownIcon,
    isEnabled: (editor: Editor) => {
      if (isInlineAtomSelected(editor)) return false;
      const block = selectedBlock(editor);
      if (!block) return false;
      const sibling = siblingIndex(editor, block.pos);
      return sibling.index < sibling.count - 1;
    },
    run: (editor: Editor) => {
      moveBlock(editor, 'down');
    },
  },
  duplicate: {
    id: 'duplicate',
    label: 'Duplicate',
    icon: CopyIcon,
    run: (editor: Editor) => {
      duplicateBlock(editor);
    },
  },
  remove: {
    id: 'delete',
    label: 'Delete',
    icon: Trash2Icon,
    isEnabled: canDeleteBlock,
    run: (editor: Editor) => {
      deleteBlock(editor);
    },
  },
} satisfies Record<string, EditorCommand>;
