import {
  getColumnCount,
  getColumnWidths,
  isColumnsSelected,
} from '@/editor/utils/columns';
import { Editor, useEditorState } from '@tiptap/react';
import deepEql from 'fast-deep-equal';

export const useColumnsState = (editor: Editor) => {
  const states = useEditorState({
    editor,
    selector: (ctx) => {
      return {
        isSectionActive: ctx.editor.isActive('section'),
        isColumnActive: ctx.editor.isActive('column'),
        // The count and the widths belong to the wrapper, and a
        // NodeSelection of the wrapper carries no caret in any column — so
        // `isColumnActive` is false there and would hide the two settings a
        // Columns block exists for. Indices run from the first column
        // either way.
        isColumnsSelected: isColumnsSelected(ctx.editor),

        currentVerticalAlignment:
          ctx.editor.getAttributes('column')?.verticalAlign || 'top',

        currentShowIfKey: ctx.editor.getAttributes('columns')?.showIfKey || '',

        columnsCount: getColumnCount(ctx.editor),
        columnWidths: getColumnWidths(ctx.editor).map((c) => c.width),

        currentColumnsGap: ctx.editor.getAttributes('columns')?.gap || 0,
      };
    },
    equalityFn: deepEql,
  });

  return states;
};
