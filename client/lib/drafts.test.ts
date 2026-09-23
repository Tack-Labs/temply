import { beforeEach, describe, expect, test } from 'bun:test';
import { clearDraft, PLAYGROUND_DRAFT_ID } from './drafts';

const store = new Map<string, string>();

// bun's test environment has no DOM. The store only needs the two methods
// the module calls, so a Map stands in for it.
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
};

beforeEach(() => store.clear());

describe('clearDraft', () => {
  test('removes a leftover draft under the playground key', () => {
    store.set('temply:draft:playground', '{"subject":"stale"}');
    clearDraft(PLAYGROUND_DRAFT_ID);
    expect(store.has('temply:draft:playground')).toBe(false);
  });

  test('removes only the requested key, not another template\'s', () => {
    store.set('temply:draft:playground', '{}');
    store.set('temply:draft:tpl_1', '{}');
    clearDraft(PLAYGROUND_DRAFT_ID);
    expect(store.has('temply:draft:playground')).toBe(false);
    expect(store.has('temply:draft:tpl_1')).toBe(true);
  });

  test('does nothing when there is no draft to clear', () => {
    expect(() => clearDraft(PLAYGROUND_DRAFT_ID)).not.toThrow();
  });

  test('a removal that throws leaves the caller unharmed', () => {
    const original = (globalThis as any).window.localStorage.removeItem;
    (globalThis as any).window.localStorage.removeItem = () => {
      throw new Error('SecurityError');
    };
    expect(() => clearDraft(PLAYGROUND_DRAFT_ID)).not.toThrow();
    (globalThis as any).window.localStorage.removeItem = original;
  });
});
