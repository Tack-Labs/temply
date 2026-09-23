import { useImageUploadOptions } from '@/editor/extensions/image-upload/image-upload';
import { AllowedLogoSize, allowedLogoSize } from '@/editor/nodes/logo/logo';
import { getNewHeight, getNewWidth } from '@/editor/utils/aspect-ratio';
import { borderRadius } from '@/editor/utils/border-radius';
import { Editor } from '@tiptap/core';
import { ImageDown, LockIcon, LockOpenIcon } from 'lucide-react';
import { AlignmentSwitch } from '../alignment-switch';
import { BubbleMenuButton } from '../bubble-menu-button';
import { ShowPopover } from '../show-popover';
import { Divider } from '../ui/divider';
import { LinkInputPopover } from '../ui/link-input-popover';
import { Select } from '../ui/select';
import { AltTextInput } from './alt-text-input';
import { ImageSize } from './image-size';
import { useImageState } from './use-image-state';
import {
  IMAGE_MAX_WIDTH,
} from '@/editor/nodes/image/image-view';

export function ImageMenuContent({ editor }: { editor: Editor }) {
  const state = useImageState(editor);
  const { isLibraryImage } = useImageUploadOptions(editor);

  const { lockAspectRatio } = state;

  return (
    <>
      {state.isLogoActive && state.imageSrc && (
        <>
          <Select
            label="Size"
            tooltip="Size"
            value={state.logoSize}
            options={allowedLogoSize.map((size) => ({
              value: size,
              label: size,
            }))}
            onValueChange={(value) => {
              editor
                ?.chain()
                .focus()
                .setLogoAttributes({ size: value as AllowedLogoSize })
                .run();
            }}
          />

          <Divider />
        </>
      )}

      <div className="mly:flex mly:gap-x-0.5">
        <AlignmentSwitch
          alignment={state.alignment}
          onAlignmentChange={(alignment) => {
            const isCurrentNodeImage = state.isImageActive;
            if (!isCurrentNodeImage) {
              editor?.chain().focus().setLogoAttributes({ alignment }).run();
            } else {
              editor
                ?.chain()
                .focus()
                .updateAttributes('image', { alignment })
                .run();
            }
          }}
        />

        <LinkInputPopover
          defaultValue={state?.imageSrc ?? ''}
          onValueChange={(value, isVariable) => {
            if (state.isLogoActive) {
              editor
                ?.chain()
                .setLogoAttributes({
                  src: value,
                  isSrcVariable: isVariable ?? false,
                })
                .run();
            } else {
              editor
                ?.chain()
                .updateAttributes('image', {
                  src: value,
                  isSrcVariable: isVariable ?? false,
                })
                .run();
            }
          }}
          tooltip="Image source"
          icon={ImageDown}
          editor={editor}
          isVariable={state.isSrcVariable}
          showImageStatus
          triggerProps={{ 'aria-label': 'Image source' }}
        />

        {/* Where the bytes live is the one thing the URL field does not
            say: our library, or a host the user controls. */}
        {isLibraryImage && state.imageSrc && !state.isSrcVariable && (
          <span className="mly:flex mly:items-center mly:px-1.5 mly:text-xs mly:leading-none mly:text-gray-400">
            {isLibraryImage(state.imageSrc) ? 'Library' : 'External'}
          </span>
        )}

        <AltTextInput
          value={state.imageAlt}
          onChange={(alt) => {
            const type = state.isLogoActive ? 'logo' : 'image';
            editor?.chain().updateAttributes(type, { alt }).run();
          }}
        />

        {state.isImageActive && (
          <LinkInputPopover
            defaultValue={state?.imageExternalLink ?? ''}
            onValueChange={(value, isVariable) => {
              editor
                ?.chain()
                .updateAttributes('image', {
                  externalLink: value,
                  isExternalLinkVariable: isVariable ?? false,
                })
                .run();
            }}
            tooltip="Link address"
            editor={editor}
            isVariable={state.isExternalLinkVariable}
            triggerProps={{ 'aria-label': 'Link address' }}
          />
        )}
      </div>

      {state.isImageActive && state.imageSrc && (
        <>
          <Divider />

          <Select
            label="Border radius"
            value={state?.borderRadius}
            options={borderRadius.map((value) => ({
              value: String(value.value),
              label: value.name,
            }))}
            onValueChange={(value) => {
              editor
                ?.chain()
                .updateAttributes('image', {
                  borderRadius: Number(value),
                })
                .run();
            }}
            tooltip="Border radius"
            className="mly:capitalize"
          />

          <div className="mly:flex mly:gap-x-0.5">
            <ImageSize
              dimension="width"
              value={state?.width ?? ''}
              onValueChange={(value) => {
                const width = Math.min(Number(value) || 0, IMAGE_MAX_WIDTH);
                const currentHeight = Number(state.height) || 0;
                const currentWidth = Number(state.width) || 0;
                const hasValidAspectRatio =
                  state.aspectRatio &&
                  isFinite(state.aspectRatio) &&
                  state.aspectRatio > 0;
                const currentAspectRatio = hasValidAspectRatio
                  ? state.aspectRatio
                  : currentHeight > 0
                    ? currentWidth / currentHeight
                    : 1;
                const isHeightAuto = !state.height || state.height === 'auto';
                const shouldUpdateHeight =
                  (lockAspectRatio || isHeightAuto) &&
                  value &&
                  (hasValidAspectRatio || currentHeight > 0);

                editor
                  ?.chain()
                  .updateAttributes('image', {
                    width: String(width),
                    ...(shouldUpdateHeight
                      ? {
                          height: String(
                            getNewHeight(width, currentAspectRatio)
                          ),
                        }
                      : {}),
                  })
                  .run();
              }}
            />
            <ImageSize
              dimension="height"
              value={state?.height ?? ''}
              onValueChange={(value) => {
                const height = Number(value) || 0;
                const currentHeight = Number(state.height) || 0;
                const currentWidth = Number(state.width) || 0;
                const hasValidAspectRatio =
                  state.aspectRatio &&
                  isFinite(state.aspectRatio) &&
                  state.aspectRatio > 0;
                const currentAspectRatio = hasValidAspectRatio
                  ? state.aspectRatio
                  : currentHeight > 0
                    ? currentWidth / currentHeight
                    : 1;
                const isWidthAuto = !state.width || state.width === 'auto';
                const shouldUpdateWidth =
                  (lockAspectRatio || isWidthAuto) &&
                  value &&
                  (hasValidAspectRatio || currentWidth > 0);

                editor
                  ?.chain()
                  .updateAttributes('image', {
                    height: String(height),
                    ...(shouldUpdateWidth
                      ? {
                          width: String(getNewWidth(height, currentAspectRatio)),
                        }
                      : {}),
                  })
                  .run();
              }}
            />

            <BubbleMenuButton
              isActive={() => lockAspectRatio}
              command={() => {
                const width = Number(state.width) || 0;
                const height = Number(state.height) || 0;
                const aspectRatio = width / height;

                editor
                  ?.chain()
                  .updateAttributes('image', {
                    lockAspectRatio: !lockAspectRatio,
                    aspectRatio,
                  })
                  .run();
              }}
              icon={lockAspectRatio ? LockIcon : LockOpenIcon}
              tooltip="Lock aspect ratio"
            />
          </div>
        </>
      )}

      <Divider />
      <ShowPopover
        showIfKey={state.currentShowIfKey}
        onShowIfKeyValueChange={(value) => {
          editor
            ?.chain()
            .updateAttributes(state.isLogoActive ? 'logo' : 'image', {
              showIfKey: value,
            })
            .run();
        }}
        editor={editor}
      />
    </>
  );
}
