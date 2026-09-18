import { getSchema } from '@tiptap/core';
// The editor's schema is the other half of this file's subject: a block the
// canvas can build and the engine has no case for is a template that cannot be
// previewed, preflighted, published or sent. Reaching across the workspace is
// what lets the schema decide what has to be covered here, rather than a list
// somebody remembered to extend.
import '../../../client/core/editor/test/dom';
import { extensions } from '../../../client/core/editor/extensions';
import { Engine, render } from './index';

/**
 * One case per block the editor can insert. The assertion is deliberately
 * shallow — this catches a block that throws or silently renders nothing,
 * which is the failure that actually ships. Attribute-level behaviour belongs
 * with the feature that owns the attribute.
 */
const doc = (...content: unknown[]) => ({ type: 'doc', content });
const para = (text: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});

const CASES: { name: string; node: unknown; expect: RegExp }[] = [
  {
    name: 'image',
    node: { type: 'image', attrs: { src: 'https://x.dev/a.png', alt: 'A picture' } },
    expect: /<img[^>]+src="https:\/\/x\.dev\/a\.png"/,
  },
  {
    name: 'logo',
    node: { type: 'logo', attrs: { src: 'https://x.dev/logo.png', alt: 'logo', size: 'md' } },
    expect: /<img[^>]+src="https:\/\/x\.dev\/logo\.png"/,
  },
  {
    name: 'inlineImage',
    node: {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'before ' },
        { type: 'inlineImage', attrs: { src: 'https://x.dev/i.png', height: 20, width: 20 } },
      ],
    },
    expect: /<img[^>]+src="https:\/\/x\.dev\/i\.png"/,
  },
  {
    name: 'columns',
    node: {
      type: 'columns',
      attrs: { gap: 8 },
      content: [
        { type: 'column', attrs: { width: 'auto' }, content: [para('Left cell')] },
        { type: 'column', attrs: { width: 'auto' }, content: [para('Right cell')] },
      ],
    },
    // The gap is proof the columns wrapper ran: without it the cells would
    // still print their text and the case would pass on nothing.
    expect: /padding-right:4px[\s\S]*Left cell[\s\S]*Right cell/,
  },
  {
    name: 'section',
    node: {
      type: 'section',
      attrs: { backgroundColor: '#EEF0FE', paddingTop: 24 },
      content: [para('Inside a section')],
    },
    // Same reasoning as columns: assert the section's own styling, not just
    // the paragraph it happens to contain.
    expect: /background-color:#EEF0FE;[\s\S]*padding-top:24px[\s\S]*Inside a section/,
  },
  {
    name: 'spacer',
    node: { type: 'spacer', attrs: { height: 64 } },
    expect: /height:64px/,
  },
  {
    name: 'htmlCodeBlock',
    node: {
      type: 'htmlCodeBlock',
      attrs: { language: 'html' },
      content: [{ type: 'text', text: '<p id="raw">Raw markup</p>' }],
    },
    expect: /id="raw"/,
  },
  {
    name: 'blockquote',
    node: { type: 'blockquote', content: [para('Quoted line')] },
    expect: /<blockquote[\s\S]*Quoted line/,
  },
  {
    name: 'bulletList',
    node: {
      type: 'bulletList',
      content: [{ type: 'listItem', content: [para('First bullet')] }],
    },
    expect: /<ul[\s\S]*First bullet/,
  },
  {
    name: 'orderedList',
    node: {
      type: 'orderedList',
      content: [{ type: 'listItem', content: [para('First number')] }],
    },
    expect: /<ol[\s\S]*First number/,
  },
  {
    name: 'linkCard',
    node: {
      type: 'linkCard',
      attrs: {
        title: 'Card title',
        description: 'Card description',
        link: 'https://x.dev',
        badgeText: '',
      },
    },
    expect: /Card title/,
  },
  {
    name: 'hardBreak',
    node: {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'above' },
        { type: 'hardBreak' },
        { type: 'text', text: 'below' },
      ],
    },
    expect: /above[\s\S]*<br[\s\S]*below/,
  },
  {
    name: 'heading',
    node: { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'A heading' }] },
    expect: /<h2[\s\S]*A heading/,
  },
  {
    name: 'footer',
    node: { type: 'footer', content: [{ type: 'text', text: 'Unsubscribe' }] },
    expect: /Unsubscribe/,
  },
  {
    name: 'horizontalRule',
    node: { type: 'horizontalRule' },
    expect: /<hr/,
  },
  {
    name: 'button',
    node: {
      type: 'button',
      attrs: { text: 'Press me', url: 'https://x.dev/go', alignment: 'left', variant: 'filled' },
    },
    expect: /<a[^>]+href="https:\/\/x\.dev\/go"[\s\S]*Press me/,
  },
  {
    name: 'repeat',
    node: { type: 'repeat', attrs: { each: 'items' }, content: [para('Repeated line')] },
    expect: /Repeated line/,
  },
  {
    name: 'variable',
    node: {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Hi ' },
        { type: 'variable', attrs: { id: 'firstName', fallback: 'there' } },
      ],
    },
    expect: /Hi [\s\S]*\{\{firstName,fallback=there\}\}/,
  },
  {
    name: 'marks',
    node: {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
        { type: 'text', text: 'underline', marks: [{ type: 'underline' }] },
        { type: 'text', text: 'strike', marks: [{ type: 'strike' }] },
        { type: 'text', text: 'code', marks: [{ type: 'code' }] },
        { type: 'text', text: 'tinted', marks: [{ type: 'textStyle', attrs: { color: '#AA0000' } }] },
        { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://x.dev' } }] },
      ],
    },
    // Every mark wraps the text it was given, so each one names itself in the
    // output it produced rather than in the fixture that asked for it.
    expect:
      /<strong>bold<\/strong>[\s\S]*<em>italic<\/em>[\s\S]*<u>underline<\/u>[\s\S]*<s[^>]*>strike<\/s>[\s\S]*<code[\s\S]*>code<\/code>[\s\S]*#AA0000[\s\S]*tinted[\s\S]*<a[^>]+href="https:\/\/x\.dev"[\s\S]*link/,
  },
];

/** Every node and mark type a fixture actually holds, read off the fixture. */
function typesIn(node: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    for (const child of node) typesIn(child, found);
    return found;
  }
  if (!node || typeof node !== 'object') return found;
  const { type, content, marks } = node as Record<string, unknown>;
  if (typeof type === 'string') found.add(type);
  typesIn(content, found);
  typesIn(marks, found);
  return found;
}

/**
 * Every node and mark the editor can put in a document, asked of the schema
 * rather than listed by hand. A hand-written list is why this file rendered
 * fourteen of the editor's blocks and called that all of them: `codeBlock` was
 * registered, insertable and unrenderable, and nothing here could see it.
 *
 * `doc` is the one name with no case to answer for — the engine walks the
 * document's children and never renders the document itself.
 */
function schemaTypes(): string[] {
  const schema = getSchema(extensions({}));
  return [...Object.keys(schema.nodes), ...Object.keys(schema.marks)]
    .filter((name) => name !== 'doc')
    .sort();
}

describe('spacer height', () => {
  const spacer = (height: unknown) => doc({ type: 'spacer', attrs: { height } });

  it('uses a numeric height as pixels', async () => {
    expect(await render(spacer(32) as any)).toContain('height:32px');
  });

  it('understands the size names the toolbar shows', async () => {
    // Templates saved before the slash command was fixed carry `height: "sm"`,
    // which reached the stylesheet as `height: smpx` — invalid, so the spacer
    // collapsed to nothing in the email.
    expect(await render(spacer('sm') as any)).toContain('height:8px');
    expect(await render(spacer('xl') as any)).toContain('height:64px');
  });

  it('falls back to the default rather than emitting invalid CSS', async () => {
    const html = await render(spacer('nonsense') as any);
    expect(html).toContain('height:8px');
    expect(html).not.toContain('nonsensepx');
  });
});

describe('repeat', () => {
  const repeated = doc({
    type: 'repeat',
    attrs: { each: 'items' },
    content: [para('One row')],
  });

  it('shows its contents once when the caller passes no data', async () => {
    // Matching "Show if": with nothing to iterate, an author composing the
    // email must still see what they put inside the block. Previewing used to
    // render the whole repeat as empty space with no explanation.
    const html = await render(repeated as any);
    expect(html).toContain('One row');
  });

  it('repeats once per item when data is supplied', async () => {
    const html = await render(repeated as any, { payload: { items: [{}, {}, {}] } });
    expect(html.match(/One row/g)).toHaveLength(3);
  });

  it('renders nothing when the data says there are no items', async () => {
    const html = await render(repeated as any, { payload: { items: [] } });
    expect(html).not.toContain('One row');
  });

  it('keeps the paragraph gap between items, and drops it only after the last', async () => {
    // Each item used to lose its last block's bottom margin, so three items
    // sat flush against each other while the paragraphs inside them kept
    // their gaps — the block read as one item with the wrong rhythm.
    const html = await render(repeated as any, { payload: { items: [{}, {}, {}] } });
    const margins = [...html.matchAll(/<p[^>]*margin-bottom:\s*(\d+)px[^>]*>One row/g)].map((m) => Number(m[1]));
    expect(margins).toEqual([20, 20, 0]);
  });
});

describe('node types the schema dropped', () => {
  // The editor renames these on load, but the API renders stored content
  // without the document ever passing through the editor — so a row written
  // before the schema changed reaches this side under its old name. A case
  // here with no node in the schema is the point: the coverage below is
  // one-directional for exactly this reason, and deleting one of these turns
  // an old template into a send that throws.
  it('renders a stored code block as the code block the product kept', async () => {
    const html = await render(
      doc({
        type: 'codeBlock',
        attrs: { language: 'html' },
        content: [{ type: 'text', text: '<b>hi</b>' }],
      }) as any
    );
    expect(html).toContain('<b>hi</b>');
  });

  it('renders a stored for as a repeat', async () => {
    const html = await render(
      doc({ type: 'for', attrs: { each: 'items' }, content: [para('One row')] }) as any,
      { payload: { items: [{}, {}] } }
    );
    expect(html.match(/One row/g)).toHaveLength(2);
  });
});

describe('every insertable block renders', () => {
  it('has a case in the engine for everything the schema admits', () => {
    const engine = new Engine({ type: 'doc' });
    // `renderNode` and `renderMark` both dispatch on `type in this` and throw
    // on anything else, so this asks the engine its own question — once, here,
    // instead of one customer at a time at the moment they press send.
    expect(schemaTypes().filter((name) => !(name in engine))).toEqual([]);
  });

  it('has a fixture below for everything the schema admits', () => {
    const covered = typesIn(CASES.map((testCase) => testCase.node));
    expect(schemaTypes().filter((name) => !covered.has(name))).toEqual([]);
    // And the other direction: a fixture naming a type the schema dropped
    // renders something no customer can build, and would go on passing.
    expect([...covered].filter((name) => !schemaTypes().includes(name)).sort()).toEqual([]);
  });

  for (const testCase of CASES) {
    it(`renders ${testCase.name}`, async () => {
      const html = await render(doc(testCase.node) as any);
      expect(html).toMatch(testCase.expect);
    });
  }
});
