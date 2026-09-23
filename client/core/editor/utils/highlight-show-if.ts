import type { Editor } from '@tiptap/core';
import { showIfHighlightKey } from '../extensions/show-if-highlight';

/**
 * Outlines every block whose "Show if" reads `key`; pass null to clear.
 * The decorations themselves live in the ShowIfHighlight extension.
 *
 * `addToHistory: false` keeps a hover out of the undo stack — nothing about
 * the document changed.
 */
export function highlightShowIfKey(editor: Editor, key: string | null) {
  if (!editor?.view) return;
  editor.view.dispatch(
    editor.state.tr.setMeta(showIfHighlightKey, key).setMeta('addToHistory', false)
  );
}
