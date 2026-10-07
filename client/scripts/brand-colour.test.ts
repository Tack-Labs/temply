import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import manifest from '../app/manifest';

/**
 * The brand has its own colours and the app its own accent; the two are not
 * the same violet and do not follow each other. What this file watches is the
 * places that cannot read a CSS variable and so repeat a value: the icon and
 * lockup SVGs repeat the three brand stops (and the light lockup's wordmark
 * repeats the navy), the manifest and the error page (which
 * renders when the layout, and with it the stylesheet, did not) repeat
 * `--ds-accent`. Each fails here when its token moves and the copy does not.
 * The icon PNGs are rasters supplied by the brand pack; they cannot be
 * compared to a token, so what is pinned is that each is a PNG of the size
 * its name says, and that the copies Next needs under app/ are the same
 * bytes as the ones under public/brand/.
 */
const client = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(client, path), 'utf8');

const css = read('app/globals.css');
const root = css.slice(css.indexOf(':root'), css.indexOf('\n}', css.indexOf(':root')));
const accent = /--ds-accent:\s*(#[0-9a-fA-F]{6})/.exec(root)?.[1];
const brand = (name: string) => new RegExp(`--brand-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)?.[1];

describe('the app accent', () => {
  it('exists to be followed', () => {
    expect(accent).toBeDefined();
  });

  it('is the manifest theme_color, which cannot read a variable', () => {
    expect(manifest().theme_color?.toLowerCase()).toBe(accent?.toLowerCase());
  });

  it('is the error page button, which has no stylesheet to read', () => {
    const page = read('app/global-error.tsx');
    const button = /background:\s*'(#[0-9a-fA-F]{6})'/.exec(page.slice(page.indexOf('<button')))?.[1];
    expect(button?.toLowerCase()).toBe(accent?.toLowerCase());
  });
});

describe('the gradient icon', () => {
  const tokens = ['coral', 'pink', 'purple'].map((name) => brand(name)?.toLowerCase());

  it('has the three brand colours to repeat', () => {
    expect(tokens.every((token) => token !== undefined)).toBe(true);
  });

  for (const svg of ['app/icon0.svg', 'public/brand/temply-app-icon-gradient.svg']) {
    it(`${svg} runs coral, pink, purple`, () => {
      const stops = [...read(svg).matchAll(/<stop\b[^>]*\sstop-color="(#[0-9a-fA-F]{6})"/g)].map((match) => match[1]?.toLowerCase());
      expect(stops).toEqual(tokens);
    });
  }

  it('is one file under app/ and public/brand/, so the favicon and the manifest cannot show different icons', () => {
    expect(read('app/icon0.svg')).toBe(read('public/brand/temply-app-icon-gradient.svg'));
  });
});

describe('the horizontal lockups', () => {
  const colour = read('public/brand/temply-logo-horizontal.svg');
  const onDark = read('public/brand/temply-logo-horizontal-on-dark.svg');
  const paths = (svg: string) => [...svg.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)].map((match) => match[1]);
  const fills = (svg: string) => [...svg.matchAll(/<path\b[^>]*\sfill="([^"]+)"/g)].map((match) => match[1]?.toLowerCase());
  const stops = (svg: string) => [...svg.matchAll(/<stop\b[^>]*\sstop-color="(#[0-9a-fA-F]{6})"/g)].map((match) => match[1]?.toLowerCase());

  for (const [name, svg] of [['temply-logo-horizontal.svg', colour], ['temply-logo-horizontal-on-dark.svg', onDark]] as const) {
    it(`${name} has the mark running coral, pink, purple, and nothing that runs or loads`, () => {
      expect(stops(svg)).toEqual(['coral', 'pink', 'purple'].map((token) => brand(token)?.toLowerCase()));
      expect(svg).not.toMatch(/<script|<image|<foreignObject|\shref=|xlink|@import|url\((?!#)/i);
    });
  }

  it('differ only in the wordmark\'s colour: navy on the light surface, white on the dark one', () => {
    expect(paths(colour)).toEqual(paths(onDark));
    expect(fills(colour)).toEqual(['url(#temply-gradient)', brand('navy')?.toLowerCase()]);
    expect(fills(onDark)).toEqual(['url(#temply-gradient)', '#ffffff']);
  });

  it('are the 1213.66 by 320 the BrandLogo attributes hold the ratio of', () => {
    for (const svg of [colour, onDark]) expect(svg).toContain('viewBox="0 0 1213.66 320"');
  });
});

describe('the icon PNGs', () => {
  const bytes = (path: string) => readFileSync(join(client, path));
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  for (const size of [16, 32, 180, 192, 512]) {
    const file = `public/brand/temply-app-icon-gradient-${size}.png`;
    it(`${file} is a ${size} by ${size} PNG`, () => {
      const png = bytes(file);
      expect(png.subarray(0, 8).equals(PNG)).toBe(true);
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([size, size]);
    });
  }

  // Next serves a static icon from app/ under its own name and will not
  // take one from public/, so the favicon and touch icon exist twice.
  for (const [copy, original] of [
    ['app/icon1.png', 'public/brand/temply-app-icon-gradient-32.png'],
    ['app/apple-icon.png', 'public/brand/temply-app-icon-gradient-180.png'],
  ] as const) {
    it(`${copy} is the same file as ${original}`, () => {
      expect(bytes(copy).equals(bytes(original))).toBe(true);
    });
  }
});
