import { Editor, type JSONContent } from '@tiptap/core';
import { GapCursor } from '@tiptap/pm/gapcursor';
import type { ResolvedPos } from '@tiptap/pm/model';
import { extensions } from '../extensions';

// Builds a real tiptap editor against the app's extension set, with no React
// tree — for unit tests that exercise ProseMirror-level commands directly.
// `opts.touch` is accepted but does nothing: the editor core no longer has a
// touch mode, and dropping the option here would mean editing every case
// across the suite that still passes it for a document shape unrelated to
// touch at all.
export function makeEditor(content: JSONContent, opts: { touch?: boolean } = {}): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    content,
    extensions: extensions({}),
  });
  // EditorView.destroy() only tears down its own contenteditable inside
  // element, never element itself, which would otherwise pile up orphans on
  // the one happy-dom document shared by the whole test process. Wrapped
  // rather than hung off the 'destroy' event: an editor holding a variable
  // pill with an open suggestion throws part-way through teardown under
  // happy-dom, and the event never fires — leaving the orphan behind for
  // whichever test runs next to trip over.
  const teardown = editor.destroy.bind(editor);
  editor.destroy = () => {
    try {
      teardown();
    } finally {
      element.remove();
    }
  };
  return editor;
}

/**
 * Whether a customer can still put a caret after the document's last block —
 * the gap cursor ProseMirror places there. This is what the editor relies on
 * instead of adding a trailing paragraph, so a case that used to assert the
 * paragraph exists asserts this instead.
 */
export function caretFitsAfterLastBlock(editor: Editor): boolean {
  // `GapCursor.valid` is prosemirror-gapcursor's own answer to this question
  // and the one its plugin asks; the package's types leave the static off.
  const { valid } = GapCursor as unknown as { valid(pos: ResolvedPos): boolean };
  return valid(editor.state.doc.resolve(editor.state.doc.content.size));
}
