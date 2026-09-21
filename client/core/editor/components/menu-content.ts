import type { Editor } from '@tiptap/core';
import { enclosingNodes } from '../commands/block';

/** The blocks that hold other blocks and have settings of their own. On the
 *  phone a tap lands on the block inside, never on these, so their settings
 *  are shown from there. */
export const WRAPPER_TYPES: readonly string[] = ['repeat', 'section', 'columns'];

/** The wrappers around the selected block, outermost first — the order the
 *  Style sheet stacks their settings in above the block's own. */
export function wrappersAround(editor: Editor): string[] {
  return enclosingNodes(editor, WRAPPER_TYPES).map((found) => found.node.type.name);
}
