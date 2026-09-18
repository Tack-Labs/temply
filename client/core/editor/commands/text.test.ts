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

/**
 * One action, one spelling. The phone's format bar reads its labels from this
 * file; the desktop's menus used to write their own, in another dialect and
 * another case — `Align Center` against `Align centre`, `Ordered List`
 * against `Numbered list` — so the same button was two different words
 * depending on the width of the window.
 *
 * The rule the product settled on is its own voice everywhere it already had
 * one: sentence case, British spelling. A block's name is the exception, and
 * stays the proper noun the slash menu and the documentation both give it.
 */
describe('how an action is spelled', () => {
  it('is sentence case and British, whichever control offers it', () => {
    expect(alignCommands.map((command) => command.label)).toEqual([
      'Align left',
      'Align centre',
      'Align right',
    ]);
    expect(textCommands.bulletList.label).toBe('Bullet list');
    expect(textCommands.orderedList.label).toBe('Numbered list');
  });

  it('is spelled that way in every label the editor renders', async () => {
    // The pairs above are shared constants now, but most of the editor's
    // labels are literals in the component that draws them, and those are
    // where the American title case came in with the vendored menus. Read
    // off the source, since nothing else can see a label nobody opened.
    const root = Bun.fileURLToPath(new URL('../', import.meta.url));
    const drifted =
      /Align (?:Left|Center|Right)|Ordered List|(?:Text|Background|Border) Color|Border (?:Radius|Width)|Columns Gap|Lock Aspect Ratio|Text Direction|Update External Link|Source URL|HTML Code|Extra (?:Small|Large)/;
    const found: string[] = [];
    let scanned = 0;
    let labels = 0;

    for await (const relative of new Bun.Glob('**/*.{ts,tsx}').scan({ cwd: root })) {
      scanned += 1;
      const source = await Bun.file(root + relative).text();
      for (const [, label] of source.matchAll(/(?:tooltip|label|aria-label|title)[=:]\s*["']([^"']+)["']/g)) {
        labels += 1;
        if (drifted.test(label)) found.push(`${relative}: ${label}`);
      }
    }

    expect(found.sort()).toEqual([]);
    // Both halves have to be finding something, or a pattern that had stopped
    // matching would pass on an empty result.
    expect(scanned).toBeGreaterThan(100);
    expect(labels).toBeGreaterThan(50);
  });
});
