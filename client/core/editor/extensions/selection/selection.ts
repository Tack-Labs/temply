import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const SelectionExtension = Extension.create({
  name: 'selection',

  addProseMirrorPlugins() {
    const { editor } = this;

    return [
      new Plugin({
        key: new PluginKey('selection'),
        props: {
          decorations(state) {
            if (state.selection.empty) {
              return null;
            }

            if (editor.isFocused === true) {
              return null;
            }

            // this is a hack to make sure the selection is visible
            // when the editor is not focused (e.g. when trigger a popover or something similar)
            return DecorationSet.create(state.doc, [
              Decoration.inline(state.selection.from, state.selection.to, {
                // The accent with white text: the selection reads the same on a white
                // canvas, a coloured one, and under the dark-mode veil, where a
                // pale blue on grey text washed out to nothing.
                class: 'selection mly:bg-accent mly:text-white mly:inline mly:py-1',
              }),
            ]);
          },
        },
      }),
    ];
  },
});
