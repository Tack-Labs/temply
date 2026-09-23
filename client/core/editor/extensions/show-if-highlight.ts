import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const showIfHighlightKey = new PluginKey<DecorationSet>('showIfHighlight');

/** Marks the blocks that hang off one condition key. Styled in _editor.css. */
export const SHOW_IF_HIGHLIGHT_CLASS = 'mly-show-if-highlight';

/**
 * Outlines every block whose "Show if" reads one key, so hovering a suggestion
 * answers "what else does this affect?" without hunting through the email. A
 * condition usually spans several blocks — a heading, its paragraph, its
 * button — and nothing else in the editor shows that grouping.
 *
 * This has to be a decoration. Writing the class straight onto the DOM works
 * for a frame and then vanishes: ProseMirror re-renders plain nodes from their
 * own attributes and drops anything it did not put there, so text blocks lost
 * the outline while node views (buttons, spacers) kept it. Decorations are the
 * supported way to attach transient styling, and they cover both kinds.
 */
export const ShowIfHighlight = Extension.create({
  name: 'showIfHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: showIfHighlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, current, _oldState, newState) {
            const key = tr.getMeta(showIfHighlightKey) as string | null | undefined;
            // No instruction in this transaction: keep what we have, mapped
            // through whatever the transaction did to the document.
            if (key === undefined) return current.map(tr.mapping, tr.doc);
            if (!key) return DecorationSet.empty;

            const decorations: Decoration[] = [];
            newState.doc.descendants((node, pos) => {
              if (node.attrs?.showIfKey !== key) return;
              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  class: SHOW_IF_HIGHLIGHT_CLASS,
                })
              );
            });
            return DecorationSet.create(newState.doc, decorations);
          },
        },
        props: {
          decorations(state) {
            return showIfHighlightKey.getState(state);
          },
        },
      }),
    ];
  },
});
