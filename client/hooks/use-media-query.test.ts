import { describe, expect, it } from 'bun:test';
import { matches } from './use-media-query';

describe('matches', () => {
  it('is false where there is no window', () => {
    expect(matches('(pointer: coarse)')).toBe(false);
  });

  it('asks matchMedia when there is one', () => {
    const calls: string[] = [];
    (globalThis as { window?: unknown }).window = {
      matchMedia: (q: string) => { calls.push(q); return { matches: q === '(max-width: 639px)' }; },
    };
    try {
      expect(matches('(max-width: 639px)')).toBe(true);
      expect(matches('(pointer: coarse)')).toBe(false);
      expect(calls).toEqual(['(max-width: 639px)', '(pointer: coarse)']);
    } finally {
      delete (globalThis as { window?: unknown }).window;
    }
  });
});
