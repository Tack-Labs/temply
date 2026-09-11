'use client';

import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import type { Transaction } from '@tiptap/pm/state';
import { Trash2Icon } from 'lucide-react';
import { useEffect } from 'react';
import { deleteEnclosingNode, enclosingNode, selectedBlock } from '~/core/editor/commands/block';
import { hasStyleContent, menuContentFor } from '~/core/editor/components/menu-content';
import { RepeatMenuContent } from '~/core/editor/components/repeat-menu/repeat-menu-content';
import { Divider } from '~/core/editor/components/ui/divider';
import { TooltipProvider } from '~/core/editor/components/ui/tooltip';
import { Button } from '~/components/ui/button';
import { BottomSheet } from './bottom-sheet';

const LABELS: Record<string, string> = {
  image: 'Image',
  logo: 'Logo',
  spacer: 'Spacer',
  section: 'Section',
  columns: 'Columns',
  column: 'Column',
  variable: 'Variable',
  repeat: 'Repeat',
  htmlCodeBlock: 'HTML',
  inlineImage: 'Inline image',
  paragraph: 'Text',
  heading: 'Heading',
  footer: 'Footer',
  button: 'Button',
};

/** Where a followed position lands after a transaction, or null once the
 *  content it pointed at has been removed. The distinction the Style sheet
 *  leans on, kept out of the component so a test can hold it to it. */
export function followPosition(pos: number, transaction: Transaction): number | null {
  if (!transaction.docChanged) return pos;
  const mapped = transaction.mapping.mapResult(pos);
  return mapped.deleted ? null : mapped.pos;
}

/** The selected block's controls — the same components the desktop bubble
 *  menu draws — in a sheet, with the canvas still visible above. */
export function StylePanel({ editor, open, onOpenChange, returnFocus }: { editor: Editor | null; open: boolean; onOpenChange: (o: boolean) => void; returnFocus?: boolean }) {
  // `editor` can still be null while the lazy editor is mounting; the hook
  // itself must run unconditionally, so the null case is threaded through
  // the selector rather than skipping the call.
  const typeName = useEditorState({
    editor,
    selector: ({ editor }) => (editor ? (selectedBlock(editor)?.node.type.name ?? null) : null),
  });
  const Content = typeName ? menuContentFor(typeName) : null;
  // A block inside a Repeat carries the repeat's settings below its own: the
  // tap model never selects the wrapper itself (see enclosingNode), so the
  // block tapped inside it is where they are found.
  const inRepeat = useEditorState({ editor, selector: ({ editor }) => (editor ? enclosingNode(editor, 'repeat') !== null : false) });
  const hasContent = useEditorState({ editor, selector: ({ editor }) => (editor ? hasStyleContent(editor) : false) });

  // Both ways the sheet can end up pointing at nothing, and both go through
  // onOpenChange — never through simply rendering less. `open` is the shell's
  // own flag, and that flag is what holds the canvas read-only: a sheet that
  // quietly stopped rendering took Radix's onOpenChange with it and left the
  // editor answering no taps at all, with nothing on screen to clear it.

  // One: the block it was opened on is gone. Section and Columns each offer
  // Delete, and the selection then falls back to a neighbour — which is no
  // signal at all, since the section that slides into a deleted section's
  // place has the same type at the same position. So the block is followed
  // through the document's own mappings, which say outright when the content
  // a position points at has been removed, and say nothing when a control
  // merely moves the block about (the list buttons wrap it in a list, which
  // shifts everything after them along). The position followed is one inside
  // the node rather than its start: the start is the boundary a wrap inserts
  // at, and mapping that reports the block deleted every time.
  useEffect(() => {
    if (!open || !editor) return;
    const block = selectedBlock(editor);
    if (!block) {
      onOpenChange(false);
      return;
    }
    let pos = block.pos + 1;
    const follow = ({ transaction }: { transaction: Transaction }) => {
      const next = followPosition(pos, transaction);
      if (next === null) onOpenChange(false);
      else pos = next;
    };
    editor.on('transaction', follow);
    return () => {
      editor.off('transaction', follow);
    };
  }, [open, editor, onOpenChange]);

  // Two: what is selected has no settings to show. Turn a paragraph into a
  // list and the node holding the selection is one this has no entry for; the
  // Style button never offers that state, so neither should the sheet.
  useEffect(() => {
    if (open && !hasContent) onOpenChange(false);
  }, [open, hasContent, onOpenChange]);

  const title = Content && typeName ? (LABELS[typeName] ?? typeName) : inRepeat ? LABELS.repeat : 'Style';
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} returnFocus={returnFocus} title={title}>
      {/* The menu components use Radix Tooltip and normally get their provider
          from the desktop bubble-menu wrapper; the sheet is their only
          ancestor here, so it supplies one. */}
      <TooltipProvider>
        {/* The menu components carry the editor's own `mly:` styles and were
            laid out for a horizontal strip a mouse aims at: 28px controls that
            wrap here and are grown to a thumb's 44px in both directions. The
            strip's vertical dividers go: between wrapped 44px targets they
            read as uneven gaps rather than groups. */}
        <div className="mly-editor flex flex-wrap items-center gap-2 py-1 [&_button]:min-h-11 [&_button]:min-w-11 [&_input]:min-h-11 [&_[data-divider=vertical]]:hidden">
          {/* The repeat's settings sit above the block's own, the way a pill's
              fields sit above its text formatting: what the block is part of
              comes before what it looks like. Delete is here rather than on
              the bar, whose Delete acts on the block tapped; deleting the
              repeat takes the block with it, and the sheet closes on losing
              its block. */}
          {inRepeat && editor ? (
            <div className="flex w-full flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted">Repeat</p>
                <Button type="button" variant="danger-quiet" size="icon" className="-my-2 size-11" aria-label="Delete repeat" onClick={() => deleteEnclosingNode(editor, 'repeat')}>
                  <Trash2Icon />
                </Button>
              </div>
              <RepeatMenuContent editor={editor} />
              {Content ? <Divider type="horizontal" /> : null}
            </div>
          ) : null}
          {Content && editor ? <Content editor={editor} /> : null}
        </div>
      </TooltipProvider>
    </BottomSheet>
  );
}
