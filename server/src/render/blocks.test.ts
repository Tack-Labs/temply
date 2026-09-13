import { render } from './index';

/**
 * One case per block the slash menu can insert. The assertion is deliberately
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
];

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

describe('every insertable block renders', () => {
  for (const testCase of CASES) {
    it(`renders ${testCase.name}`, async () => {
      const html = await render(doc(testCase.node) as any);
      expect(html).toMatch(testCase.expect);
    });
  }
});
