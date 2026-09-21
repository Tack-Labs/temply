import { describe, expect, it } from 'bun:test';
import '../../test/dom';
import { makeEditor } from '../../test/make-editor';
import { selectBlockAt, selectedBlock } from '../../commands/block';

const doc = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] },
    { type: 'button', attrs: { text: 'Go', url: 'https://a.test', variant: 'filled', alignment: 'left' } },
  ],
};

// `updateButton` writes against a NodeSelection of the button — the whole
// block selected, not a caret inside the node view — rather than through
// the node view's own updateAttributes. This is the path it relies on.
describe('button menu writes', () => {
  it('updates the selected button node through the button command', () => {
    const editor = makeEditor(doc);
    selectBlockAt(editor, 4); // after "Hi" paragraph (size 4)
    expect(selectedBlock(editor)!.node.type.name).toBe('button');
    editor.chain().updateButton({ variant: 'outline', alignment: 'center', url: 'https://b.test', isUrlVariable: false }).run();
    const attrs = selectedBlock(editor)!.node.attrs;
    expect(attrs.variant).toBe('outline');
    expect(attrs.alignment).toBe('center');
    expect(attrs.url).toBe('https://b.test');
    expect(editor.getJSON().content![0]!.type).toBe('paragraph');
    editor.destroy();
  });
});
