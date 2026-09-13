import { NodeViewProps, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { DOMSerializer } from '@tiptap/pm/model';
import { Repeat2 } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { isTouchEditor, selectBlockAt } from '@/editor/plugins/block-selection';
import { countFromDecorations } from '@/editor/extensions/repeat-preview';

export function RepeatView(props: NodeViewProps) {
  const { editor, getPos, node, decorations } = props;
  const count = countFromDecorations(decorations);

  // The rows the list would add, drawn under the one being edited: the
  // same content serialised to static DOM, so what is typed above appears
  // below on the next render. Static on purpose — the copies are a preview
  // of repetition, not more places to type. Appended as nodes rather than
  // set as HTML: a pill serialises to a div inside the paragraph, which the
  // HTML parser would push out of the paragraph and onto its own line.
  const fragment = useMemo(
    () => (count > 1 ? DOMSerializer.fromSchema(editor.schema).serializeFragment(node.content) : null),
    [editor.schema, node, count],
  );

  const touch = isTouchEditor(editor);
  // A press on a copy is a press on the row it copies: the live row is the
  // only place to edit, so that is where the selection goes — the block
  // itself on the phone (the tap model), the caret on the desktop.
  const toLiveRow = (event: ReactMouseEvent) => {
    event.preventDefault();
    const pos = getPos();
    if (typeof pos !== 'number') return;
    if (touch) selectBlockAt(editor, pos + 1);
    else editor.chain().focus().setTextSelection(pos + 2).run();
  };
  const mark = (
    <>
      <Repeat2 className={`mly:size-3 mly:stroke-[2.5] ${touch ? 'mly:text-accent-ink' : 'mly:text-midnight-gray'}`} />
      {count > 1 ? <span className="mly:font-mono mly:text-[10px] mly:leading-none mly:text-accent-ink">×{count}</span> : null}
      <div className="mly:w-[1.5px] mly:grow mly:rounded-full mly:bg-accent-ink" />
    </>
  );

  return (
    <NodeViewWrapper
      data-type="repeat"
      draggable={editor.isEditable}
      data-drag-handle={editor.isEditable}
      className="mly:relative"
    >
      <NodeViewContent className="is-editable" />
      {fragment
        ? Array.from({ length: count - 1 }, (_, index) => <Copy key={index} fragment={fragment} onPress={toLiveRow} />)
        : null}

      {/* The strip in the margin says "this is a repeat" — the box itself
          looks like whatever is inside it — and carries the preview count.
          On the desktop it is also the target that selects the wrapper for
          the bubble menu, and fades until the block has focus. A finger
          cannot hit a 12px strip, and on the phone the repeat's settings are
          reached from the block tapped inside it instead, so there it is
          only the mark: always on, taking no taps. */}
      {touch ? (
        <div
          data-repeat-indicator=""
          aria-hidden
          className="mly:pointer-events-none mly:absolute mly:inset-y-0 mly:right-0 mly:flex mly:translate-x-full mly:flex-col mly:items-center mly:gap-1"
          contentEditable={false}
        >
          {mark}
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
          {mark}
        </div>
      )}
    </NodeViewWrapper>
  );
}

/** One faded copy of the row, filled from the serialised fragment. */
function Copy({ fragment, onPress }: { fragment: DocumentFragment | HTMLElement; onPress: (event: ReactMouseEvent) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.replaceChildren(fragment.cloneNode(true));
  }, [fragment]);
  return <div ref={ref} className="mly-repeat-copy" contentEditable={false} aria-hidden onMouseDown={onPress} />;
}
