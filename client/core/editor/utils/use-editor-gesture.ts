import type { Editor } from '@tiptap/core';
import { useEffect, useRef } from 'react';

/**
 * Every menu calls this, and only the first of them to see the gesture needs
 * to tell the rest to look again.
 */
const told = new WeakSet<Editor>();

/**
 * Whether the customer has touched the canvas yet, as a ref every bubble menu
 * can read from its `shouldShow`.
 *
 * A bubble menu is a response to a gesture. The desktop editor opens with
 * `autofocus="end"`, which parks the caret inside whatever the document ends
 * in, so a template finishing in a Section — or a Columns, a Repeat, an Image,
 * a Spacer or an HTML block — used to open with that block's menu already up,
 * covering the block above it before anyone had asked for it. The caret is in
 * the right place; the menu is not, because nobody made a selection.
 *
 * The listeners sit on the editor's own DOM in the capture phase, so the flag
 * is already true by the time ProseMirror turns the gesture into a selection
 * and the menus re-ask. They come off again once it has been seen: the flag
 * never goes back down, so there is nothing left for them to do.
 *
 * That first gesture also has to make the menus re-ask, because it often
 * changes nothing for them to notice: a click inside the block the caret is
 * already in — past the end of its last line, say — leaves the selection
 * exactly where it was, and a bubble menu re-reads `shouldShow` only when the
 * document or the selection moves. The editor's own focus event is what every
 * bubble menu already listens to for "look again now", and nothing else in
 * the app reads it.
 */
export function useEditorGesture(editor: Editor | null | undefined) {
  const gestured = useRef(false);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const stop = () => {
      dom.removeEventListener('pointerdown', open, true);
      dom.removeEventListener('keydown', open, true);
    };
    const open = () => {
      gestured.current = true;
      stop();
      if (told.has(editor)) return;
      told.add(editor);
      editor.emit('focus', { editor, event: new FocusEvent('focus'), transaction: editor.state.tr });
    };
    dom.addEventListener('pointerdown', open, true);
    dom.addEventListener('keydown', open, true);
    return stop;
  }, [editor]);

  return gestured;
}
