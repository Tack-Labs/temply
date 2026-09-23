import { isTextSelection } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { Editor } from '@tiptap/react';

/**
 * Whether the customer has a run of content selected — the question the
 * bubble menus ask before deciding who has the floor. Select-all is an
 * `AllSelection` rather than a text selection and still counts; a selected
 * block does not, because that is the moment the block's own menu has to be
 * up, and the menus settle among themselves by node name rather than here.
 */
export function isTextSelected(editor: Editor) {
  const {
    state: {
      doc,
      selection,
      selection: { empty, from, to },
    },
  } = editor;

  // Sometime check for `empty` is not enough.
  // Doubleclick an empty paragraph returns a node size of 2.
  // So we check also for an empty text size.
  const isEmptyTextBlock =
    !doc.textBetween(from, to).length && isTextSelection(selection);

  if (
    empty ||
    isEmptyTextBlock ||
    selection instanceof NodeSelection ||
    !editor.isEditable
  ) {
    return false;
  }

  return true;
}
