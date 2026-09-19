import { describe, expect, it } from 'bun:test';
import '../test/dom';
import { makeEditor } from '../test/make-editor';
import { selectedBlock } from '../commands/block';
import { isEditingText, isTouchEditor, tapTransaction } from './block-selection';

const doc = { type: 'doc', content: [
  { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'two' }] },
] };

/** Drives the model the way the view would: a tap resolving to `pos`, inside
 *  the block that holds it. Returns true when the tap selected a block and
 *  false when it was left to ProseMirror (a second tap: place the caret). */
function tap(editor: ReturnType<typeof makeEditor>, pos: number, focused = true) {
  const { view } = editor;
  const $pos = view.state.doc.resolve(pos);
  const inside = $pos.depth > 0 ? $pos.before($pos.depth) : -1;
  const tap = tapTransaction(view.state, pos, inside, focused);
  if (!tap) return false;
  view.dispatch(tap.tr);
  return !tap.edit;
}

describe('BlockSelection (touch)', () => {
  it('first tap selects the block, second tap on the same block enters text editing', () => {
    const editor = makeEditor(doc, { touch: true });
    expect(tap(editor, 7)).toBe(true);             // inside "two"
    expect(isEditingText(editor)).toBe(false);
    expect(selectedBlock(editor)!.node.textContent).toBe('two');
    expect(tap(editor, 7)).toBe(false);            // second tap: a caret at the finger
    expect(editor.state.selection.empty).toBe(true);
    expect(editor.state.selection.from).toBe(7);
    editor.commands.setTextSelection(7);           // what the default handler does
    expect(isEditingText(editor)).toBe(true);
    editor.destroy();
  });

  it('a tap on a different block selects that block instead of editing', () => {
    const editor = makeEditor(doc, { touch: true });
    tap(editor, 7);
    expect(tap(editor, 2)).toBe(true);
    expect(selectedBlock(editor)!.node.textContent).toBe('one');
    expect(isEditingText(editor)).toBe(false);
    editor.destroy();
  });

  it('is only installed on a touch editor', () => {
    const mouse = makeEditor(doc);
    const touch = makeEditor(doc, { touch: true });
    expect(isTouchEditor(mouse)).toBe(false);
    expect(isTouchEditor(touch)).toBe(true);
    mouse.destroy();
    touch.destroy();
  });

  it('a tap on a variable pill selects the pill, not the paragraph around it', () => {
    const editor = makeEditor(
      { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi ' }, { type: 'variable', attrs: { id: 'firstName' } }] }] },
      { touch: true },
    );
    const { view } = editor;
    const pillPos = 4; // after "Hi " inside the paragraph
    const pill = view.state.doc.nodeAt(pillPos)!;
    expect(pill.type.name).toBe('variable');
    const tap = tapTransaction(view.state, pillPos, pillPos);
    expect(tap?.edit).toBe(false);
    view.dispatch(tap!.tr);
    expect(selectedBlock(editor)!.node.type.name).toBe('variable');
    expect(isEditingText(editor)).toBe(false);
    editor.destroy();
  });

  it('a caret parked by autofocus, with no focus, still lets the first tap select', () => {
    // How a template opens: a text selection in the first block, the
    // editor not focused, no keyboard. The tap is the first gesture.
    const editor = makeEditor(doc, { touch: true });
    editor.commands.setTextSelection(2);
    expect(editor.isFocused).toBe(false);
    expect(tap(editor, 2, false)).toBe(true);
    expect(selectedBlock(editor)?.pos).toBe(0);
    editor.destroy();
  });

  it('a tap inside the block being typed in is left to the browser', () => {
    const editor = makeEditor(doc, { touch: true });
    tap(editor, 7);                                   // select "two"
    expect(tap(editor, 7)).toBe(false);               // edit it
    expect(tapTransaction(editor.state, 8, 5)).toBeNull(); // another tap in "two": caret moves, no reselect
    expect(isEditingText(editor)).toBe(true);
    expect(tap(editor, 2)).toBe(true);                // a tap in "one" still selects that block
    expect(selectedBlock(editor)!.node.textContent).toBe('one');
    editor.destroy();
  });
});
