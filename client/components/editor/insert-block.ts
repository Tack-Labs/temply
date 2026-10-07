import type { Editor } from '@tiptap/core';
import type { BlockItem } from '~/core/blocks/types';
import { revealInsertedBlock } from '~/core/editor/utils/reveal-block';

/**
 * Puts a block below the top-level block the caret is in, or at the end of the
 * document when there is no caret, and brings it into view. An empty paragraph
 * is made for the block's command to turn into the block, which is what the
 * slash menu does too: the command takes a range to replace, not a position.
 * One implementation for every surface that adds a block by click.
 */
export function insertBlockBelowSelection(editor: Editor, block: BlockItem): void {
  if (!block.command) return;
  const { $from } = editor.state.selection;
  const position = $from.depth > 0 ? $from.after(1) : editor.state.doc.content.size;
  editor.chain().focus().insertContentAt(position, { type: 'paragraph' }).setTextSelection(position + 1).run();
  block.command({ editor, range: { from: position + 1, to: position + 1 } });
  revealInsertedBlock(editor);
}

/** The words a customer sees for a block; the slash menu's titles are the
 *  names the editor uses, and a few of them are not what you would say. */
export function blockLabel(title: string): string {
  if (title === 'Heading 1') return 'Heading';
  if (title === 'Heading 2') return 'Subheading';
  if (title === 'Repeat') return 'Repeating list';
  return title;
}
