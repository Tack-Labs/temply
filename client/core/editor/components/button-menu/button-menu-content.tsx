import { AlignmentSwitch } from '../alignment-switch';
import { ShowPopover } from '../show-popover';
import { Divider } from '../ui/divider';
import { LinkInputPopover } from '../ui/link-input-popover';
import { Select } from '../ui/select';
import { selectedBlock } from '@/editor/commands/block';
import {
  allowedButtonBorderRadius,
  allowedButtonVariant,
  BUTTON_SIZES,
  ButtonAttributes,
  buttonSizeOf,
  type ButtonSize,
} from '@/editor/nodes/button/button';
import { ButtonLabelInput } from '@/editor/nodes/button/button-label-input';
import {
  BackgroundColorPickerPopup,
  TextColorPickerPopup,
} from '@/editor/nodes/button/button-view';
import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';

/**
 * The selected button's controls, for the Style sheet. The desktop keeps the
 * popover ButtonView opens on its own node; this reads the same attributes
 * off the selected node and writes them back through the button command, so
 * it needs only the editor — the shape every other menu here has.
 */
export function ButtonMenuContent({ editor }: { editor: Editor }) {
  // The node, compared by identity — not its attrs: tiptap's default
  // equality walks the object and calls valueOf on each value, and a null
  // colour throws inside it. A new node object arrives on every change.
  const node = useEditorState({
    editor,
    selector: ({ editor }) => {
      const block = selectedBlock(editor);
      return block?.node.type.name === 'button' ? block.node : null;
    },
    equalityFn: (a, b) => a === b,
  });
  if (!node) return null;
  const attrs = node.attrs as ButtonAttributes;
  // No focus call: the sheet is where the typing happens, and pulling focus
  // back to the canvas would raise the keyboard over it.
  const update = (next: Partial<ButtonAttributes>) => {
    editor.chain().updateButton(next).run();
  };
  const size = buttonSizeOf(attrs);

  return (
    <>
      <ButtonLabelInput
        value={attrs.text}
        isVariable={attrs.isTextVariable}
        onValueChange={(value, isVariable) => update({ text: value, isTextVariable: isVariable ?? false })}
        editor={editor}
      />

      <Divider />

      <div className="mly:flex mly:gap-x-0.5">
        <Select
          label="Border radius"
          tooltip="Border radius"
          value={attrs.borderRadius}
          options={allowedButtonBorderRadius.map((value) => ({ value, label: value }))}
          onValueChange={(value) => update({ borderRadius: value as ButtonAttributes['borderRadius'] })}
          className="mly:capitalize"
        />
        <Select
          label="Style"
          tooltip="Style"
          value={attrs.variant}
          options={allowedButtonVariant.map((value) => ({ value, label: value }))}
          onValueChange={(value) => update({ variant: value as ButtonAttributes['variant'] })}
          className="mly:capitalize"
        />
        <Select
          label="Size"
          tooltip="Size"
          placeholder="Size"
          value={size ?? ''}
          options={(Object.keys(BUTTON_SIZES) as ButtonSize[]).map((value) => ({
            value,
            label: value.charAt(0).toUpperCase() + value.slice(1),
          }))}
          onValueChange={(value) => {
            const { paddingX, paddingY } = BUTTON_SIZES[value as ButtonSize];
            update({ paddingTop: paddingY, paddingRight: paddingX, paddingBottom: paddingY, paddingLeft: paddingX });
          }}
        />
      </div>

      <Divider />

      <div className="mly:flex mly:gap-x-0.5">
        <AlignmentSwitch alignment={attrs.alignment} onAlignmentChange={(alignment) => update({ alignment })} />
        <LinkInputPopover
          defaultValue={attrs.url || ''}
          isVariable={attrs.isUrlVariable}
          onValueChange={(value, isVariable) => update({ url: value, isUrlVariable: isVariable ?? false })}
          tooltip="Link address"
          editor={editor}
        />
      </div>

      <Divider />

      <div className="mly:flex mly:gap-x-0.5">
        <BackgroundColorPickerPopup
          variant={attrs.variant}
          color={attrs.buttonColor || 'transparent'}
          onChange={(color) => update({ buttonColor: color })}
        />
        <TextColorPickerPopup color={attrs.textColor || 'transparent'} onChange={(color) => update({ textColor: color })} />
      </div>

      <Divider />

      <ShowPopover
        showIfKey={attrs.showIfKey ?? ''}
        onShowIfKeyValueChange={(value) => update({ showIfKey: value })}
        editor={editor}
      />
    </>
  );
}
