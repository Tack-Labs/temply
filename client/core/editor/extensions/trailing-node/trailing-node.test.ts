import { describe, expect, it } from 'bun:test';
import { TextSelection } from '@tiptap/pm/state';
import type { Node } from '@tiptap/pm/model';
import '../../test/dom';
import { caretFitsAfterLastBlock, makeEditor } from '../../test/make-editor';

/**
 * The shapes a document can end in, asked of the schema rather than listed by
 * hand. A hand-written list is how the blast radius of this extension came out
 * wrong twice: the two code blocks were missing from it, and nobody could see
 * that they were.
 */
function endings(): string[] {
  const editor = makeEditor({ type: 'doc', content: [{ type: 'paragraph' }] });
  const { schema } = editor.state;
  const lead = schema.nodes.paragraph.createAndFill()!;
  const names = Object.keys(schema.nodes).filter((name) => {
    const type = schema.nodes[name];
    if (type.isText || name === 'doc') return false;
    let filled: Node | null = null;
    try {
      filled = type.createAndFill();
    } catch {
      return false;
    }
    if (!filled) return false;
    try {
      schema.nodes.doc.createChecked(null, [lead, filled]);
      return true;
    } catch {
      return false;
    }
  });
  editor.destroy();
  return names;
}

/** A document ending in `name`, after the one transaction that wakes the plugin. */
function settle(name: string) {
  const seed = makeEditor({ type: 'doc', content: [{ type: 'paragraph' }] });
  const { schema } = seed.state;
  const doc = schema.nodes.doc.createChecked(null, [
    schema.nodes.paragraph.createAndFill()!,
    schema.nodes[name].createAndFill()!,
  ]);
  seed.destroy();

  const editor = makeEditor(doc.toJSON());
  const before = editor.state.doc.childCount;
  // The caret can sit in the last block itself when that block is a textblock
  // — a heading, a footer, either code block — which is read before the
  // plugin has had a chance to change the shape underneath it.
  const caretInside = editor.state.doc.lastChild!.isTextblock;
  const gapAfter = caretFitsAfterLastBlock(editor);
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 1)));
  const gained = editor.state.doc.childCount > before;
  editor.destroy();
  return { caretInside, gapAfter, gained };
}

describe('the trailing line', () => {
  it('is kept only where the document leaves the customer nowhere to type', () => {
    const gains = endings().filter((name) => settle(name).gained);
    // Three of the seventeen shapes the schema admits at the top level. Every
    // other ending — a Section, a Button, an Image, either code block — is the
    // document the customer saved, opened unchanged.
    expect(gains.sort()).toEqual(['blockquote', 'bulletList', 'orderedList']);
  });

  it('answers the same question the excluded set is named for', () => {
    for (const name of endings()) {
      const { caretInside, gapAfter, gained } = settle(name);
      expect(
        { ending: name, somewhereToType: caretInside || gapAfter },
        `${name} either already gives the customer somewhere to type or gains a line`
      ).toEqual({ ending: name, somewhereToType: !gained });
    }
  });
});
