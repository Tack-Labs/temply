import type { Editor } from '@tiptap/core';
import { cn } from '@/editor/utils/classname';
import { layerWillTakeEscape } from '@/editor/utils/escape-layer';

/**
 * The named strip of controls a bubble menu is made of, and the keyboard's
 * way out of it.
 *
 * Nine of these can be on screen in one editor, and none of them said which
 * block it acts on: tiptap's `BubbleMenu` renders a single div and forwards
 * only `className` to it, so a menu had nowhere to carry a role or a name.
 * This wrapper is that place, and the layout comes with it — left on the div
 * above, the controls would be children of an unnamed flex row and the name
 * would sit on a box with nothing in it.
 *
 * The name is the block, not the word "menu": the role supplies that, so a
 * reader hears "Section toolbar" rather than "Section menu menu".
 *
 * Escape is the other half of the gesture `MenuFocus` opens — it puts the
 * caret back where it was, with the selection still drawn, so a customer who
 * came in by the keyboard is not stranded among buttons with no way home.
 */
export function MenuToolbar({
  editor,
  label,
  className,
  children,
}: {
  editor: Editor;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      className={cn(className)}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        // Escape belongs to the innermost thing the customer opened — a
        // colour popover, a dropdown — and only then to the way out of here.
        if (layerWillTakeEscape()) return;
        event.preventDefault();
        editor.commands.focus();
      }}
    >
      {children}
    </div>
  );
}
