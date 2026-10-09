'use client';

import type { Editor } from '@tiptap/core';
import { DEFAULT_SLASH_COMMANDS } from '~/core/editor/extensions/slash-command/default-slash-commands';
import { cn } from '~/lib/classname';
import { pressable } from '../ui/button';
import { blockLabel, insertBlockBelowSelection } from './insert-block';

const common = ['Text', 'Heading 1', 'Heading 2', 'Button', 'Image', 'Logo', 'Divider', 'Spacer', 'Columns', 'Section', 'Repeat'];

/**
 * The playground's block list: the framed editor's Components rail cut down
 * to one card with no collapse, since the playground has no rails to fold.
 * The tiles are drawn as the rail draws them, so a visitor who signs up meets
 * the same control.
 */
export function BlockLibrary({ editor, disabled }: { editor: Editor | null; disabled: boolean }) {
  const blocks = DEFAULT_SLASH_COMMANDS[0].commands.filter((block) => common.includes(block.title));
  return (
    <aside aria-label="Add content" className="rounded-card border border-transparent bg-raised p-5 shadow-sm">
      <p className="text-xs font-bold tracking-widest text-accent-ink uppercase">Start here</p>
      <h2 className="mt-1 font-display text-xl font-bold tracking-display text-ink">Add content</h2>
      <p className="mt-2 text-base leading-relaxed text-muted">Click a block to add it below the part you’re editing. Then change its words or settings in the email.</p>
      <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-1">
        {blocks.map((block) => (
          <button
            key={block.title}
            type="button"
            disabled={!editor || disabled}
            onClick={() => { if (editor) insertBlockBelowSelection(editor, block); }}
            className={cn(
              pressable,
              'group flex h-12 cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] border-line bg-raised px-2 text-left text-ui font-semibold text-ink hover:border-line-strong hover:bg-hover',
              'disabled:pointer-events-none disabled:text-disabled',
            )}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-wash text-accent-ink group-disabled:bg-sunken group-disabled:text-disabled [&_svg]:size-5">
              {block.icon}
            </span>
            <span className="min-w-0 truncate">{blockLabel(block.title)}</span>
          </button>
        ))}
      </div>
      <div className="mt-5 rounded-xl bg-accent-wash px-4 py-3.5 text-base text-accent-ink">
        <p className="font-bold">Make it personal</p>
        <p className="mt-1">Type <kbd className="rounded-xs bg-raised px-1 font-mono text-ink">@</kbd> in a line of text to add a detail that changes, like a first name.</p>
      </div>
    </aside>
  );
}
