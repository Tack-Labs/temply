'use client';

import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { SlidersHorizontalIcon } from 'lucide-react';
import { blockCommands, isInlineAtomSelected } from '~/core/editor/commands/block';
import type { EditorCommand } from '~/core/editor/commands/types';
import { hasStyleContent } from '~/core/editor/components/menu-content';
import { pressable } from '~/components/ui/button';
import { cn } from '~/lib/classname';

function BarButton({ editor, command, className }: { editor: Editor; command: EditorCommand; className?: string }) {
  // Own subscription, not a value read in the render body: moving a block
  // up/down changes nothing `BlockActionBar`'s `typeName` selector watches,
  // so without this the greyed-out state at an edge would only catch up on
  // some unrelated re-render.
  const enabled = useEditorState({ editor, selector: ({ editor }) => (command.isEnabled ? command.isEnabled(editor) : true) });
  return (
    <button
      type="button"
      aria-label={command.label}
      title={command.label}
      disabled={!enabled}
      onClick={() => command.run(editor)}
      className={cn('flex h-11 min-w-11 flex-1 items-center justify-center rounded-md text-ink hover:bg-hover disabled:opacity-45', pressable, className)}
    >
      <command.icon className="size-5" />
    </button>
  );
}

/**
 * Up, down, Style, duplicate, delete for the selected block. Style only
 * shows when there are settings to open: the block's own, or the Repeat's
 * around it.
 *
 * An inline atom — a variable pill — is selected by the same tap and shows on
 * this same face, but it is not a block: it sits between words, so up, down
 * and duplicate have no sibling blocks to work with. It gets Style and Delete
 * and nothing else. Omitted rather than disabled, because a button that can
 * never be pressed for this kind of selection is only noise.
 */
export function BlockActionBar({ editor, styleOpen, onStyle }: { editor: Editor; styleOpen: boolean; onStyle: () => void }) {
  const hasStyle = useEditorState({ editor, selector: ({ editor }) => hasStyleContent(editor) });
  const inlineAtom = useEditorState({ editor, selector: ({ editor }) => isInlineAtomSelected(editor) });
  return (
    <div className="flex h-14 items-center gap-1 px-2">
      {inlineAtom ? null : (
        <>
          <BarButton editor={editor} command={blockCommands.moveUp} />
          <BarButton editor={editor} command={blockCommands.moveDown} />
        </>
      )}
      {hasStyle ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={styleOpen}
          onClick={onStyle}
          className={cn('flex h-11 flex-[2] items-center justify-center gap-1.5 rounded-md text-sm font-medium text-ink hover:bg-hover', pressable)}
        >
          <SlidersHorizontalIcon className="size-5" />
          Style
        </button>
      ) : null}
      {inlineAtom ? null : <BarButton editor={editor} command={blockCommands.duplicate} />}
      {/* Two controls share the bar for a pill, and an equal share would give
          Delete a third of the width under the thumb — far more of a target
          than it has on the block face. It keeps its icon-button size and
          Style takes the room. */}
      <BarButton editor={editor} command={blockCommands.remove} className={inlineAtom ? 'flex-none px-3' : undefined} />
    </div>
  );
}
