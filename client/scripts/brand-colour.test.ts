import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARK_COLOUR } from '../app/mark';

/**
 * The brand mark is drawn in files that cannot read a CSS variable: two SVGs,
 * the satori icon routes, the manifest, and the error page that renders when
 * the layout (and with it the stylesheet) did not. They repeat `--ds-accent`,
 * so this is the one place that notices when the token moves and they do not.
 * The PNGs under public/ are rasters of the same fill and are re-rendered by
 * hand when it changes.
 */
const client = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(client, path), 'utf8');

const css = read('app/globals.css');
const root = css.slice(css.indexOf(':root'), css.indexOf('\n}', css.indexOf(':root')));
const accent = /--ds-accent:\s*(#[0-9a-fA-F]{6})/.exec(root)?.[1];

describe('the brand mark follows the accent token', () => {
  it('has an accent to follow', () => {
    expect(accent).toBeDefined();
  });

  it('is drawn by the icon routes in the accent', () => {
    expect(MARK_COLOUR.toLowerCase()).toBe(accent?.toLowerCase());
  });

  for (const svg of ['app/icon0.svg', 'public/brand/icon.svg']) {
    it(`${svg} fills its tile with the accent`, () => {
      const tile = /<rect[^>]*\sfill="(#[0-9a-fA-F]{6})"/.exec(read(svg))?.[1];
      expect(tile?.toLowerCase()).toBe(accent?.toLowerCase());
    });
  }

  it('the error page button, which has no stylesheet to read, uses the accent', () => {
    const page = read('app/global-error.tsx');
    const button = /background:\s*'(#[0-9a-fA-F]{6})'/.exec(page.slice(page.indexOf('<button')))?.[1];
    expect(button?.toLowerCase()).toBe(accent?.toLowerCase());
  });
});
