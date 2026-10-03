import { describe, expect, it } from 'bun:test';
import { matches } from './use-media-query';

describe('matches', () => {
  it('is false where there is no window', () => {
    expect(matches('(pointer: coarse)')).toBe(false);
  });

  it('asks matchMedia when there is one', () => {
    const calls: string[] = [];
    // Bun runs every test file in one process, and any file that has loaded
    // happy-dom has already put its own `window` here. Deleting it on the way
    // out would leave every DOM test that runs afterwards without one, so the
    // original is put back whole.
    const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
    (globalThis as { window?: unknown }).window = {
      matchMedia: (q: string) => { calls.push(q); return { matches: q === '(max-width: 639px)' }; },
    };
    try {
      expect(matches('(max-width: 639px)')).toBe(true);
      expect(matches('(pointer: coarse)')).toBe(false);
      expect(calls).toEqual(['(max-width: 639px)', '(pointer: coarse)']);
    } finally {
      if (original) Object.defineProperty(globalThis, 'window', original);
      else delete (globalThis as { window?: unknown }).window;
    }
  });
});
