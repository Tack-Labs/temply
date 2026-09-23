import { render } from './index';

/**
 * "Show if" used to read an empty payload as false, so a template that set a
 * key lost the block from every render the app performs — preview, Copy HTML,
 * and test send all call render() without data. Variables already had the
 * opposite behaviour: no data means pass the placeholder through untouched.
 * These pin the matching rule for blocks.
 */
const doc = (showIfKey: string | null) => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { showIfKey },
      content: [{ type: 'text', text: 'Members only' }],
    },
  ],
});

describe('show if', () => {
  it('shows the block when the caller passes no data at all', async () => {
    const html = await render(doc('isMember'), { plainText: true });
    expect(html).toContain('Members only');
  });

  it('hides the block when the data says the key is false', async () => {
    const html = await render(doc('isMember'), {
      plainText: true,
      payload: { isMember: false },
    });
    expect(html).not.toContain('Members only');
  });

  it('shows the block when the data says the key is true', async () => {
    const html = await render(doc('isMember'), {
      plainText: true,
      payload: { isMember: true },
    });
    expect(html).toContain('Members only');
  });

  it('hides the block when data is supplied but omits the key', async () => {
    const html = await render(doc('isMember'), {
      plainText: true,
      payload: { somethingElse: true },
    });
    expect(html).not.toContain('Members only');
  });

  it('leaves a block without a key alone', async () => {
    const html = await render(doc(null), { plainText: true, payload: {} });
    expect(html).toContain('Members only');
  });
});
