import { Editor, useEditorState } from '@tiptap/react';
import deepEql from 'fast-deep-equal';

/**
 * Takes a missing editor so the menus can ask before they know they have one:
 * a hook below an early return is a hook React may never see again.
 */
export const useSpacerState = (editor: Editor | null) => {
  const states = useEditorState({
    editor,
    selector: (ctx) => {
      return {
        currentShowIfKey: ctx.editor?.getAttributes('spacer')?.showIfKey || '',
        currentHeight: Number(ctx.editor?.getAttributes('spacer')?.height) || 0,
      };
    },
    equalityFn: deepEql,
  });

  return states ?? { currentShowIfKey: '', currentHeight: 0 };
};
