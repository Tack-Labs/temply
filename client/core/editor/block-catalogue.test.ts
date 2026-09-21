import { describe, expect, it } from 'bun:test';
import { NodeSelection } from '@tiptap/pm/state';
import './test/dom';
import { blockCatalogue, CATALOGUE_GROUPS, insertBlock, PHONE_EXCLUDED_TITLES } from './block-catalogue';
import { makeEditor } from './test/make-editor';
import { DEFAULT_SLASH_COMMANDS } from './extensions/slash-command/default-slash-commands';

describe('blockCatalogue', () => {
  it('groups every slash command into exactly one group with exact title matching', () => {
    const groups = blockCatalogue();

    // Each group's items must exactly match its titles array (not just contain)
    for (const group of groups) {
      const catalogueGroup = CATALOGUE_GROUPS.find(g => g.id === group.id);
      const groupTitles = group.items.map(i => i.title);
      expect(groupTitles).toEqual(catalogueGroup?.titles ?? []);
    }
  });

  it('accounts for every slash command but the excluded ones, without duplication or silent fallback', () => {
    const groups = blockCatalogue();
    const allRealTitles = DEFAULT_SLASH_COMMANDS.flatMap(g => g.commands)
      .map(item => item.title)
      .filter(title => !PHONE_EXCLUDED_TITLES.has(title));
    const cataloguedTitles = groups.flatMap(g => g.items.map(i => i.title));

    // Every real command is catalogued, sorted to verify exact match
    expect(cataloguedTitles.sort()).toEqual(allRealTitles.sort());

    // No duplicates
    expect(cataloguedTitles.length).toBe(new Set(cataloguedTitles).size);
  });

  it('leaves the excluded blocks out of the sheet but not out of the slash menu', () => {
    const cataloguedTitles = blockCatalogue().flatMap(g => g.items.map(i => i.title));
    const slashTitles = DEFAULT_SLASH_COMMANDS.flatMap(g => g.commands).map(i => i.title);
    for (const title of PHONE_EXCLUDED_TITLES) {
      expect(slashTitles).toContain(title);
      expect(cataloguedTitles).not.toContain(title);
    }
  });

  it('prevents title duplication across group definitions', () => {
    // No title should appear in more than one group's titles array
    const allTitles = CATALOGUE_GROUPS.flatMap(g => g.titles);
    expect(allTitles.length).toBe(new Set(allTitles).size);
  });

  it('puts layout blocks under layout and logic blocks under logic', () => {
    const byId = Object.fromEntries(blockCatalogue().map((g) => [g.id, g.items.map((i) => i.title)]));
    expect(byId.layout).toEqual(expect.arrayContaining(['Columns', 'Section', 'Divider', 'Spacer']));
    expect(byId.logic).toEqual(expect.arrayContaining(['Repeat']));
    expect(byId.components).toEqual(expect.arrayContaining(['Headers', 'Footers']));
  });
});

describe('insertBlock', () => {
  const doc = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'first' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'second' }] },
    ],
  };
  const divider = blockCatalogue().flatMap((g) => g.items).find((i) => i.title === 'Divider')!;

  it('inserts below the selected block instead of replacing it', () => {
    const editor = makeEditor(doc);
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)));

    insertBlock(editor, divider);

    const kinds = editor.state.doc.children.map((node) => node.type.name);
    expect(editor.state.doc.child(0).textContent).toBe('first');
    expect(kinds.indexOf('horizontalRule')).toBe(1);
    // The anchor paragraph is the command's target, not a leftover beside it.
    expect(kinds).toEqual(['paragraph', 'horizontalRule', 'paragraph']);
    editor.destroy();
  });

  it('inserts at the end when no block is selected', () => {
    const editor = makeEditor(doc);
    // What the tap-off-the-page clear leaves: a caret at the top, no block.
    editor.commands.setTextSelection(1);

    insertBlock(editor, divider);

    const kinds = editor.state.doc.children.map((node) => node.type.name);
    // The trailing paragraph is tiptap's own: a rule at the very end of a
    // document gets one so there is somewhere to type after it.
    expect(kinds).toEqual(['paragraph', 'paragraph', 'horizontalRule', 'paragraph']);
    expect(editor.state.doc.child(0).textContent).toBe('first');
    expect(editor.state.doc.child(1).textContent).toBe('second');
    editor.destroy();
  });

  it('selects the block it inserted, so the action bar has a subject', () => {
    const editor = makeEditor(doc);
    editor.commands.setTextSelection(1);

    insertBlock(editor, divider);

    const selection = editor.state.selection;
    expect(selection).toBeInstanceOf(NodeSelection);
    expect((selection as NodeSelection).node.type.name).toBe('horizontalRule');
    editor.destroy();
  });

  it('undoes in one step, leaving no anchor paragraph behind', () => {
    const editor = makeEditor(doc);
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)));

    insertBlock(editor, divider);
    editor.commands.undo();

    expect(editor.state.doc.children.map((node) => node.type.name)).toEqual(['paragraph', 'paragraph']);
    editor.destroy();
  });
});
