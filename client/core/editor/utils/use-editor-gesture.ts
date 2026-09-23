import type { Editor } from '@tiptap/core';
import { useEffect, useMemo } from 'react';

/**
 * Has the customer touched this editor yet, and have the menus been told to
 * look again. Both hang off the editor, because they only work as a pair: the
 * telling happens once and then disarms itself, so a flag with a shorter life
 * than the editor's would go back down with nothing left to raise it. The six
 * menus that read this are a React subtree of their own, and React is free to
 * remount one of them without remounting the editor above it.
 */
const gestured = new WeakSet<Editor>();
const told = new WeakSet<Editor>();

/**
 * Whether the customer has touched the canvas yet, for every bubble menu to
 * read from its `shouldShow`.
 *
 * A bubble menu is a response to a gesture. The desktop editor opens with
 * `autofocus="end"`, which parks the caret inside whatever the document ends
 * in, so a template finishing in a Section — or a Columns, a Repeat, an Image,
 * a Spacer or an HTML block — used to open with that block's menu already up,
 * covering the block above it before anyone had asked for it. The caret is in
 * the right place; the menu is not, because nobody made a selection.
 *
 * The listeners sit in the capture phase on the element that holds the canvas
 * rather than on the canvas itself, so the flag is already true by the time
 * ProseMirror turns the gesture into a selection and the menus re-ask. The
 * wrapper is what makes the drag handle count: its container is a sibling of
 * the canvas, not a child of it, so the "+" and the grip — both of which put
 * a block under the caret without the pointer ever touching `view.dom` —
 * would otherwise leave the gate down and the new block's menu with it. They
 * come off again once the gesture has been seen: the flag never goes back
 * down, so there is nothing left for them to do.
 *
 * That first gesture also has to make the menus re-ask, because it often
 * changes nothing for them to notice: a click inside the block the caret is
 * already in — past the end of its last line, say — leaves the selection
 * exactly where it was, and a bubble menu re-reads `shouldShow` only when the
 * document or the selection moves. The editor's own focus event is what every
 * bubble menu already listens to for "look again now", and nothing else in
 * the app reads it.
 */
export function useEditorGesture(editor: Editor | null | undefined): { readonly current: boolean } {
  useEffect(() => {
    if (!editor) return;
    // The canvas is mounted into a wrapper of tiptap's own making, and the
    // drag handle hangs off that wrapper. There is no frame in which the one
    // exists without the other, but a canvas with no parent is a canvas, so
    // the gate falls back to it rather than going unarmed.
    const dom = editor.view.dom.parentElement ?? editor.view.dom;
    const stop = () => {
      dom.removeEventListener('pointerdown', open, true);
      dom.removeEventListener('keydown', open, true);
    };
    const open = () => {
      gestured.add(editor);
      stop();
      if (told.has(editor)) return;
      told.add(editor);
      editor.emit('focus', { editor, event: new FocusEvent('focus'), transaction: editor.state.tr });
    };
    dom.addEventListener('pointerdown', open, true);
    dom.addEventListener('keydown', open, true);
    return stop;
  }, [editor]);

  // Shaped like a ref so a `shouldShow` reads it the same way, but answered
  // from the editor on every read: `shouldShow` is called long after the last
  // render, and the answer may have been written by one of the other menus.
  return useMemo(
    () => ({
      get current() {
        return !!editor && gestured.has(editor);
      },
    }),
    [editor]
  );
}
