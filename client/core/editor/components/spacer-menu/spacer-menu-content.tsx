import { Editor } from '@tiptap/core';
import { useMemo } from 'react';
import { BubbleMenuButton } from '../bubble-menu-button';
import { BubbleMenuItem } from '../text-menu/text-bubble-menu';
import { Divider } from '../ui/divider';
import { ShowPopover } from '../show-popover';
import { spacing } from '@/editor/utils/spacing';
import { useSpacerState } from './use-spacer-state';

export function SpacerMenuContent({ editor }: { editor: Editor }) {
  const items: BubbleMenuItem[] = useMemo(
    () =>
      spacing.map((space) => {
        const { value: height, short: name } = space;
        return {
          name,
          isActive: () => editor?.isActive('spacer', { height }),
          command: () => {
            editor?.chain().focus().setSpacer({ height }).run();
          },
        };
      }),
    [editor]
  );

  const state = useSpacerState(editor);

  return (
    <>
      {items.map((item, index) => (
        <BubbleMenuButton
          key={index}
          className="!mly:h-7 mly:w-7 mly:shrink-0 mly:p-0"
          iconClassName="mly:w-3 mly:h-3"
          nameClassName="mly:text-xs"
          {...item}
        />
      ))}
      <Divider />
      <ShowPopover
        showIfKey={state.currentShowIfKey}
        onShowIfKeyValueChange={(value) => {
          editor.commands.setSpacerShowIfKey(value);
        }}
        editor={editor}
      />
    </>
  );
}
