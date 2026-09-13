import type { Editor } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import type { BlockItem } from '@/blocks/types';
import { DEFAULT_SLASH_COMMANDS } from './extensions/slash-command/default-slash-commands';
import { selectBlockAt } from './commands/block';

export type CatalogueGroup = {
  id: 'content' | 'layout' | 'logic' | 'components';
  title: string;
  items: BlockItem[];
};

/**
 * Blocks the slash menu offers that the phone's `+` sheet does not, both for
 * the same reason: nothing on the phone can configure them once they exist.
 * An inline image is an unselectable inline atom whose own click handler sets
 * a TextSelection, so a tap raises the keyboard and the text bar instead of
 * the block bar — its width, alt, link and source controls are unreachable by
 * thumb. A link card has no entry in MENU_CONTENT, so the action bar offers no
 * Style at all; its seven fields live in a node-view popover laid out for a
 * mouse. Offering either from `+` would be a dead end; the slash menu keeps
 * them, and a card that arrived from a desktop can still be moved and deleted.
 * Hard Break is a line break at the caret, which as a tile could only make
 * a new block holding one; the phone's text bar has a key for it instead.
 * Footer, the empty footer block, sat beside Footers, the three designed
 * ones, and read as the same thing twice — a preset edited down is the
 * empty one. The set is explicit because `blockCatalogue()`'s "rest"
 * fallback re-adds anything the group titles do not name.
 */
export const PHONE_EXCLUDED_TITLES = new Set(['Inline Image', 'Link Card', 'Hard Break', 'Footer']);

/** The phone's grouping of the same blocks the slash menu offers. Titles
 *  are matched, not ids, because BlockItem has no stable id for leaves. */
export const CATALOGUE_GROUPS: Array<{ id: CatalogueGroup['id']; title: string; titles: string[] }> = [
  { id: 'content', title: 'Content', titles: ['Text', 'Heading 1', 'Heading 2', 'Heading 3', 'Bullet List', 'Numbered List', 'Image', 'Logo', 'Button', 'Blockquote'] },
  { id: 'layout', title: 'Layout', titles: ['Columns', 'Section', 'Divider', 'Spacer'] },
  { id: 'logic', title: 'Logic', titles: ['Repeat', 'Custom HTML'] },
  { id: 'components', title: 'Components', titles: ['Headers', 'Footers'] },
];

export function blockCatalogue(): CatalogueGroup[] {
  const all = DEFAULT_SLASH_COMMANDS.flatMap((group) => group.commands).filter(
    (item) => !PHONE_EXCLUDED_TITLES.has(item.title),
  );
  const seen = new Set<string>();
  const groups = CATALOGUE_GROUPS.map((group) => {
    const items = all.filter((item) => group.titles.includes(item.title) && !seen.has(item.title));
    for (const item of items) seen.add(item.title);
    return { id: group.id, title: group.title, items };
  });
  // Anything the lists above do not name still has to be reachable.
  const rest = all.filter((item) => !seen.has(item.title));
  if (rest.length > 0) groups[0].items.push(...rest);
  return groups;
}

/**
 * Runs a block's slash command for the `+` sheet. The slash menu passes the
 * range of the typed "/query"; here there is none, so the range is the empty
 * range at a caret we open first.
 *
 * A selected block is an anchor, not a target: a command run at a
 * NodeSelection would replace it. With nothing selected the caret is wherever
 * the last tap left it — a tap on the page margin parks it at the top of the
 * document — so the block goes to the end instead, which is where an author
 * adding to an email expects it. Either way an empty paragraph opens at that
 * spot to give the command the caret every slash command expects, and the new
 * block ends up selected so the action bar has a subject.
 */
export function insertBlock(editor: Editor, item: BlockItem): void {
  if (!item.command) return;
  const { selection, doc } = editor.state;
  const at = selection instanceof NodeSelection ? selection.to : doc.content.size;
  const tr = editor.state.tr.insert(at, editor.state.schema.nodes.paragraph.create());
  // A parent that rejects a paragraph — a `column` inside `columns` — makes
  // tr.insert a silent no-op, and the selection below would then land at a
  // position the anchor never opened.
  if (!tr.docChanged) return;
  tr.setSelection(TextSelection.create(tr.doc, at + 1));
  // Recorded in history, not skipped: the anchor is a content change, and the
  // command that follows it is adjacent and in the same tick, so the history
  // groups the two into the one undo step. Skipping it would leave the empty
  // paragraph behind when that step is undone.
  editor.view.dispatch(tr);

  const { from } = editor.state.selection;
  item.command({ editor, range: { from, to: from } });

  // The command replaced the anchor paragraph, so the block it made starts
  // where the anchor did. A command that inserted nothing leaves the caret.
  if (at < editor.state.doc.content.size && editor.state.doc.resolve(at).nodeAfter) {
    selectBlockAt(editor, at);
  }
}
