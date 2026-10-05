'use client';

import type { Editor } from '@tiptap/core';
import { DEFAULT_SLASH_COMMANDS } from '~/core/editor/extensions/slash-command/default-slash-commands';
import { revealInsertedBlock } from '~/core/editor/utils/reveal-block';
import { Button } from '../ui/button';

const common = ['Text', 'Heading 1', 'Heading 2', 'Button', 'Image', 'Logo', 'Divider', 'Spacer', 'Columns', 'Section', 'Repeat'];

export function BlockLibrary({ editor, disabled }: { editor: Editor | null; disabled: boolean }) {
  const blocks = DEFAULT_SLASH_COMMANDS[0].commands.filter((block) => common.includes(block.title));
  return (
    <aside aria-label="Add content" className="rounded-xl border border-line bg-raised p-4 shadow-sm">
      <p className="text-xs font-medium text-accent-ink">Start here</p>
      <h2 className="mt-1 font-display text-base font-semibold text-ink">Add content</h2>
      <p className="mt-2 text-xs leading-relaxed text-muted">Click a block to add it below the part you’re editing. Then change its words or settings in the email.</p>
      <div className="mt-4 grid grid-cols-2 gap-1.5 lg:grid-cols-1">
        {blocks.map((block) => <Button key={block.title} variant="ghost" disabled={!editor || disabled}
          className="justify-start text-sm" onClick={() => {
            if (!editor || !block.command) return;
            const { $from } = editor.state.selection;
            const position = $from.depth > 0 ? $from.after(1) : editor.state.doc.content.size;
            editor.chain().focus().insertContentAt(position, { type: 'paragraph' }).setTextSelection(position + 1).run();
            block.command({ editor, range: { from: position + 1, to: position + 1 } });
            revealInsertedBlock(editor);
          }}>
          {block.icon}<span>{block.title === 'Heading 1' ? 'Heading' : block.title === 'Heading 2' ? 'Subheading' : block.title === 'Repeat' ? 'Repeating list' : block.title}</span>
        </Button>)}
      </div>
      <div className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-muted">
        <p className="font-medium text-ink">Make it personal</p>
        <p className="mt-1">Type <kbd className="rounded bg-hover px-1 font-mono">@</kbd> in a line of text to add a detail that changes, like a first name.</p>
      </div>
    </aside>
  );
}
