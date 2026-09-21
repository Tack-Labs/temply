import { describe, expect, it } from 'bun:test';
import { NodeSelection } from '@tiptap/pm/state';
import '../test/dom';
import { makeEditor } from '../test/make-editor';
import { isTextSelected } from './is-text-selected';

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const doc = {
  type: 'doc',
  content: [para('above'), { type: 'repeat', attrs: { each: 'items' }, content: [para('row')] }],
};
/** Where the `repeat` node starts: after the paragraph "above". */
const repeatPos = 7;

const selectRepeat = () => {
  const editor = makeEditor(doc);
  editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, repeatPos)));
  expect(editor.isActive('repeat')).toBe(true);
  return editor;
};

describe('isTextSelected', () => {
  it('says no to a caret, which selects nothing', () => {
    const editor = makeEditor(doc);
    editor.commands.setTextSelection(3);
    expect(isTextSelected(editor)).toBe(false);
  });

  it('says yes to a run of text a customer dragged over', () => {
    const editor = makeEditor(doc);
    editor.commands.setTextSelection({ from: 1, to: 6 });
    expect(isTextSelected(editor)).toBe(true);
  });

  it('says no to a double-clicked empty paragraph', () => {
    const editor = makeEditor({ type: 'doc', content: [{ type: 'paragraph' }] });
    editor.commands.setTextSelection({ from: 1, to: 1 });
    expect(isTextSelected(editor)).toBe(false);
  });

  it('says yes to select-all, which is not a text selection either', () => {
    // Ctrl+A gives an AllSelection. The formatting menu lives on this answer,
    // so a guard written as "is this a TextSelection" puts it out.
    const editor = makeEditor(doc);
    editor.commands.selectAll();
    expect(isTextSelected(editor)).toBe(true);
  });

  it('says no to a selected block, which is not text', () => {
    // The wrapper menus read this as "the customer is selecting text, stand
    // down". A selected Repeat is the one moment its own menu has to be up.
    expect(isTextSelected(selectRepeat())).toBe(false);
  });

  it('says no in a read-only editor', () => {
    const editor = makeEditor(doc);
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.setEditable(false);
    expect(isTextSelected(editor)).toBe(false);
  });
});
