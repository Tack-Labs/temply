import { describe, expect, test } from 'bun:test';
import { BRAND_PRESETS } from '@temply/shared/brand-presets';
import { matchThemeToBrand, sameTheme } from './theme-match';

const warm = BRAND_PRESETS.find((p) => p.id === 'warm')!;
const slate = BRAND_PRESETS.find((p) => p.id === 'slate')!;

/** A brand row as the API returns it: the theme is stored as a JSON string. */
const brandFrom = (id: string, theme: unknown) => ({ id, theme: JSON.stringify(theme) });

describe('sameTheme', () => {
  test('ignores key order and undefined values', () => {
    expect(sameTheme({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 })).toBe(true);
    expect(sameTheme({ a: 1, b: undefined }, { a: 1 })).toBe(true);
  });

  test('tells a differing leaf apart', () => {
    expect(sameTheme({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 3 } })).toBe(false);
    expect(sameTheme({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

describe('matchThemeToBrand', () => {
  test('an own brand wins over the preset it was saved from', () => {
    const own = brandFrom('brand_warm', warm.theme);
    expect(matchThemeToBrand(warm.theme, [own])).toBe('brand_warm');
  });

  test('the workspace default wins over a same-theme sibling brand', () => {
    const older = brandFrom('brand_older', warm.theme);
    const newer = brandFrom('brand_newer', warm.theme);
    expect(matchThemeToBrand(warm.theme, [newer, older], 'brand_older')).toBe('brand_older');
    expect(matchThemeToBrand(warm.theme, [older, newer], 'brand_newer')).toBe('brand_newer');
  });

  test('a theme matching only a preset reads as that preset', () => {
    expect(matchThemeToBrand(slate.theme)).toBe('slate');
    expect(matchThemeToBrand(slate.theme, [brandFrom('brand_warm', warm.theme)], 'brand_warm')).toBe('slate');
  });

  test('malformed brand JSON never matches', () => {
    const broken = { id: 'brand_broken', theme: '{not json' };
    expect(matchThemeToBrand(warm.theme, [broken], 'brand_broken')).toBe('warm');
    expect(matchThemeToBrand({ ...warm.theme, button: { ...warm.theme.button, backgroundColor: '#000000' } }, [broken])).toBe('custom');
  });

  test('a theme that matches nothing is custom', () => {
    expect(matchThemeToBrand({ ...slate.theme, button: { ...slate.theme.button, backgroundColor: '#123456' } }, [brandFrom('brand_warm', warm.theme)])).toBe('custom');
  });
});
