import type { Editor } from '@tiptap/core';
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, BoldIcon, CodeIcon, CornerDownLeftIcon, ItalicIcon, ListIcon, ListOrderedIcon, RemoveFormattingIcon, StrikethroughIcon, UnderlineIcon } from 'lucide-react';
import { DEFAULT_TEXT_COLOR } from '../components/text-menu/use-text-menu-state';
import type { EditorCommand, RunOptions } from './types';

/** A chain that refocuses unless the caller said not to. */
const chain = (e: Editor, options?: RunOptions) => (options?.focus === false ? e.chain() : e.chain().focus());

const mark = (id: string, label: string, icon: EditorCommand['icon'], name: string, toggle: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>): EditorCommand => ({
  id, label, icon,
  isActive: (e) => e.isActive(name),
  run: (e, options) => { toggle(chain(e, options)).run(); },
});

export const textCommands = {
  bold: mark('bold', 'Bold', BoldIcon, 'bold', (c) => c.toggleBold()),
  italic: mark('italic', 'Italic', ItalicIcon, 'italic', (c) => c.toggleItalic()),
  underline: mark('underline', 'Underline', UnderlineIcon, 'underline', (c) => c.toggleUnderline()),
  strike: mark('strike', 'Strikethrough', StrikethroughIcon, 'strike', (c) => c.toggleStrike()),
  code: mark('code', 'Code', CodeIcon, 'code', (c) => c.toggleCode()),
  bulletList: mark('bullet-list', 'Bullet list', ListIcon, 'bulletList', (c) => c.toggleBulletList()),
  orderedList: mark('ordered-list', 'Numbered list', ListOrderedIcon, 'orderedList', (c) => c.toggleOrderedList()),
  clearFormatting: { id: 'clear', label: 'Clear formatting', icon: RemoveFormattingIcon, run: (e, options) => { chain(e, options).unsetAllMarks().clearNodes().run(); } },
  /** A new line inside the block, without a new block's spacing — what
   *  Shift+Enter does on a desktop, which a phone keyboard has no key for. */
  lineBreak: { id: 'line-break', label: 'Line break', icon: CornerDownLeftIcon, run: (e, options) => { chain(e, options).setHardBreak().run(); } },
} satisfies Record<string, EditorCommand>;

/**
 * What each alignment is called, wherever it is offered.
 *
 * The phone's format bar and the desktop's alignment switch are two controls
 * for one action, and they spelled it two ways — `Align centre` against
 * `Align Center`. One label read by both is the only version of this rule
 * that cannot drift again.
 */
export const ALIGN_LABEL = {
  left: 'Align left',
  center: 'Align centre',
  right: 'Align right',
} as const;

export const alignCommands: EditorCommand[] = (['left', 'center', 'right'] as const).map((side) => ({
  id: `align-${side}`,
  label: ALIGN_LABEL[side],
  icon: side === 'left' ? AlignLeftIcon : side === 'center' ? AlignCenterIcon : AlignRightIcon,
  isActive: (e) => e.isActive({ textAlign: side }),
  run: (e, options) => { chain(e, options).setTextAlign(side).run(); },
}));

export function currentTextColor(editor: Editor): string {
  return editor.getAttributes('textStyle').color || DEFAULT_TEXT_COLOR;
}

export function setTextColor(editor: Editor, hex: string, options?: RunOptions): void {
  chain(editor, options).setColor(hex).run();
}
