import { VariableExtension } from '@/extensions';
import { AnyExtension } from '@tiptap/core';
import { HTMLCodeBlockExtension } from '../nodes/html/html';
import { InlineImageExtension } from '../nodes/inline-image/inline-image';
import { getVariableSuggestions } from '../nodes/variable/variable-suggestions';
import { MailyContextType } from '../provider';
import { TemplyKit } from './temply-kit';
import { ImageUploadExtension } from './image-upload/image-upload';
import { PlaceholderExtension } from './placeholder';
import { SlashCommandExtension } from './slash-command/slash-command';
import { getSlashCommandSuggestions } from './slash-command/slash-command-view';
import { SelectionExtension } from './selection/selection';
import { BlockSelection } from '../plugins/block-selection';
import { RepeatPreview } from './repeat-preview';

type ExtensionsProps = Partial<MailyContextType> & {
  extensions?: AnyExtension[];
  touch?: boolean;
};

export function extensions(props: ExtensionsProps) {
  const {
    blocks,
    extensions = [],
    onImageUpload,
    allowedMimeTypes,
    onPickImage,
    isLibraryImage,
    touch = false,
  } = props;

  const defaultExtensions = [
    TemplyKit,
    ImageUploadExtension.configure({
      onImageUpload,
      onPickImage,
      isLibraryImage,
      ...(allowedMimeTypes ? { allowedMimeTypes } : {}),
    }),
    SlashCommandExtension.configure({
      suggestion: getSlashCommandSuggestions(blocks),
    }),
    VariableExtension.configure({
      suggestion: getVariableSuggestions(),
    }),
    HTMLCodeBlockExtension,
    InlineImageExtension,
    PlaceholderExtension,
    SelectionExtension,
    RepeatPreview,
    ...(touch ? [BlockSelection] : []),
  ].filter((ext) => {
    return !extensions.some((e) => e.name === ext.name);
  });

  return [...defaultExtensions, ...extensions];
}
