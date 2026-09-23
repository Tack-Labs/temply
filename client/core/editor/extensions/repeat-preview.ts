import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { LIST_ITEMS_DEFAULT, LIST_ITEMS_MAX } from '@temply/shared/template-data';

type Counts = Record<string, number>;
type State = { counts: Counts; decorations: DecorationSet };

export const repeatPreviewKey = new PluginKey<State>('repeatPreview');

/**
 * How many items each Repeat is previewed with, on the canvas. The sample
 * data decides — the shell sends its list counts here — and until it has
 * said anything every Repeat gets the default. Each Repeat node carries its
 * count as a decoration, which is how the node view learns it: a node view
 * re-renders when its decorations change, and nothing else about the node
 * changes when a count does.
 */
export const RepeatPreview = Extension.create({
  name: 'repeatPreview',

  addProseMirrorPlugins() {
    const decorate = (doc: EditorState['doc'], counts: Counts) => {
      const decorations: Decoration[] = [];
      doc.descendants((node, pos) => {
        if (node.type.name !== 'repeat') return;
        const count = countFor(counts, node.attrs.each);
        decorations.push(Decoration.node(pos, pos + node.nodeSize, {}, { count }));
      });
      return DecorationSet.create(doc, decorations);
    };
    return [
      new Plugin<State>({
        key: repeatPreviewKey,
        state: {
          init: (_, state) => ({ counts: {}, decorations: decorate(state.doc, {}) }),
          apply(tr, current, _old, next) {
            const counts = tr.getMeta(repeatPreviewKey) as Counts | undefined;
            if (counts === undefined && !tr.docChanged) return current;
            const merged = counts ?? current.counts;
            return { counts: merged, decorations: decorate(next.doc, merged) };
          },
        },
        props: {
          decorations(state) {
            return repeatPreviewKey.getState(state)?.decorations;
          },
        },
      }),
    ];
  },
});

function countFor(counts: Counts, each: unknown): number {
  const key = typeof each === 'string' ? each.trim() : '';
  const count = key ? counts[key] : undefined;
  return typeof count === 'number' ? count : LIST_ITEMS_DEFAULT;
}

/** The count a Repeat over `each` is previewed with right now. */
export function repeatPreviewCount(state: EditorState, each: string): number {
  return countFor(repeatPreviewKey.getState(state)?.counts ?? {}, each);
}

/** The shell's sample-data counts, applied. Not a document change: nothing
 *  to undo, nothing to save. */
export function setRepeatPreviewCounts(editor: Editor, counts: Counts): void {
  editor.view.dispatch(editor.state.tr.setMeta(repeatPreviewKey, counts).setMeta('addToHistory', false));
}

/** One key set from a Repeat's own menu, within the panel's range; the
 *  shell hears the transaction and keeps its sample data in step. */
export function setRepeatPreviewCount(editor: Editor, each: string, count: number): void {
  const key = each.trim();
  if (!key) return;
  const current = repeatPreviewKey.getState(editor.state)?.counts ?? {};
  const clamped = Math.min(LIST_ITEMS_MAX, Math.max(0, Math.round(count)));
  setRepeatPreviewCounts(editor, { ...current, [key]: clamped });
}

/** The count carried on a node view's decorations, or the default. */
export function countFromDecorations(decorations: readonly Decoration[]): number {
  for (const decoration of decorations) {
    const count = (decoration.spec as { count?: unknown }).count;
    if (typeof count === 'number') return count;
  }
  return LIST_ITEMS_DEFAULT;
}
