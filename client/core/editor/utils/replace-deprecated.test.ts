import { describe, expect, it } from 'bun:test';
import '../test/dom';
import { makeEditor } from '../test/make-editor';
import { storedDocument } from './replace-deprecated';

/**
 * The document shape a template saved before the schema changed still has in
 * the database, put on a canvas through the door the app uses.
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
  const editor = makeEditor(storedDocument(json) as any);
  const doc = editor.getJSON();
  editor.destroy();
  return doc;
};

describe('the migration a stored document gets', () => {
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

describe('storedDocument', () => {
  /**
   * The row as the server hands it back — `content` is a JSON string — put on
   * a live editor the way History → Restore and Discard draft put one:
   * `setContent` on an editor that is already mounted. That path used to parse
   * for itself, so it blanked the canvas on every document a schema change had
   * left behind, and the autosave that follows a restore wrote the blank back.
   */
  const restore = (content: string) => {
    const editor = makeEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: text('what was on screen') }],
    });
    editor.commands.setContent(storedDocument(content));
    const doc = editor.getJSON();
    editor.destroy();
    return doc;
  };

  it('puts a restored row on the canvas whole, whatever its age', () => {
    const doc = restore(
      JSON.stringify({
        type: 'doc',
        content: [
          { type: 'paragraph', content: text('before') },
          { type: 'codeBlock', attrs: { language: 'html' }, content: text('<b>hi</b>') },
          { type: 'spacer', attrs: { height: 'lg' } },
          { type: 'for', attrs: { each: 'items' }, content: [{ type: 'paragraph', content: text('One row') }] },
          { type: 'paragraph', content: text('after') },
        ],
      })
    );

    expect(doc.content?.map((node) => node.type)).toEqual([
      'paragraph',
      'htmlCodeBlock',
      'spacer',
      'repeat',
      'paragraph',
    ]);
    expect(JSON.stringify(doc)).toContain('before');
    expect(JSON.stringify(doc)).toContain('after');
    // The spacer shorthand is the quiet one of the three: nothing blanks, the
    // height simply reaches the stylesheet as `lgpx` and the gap collapses.
    expect(doc.content?.[2]?.attrs?.height).toBe(32);
  });

  it('takes a document as readily as a row', () => {
    const doc = storedDocument({
      type: 'doc',
      content: [{ type: 'codeBlock', attrs: { language: 'html' }, content: text('<b>hi</b>') }],
    });
    expect(doc.content?.[0]?.type).toBe('htmlCodeBlock');
  });

  it('leaves the caller\'s own object alone', () => {
    // The migration rewrites in place, and what reaches this door includes
    // React state and an imported JSON module the rest of the app reads.
    const original = {
      type: 'doc',
      content: [{ type: 'spacer', attrs: { height: 'lg' } }],
    };
    storedDocument(original);
    expect(original.content[0].attrs.height).toBe('lg');
  });

  it('wraps a bare list of blocks in a document', () => {
    const doc = storedDocument([{ type: 'paragraph', content: text('loose') }] as never);
    expect(doc.type).toBe('doc');
    expect(JSON.stringify(doc)).toContain('loose');
  });

  it('throws on a corrupt row rather than handing back a blank one', () => {
    // A restore catches this and keeps what is on screen. Returning an empty
    // document instead would blank the canvas for the one reason the customer
    // can do nothing about.
    expect(() => storedDocument('{ not json')).toThrow();
  });
});

/**
 * `storedDocument` being the only door is a property of the whole client, not
 * of this file, and until now it held by convention — a reviewer read every
 * call site once and found one that had drifted. A second parse anywhere is a
 * second migration policy, and the one that forgets is the one that blanks a
 * customer's template, so the rule is read off the source instead of
 * remembered.
 */
describe('the one door', () => {
  const ROOT = Bun.fileURLToPath(new URL('../../../', import.meta.url));
  /** Its own parse is the row's; everything else has to come through it. */
  const DOOR = 'core/editor/utils/replace-deprecated.ts';

  async function parsesOfARow() {
    const glob = new Bun.Glob('**/*.{ts,tsx}');
    const hits: string[] = [];
    let scanned = 0;

    for await (const relative of glob.scan({ cwd: ROOT, dot: false })) {
      if (relative.includes('node_modules') || relative.startsWith('.next/')) {
        continue;
      }
      scanned += 1;
      const source = await Bun.file(ROOT + relative).text();
      // The argument, not the call: `JSON.parse(raw)` where `raw` is a theme
      // column is none of this rule's business, and a row is always named for
      // what it is — `content`, `previewVersion.content`, `rawContent`.
      for (const [, argument] of source.matchAll(/JSON\.parse\(([^()]*)\)/g)) {
        if (/content/i.test(argument)) hits.push(relative);
      }
    }

    return { hits, scanned };
  }

  it('is the only place a stored row is parsed', async () => {
    const { hits, scanned } = await parsesOfARow();

    expect(hits.filter((file) => file !== DOOR).sort()).toEqual([]);
    // A regex that has stopped matching passes the assertion above on an
    // empty result, so both halves of the scan have to be finding something:
    // the client is a few hundred files, and the door parses a row.
    expect(scanned).toBeGreaterThan(200);
    expect(hits).toContain(DOOR);
  });
});
