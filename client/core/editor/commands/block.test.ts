import { describe, expect, it } from 'bun:test';
import { TextSelection } from '@tiptap/pm/state';
import '../test/dom';
import { makeEditor } from '../test/make-editor';
import { blockCommands, canDeleteBlock, clearBlockSelection, deleteBlock, duplicateBlock, enclosingNodes, isInlineAtomSelected, moveBlock, selectBlockAt, selectedBlock } from './block';

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const doc = { type: 'doc', content: [para('one'), para('two'), para('three')] };
const texts = (editor: ReturnType<typeof makeEditor>) => editor.getJSON().content!.map((n) => n.content?.[0]?.text ?? '');
const pill = (id: string) => ({ type: 'variable', attrs: { id } });
/** The inline runs of the paragraph at `index`, pills written as ⟦id⟧ — the
 *  shape a merged pair of text runs shows up in and a text comparison hides. */
const runs = (editor: ReturnType<typeof makeEditor>, index = 0) =>
  editor.state.doc
    .child(index)
    .content.content.map((node) => (node.isText ? node.text : `⟦${node.attrs.id}⟧`))
    .join('|');

describe('block commands', () => {
  it('finds the top-level block around the cursor', () => {
    const editor = makeEditor(doc);
    editor.commands.setTextSelection(8); // inside "two"
    const block = selectedBlock(editor)!;
    expect(block.node.textContent).toBe('two');
    expect(block.depth).toBe(1);
    editor.destroy();
  });

  it('moves a block up and down and keeps it selected', () => {
    const editor = makeEditor(doc);
    editor.commands.setTextSelection(8);
    expect(moveBlock(editor, 'up')).toBe(true);
    expect(texts(editor)).toEqual(['two', 'one', 'three']);
    expect(selectedBlock(editor)!.node.textContent).toBe('two');
    expect(moveBlock(editor, 'down')).toBe(true);
    expect(moveBlock(editor, 'down')).toBe(true);
    expect(texts(editor)).toEqual(['one', 'three', 'two']);
    expect(moveBlock(editor, 'down')).toBe(false); // already last
    editor.destroy();
  });

  it('duplicates below and selects the copy', () => {
    const editor = makeEditor(doc);
    editor.commands.setTextSelection(8);
    expect(duplicateBlock(editor)).toBe(true);
    expect(texts(editor)).toEqual(['one', 'two', 'two', 'three']);
    expect(selectedBlock(editor)!.pos).toBeGreaterThan(5);
    editor.destroy();
  });

  it('deletes the block and selects its neighbour', () => {
    const editor = makeEditor(doc);
    editor.commands.setTextSelection(8);
    expect(deleteBlock(editor)).toBe(true);
    expect(texts(editor)).toEqual(['one', 'three']);
    expect(selectedBlock(editor)!.node.textContent).toBe('three');
    editor.destroy();
  });

  it('selects a block as a node selection by position', () => {
    const editor = makeEditor(doc);
    selectBlockAt(editor, 0);
    expect(editor.state.selection.constructor.name).toBe('NodeSelection');
    expect(selectedBlock(editor)!.node.textContent).toBe('one');
    editor.destroy();
  });

  it('deleting a block whose neighbours are not blocks leaves a caret, not a node selection', () => {
    // What sits behind a deleted node is only a candidate if it is a block:
    // behind a pill is the text run in front of it, which the action bar has
    // no subject for.
    const editor = makeEditor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi ' }, pill('name')] }] });
    selectBlockAt(editor, 4);
    expect(deleteBlock(editor)).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    expect(editor.state.selection.from).toBe(4);
    editor.destroy();
  });

  it('clears a block selection to a caret', () => {
    const editor = makeEditor(doc);
    selectBlockAt(editor, 0);
    expect(editor.state.selection.constructor.name).toBe('NodeSelection');

    clearBlockSelection(editor);

    expect(editor.state.selection.constructor.name).toBe('TextSelection');
    expect(editor.state.selection.empty).toBe(true);
    editor.destroy();
  });
});

describe('a selected inline atom', () => {
  const pillDoc = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi ' }, pill('name'), { type: 'text', text: ' there' }] }],
  };
  const pillPos = 4; // "Hi " is three characters, so the pill starts here

  it('is told apart from a block, so the bar can leave move and duplicate out', () => {
    // Move up on a pill swapped it with its *sibling inline node* — the text
    // run in front of it — rewriting the paragraph to "⟦name⟧|Hi  there" with
    // the two runs merged. The bar never offers the button now, and this is
    // the flag it decides that from.
    const editor = makeEditor(pillDoc, { touch: true });
    selectBlockAt(editor, pillPos);
    expect(runs(editor)).toBe('Hi |⟦name⟧| there');
    expect(selectedBlock(editor)!.node.type.name).toBe('variable');
    expect(isInlineAtomSelected(editor)).toBe(true);
    editor.destroy();
  });

  it('is not what a selected block reports', () => {
    const editor = makeEditor(doc, { touch: true });
    selectBlockAt(editor, 0);
    expect(isInlineAtomSelected(editor)).toBe(false);
    editor.commands.setTextSelection(2);
    expect(isInlineAtomSelected(editor)).toBe(false);
    editor.destroy();
  });

  it('refuses to move — its siblings are text runs, not blocks, and swapping would rewrite the paragraph', () => {
    const editor = makeEditor(pillDoc, { touch: true });
    selectBlockAt(editor, pillPos);
    const before = runs(editor);
    expect(moveBlock(editor, 'up')).toBe(false);
    expect(runs(editor)).toBe(before);
    expect(moveBlock(editor, 'down')).toBe(false);
    expect(runs(editor)).toBe(before);
    expect(blockCommands.moveUp.isEnabled!(editor)).toBe(false);
    expect(blockCommands.moveDown.isEnabled!(editor)).toBe(false);
    editor.destroy();
  });

  it('deletes to a caret between the words it stood among', () => {
    const editor = makeEditor(pillDoc, { touch: true });
    selectBlockAt(editor, pillPos);
    expect(deleteBlock(editor)).toBe(true);
    expect(runs(editor)).toBe('Hi  there');
    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    expect(editor.state.selection.empty).toBe(true);
    expect(editor.state.selection.from).toBe(pillPos);
    editor.destroy();
  });

  it('deletes to its own paragraph when it started one, not to the top of the email', () => {
    const editor = makeEditor(
      { type: 'doc', content: [para('first'), { type: 'paragraph', content: [pill('name'), { type: 'text', text: ' there' }] }] },
      { touch: true },
    );
    selectBlockAt(editor, 8);
    expect(deleteBlock(editor)).toBe(true);
    expect(runs(editor, 1)).toBe(' there');
    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    expect(editor.state.selection.from).toBe(8);
    editor.destroy();
  });
});

describe('enclosingNodes around a repeat', () => {
  const inRepeat = {
    type: 'doc',
    content: [
      para('before'),
      { type: 'repeat', attrs: { each: 'items' }, content: [para('inside')] },
    ],
  };

  it('finds the repeat around a selected block inside it', () => {
    const editor = makeEditor(inRepeat, { touch: true });
    // The paragraph inside the repeat: doc(0) > para "before" (0..8) > repeat opens at 8, its paragraph at 9.
    selectBlockAt(editor, 9);
    expect(selectedBlock(editor)!.node.textContent).toBe('inside');
    const [found] = enclosingNodes(editor, ['repeat']);
    expect(found?.node.type.name).toBe('repeat');
    expect(found?.pos).toBe(8);
    editor.destroy();
  });

  it('is empty for a block with no such wrapper, and for the wrapper itself', () => {
    const editor = makeEditor(inRepeat, { touch: true });
    selectBlockAt(editor, 0);
    expect(enclosingNodes(editor, ['repeat'])).toEqual([]);
    // The repeat selected as a node is not inside a repeat.
    selectBlockAt(editor, 8);
    expect(selectedBlock(editor)!.node.type.name).toBe('repeat');
    expect(enclosingNodes(editor, ['repeat'])).toEqual([]);
    editor.destroy();
  });
});

describe('deleteBlock inside a wrapper', () => {
  const wrap = (type: string, children: unknown[]) => ({ type, content: children });
  const topLevel = (editor: ReturnType<typeof makeEditor>) => editor.state.doc.content.content.map((n) => n.type.name);

  it('takes the repeat with it when the block was its only one', () => {
    const editor = makeEditor({ type: 'doc', content: [para('a'), wrap('repeat', [{ type: 'paragraph' }]), para('b')] }, { touch: true });
    selectBlockAt(editor, 4); // the sole paragraph inside the repeat
    expect(deleteBlock(editor)).toBe(true);
    expect(topLevel(editor)).toEqual(['paragraph', 'paragraph']);
    expect(selectedBlock(editor)!.node.textContent).toBe('b');
    editor.destroy();
  });

  it('takes only the block when the repeat has another', () => {
    const editor = makeEditor({ type: 'doc', content: [wrap('repeat', [para('x'), para('y')])] }, { touch: true });
    selectBlockAt(editor, 1);
    expect(deleteBlock(editor)).toBe(true);
    expect(topLevel(editor)).toEqual(['repeat']);
    expect(editor.state.doc.firstChild!.childCount).toBe(1);
    expect(editor.state.doc.firstChild!.textContent).toBe('y');
    editor.destroy();
  });

  it('takes the section with it the same way', () => {
    const editor = makeEditor({ type: 'doc', content: [para('a'), wrap('section', [para('x')])] }, { touch: true });
    selectBlockAt(editor, 4);
    expect(deleteBlock(editor)).toBe(true);
    expect(topLevel(editor)).toEqual(['paragraph']);
    editor.destroy();
  });

  it('leaves a column standing: its block is emptied, the columns keep their count', () => {
    const editor = makeEditor(
      { type: 'doc', content: [wrap('columns', [wrap('column', [para('left')]), wrap('column', [para('right')])])] },
      { touch: true },
    );
    selectBlockAt(editor, 2); // "left"
    expect(deleteBlock(editor)).toBe(true);
    expect(topLevel(editor)).toEqual(['columns']);
    expect(editor.state.doc.firstChild!.childCount).toBe(2);
    expect(editor.state.doc.firstChild!.firstChild!.textContent).toBe('');
    editor.destroy();
  });
});

describe('enclosingNodes', () => {
  const wrap = (type: string, children: unknown[], attrs?: Record<string, unknown>) => ({ type, content: children, ...(attrs ? { attrs } : {}) });

  it('lists the wrappers around the selected block from the outside in', () => {
    const editor = makeEditor(
      { type: 'doc', content: [wrap('section', [wrap('columns', [wrap('column', [para('left')]), wrap('column', [para('right')])])])] },
      { touch: true },
    );
    selectBlockAt(editor, 3); // "left": section opens at 0, columns at 1, column at 2, paragraph at 3
    expect(selectedBlock(editor)!.node.textContent).toBe('left');
    expect(enclosingNodes(editor, ['repeat', 'section', 'columns']).map((f) => f.node.type.name)).toEqual(['section', 'columns']);
    editor.destroy();
  });

  it('is empty for a top-level block', () => {
    const editor = makeEditor({ type: 'doc', content: [para('a')] }, { touch: true });
    selectBlockAt(editor, 0);
    expect(enclosingNodes(editor, ['repeat', 'section', 'columns'])).toEqual([]);
    editor.destroy();
  });
});

describe('deleteBlock inside the other wrappers that need a child', () => {
  const wrap = (type: string, children: unknown[], attrs?: Record<string, unknown>) => ({ type, content: children, ...(attrs ? { attrs } : {}) });
  const topLevel = (editor: ReturnType<typeof makeEditor>) => editor.state.doc.content.content.map((n) => n.type.name);
  const item = (text: string) => wrap('listItem', [para(text)]);

  it('takes a list with its only item', () => {
    const editor = makeEditor({ type: 'doc', content: [para('a'), wrap('orderedList', [item('one')]), para('b')] }, { touch: true });
    selectBlockAt(editor, 5); // the paragraph inside the item: list opens at 3, item at 4, paragraph at 5
    expect(selectedBlock(editor)!.node.textContent).toBe('one');
    expect(deleteBlock(editor)).toBe(true);
    expect(topLevel(editor)).toEqual(['paragraph', 'paragraph']);
    editor.destroy();
  });

  it('takes only the item when the list has another', () => {
    const editor = makeEditor({ type: 'doc', content: [wrap('bulletList', [item('one'), item('two')])] }, { touch: true });
    selectBlockAt(editor, 2);
    expect(deleteBlock(editor)).toBe(true);
    expect(topLevel(editor)).toEqual(['bulletList']);
    expect(editor.state.doc.firstChild!.childCount).toBe(1);
    expect(editor.state.doc.firstChild!.textContent).toBe('two');
    editor.destroy();
  });

  it('takes a blockquote with its only block', () => {
    const editor = makeEditor({ type: 'doc', content: [para('a'), wrap('blockquote', [para('quote')])] }, { touch: true });
    selectBlockAt(editor, 4);
    expect(deleteBlock(editor)).toBe(true);
    expect(topLevel(editor)).toEqual(['paragraph']);
    editor.destroy();
  });

  it('takes the columns block when every column is already empty', () => {
    const editor = makeEditor(
      { type: 'doc', content: [para('a'), wrap('columns', [wrap('column', [{ type: 'paragraph' }]), wrap('column', [{ type: 'paragraph' }])])] },
      { touch: true },
    );
    selectBlockAt(editor, 5); // the empty paragraph in the first column
    expect(canDeleteBlock(editor)).toBe(true);
    expect(deleteBlock(editor)).toBe(true);
    expect(topLevel(editor)).toEqual(['paragraph']);
    editor.destroy();
  });

  it('refuses an empty column cell while another column has content, and the bar knows', () => {
    const editor = makeEditor(
      { type: 'doc', content: [wrap('columns', [wrap('column', [{ type: 'paragraph' }]), wrap('column', [para('right')])])] },
      { touch: true },
    );
    selectBlockAt(editor, 2); // the empty paragraph in the first column
    expect(canDeleteBlock(editor)).toBe(false);
    expect(blockCommands.remove.isEnabled(editor)).toBe(false);
    expect(deleteBlock(editor)).toBe(false);
    expect(editor.state.doc.firstChild!.childCount).toBe(2);
    editor.destroy();
  });

  it('empties a column cell that has words, and keeps the columns', () => {
    const editor = makeEditor(
      { type: 'doc', content: [wrap('columns', [wrap('column', [para('left')]), wrap('column', [para('right')])])] },
      { touch: true },
    );
    selectBlockAt(editor, 2);
    expect(canDeleteBlock(editor)).toBe(true);
    expect(deleteBlock(editor)).toBe(true);
    expect(editor.state.doc.firstChild!.childCount).toBe(2);
    expect(editor.state.doc.firstChild!.firstChild!.textContent).toBe('');
    editor.destroy();
  });
});
