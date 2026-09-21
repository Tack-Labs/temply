import type { FocusPosition, JSONContent, Editor as TiptapEditor } from '@tiptap/core';
import { lazy, Suspense, useState } from 'react';
import { PageLoading } from '~/components/ui/page-loading';
import { cn } from '~/lib/classname';

const Editor = lazy(() =>
  import('~/core').then((module) => ({
    default: module.Editor,
  }))
);

type EmailEditorProps = {
  /** Already a document: the model parses and migrates a stored row through
   *  `storedDocument`, which is the only place either happens. */
  defaultContent: JSONContent;
  setEditor: (editor: TiptapEditor) => void;
  autofocus?: FocusPosition;
  onImageUpload?: (file: Blob) => Promise<string>;
  allowedMimeTypes?: string[];
  onPickImage?: () => Promise<string | null>;
  isLibraryImage?: (src: string) => boolean;
  /** False mounts the canvas read-only: the phone shows a template rather
   *  than editing one. */
  editable?: boolean;
  touch?: boolean;
};

export function EmailEditor(props: EmailEditorProps) {
  const {
    defaultContent,
    setEditor,
    autofocus,
    onImageUpload,
    allowedMimeTypes,
    onPickImage,
    isLibraryImage,
    editable = true,
    touch,
  } = props;

  const [isLoading, setIsLoading] = useState(true);

  return (
    <>
      {isLoading && <PageLoading label="Loading the editor…" />}

      <Suspense>
        <Editor
          onImageUpload={onImageUpload}
          allowedMimeTypes={allowedMimeTypes}
          onPickImage={onPickImage}
          isLibraryImage={isLibraryImage}
          touch={touch}
          editable={editable}
          config={{
            hasMenuBar: false,
            wrapClassName: cn('editor-wrap', isLoading && 'hidden'),
            bodyClassName: '!mt-0 !border-0 !p-0',
            // Layout (page background, card width, paddings) is painted by the
            // sandbox from the live theme, so the content carries none of its
            // own — hardcoded padding here would double what the theme sets.
            contentClassName: 'editor-content',
            toolbarClassName: 'flex-wrap !items-start',
            spellCheck: false,
            autofocus,
            immediatelyRender: false,
          }}
          contentJson={defaultContent}
          onCreate={(editor) => {
            setIsLoading(false);
            setEditor(editor);
          }}
          onUpdate={(editor) => {
            setEditor(editor);
          }}
        />
      </Suspense>
    </>
  );
}
