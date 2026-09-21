import { describe, expect, it } from 'bun:test';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import '../test/dom';
import { caretFitsAfterLastBlock, makeEditor } from '../test/make-editor';
import { addColumnByIndex, getColumnCount, getColumnWidths, isColumnsSelected, removeColumnByIndex, updateColumnWidth } from './columns';
import { deleteNode } from './delete-node';

const column = (columnId: string, text: string) => ({
  type: 'column',
  attrs: { columnId, width: 'auto' },
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
const doc = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'above' }] },
    { type: 'columns', content: [column('a', 'left'), column('b', 'right')] },
  ],
};
/** Where the `columns` node starts: after the paragraph "above". */
const columnsPos = 7;
const kinds = (editor: ReturnType<typeof makeEditor>) => editor.state.doc.children.map((node) => node.type.name);
/** A caret inside the first column — the only way a mouse ever reaches these
 *  controls, and the path every assertion here has to leave alone. */
const withCaret = () => {
  const editor = makeEditor(doc);
  editor.commands.setTextSelection(10);
  expect(editor.isActive('column')).toBe(true);
  return editor;
};
/** What a tap on a Columns block leaves: the wrapper itself node-selected,
 *  with no caret anywhere inside it. */
const withColumnsSelected = () => {
  const editor = makeEditor(doc);
  editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, columnsPos)));
  expect(editor.isActive('column')).toBe(false);
  return editor;
};

describe('deleteNode', () => {
  it('deletes the node the caret is inside', () => {
    const editor = withCaret();
    deleteNode(editor, 'columns');
    expect(kinds(editor)).toEqual(['paragraph']);
    editor.destroy();
  });

  it('deletes a node that is the selection rather than an ancestor of it', () => {
    const editor = withColumnsSelected();
    deleteNode(editor, 'columns');
    expect(kinds(editor)).toEqual(['paragraph']);
    editor.destroy();
  });

  it('does nothing when neither the selection nor an ancestor is that type', () => {
    const editor = makeEditor(doc);
    editor.commands.setTextSelection(2); // in "above"
    deleteNode(editor, 'columns');
    expect(kinds(editor)).toEqual(['paragraph', 'columns']);
    expect(caretFitsAfterLastBlock(editor)).toBe(true);
    editor.destroy();
  });
});

describe('the columns controls from a selected columns node', () => {
  it('reads the count and the widths the width config draws', () => {
    const editor = withColumnsSelected();
    expect(isColumnsSelected(editor)).toBe(true);
    expect(getColumnCount(editor)).toBe(2);
    expect(getColumnWidths(editor).map((c) => c.width)).toEqual(['auto', 'auto']);
    editor.destroy();
  });

  it('is not claimed by a caret inside a column, which is active in its own right', () => {
    const editor = withCaret();
    expect(isColumnsSelected(editor)).toBe(false);
    editor.destroy();
  });

  it('writes a column width and keeps the sheet on the same block', () => {
    const editor = withColumnsSelected();
    expect(updateColumnWidth(editor, 0, '40')).toBe(true);
    expect(getColumnWidths(editor).map((c) => c.width)).toEqual(['40', 'auto']);
    // The Style sheet follows the selection: a caret dropped into a column
    // would turn the Columns sheet into the Text sheet mid-edit.
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect((editor.state.selection as NodeSelection).node.type.name).toBe('columns');
    editor.destroy();
  });

  it('writes a width without replacing the columns node', () => {
    // The Style sheet follows a position inside the block it was opened on
    // and closes when the document says that content is gone. A width is
    // typed a digit at a time, so a rebuilt `columns` node closed the sheet
    // on the first keystroke.
    const editor = withColumnsSelected();
    const deleted: boolean[] = [];
    editor.on('transaction', ({ transaction }) => {
      if (transaction.docChanged) deleted.push(transaction.mapping.mapResult(columnsPos + 1).deleted);
    });
    updateColumnWidth(editor, 0, '40');
    expect(deleted).toEqual([false]);
    editor.destroy();
  });

  it('adds and removes a column and keeps the sheet on the same block', () => {
    const editor = withColumnsSelected();
    expect(addColumnByIndex(editor)).toBe(true);
    expect(getColumnCount(editor)).toBe(3);
    expect((editor.state.selection as NodeSelection).node?.type.name).toBe('columns');
    expect(removeColumnByIndex(editor)).toBe(true);
    expect(getColumnCount(editor)).toBe(2);
    expect((editor.state.selection as NodeSelection).node?.type.name).toBe('columns');
    editor.destroy();
  });
});

describe('vertical alignment', () => {
  // The columns node is the second top-level child in `doc`, so its children
  // are the two columns' current `verticalAlign`.
  const verticalAligns = (editor: ReturnType<typeof makeEditor>) => editor.state.doc.child(1).content.content.map((c) => c.attrs.verticalAlign);

  it('from a selected columns node sets every column, not the one `updateAttributes` would silently land on', () => {
    const editor = withColumnsSelected();
    expect(editor.commands.updateColumn({ verticalAlign: 'middle' })).toBe(true);
    expect(verticalAligns(editor)).toEqual(['middle', 'middle']);
    editor.destroy();
  });

  it('from a caret (desktop) still sets only the column the caret is in', () => {
    const editor = withCaret();
    expect(editor.commands.updateColumn({ verticalAlign: 'middle' })).toBe(true);
    expect(verticalAligns(editor)).toEqual(['middle', 'top']);
    editor.destroy();
  });
});

describe('the columns controls from a caret (desktop)', () => {
  it('still reads the count and the widths', () => {
    const editor = withCaret();
    expect(getColumnCount(editor)).toBe(2);
    expect(getColumnWidths(editor).map((c) => c.width)).toEqual(['auto', 'auto']);
    editor.destroy();
  });

  it('still writes a width and leaves the caret in the document', () => {
    const editor = withCaret();
    expect(updateColumnWidth(editor, 1, '30')).toBe(true);
    expect(getColumnWidths(editor).map((c) => c.width)).toEqual(['auto', '30']);
    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    editor.destroy();
  });

  it('still adds and removes a column, moving the caret into one', () => {
    const editor = withCaret();
    expect(addColumnByIndex(editor)).toBe(true);
    expect(getColumnCount(editor)).toBe(3);
    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    expect(removeColumnByIndex(editor)).toBe(true);
    expect(getColumnCount(editor)).toBe(2);
    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    editor.destroy();
  });
});
