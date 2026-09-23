import { describe, expect, it } from 'bun:test';
import '../test/dom';
import { makeEditor } from '../test/make-editor';
import { knownNames } from './variable';

const withVariables = (...names: string[]) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: names.map((id) => ({ type: 'variable', attrs: { id } })) }],
});

const withCondition = (showIfKey: string, ...variableNames: string[]) => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { showIfKey },
      content: variableNames.map((id) => ({ type: 'variable', attrs: { id } })),
    },
  ],
});

describe('knownNames', () => {
  it('offers the names the template already uses', () => {
    const editor = makeEditor(withVariables('first_name', 'company'));
    expect(knownNames(editor, 'variables', [], 'content-variable')('')).toEqual(['first_name', 'company']);
    editor.destroy();
  });

  it('narrows to what has been typed, anywhere in the name', () => {
    const editor = makeEditor(withVariables('first_name', 'company'));
    const search = knownNames(editor, 'variables', [], 'content-variable');
    expect(search('name')).toContain('first_name');
    expect(search('name')).not.toContain('company');
    editor.destroy();
  });

  it('offers nothing from an empty template rather than throwing', () => {
    const editor = makeEditor({ type: 'doc', content: [{ type: 'paragraph' }] });
    expect(knownNames(editor, 'variables', undefined, 'content-variable')('')).toEqual([]);
    editor.destroy();
  });

  it('lists a name once when the app offers it too', () => {
    const editor = makeEditor(withVariables('first_name'));
    const names = knownNames(editor, 'variables', [{ name: 'first_name' }], 'content-variable')('');
    expect(names.filter((n) => n === 'first_name')).toHaveLength(1);
    editor.destroy();
  });

  it('reads condition names, not variable names, for kind "conditions"', () => {
    const editor = makeEditor(withCondition('isMember', 'first_name'));
    const names = knownNames(editor, 'conditions', [], 'bubble-variable')('');
    expect(names).toEqual(['isMember']);
    expect(names).not.toContain('first_name');
    editor.destroy();
  });

  it('reads the document once per call, not once per query', () => {
    const editor = makeEditor(withVariables('first_name'));
    const search = knownNames(editor, 'variables', [], 'content-variable');
    // An empty query matches every in-document name (a bare substring test)
    // without the app-list fallback that a non-empty query would add, so
    // this call's result reflects the document snapshot exactly.
    expect(search('')).toEqual(['first_name']);
    // Mutated after the snapshot was taken: a re-snapshotting implementation
    // would pick this up on the next call; the snapshot-at-open contract
    // means it must not.
    editor.chain().insertContent({ type: 'variable', attrs: { id: 'last_name' } }).run();
    expect(search('')).toEqual(['first_name']);
    editor.destroy();
  });
});
