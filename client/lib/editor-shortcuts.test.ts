import { describe, expect, test } from 'bun:test';
import { EDITOR_SHORTCUTS, formatKeys } from './editor-shortcuts';

/** What the cheatsheet and the docs table render, group by group. */
const rendered = (isApple: boolean) =>
  EDITOR_SHORTCUTS.flatMap((group) => group.items.map((item) => formatKeys(item.keys, isApple)));

describe('EDITOR_SHORTCUTS', () => {
  test('is four groups of eighteen shortcuts', () => {
    expect(EDITOR_SHORTCUTS.map((group) => group.title)).toEqual(['Insert', 'Write', 'Blocks', 'Text']);
    expect(rendered(true)).toHaveLength(18);
  });

  test('lists no shortcut twice', () => {
    const keys = EDITOR_SHORTCUTS.flatMap((group) => group.items.map((item) => item.keys));
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('every description is prose, never a key combination', () => {
    // Only `keys` is rewritten per platform, so a "Mod" in a description
    // would reach the reader as the word.
    for (const group of EDITOR_SHORTCUTS) {
      for (const item of group.items) expect(item.what).not.toContain('Mod');
    }
  });
});

describe('formatKeys', () => {
  test('Mod is the command glyph on an Apple keyboard and Ctrl everywhere else', () => {
    expect(formatKeys('Mod+B', true)).toBe('⌘B');
    expect(formatKeys('Mod+B', false)).toBe('Ctrl+B');
  });

  test('an Apple keyboard loses the plus signs and keeps them everywhere else', () => {
    expect(formatKeys('Mod+Shift+D', true)).toBe('⌘⇧D');
    expect(formatKeys('Mod+Shift+D', false)).toBe('Ctrl+Shift+D');
  });

  test('Backspace is the delete glyph on an Apple keyboard and the word everywhere else', () => {
    expect(formatKeys('Mod+Shift+Backspace', true)).toBe('⌘⇧⌫');
    expect(formatKeys('Mod+Shift+Backspace', false)).toBe('Ctrl+Shift+Backspace');
  });

  test('the arrows are glyphs on both, rewritten after the modifiers', () => {
    // Up and Down are replaced last, so the substitution has to survive the
    // modifier pass rather than be eaten by it — Ctrl+Shift+Down is the case
    // where a rewrite in the wrong order shows.
    expect(formatKeys('Mod+Shift+Up', true)).toBe('⌘⇧↑');
    expect(formatKeys('Mod+Shift+Up', false)).toBe('Ctrl+Shift+↑');
    expect(formatKeys('Mod+Shift+Down', true)).toBe('⌘⇧↓');
    expect(formatKeys('Mod+Shift+Down', false)).toBe('Ctrl+Shift+↓');
  });

  test('Shift on its own is the glyph on an Apple keyboard', () => {
    expect(formatKeys('Shift+Enter', true)).toBe('⇧Enter');
    expect(formatKeys('Shift+Enter', false)).toBe('Shift+Enter');
  });

  test('what a customer types is left alone, trailing space and all', () => {
    // The space is the load-bearing half of `# `, `- `, `1. ` and `> `: the
    // input rules fire on it, so a listing that lost it would be telling the
    // reader to press something the editor does not answer to.
    for (const typed of ['/', '@', '---', '# ', '- ', '1. ', '> ', '**text**']) {
      expect(formatKeys(typed, true)).toBe(typed);
      expect(formatKeys(typed, false)).toBe(typed);
    }
  });

  test('the whole list renders as the two sets the cheatsheet shows', () => {
    // The Apple set is the one no browser in the e2e suite renders — the
    // desktop project's Chrome descriptor reports a platform of its own — so
    // this is where the glyphs every Mac customer reads are pinned.
    expect(rendered(true)).toEqual([
      '/', '@', '---',
      '# ', '- ', '1. ', '> ', '**text**', '⇧Enter',
      '⌘⇧↑', '⌘⇧↓', '⌘⇧D', '⌘⇧Space', '⌘⇧⌫',
      '⌘B', '⌘I', '⌘U', '⌘Z',
    ]);
    expect(rendered(false)).toEqual([
      '/', '@', '---',
      '# ', '- ', '1. ', '> ', '**text**', 'Shift+Enter',
      'Ctrl+Shift+↑', 'Ctrl+Shift+↓', 'Ctrl+Shift+D', 'Ctrl+Shift+Space', 'Ctrl+Shift+Backspace',
      'Ctrl+B', 'Ctrl+I', 'Ctrl+U', 'Ctrl+Z',
    ]);
  });
});
