import { describe, expect, it } from 'bun:test';
import type { Editor } from '@tiptap/core';
import '../../test/dom';
import { makeEditor } from '../../test/make-editor';

/**
 * Presses a combination the way the browser would, through the editor's own
 * keymap rather than through the command the binding happens to name.
 *
 * `Mod` is the Control key here: prosemirror-keymap decides that from
 * `navigator.platform`, and happy-dom advertises X11 — which is what a Windows
 * or Linux customer's keyboard resolves to as well. The binding under test is
 * the one string either platform reaches.
 */
function press(editor: Editor, init: KeyboardEventInit) {
  const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
  return Boolean(editor.view.someProp('handleKeyDown', (handler) => handler(editor.view, event)));
}

const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] };

describe('the code-block shortcut', () => {
  it('builds the code block the product has', () => {
    const editor = makeEditor(doc);
    editor.commands.setTextSelection(2);

    expect(press(editor, { key: 'c', code: 'KeyC', keyCode: 67, ctrlKey: true, altKey: true })).toBe(true);

    expect(editor.state.doc.child(0).type.name).toBe('htmlCodeBlock');
    editor.destroy();
  });

  it('leaves no node in the schema the renderer cannot draw', () => {
    const editor = makeEditor(doc);
    // StarterKit's own `codeBlock` reached templates through this keystroke
    // and nothing else, and every surface downstream threw on it. Its absence
    // from the schema is what stops it coming back.
    expect(editor.state.schema.nodes.codeBlock).toBeUndefined();
    editor.destroy();
  });
});
