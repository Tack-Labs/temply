import { Extension } from '@tiptap/core';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';
import { revealInsertedBlock } from '@/editor/utils/reveal-block';

export type SlashCommandOptions = {
  suggestion: Omit<SuggestionOptions, 'editor'>;
};

export const SlashCommandExtension = Extension.create<SlashCommandOptions>({
  name: 'slash-command',
  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
          // Every block the slash menu inserts comes through here — the "/"
          // typed into the canvas and the drag handle's "+", which types one
          // for the customer — so this is where a new block is made sure of.
          revealInsertedBlock(editor);
        },
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
