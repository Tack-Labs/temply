import { describe, expect, it } from 'bun:test';
import '../test/dom';
import { makeEditor } from '../test/make-editor';
import { alignCommands, currentTextColor, setTextColor, textCommands } from './text';

describe('text commands', () => {
  it('toggles bold on the selection and reports it active', () => {
    const editor = makeEditor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] });
    editor.commands.setTextSelection({ from: 1, to: 6 });
    expect(textCommands.bold.isActive!(editor)).toBe(false);
    textCommands.bold.run(editor);
    expect(textCommands.bold.isActive!(editor)).toBe(true);
    expect(editor.getHTML()).toContain('<strong>');
    editor.destroy();
  });

  it('sets and reads the text colour', () => {
    const editor = makeEditor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] });
    editor.commands.setTextSelection({ from: 1, to: 6 });
    setTextColor(editor, '#dc2626');
    expect(currentTextColor(editor).toLowerCase()).toBe('#dc2626');
    editor.destroy();
  });

  it('runs without refocusing when told to', () => {
    const editor = makeEditor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] });
    editor.commands.setTextSelection({ from: 1, to: 6 });
    let focusCalls = 0;
    const focus = editor.view.focus.bind(editor.view);
    editor.view.focus = () => { focusCalls++; focus(); };

    alignCommands[1]!.run(editor, { focus: false });
    setTextColor(editor, '#059669', { focus: false });
    textCommands.strike.run(editor, { focus: false });
    expect(focusCalls).toBe(0);
    expect(editor.isActive({ textAlign: 'center' })).toBe(true);
    expect(currentTextColor(editor).toLowerCase()).toBe('#059669');
    expect(textCommands.strike.isActive!(editor)).toBe(true);
    editor.destroy();
  });

  it('breaks the line inside the paragraph rather than starting a new block', () => {
    const editor = makeEditor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] });
    editor.commands.setTextSelection(6);
    textCommands.lineBreak.run(editor);
    expect(editor.state.doc.childCount).toBe(1);
    expect(editor.getHTML()).toMatch(/Hello<br/);
    editor.destroy();
  });
});
