/**
 * Everything the editor responds to that nothing on screen advertises.
 *
 * One list, rendered twice: the cheatsheet inside the editor and the reference
 * section in the documentation. Two copies would disagree within a month.
 *
 * `keys` is written for macOS and rewritten per platform at render time.
 */

export type Shortcut = {
  /** Either a key combination ("Mod+Shift+D") or something you type ("/"). */
  keys: string;
  what: string;
};

export type ShortcutGroup = {
  title: string;
  items: Shortcut[];
};

export const EDITOR_SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'Insert',
    items: [
      { keys: '/', what: 'Open the block menu — every block, filtered as you type' },
      { keys: '@', what: 'Insert a variable, in text, a button label or a URL' },
      { keys: '---', what: 'Turn the line into a divider' },
    ],
  },
  {
    title: 'Write',
    items: [
      { keys: '# ', what: 'Heading 1 — ## and ### for the smaller ones' },
      { keys: '- ', what: 'Start a bullet list' },
      { keys: '1. ', what: 'Start a numbered list' },
      { keys: '> ', what: 'Start a blockquote' },
      { keys: '**text**', what: 'Bold — *text* italic, `text` code, ~~text~~ struck through' },
      { keys: 'Shift+Enter', what: 'A new line inside the block, without a new block’s spacing' },
    ],
  },
  {
    title: 'Blocks',
    items: [
      { keys: 'Mod+Shift+Up', what: 'Move the block up' },
      { keys: 'Mod+Shift+Down', what: 'Move the block down' },
      { keys: 'Mod+Shift+D', what: 'Duplicate the block' },
      { keys: 'Mod+Shift+L', what: 'Select the whole block' },
      { keys: 'Mod+Shift+Backspace', what: 'Delete the block' },
    ],
  },
  {
    title: 'Text',
    items: [
      { keys: 'Mod+B', what: 'Bold' },
      { keys: 'Mod+I', what: 'Italic' },
      { keys: 'Mod+U', what: 'Underline' },
      // The description is plain prose: only `keys` gets rewritten per
      // platform, so naming a combination here would leak "Mod" to the reader.
      { keys: 'Mod+Z', what: 'Undo — hold Shift as well to redo' },
    ],
  },
];

/** Mod is ⌘ on a Mac and Ctrl everywhere else; the arrows read better as
 *  glyphs than as words. */
export function formatKeys(keys: string, isApple: boolean): string {
  return keys
    .replace('Mod', isApple ? '⌘' : 'Ctrl')
    .replace('Shift', isApple ? '⇧' : 'Shift')
    .replace('Backspace', isApple ? '⌫' : 'Backspace')
    .replace('Up', '↑')
    .replace('Down', '↓')
    .replaceAll('+', isApple ? '' : '+');
}
