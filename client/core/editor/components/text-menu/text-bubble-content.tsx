import { Editor } from '@tiptap/core';
import { BubbleMenuItem } from './text-bubble-menu';

import {
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  List,
  ListOrdered,
  StrikethroughIcon,
  UnderlineIcon,
} from 'lucide-react';
import { BubbleMenuButton } from '../bubble-menu-button';
import { AlignmentSwitch } from '../alignment-switch';
import { TextDirectionSwitch } from '../text-direction-switch';
import { useTextMenuState } from './use-text-menu-state';
import { LinkInputPopover } from '../ui/link-input-popover';
import { Divider } from '../ui/divider';
import { ColorPicker } from '../ui/color-picker';
import { BaseButton } from '../base-button';
import { ShowPopover } from '../show-popover';
import { textCommands } from '@/editor/commands/text';

type TextBubbleContentProps = {
  editor: Editor;
  showListMenu?: boolean;
};

export function TextBubbleContent(props: TextBubbleContentProps) {
  const { editor, showListMenu = true } = props;

  const state = useTextMenuState(editor);
  const colors = editor?.storage.color.colors as Set<string>;
  const suggestedColors = Array?.from(colors)?.reverse()?.slice(0, 6) ?? [];

  const items: BubbleMenuItem[] = [
    {
      name: 'bold',
      isActive: () => !!editor?.isActive('bold'),
      command: () => !!editor?.chain().focus().toggleBold().run(),
      icon: BoldIcon,
      tooltip: 'Bold',
    },
    {
      name: 'italic',
      isActive: () => !!editor?.isActive('italic'),
      command: () => !!editor?.chain().focus().toggleItalic().run(),
      icon: ItalicIcon,
      tooltip: 'Italic',
    },
    {
      name: 'underline',
      isActive: () => !!editor?.isActive('underline'),
      command: () => !!editor?.chain().focus().toggleUnderline().run(),
      icon: UnderlineIcon,
      tooltip: 'Underline',
    },
    {
      name: 'strike',
      isActive: () => !!editor?.isActive('strike'),
      command: () => !!editor?.chain().focus().toggleStrike().run(),
      icon: StrikethroughIcon,
      tooltip: 'Strikethrough',
    },
    {
      name: 'code',
      isActive: () => !!editor?.isActive('code'),
      command: () => !!editor?.chain().focus().toggleCode().run(),
      icon: CodeIcon,
      tooltip: 'Code',
    },
  ];

  return (
    <>
      {items.map((item, index) => (
        <BubbleMenuButton key={index} {...item} />
      ))}

      <AlignmentSwitch
        alignment={state.textAlign}
        onAlignmentChange={(alignment) => {
          editor?.chain().focus().setTextAlign(alignment).run();
        }}
      />

      <TextDirectionSwitch
        direction={state.textDirection}
        onDirectionChange={(direction) => {
          if (state.isFooterActive) {
            editor?.chain().focus().setFooterTextDirection(direction).run();
          } else if (state.isHeadingActive) {
            editor
              ?.chain()
              .focus()
              .updateAttributes('heading', { textDirection: direction })
              .run();
          } else {
            editor?.chain().focus().setTextDirection(direction).run();
          }
        }}
      />

      {!state.isListActive && showListMenu && (
        <>
          <BubbleMenuButton
            icon={List}
            command={() => {
              editor.chain().focus().toggleBulletList().run();
            }}
            tooltip={textCommands.bulletList.label}
          />
          <BubbleMenuButton
            icon={ListOrdered}
            command={() => {
              editor.chain().focus().toggleOrderedList().run();
            }}
            tooltip={textCommands.orderedList.label}
          />
        </>
      )}

      <LinkInputPopover
        defaultValue={state?.linkUrl ?? ''}
        onValueChange={(value, isVariable) => {
          if (!value) {
            editor
              ?.chain()
              .focus()
              .extendMarkRange('link')
              .unsetLink()
              .unsetUnderline()
              .run();
            return;
          }

          editor
            ?.chain()
            .extendMarkRange('link')
            .setLink({ href: value })
            .setIsUrlVariable(isVariable ?? false)
            .setUnderline()
            .run();
        }}
        tooltip="Link address"
        editor={editor}
        isVariable={state.isUrlVariable}
      />

      <Divider />

      <ColorPicker
        color={state.currentTextColor}
        onColorChange={(color) => {
          editor?.chain().setColor(color).run();
        }}
        tooltip="Text colour"
        suggestedColors={suggestedColors}
      >
        <BaseButton
          variant="ghost"
          size="sm"
          type="button"
          className="mly:h-7 mly:w-7 mly:shrink-0 mly:p-0"
        >
          <div className="mly:flex mly:flex-col mly:items-center mly:justify-center mly:gap-px">
            <span className="mly:font-bolder mly:font-mono mly:text-xs mly:text-slate-700">
              A
            </span>
            <div
              className="mly:h-[2px] mly:w-3"
              style={{ backgroundColor: state.currentTextColor }}
            />
          </div>
        </BaseButton>
      </ColorPicker>

      {/* Paragraphs and headings have carried a showIfKey all along — the
          renderer honours it and this menu's state already read it — but no
          control ever offered it, so text was the one block type you could not
          make conditional. */}
      {(state.isParagraphActive || state.isHeadingActive) && (
        <>
          <Divider />
          <ShowPopover
            showIfKey={
              state.isHeadingActive ? state.headingShowIfKey : state.paragraphShowIfKey
            }
            onShowIfKeyValueChange={(showIfKey) => {
              editor
                ?.chain()
                .updateAttributes(state.isHeadingActive ? 'heading' : 'paragraph', {
                  showIfKey,
                })
                .run();
            }}
            editor={editor}
          />
        </>
      )}
    </>
  );
}
