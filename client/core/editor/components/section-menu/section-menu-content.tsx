import { deleteNode } from '@/editor/utils/delete-node';
import { Editor } from '@tiptap/core';
import { ChevronUp, Trash } from 'lucide-react';
import { AlignmentSwitch } from '../alignment-switch';
import { BaseButton } from '../base-button';
import { BubbleMenuButton } from '../bubble-menu-button';
import { ColumnsMenuContent } from '../column-menu/columns-menu-content';
import { BorderColor } from '../icons/border-color';
import { MarginIcon } from '../icons/margin-icon';
import { PaddingIcon } from '../icons/padding-icon';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';
import { ShowPopover } from '../show-popover';
import { ColorPicker } from '../ui/color-picker';
import { Divider } from '../ui/divider';
import { Select } from '../ui/select';
import { useSectionState } from './use-section-state';
import { spacing } from '@/editor/utils/spacing';

export function SectionMenuContent({ editor }: { editor: Editor }) {
  const state = useSectionState(editor);

  const borderRadiusOptions = [
    { value: '0', label: 'Sharp' },
    { value: '6', label: 'Smooth' },
    { value: '9999', label: 'Round' },
  ];

  return (
    <>
      <AlignmentSwitch
        alignment={state.currentAlignment}
        onAlignmentChange={(alignment) => {
          editor?.commands?.updateSection({
            align: alignment,
          });
        }}
      />

      <Divider />

      <div className="mly:flex mly:gap-x-0.5">
        <Select
          label="Border radius"
          value={String(state.currentBorderRadius)}
          options={borderRadiusOptions}
          onValueChange={(value) => {
            editor?.commands?.updateSection({
              borderRadius: Number(value),
            });
          }}
          tooltip="Border radius"
          className="mly:capitalize"
        />

        <Select
          label="Border width"
          value={String(state.currentBorderWidth)}
          options={[
            { value: '0', label: 'None' },
            { value: '1', label: 'Thin' },
            { value: '2', label: 'Medium' },
            { value: '3', label: 'Thick' },
          ]}
          onValueChange={(value) => {
            editor?.commands?.updateSection({
              borderWidth: Number(value),
            });
          }}
          tooltip="Border width"
          className="mly:capitalize"
        />
      </div>

      <Divider />

      <Select
        icon={MarginIcon}
        iconClassName="mly:stroke-[1.2] mly:size-3.5"
        label="Margin"
        value={String(state.currentMarginTop)}
        options={[
          { value: '0', label: 'None' },
          ...spacing.map((space) => ({
            label: space.name,
            value: String(space.value),
          })),
        ]}
        onValueChange={(_value) => {
          const value = Number(_value);
          editor?.commands?.updateSection({
            marginTop: value,
            marginRight: value,
            marginBottom: value,
            marginLeft: value,
          });
        }}
        tooltip="Margin"
        className="mly:capitalize"
      />

      <Divider />

      <Select
        icon={PaddingIcon}
        iconClassName="mly:stroke-[1]"
        label="Padding"
        value={String(state.currentPaddingTop)}
        options={[
          { value: '0', label: 'None' },
          ...spacing.map((space) => ({
            label: space.name,
            value: String(space.value),
          })),
        ]}
        onValueChange={(_value) => {
          const value = Number(_value);
          editor?.commands?.updateSection({
            paddingTop: value,
            paddingRight: value,
            paddingBottom: value,
            paddingLeft: value,
          });
        }}
        tooltip="Padding"
        className="mly:capitalize"
      />

      <Divider />

      <div className="mly:flex mly:gap-x-0.5">
        <ColorPicker
          color={state.currentBorderColor}
          onColorChange={(color) => {
            editor?.commands?.updateSection({
              borderColor: color,
            });
          }}
          tooltip="Border colour"
        >
          <BaseButton
            variant="ghost"
            className="mly:h-7 mly:w-7 mly:shrink-0"
            size="sm"
            type="button"
          >
            <BorderColor
              className="mly:size-3 mly:shrink-0"
              topBarClassName="mly:stroke-midnight-gray"
              style={{
                color: state.currentBorderColor,
              }}
            />
          </BaseButton>
        </ColorPicker>
        <ColorPicker
          color={state.currentBackgroundColor}
          onColorChange={(color) => {
            editor?.commands?.updateSection({
              backgroundColor: color,
            });
          }}
          backgroundColor={state.currentBackgroundColor}
          tooltip="Background colour"
          className="mly:rounded-full mly:border-[1.5px] mly:border-panel mly:shadow"
        />
      </div>

      <Divider />

      <BubbleMenuButton
        icon={Trash}
        tooltip="Delete Section"
        command={() => {
          deleteNode(editor, 'section');
        }}
      />

      <Divider />

      <ShowPopover
        showIfKey={state.currentShowIfKey}
        onShowIfKeyValueChange={(value) => {
          editor.commands.updateSection({
            showIfKey: value,
          });
        }}
        editor={editor}
      />

      {state.isColumnsActive && (
        <>
          <Divider />
          <Popover>
            <PopoverTrigger className="mly:flex mly:items-center mly:gap-1 mly:rounded-md mly:px-1.5 mly:text-sm mly:data-[state=open]:bg-soft-gray mly:transition-colors mly:hover:bg-soft-gray">
              Column
              <ChevronUp className="mly:h-3 mly:w-3" />
            </PopoverTrigger>
            <PopoverContent
              className="mly:w-max mly:rounded-lg mly:p-0.5!"
              side="top"
              sideOffset={8}
              align="end"
              onOpenAutoFocus={(e) => {
                e.preventDefault();
              }}
              onCloseAutoFocus={(e) => {
                e.preventDefault();
              }}
            >
              <ColumnsMenuContent editor={editor} />
            </PopoverContent>
          </Popover>
        </>
      )}
    </>
  );
}
