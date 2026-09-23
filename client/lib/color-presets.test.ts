import { describe, expect, test } from 'bun:test';
import { COLOR_PRESETS } from './color-presets';

describe('COLOR_PRESETS', () => {
  test('holds exactly ten swatches', () => {
    expect(COLOR_PRESETS).toHaveLength(10);
  });

  test('every entry is an uppercase six-digit hex colour', () => {
    for (const color of COLOR_PRESETS) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  test('has no duplicate swatches', () => {
    expect(new Set(COLOR_PRESETS).size).toBe(COLOR_PRESETS.length);
  });
});
