import { describe, expect, it } from 'bun:test';
import { LIST_ITEMS_DEFAULT } from '@temply/shared/template-data';
import '../test/dom';
import { makeEditor } from '../test/make-editor';
import { repeatPreviewCount, repeatPreviewKey, setRepeatPreviewCounts } from './repeat-preview';

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const doc = {
  type: 'doc',
  content: [
    para('before'),
    { type: 'repeat', attrs: { each: 'items' }, content: [para('row')] },
    { type: 'repeat', attrs: { each: 'orders' }, content: [para('order')] },
  ],
};

describe('repeat preview counts', () => {
  it('gives every repeat the default count until the sample data says otherwise', () => {
    const editor = makeEditor(doc);
    expect(repeatPreviewCount(editor.state, 'items')).toBe(LIST_ITEMS_DEFAULT);
    expect(repeatPreviewCount(editor.state, 'orders')).toBe(LIST_ITEMS_DEFAULT);
    editor.destroy();
  });

  it('follows the counts the shell sends, key by key, and keeps them across edits', () => {
    const editor = makeEditor(doc);
    setRepeatPreviewCounts(editor, { items: 4, orders: 0 });
    expect(repeatPreviewCount(editor.state, 'items')).toBe(4);
    expect(repeatPreviewCount(editor.state, 'orders')).toBe(0);
    editor.commands.insertContentAt(1, 'x');
    expect(repeatPreviewCount(editor.state, 'items')).toBe(4);
    editor.destroy();
  });

  it('marks each repeat node with its count, so the node view can draw the copies', () => {
    const editor = makeEditor(doc);
    setRepeatPreviewCounts(editor, { items: 3 });
    const decorations = repeatPreviewKey.getState(editor.state)!.decorations.find();
    expect(decorations).toHaveLength(2);
    const attrs = decorations.map((d) => (d.spec as { count: number }).count).sort();
    expect(attrs).toEqual([LIST_ITEMS_DEFAULT, 3].sort());
    editor.destroy();
  });
});
