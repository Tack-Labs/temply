import { Editor } from '@tiptap/react';
import { Fragment, Node } from '@tiptap/pm/model';
import { EditorState, NodeSelection, Selection, TextSelection, Transaction } from '@tiptap/pm/state';
import { v4 as uuidv4 } from 'uuid';
import { findParentNode } from '@tiptap/core';
import { DEFAULT_COLUMN_WIDTH } from '../nodes/columns/column';
import { selectedNodeOfType } from './selected-node';

export function getColumnCount(editor: Editor) {
  return getClosestNodeByName(editor, 'columns')?.node?.childCount || 0;
}

/** The `columns` wrapper as the selection itself — the shape a tap leaves. */
export function isColumnsSelected(editor: Editor): boolean {
  return !!selectedNodeOfType(editor.state, 'columns');
}

/**
 * The nearest `name` the selection belongs to: ancestors, as a caret's
 * containers, plus the selected node itself.
 */
export function getClosestNodeByName(editor: Editor, name: string) {
  const { state } = editor.view;
  const { selection } = state;
  const selected = selectedNodeOfType(state, name);
  if (selected) {
    const $pos = state.doc.resolve(selection.from);
    return { pos: selection.from, start: selection.from + 1, depth: $pos.depth, node: selected };
  }
  return findParentNode((node) => node.type.name === name)(selection);
}

/**
 * What to select after one of the commands below has rewritten the whole
 * `columns` node. A caret goes back where the command means it to go; a
 * wrapper that was node-selected stays node-selected, because the phone's
 * Style sheet is about whatever is selected — dropping a caret into a column
 * would turn the Columns sheet into the Text sheet half-way through setting
 * the widths.
 */
function selectionAfterRewrite(
  before: EditorState,
  tr: Transaction,
  columnsNodePos: number,
  caret: () => Selection
): Selection {
  if (selectedNodeOfType(before, 'columns') && before.selection.from === columnsNodePos) {
    return NodeSelection.create(tr.doc, columnsNodePos);
  }
  return caret();
}

export function goToColumn(editor: Editor, type: 'next' | 'previous') {
  const columnsNode = getClosestNodeByName(editor, 'columns');
  const columnNode = getClosestNodeByName(editor, 'column');
  if (!columnsNode || !columnNode) {
    return false;
  }

  const { state, dispatch } = editor.view;
  // Get the current columns node position and add the columns size
  // to the end of the columns node
  const cols = columnsNode.node;
  let currColumnIndex = 0;
  cols.content.forEach((child, _, index) => {
    if (
      child.eq(columnNode.node) &&
      child?.attrs?.columnId === columnNode.node?.attrs?.columnId
    ) {
      currColumnIndex = index;
    }
  });

  const nextColumnIndex =
    type === 'next' ? currColumnIndex + 1 : currColumnIndex - 1;
  // if the next column index is out of bounds, return
  if (nextColumnIndex < 0 || nextColumnIndex >= cols.childCount) {
    return false;
  }

  let nextColumnPos = columnsNode.pos;
  cols.content.forEach((child, _, index) => {
    if (index < nextColumnIndex) {
      nextColumnPos += child.nodeSize;
    }
  });

  const tr = state.tr.setTime(Date.now());
  const textSelection = TextSelection.near(tr.doc.resolve(nextColumnPos));
  tr.setSelection(textSelection);

  dispatch(tr);
  return true;
}

/**
 * One attribute on one column, rather than a rebuilt `columns` node. A width
 * is typed a digit at a time and each digit is a transaction, and replacing
 * the whole node reads as "the block this was opened on is gone" to anything
 * following it — which closed the phone's Style sheet on the first keystroke.
 * Nothing else moves either: no selection to restore, no content recreated.
 */
export function updateColumnWidth(
  editor: Editor,
  index: number,
  width: string = 'auto'
) {
  const { node: columnsNode, pos: columnsNodePos = 0 } =
    getClosestNodeByName(editor, 'columns') || {};
  if (!columnsNode || index < 0 || index >= columnsNode.childCount) {
    return false;
  }

  let columnPos = columnsNodePos + 1;
  for (let i = 0; i < index; i++) {
    columnPos += columnsNode.child(i).nodeSize;
  }

  const { state, dispatch } = editor.view;
  dispatch(state.tr.setNodeAttribute(columnPos, 'width', width));
  return true;
}

export function addColumnByIndex(editor: Editor, index: number = -1) {
  const { node: columnsNode, pos: columnsNodePos = 0 } =
    getClosestNodeByName(editor, 'columns') || {};
  if (!columnsNode) {
    return false;
  }

  // If the index is out of bounds, append the column to the end
  // of the columns node
  const columnIndex = index < 0 ? columnsNode.childCount : index;
  // Keep the original width of the columns
  // and set the new column width to auto
  const { state } = editor.view;
  const newColumn = state.schema.nodes.column.create(
    {
      width: DEFAULT_COLUMN_WIDTH,
      columnId: uuidv4(),
    },
    state.schema.nodes.paragraph.create(null)
  );

  // append the new column to the columns node
  // at the specified index
  const updatedContent: Node[] = [];
  columnsNode.content.forEach((child, _, i) => {
    updatedContent.push(child);
    if (i === columnIndex) {
      updatedContent.push(newColumn);
    }
  });

  if (index === -1) {
    updatedContent.push(newColumn);
  }

  const updatedColumnsNode = columnsNode.copy(Fragment.from(updatedContent));
  const transaction = state.tr.replaceWith(
    columnsNodePos,
    columnsNodePos + columnsNode.nodeSize,
    updatedColumnsNode
  );

  // Set the selection to the new column
  // if the index is out of bounds, set the selection
  // to the last column
  const newColumnPos =
    columnsNodePos +
    updatedContent
      .slice(0, columnIndex)
      .reduce((acc, node) => acc + node.nodeSize, 0);

  transaction.setSelection(
    selectionAfterRewrite(state, transaction, columnsNodePos, () =>
      TextSelection.near(transaction.doc.resolve(newColumnPos))
    )
  );

  editor.view.dispatch(transaction);
  return true;
}

export function removeColumnByIndex(editor: Editor, index: number = -1) {
  const { node: columnsNode, pos: columnsNodePos = 0 } =
    getClosestNodeByName(editor, 'columns') || {};
  if (!columnsNode) {
    return false;
  }

  const { state, dispatch } = editor.view;
  const { tr } = state;

  const updatedContent: Node[] = [];
  columnsNode.content.forEach((child, _, i) => {
    if (i !== index) {
      updatedContent.push(child);
    }
  });

  if (index === -1) {
    updatedContent.pop();
  }

  const updatedColumnsNode = columnsNode.copy(Fragment.from(updatedContent));
  const transaction = tr.replaceWith(
    columnsNodePos,
    columnsNodePos + columnsNode.nodeSize,
    updatedColumnsNode
  );

  // Set the selection to the next column
  // if the index is out of bounds, set the selection
  // to the last column
  const nextColumnIndex =
    index === columnsNode.childCount - 1 ? index - 1 : index;
  const nextColumnPos =
    columnsNodePos +
    updatedContent
      .slice(0, nextColumnIndex)
      .reduce((acc, node) => acc + node.nodeSize, 0);

  transaction.setSelection(
    selectionAfterRewrite(state, transaction, columnsNodePos, () =>
      TextSelection.near(transaction.doc.resolve(nextColumnPos))
    )
  );

  dispatch(transaction);
  return true;
}

export function getColumnWidths(editor: Editor): {
  id: string;
  width: string;
}[] {
  const { node: columnsNode } =
    getClosestNodeByName(editor, 'columns') || {};
  if (!columnsNode) {
    return [];
  }

  const columnsWidth: { id: string; width: string }[] = [];
  columnsNode.content.forEach((child) => {
    const { columnId, width } = child.attrs;
    columnsWidth.push({ id: columnId, width });
  });

  return columnsWidth;
}
