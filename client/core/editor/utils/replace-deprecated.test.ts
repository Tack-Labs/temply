import { describe, expect, it } from 'bun:test';
import '../test/dom';
import { makeEditor } from '../test/make-editor';
import { replaceDeprecatedNode } from './replace-deprecated';

/**
 * The document shape a template saved before the schema changed still has in
 * the database, mounted the way the canvas mounts one: through
 * `replaceDeprecatedNode` first (`client/core/editor/index.tsx`).
 *
 * The assertion is the surrounding text, not the renamed node. tiptap does not
 * drop a node it cannot parse and does not throw on one —
 * `createNodeFromContent` falls back to an empty document, so an unmigrated
 * rename costs the customer the whole template, and the first keystroke after
 * that writes the blank back over the stored row.
 */
const stored = (
  type: string,
  attrs: Record<string, unknown>,
  content: unknown[]
) => ({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'before' }] },
    { type, attrs, content },
    { type: 'paragraph', content: [{ type: 'text', text: 'after' }] },
  ],
});

const text = (value: string) => [{ type: 'text', text: value }];

const mount = (json: ReturnType<typeof stored>) => {
  const editor = makeEditor(replaceDeprecatedNode(json) as any);
  const doc = editor.getJSON();
  editor.destroy();
  return doc;
};

describe('replaceDeprecatedNode', () => {
  it('keeps a stored code block, and the document around it', () => {
    const doc = mount(stored('codeBlock', { language: 'html' }, text('<b>hi</b>')));

    expect(doc.content?.map((node) => node.type)).toEqual([
      'paragraph',
      'htmlCodeBlock',
      'paragraph',
    ]);
    expect(JSON.stringify(doc)).toContain('before');
    expect(JSON.stringify(doc)).toContain('after');
    expect(doc.content?.[1]?.content?.[0]?.text).toBe('<b>hi</b>');
    // The language survives the rename: it is the one attribute the old node
    // had, and the new one takes it under the same name.
    expect(doc.content?.[1]?.attrs?.language).toBe('html');
  });

  it('keeps a stored repeat, and the document around it', () => {
    const doc = mount(
      stored('for', { each: 'items' }, [
        { type: 'paragraph', content: text('One row') },
      ])
    );

    expect(doc.content?.map((node) => node.type)).toEqual([
      'paragraph',
      'repeat',
      'paragraph',
    ]);
    expect(JSON.stringify(doc)).toContain('before');
    expect(JSON.stringify(doc)).toContain('after');
  });

  it('leaves a document the schema already admits alone', () => {
    const doc = mount(stored('htmlCodeBlock', { language: 'html' }, text('<b>hi</b>')));

    expect(doc.content?.map((node) => node.type)).toEqual([
      'paragraph',
      'htmlCodeBlock',
      'paragraph',
    ]);
  });
});
