import { describe, expect, it } from 'bun:test';
import { Engine } from './index';

/**
 * Guards the shape of the HTML we emit.
 *
 * The hard target is Outlook for Windows (classic), which lays out mail with
 * Word's engine: no flexbox, no grid, no media queries, no CSS positioning.
 * `@react-email/components` already emits table-based markup that suits it, so
 * these assertions are here to stop that quietly regressing — not to claim we
 * have tested against any particular client. Nothing here substitutes for real
 * client testing, and no copy in the product promises that we have done it.
 */

const richDocument = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1, textAlign: 'left', showIfKey: null },
      content: [{ type: 'text', text: 'Your API key is ready' }],
    },
    {
      type: 'paragraph',
      attrs: { textAlign: 'left', showIfKey: null },
      content: [
        { type: 'text', text: 'Drop it into your server environment. ' },
        {
          type: 'text',
          marks: [{ type: 'link', attrs: { href: 'https://temply.app', target: '_blank' } }],
          text: 'Open the dashboard',
        },
      ],
    },
    {
      type: 'button',
      attrs: {
        text: 'Open the dashboard',
        url: 'https://temply.app',
        alignment: 'left',
        variant: 'filled',
        borderRadius: 'smooth',
        buttonColor: '#000000',
        textColor: '#FFFFFF',
        showIfKey: null,
      },
    },
    { type: 'horizontalRule' },
    {
      type: 'paragraph',
      attrs: { textAlign: 'center', showIfKey: null },
      content: [{ type: 'text', text: 'You are receiving this because you created a key.' }],
    },
  ],
};

async function renderRich() {
  return new Engine(richDocument).render();
}

describe('emitted HTML stays parseable by layout engines that predate CSS layout', () => {
  it('lays out with tables rather than flex or grid', async () => {
    const html = await renderRich();

    expect(html).toContain('<table');
    expect(html).not.toMatch(/display\s*:\s*flex/i);
    expect(html).not.toMatch(/display\s*:\s*grid/i);
    expect(html).not.toMatch(/display\s*:\s*inline-flex/i);
  });

  it('does not depend on media queries to be readable', async () => {
    const html = await renderRich();

    // A media query is fine as an enhancement, but the document must not be
    // laid out by one, because the Word engine drops them entirely.
    expect(html).not.toMatch(/@media[^{]*\{[^}]*display\s*:/i);
  });

  it('does not position content out of normal flow', async () => {
    const html = await renderRich();

    expect(html).not.toMatch(/position\s*:\s*absolute/i);
    expect(html).not.toMatch(/position\s*:\s*fixed/i);
    expect(html).not.toMatch(/position\s*:\s*sticky/i);
  });

  it('declares a colour scheme so clients that respect it leave the design alone', async () => {
    const html = await renderRich();

    expect(html).toContain('color-scheme');
    expect(html).toContain('supported-color-schemes');
  });

  it('keeps the container within the width every inbox gives you', async () => {
    const html = await renderRich();

    expect(html).toMatch(/max-width\s*:\s*600px/i);
  });
});
