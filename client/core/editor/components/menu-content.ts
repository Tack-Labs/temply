import type { Editor } from '@tiptap/core';
import type { ComponentType } from 'react';
import { enclosingNodes, selectedBlock } from '../commands/block';
import { TextBubbleContent } from './text-menu/text-bubble-content';
import { ImageMenuContent } from './image-menu/image-menu-content';
import { SpacerMenuContent } from './spacer-menu/spacer-menu-content';
import { SectionMenuContent } from './section-menu/section-menu-content';
import { ColumnsMenuContent } from './column-menu/columns-menu-content';
import { VariableMenuContent } from './variable-menu/variable-menu-content';
import { RepeatMenuContent } from './repeat-menu/repeat-menu-content';
import { HTMLMenuContent } from './html-menu/html-menu-content';
import { InlineImageMenuContent } from './inline-image-menu/inline-image-menu-content';
import { ButtonMenuContent } from './button-menu/button-menu-content';

/** Which controls a block type has. The Style panel looks up the selected
 *  node's type here; the desktop bubble menus keep their own show/hide logic.
 *  Button's desktop controls live in a Popover its node view opens on itself;
 *  the entry here is a second reading of the same attributes for touch, where
 *  that popover is never opened. */
export const MENU_CONTENT: Record<string, ComponentType<{ editor: Editor }>> = {
  image: ImageMenuContent,
  logo: ImageMenuContent,
  spacer: SpacerMenuContent,
  section: SectionMenuContent,
  columns: ColumnsMenuContent,
  column: ColumnsMenuContent,
  variable: VariableMenuContent,
  repeat: RepeatMenuContent,
  htmlCodeBlock: HTMLMenuContent,
  inlineImage: InlineImageMenuContent,
  button: ButtonMenuContent,
  paragraph: TextBubbleContent,
  heading: TextBubbleContent,
  footer: TextBubbleContent,
};

export function menuContentFor(
  typeName: string
): ComponentType<{ editor: Editor }> | null {
  return MENU_CONTENT[typeName] ?? null;
}

/** The blocks that hold other blocks and have settings of their own. On the
 *  phone a tap lands on the block inside, never on these, so their settings
 *  are shown from there. */
export const WRAPPER_TYPES: readonly string[] = ['repeat', 'section', 'columns'];

/** The wrappers around the selected block, outermost first — the order the
 *  Style sheet stacks their settings in above the block's own. */
export function wrappersAround(editor: Editor): string[] {
  return enclosingNodes(editor, WRAPPER_TYPES).map((found) => found.node.type.name);
}

/** Whether the selection has settings for the Style sheet: the selected
 *  block's own, or those of a wrapper around it. The bar's Style button and
 *  the sheet's "nothing to show" close read the same answer, so the button
 *  never offers a sheet that would shut on opening. */
export function hasStyleContent(editor: Editor): boolean {
  const typeName = selectedBlock(editor)?.node.type.name;
  return (!!typeName && menuContentFor(typeName) !== null) || wrappersAround(editor).length > 0;
}
