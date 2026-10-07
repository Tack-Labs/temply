import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The brand's minimum size is 24px tall for the mark and for the horizontal
 * lockup; under that the pack says to use its 32 and 16px app icon files. A
 * mark sized below it, even by one class, would read as a smudge, so every
 * <BrandMark> and <BrandLogo> in the app names a height at or above 24px at
 * every breakpoint it sets one.
 */
const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MINIMUM = 24;
const PX_PER_UNIT = 4;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [path] : [];
  });
}

const USAGE = /<(BrandMark|BrandLogo)\b[^>]*?className="([^"]*)"/g;
/** `h-6`, `min-[24rem]:h-7.5`: Tailwind's spacing unit is 4px. */
const HEIGHT = /(?:^|\s)(?:[^\s]*:)?h-(\d+(?:\.\d+)?)(?=\s|$)/g;

const used = ['app', 'components'].flatMap((dir) => sources(join(CLIENT, dir))).flatMap((file) => {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(USAGE)].map((match) => ({
    where: `${relative(CLIENT, file)}: <${match[1]} className="${match[2]}">`,
    heights: [...(match[2] ?? '').matchAll(HEIGHT)].map((height) => Number(height[1]) * PX_PER_UNIT),
  }));
});

describe('the mark and the lockup keep the brand\'s minimum size', () => {
  it('finds the places they are drawn, so the check below is not vacuous', () => {
    expect(used.length).toBeGreaterThanOrEqual(9);
  });

  for (const { where, heights } of used) {
    it(`${where} is sized by height, 24px or more`, () => {
      expect(heights.length, 'no height class').toBeGreaterThan(0);
      for (const height of heights) expect(height).toBeGreaterThanOrEqual(MINIMUM);
    });
  }
});
