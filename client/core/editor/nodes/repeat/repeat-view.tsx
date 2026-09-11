import { NodeViewProps, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Repeat2 } from 'lucide-react';
import { isTouchEditor } from '@/editor/plugins/block-selection';

export function RepeatView(props: NodeViewProps) {
  const { editor, getPos } = props;

  return (
    <NodeViewWrapper
      data-type="repeat"
      draggable={editor.isEditable}
      data-drag-handle={editor.isEditable}
      className="mly:relative"
    >
      <NodeViewContent className="is-editable" />

      {/* The strip in the margin says "this is a repeat" — the box itself
          looks like whatever is inside it. On the desktop it is also the
          target that selects the wrapper for the bubble menu, and fades until
          the block has focus. A finger cannot hit a 12px strip, and on the
          phone the repeat's settings are reached from the block tapped inside
          it instead, so there it is only the mark: always on, taking no taps. */}
      {isTouchEditor(editor) ? (
        <div
          data-repeat-indicator=""
          aria-hidden
          className="mly:pointer-events-none mly:absolute mly:inset-y-0 mly:right-0 mly:flex mly:translate-x-full mly:flex-col mly:items-center mly:gap-1"
          contentEditable={false}
        >
          <Repeat2 className="mly:size-3 mly:stroke-[2.5] mly:text-accent-ink" />
          <div className="mly:w-[1.5px] mly:grow mly:rounded-full mly:bg-accent-ink" />
        </div>
      ) : (
        <div
          role="button"
          data-repeat-indicator=""
          className="mly:absolute mly:inset-y-0 mly:right-0 mly:flex mly:translate-x-full mly:cursor-pointer mly:flex-col mly:items-center mly:gap-1 mly:opacity-60"
          contentEditable={false}
          onClick={() => {
            editor.commands.setNodeSelection(getPos());
          }}
        >
          <Repeat2 className="mly:size-3 mly:stroke-[2.5] mly:text-midnight-gray" />
          <div className="mly:w-[1.5px] mly:grow mly:rounded-full mly:bg-accent-ink" />
        </div>
      )}
    </NodeViewWrapper>
  );
}
