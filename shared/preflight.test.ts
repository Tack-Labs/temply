import { describe, expect, it } from 'bun:test';
import {
  assessSize,
  checkFields,
  collectContentFindings,
  unresolvedVariables,
} from './preflight';

const doc = (...content: unknown[]) => ({ type: 'doc', content });

const paragraph = (...content: unknown[]) => ({ type: 'paragraph', content });

const linkedText = (text: string, href: string, isUrlVariable = false) => ({
  type: 'text',
  text,
  marks: [{ type: 'link', attrs: { href, isUrlVariable } }],
});

const button = (url: string, over: Record<string, unknown> = {}) => ({
  type: 'button',
  attrs: { text: 'Click', url, isUrlVariable: false, ...over },
});

const image = (attrs: Record<string, unknown>) => ({ type: 'image', attrs });

describe('checkFields', () => {
  it('flags an empty subject as an error', () => {
    const issues = checkFields('', 'peek');
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].id).toBe('subject-empty');
  });

  it('flags empty preview text as a warning only', () => {
    const issues = checkFields('Hello', '  ');
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warn');
    expect(issues[0].id).toBe('preview-text-empty');
  });

  it('is silent when both are filled', () => {
    expect(checkFields('Hello', 'peek')).toHaveLength(0);
  });
});

describe('collectContentFindings — links', () => {
  it('flags a button with an empty URL', () => {
    const issues = collectContentFindings(doc(button('')));
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('button');
  });

  it("flags a '#' link mark", () => {
    const issues = collectContentFindings(doc(paragraph(linkedText('here', '#'))));
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].detail).toBe('here');
  });

  it('accepts mailto: and tel: destinations', () => {
    const issues = collectContentFindings(
      doc(
        paragraph(linkedText('write us', 'mailto:hi@example.com')),
        paragraph(linkedText('call us', 'tel:+15551234')),
      ),
    );
    expect(issues).toHaveLength(0);
  });

  it('exempts variable URLs everywhere', () => {
    const issues = collectContentFindings(
      doc(
        paragraph(linkedText('go', 'orderUrl', true)),
        button('orderUrl', { isUrlVariable: true }),
      ),
    );
    expect(issues).toHaveLength(0);
  });

  it("rejects a protocol-only 'https://' — the URL constructor throws on it", () => {
    const issues = collectContentFindings(doc(button('https://')));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('https://');
  });

  it('accepts a full URL', () => {
    const issues = collectContentFindings(
      doc(paragraph(linkedText('docs', 'https://example.com/docs')), button('https://example.com')),
    );
    expect(issues).toHaveLength(0);
  });

  it('reports one issue for a link mark split across styled text runs', () => {
    const issues = collectContentFindings(
      doc(paragraph(linkedText('bold half', '#'), linkedText('plain half', '#'))),
    );
    expect(issues).toHaveLength(1);
  });

  it('reports separate anchors separately, even with the same bad href', () => {
    const issues = collectContentFindings(
      doc(
        paragraph(
          linkedText('first', '#'),
          { type: 'text', text: ' and then ' },
          linkedText('second', '#'),
        ),
        paragraph(linkedText('third', '#')),
      ),
    );
    expect(issues).toHaveLength(3);
  });

  it('flags a link card without a URL', () => {
    const issues = collectContentFindings(
      doc({ type: 'linkCard', attrs: { title: 'Read more', link: '' } }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('link card');
  });

  it('flags an invalid image external link but not an absent one', () => {
    const plain = collectContentFindings(
      doc(image({ alt: 'Cat', title: '', externalLink: '' })),
    );
    expect(plain).toHaveLength(0);

    const invalid = collectContentFindings(
      doc(image({ alt: 'Cat', title: '', externalLink: 'not a url' })),
    );
    expect(invalid).toHaveLength(1);
    expect(invalid[0].severity).toBe('error');
  });
});

describe('collectContentFindings — images', () => {
  it('passes an image with a title but no alt — the renderer falls back to it', () => {
    const issues = collectContentFindings(doc(image({ alt: '', title: 'The chart' })));
    expect(issues).toHaveLength(0);
  });

  it('fails an inline image with neither alt nor title', () => {
    const issues = collectContentFindings(
      doc(paragraph({ type: 'inlineImage', attrs: { alt: '', title: '' } })),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warn');
    expect(issues[0].message).toContain('alt text');
  });

  it('does not ask the logo node for alt text', () => {
    const issues = collectContentFindings(doc({ type: 'logo', attrs: { alt: '', title: '' } }));
    expect(issues).toHaveLength(0);
  });
});

describe('collectContentFindings — positions', () => {
  it('reports a link finding at its paragraph, not at the text run', () => {
    // A NodeSelection over an inline text run highlights nothing and leaves
    // the block actions operating inside the paragraph, so the paragraph is
    // the position the Checks sheet has to jump to.
    const issues = collectContentFindings(doc(paragraph(linkedText('here', '#'))));
    expect(issues[0].pos).toBe(0);
  });

  it('walks past every leaf type with the right footprint', () => {
    // LEAF_NODE_TYPES is a hand-kept list — the JSON walked here carries no
    // schema to ask — and a name missing from it sizes that node 2 instead
    // of 1, shifting every position after it. This document holds one of
    // each, so the expected positions below are what keeps the list honest.
    const issues = collectContentFindings(
      doc(
        paragraph(linkedText('one', '#')), //           0, size 5
        { type: 'spacer', attrs: {} }, //               5
        { type: 'horizontalRule' }, //                  6
        { type: 'logo', attrs: { alt: 'Us' } }, //      7
        button(''), //                                  8
        { type: 'linkCard', attrs: { link: '' } }, //   9
        image({ alt: '', title: '' }), //              10
        paragraph(
          //                                           11, size 5
          { type: 'variable', attrs: { id: 'name' } },
          { type: 'hardBreak' },
          { type: 'inlineImage', attrs: { alt: '', title: '' } },
        ),
      ),
    );

    expect(issues.map((issue) => [issue.id, issue.pos])).toEqual([
      ['link-0', 0],
      ['button-1', 8],
      ['link-card-2', 9],
      ['image-alt-3', 10],
      // The inline image reports its paragraph, the block a tap can select.
      ['image-alt-4', 11],
    ]);
  });
});

describe('unresolvedVariables', () => {
  const keys = { conditions: [], variables: ['firstName', 'orderUrl'], placeholders: {}, where: {}, urlVariables: [], lists: [], inList: {} };

  it('is quiet about a pill that carries a placeholder', () => {
    const withPlaceholder = { conditions: [], variables: ['firstName', 'orderUrl'], placeholders: { firstName: 'there' }, where: {}, urlVariables: [], lists: [], inList: {} };
    expect(unresolvedVariables(withPlaceholder, {})).toEqual(['orderUrl']);
  });

  it('reports keys whose value is missing or empty', () => {
    expect(unresolvedVariables(keys, {})).toEqual(['firstName', 'orderUrl']);
    expect(unresolvedVariables(keys, { firstName: '' })).toEqual(['firstName', 'orderUrl']);
  });

  it('drops keys once a value is typed', () => {
    expect(unresolvedVariables(keys, { firstName: 'Ada' })).toEqual(['orderUrl']);
    expect(unresolvedVariables(keys, { firstName: 'Ada', orderUrl: 'https://x.com' })).toEqual([]);
  });
});

describe('assessSize', () => {
  it('stays silent under the warn mark', () => {
    expect(assessSize(89 * 1024)).toBeNull();
  });

  it('warns between the warn mark and the clip mark', () => {
    const issue = assessSize(95 * 1024);
    expect(issue?.severity).toBe('warn');
    expect(issue?.message).toContain('approaching');
    expect(issue?.message).toContain('95 KB');
  });

  it('errors past the clip mark', () => {
    const issue = assessSize(103 * 1024);
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('102 KB');
  });
});
