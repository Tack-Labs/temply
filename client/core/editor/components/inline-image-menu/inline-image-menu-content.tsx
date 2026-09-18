import { Editor } from '@tiptap/core';
import { ImageSize } from '../image-menu/image-size';
import { useInlineImageState } from './use-inline-image-state';
import { LinkInputPopover } from '../ui/link-input-popover';
import { ImageDownIcon } from 'lucide-react';
import {
  DEFAULT_INLINE_IMAGE_HEIGHT,
  DEFAULT_INLINE_IMAGE_WIDTH,
} from '@/editor/nodes/inline-image/inline-image';

export function InlineImageMenuContent({ editor }: { editor: Editor }) {
  const state = useInlineImageState(editor);

  return (
    <div className="mly:flex mly:gap-x-0.5">
      <LinkInputPopover
        defaultValue={state?.src ?? ''}
        onValueChange={(value, isVariable) => {
          editor
            ?.chain()
            .updateAttributes('inlineImage', {
              src: value,
              isSrcVariable: isVariable ?? false,
            })
            .run();
        }}
        tooltip="Image source"
        icon={ImageDownIcon}
        editor={editor}
        isVariable={state.isSrcVariable}
      />

      <LinkInputPopover
        defaultValue={state?.imageExternalLink ?? ''}
        onValueChange={(value, isVariable) => {
          editor
            ?.chain()
            .updateAttributes('inlineImage', {
              externalLink: value,
              isExternalLinkVariable: isVariable ?? false,
            })
            .run();
        }}
        tooltip="Link address"
        editor={editor}
        isVariable={state.isExternalLinkVariable}
      />

      <ImageSize
        dimension="height"
        value={state?.height}
        onValueChange={(value) => {
          editor
            ?.chain()
            .updateAttributes('inlineImage', {
              width: value || DEFAULT_INLINE_IMAGE_WIDTH,
              height: value || DEFAULT_INLINE_IMAGE_HEIGHT,
            })
            .run();
        }}
      />
    </div>
  );
}
