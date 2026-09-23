import {
  ImageUploadPlugin,
  ImageUploadPluginOptions,
} from '@/editor/plugins/image-upload/image-upload-plugin';
import { Editor, Extension } from '@tiptap/core';
import { useMemo } from 'react';

export type ImageUploadOptions = Omit<ImageUploadPluginOptions, 'editor'> & {
  /** Opens the host app's image library; resolves the chosen URL or null. The
   *  editor core does not know where images live — the app does. */
  onPickImage?: () => Promise<string | null>;
  /** Whether a src is one the host app stores, as opposed to a pasted URL. */
  isLibraryImage?: (src: string) => boolean;
};

export const ImageUploadExtension = Extension.create<ImageUploadOptions>({
  name: 'imageUpload',

  addOptions() {
    return {
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
      ],
      onImageUpload: undefined,
      onPickImage: undefined,
      isLibraryImage: undefined,
    };
  },

  addStorage() {
    return {
      placeholderImages: new Set(),
    };
  },

  addProseMirrorPlugins() {
    const { onImageUpload } = this.options;

    if (!onImageUpload) {
      return [];
    }

    return [
      ImageUploadPlugin({
        editor: this.editor,
        allowedMimeTypes: this.options.allowedMimeTypes,
        onImageUpload: this.options.onImageUpload,
      }),
    ];
  },
});

export function useImageUploadOptions(editor: Editor): ImageUploadOptions {
  return useMemo(() => {
    const node = editor.extensionManager.extensions.find(
      (extension) => extension.name === 'imageUpload'
    );

    return node?.options || {};
  }, [editor]);
}
