import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { Pencil } from 'lucide-react';
import { selectedBlock } from '@/editor/commands/block';
import { useVariableOptions } from '@/editor/utils/node-options';
import { knownNames } from '@/editor/utils/variable';
import { TextBubbleContent } from '../text-menu/text-bubble-content';
import { Divider } from '../ui/divider';
import { useInputDock } from '../ui/input-dock';

/**
 * The selected variable pill's settings, for the Style sheet. The desktop
 * keeps them in a popover the pill opens on itself (variable-view.tsx);
 * this is the same two fields — the variable's name and the placeholder
 * shown when the data has no value for it — read off the selected node and
 * written back with updateAttributes, each typed in the shell's dock, the
 * name with every known variable offered as a chip. The text formatting
 * the desktop's bubble menu gives a pill follows below.
 */
export function VariableMenuContent({ editor }: { editor: Editor }) {
  // The node, compared by identity — not its attrs: tiptap's default
  // equality walks the object and calls valueOf on each value, and a null
  // attribute throws inside it. A new node object arrives on every change.
  const node = useEditorState({
    editor,
    selector: ({ editor }) => {
      const block = selectedBlock(editor);
      return block?.node.type.name === 'variable' ? block.node : null;
    },
    equalityFn: (a, b) => a === b,
  });
  const dock = useInputDock();
  const variables = useVariableOptions(editor)?.variables;
  if (!node) return null;
  const attrs = node.attrs as { id?: string | null; fallback?: string | null; hideDefaultValue?: boolean };
  const id = attrs.id ?? '';
  const fallback = attrs.fallback ?? '';
  const hideDefaultValue = attrs.hideDefaultValue ?? false;
  // Re-selected after the write: the pill is an inline React node view, and
  // re-rendering it under a NodeSelection leaves ProseMirror reading a text
  // selection back off the DOM — which would turn the sheet into the Text
  // one the moment a name was committed.
  const update = (attrs: { id?: string; fallback?: string }) => {
    const block = selectedBlock(editor);
    const chain = editor.chain().updateAttributes('variable', attrs);
    if (block) chain.setNodeSelection(block.pos);
    chain.run();
  };
  const rowClass = 'mly:flex mly:h-11 mly:w-full mly:items-center mly:justify-between mly:gap-3 mly:rounded-md mly:border mly:border-gray-200 mly:px-3 mly:text-left mly:text-sm mly:text-midnight-gray mly:transition-colors mly:hover:bg-soft-gray';

  return (
    <div className="mly:flex mly:w-full mly:flex-col mly:gap-2">
      {dock ? (
        <button
          type="button"
          className={rowClass}
          onClick={() =>
            dock.open({
              title: 'Variable',
              fields: [
                {
                  key: 'name',
                  label: 'Name',
                  value: id,
                  placeholder: 'first_name',
                  hint: 'The name your data uses',
                  options: knownNames(editor, 'variables', variables, 'bubble-variable'),
                },
                ...(hideDefaultValue
                  ? []
                  : [{ key: 'placeholder', label: 'Placeholder', value: fallback, placeholder: 'there', hint: 'Shown when the data has no value' }]),
              ],
              // A pill that hides its default value is asked for no
              // placeholder, so none comes back and none is written — the
              // absent key is the whole test.
              onCommit: (values) =>
                update({ id: values.name.trim(), ...('placeholder' in values ? { fallback: values.placeholder } : {}) }),
            })
          }
        >
          <span className="mly:shrink-0 mly:text-xs mly:text-gray-500">Variable</span>
          <span className="mly:flex mly:min-w-0 mly:items-center mly:gap-2">
            <span className="mly:truncate mly:font-mono">{id || '—'}</span>
            {!hideDefaultValue && fallback ? <span className="mly:truncate mly:text-gray-400">/ {fallback}</span> : null}
            <Pencil className="mly:h-3 mly:w-3 mly:shrink-0 mly:stroke-[2.5]" />
          </span>
        </button>
      ) : (
        // Without a dock (no phone shell) the fields are typed in place.
        <div className="mly:flex mly:gap-2">
          <label className="mly:flex mly:flex-1 mly:flex-col mly:gap-1 mly:text-xs mly:text-gray-500">
            Variable
            <input value={id} onChange={(e) => update({ id: e.target.value })} className="mly:h-9 mly:rounded-md mly:border mly:border-gray-200 mly:px-2 mly:text-sm mly:text-midnight-gray" />
          </label>
          {!hideDefaultValue && (
            <label className="mly:flex mly:flex-1 mly:flex-col mly:gap-1 mly:text-xs mly:text-gray-500">
              Placeholder
              <input value={fallback} onChange={(e) => update({ fallback: e.target.value })} className="mly:h-9 mly:rounded-md mly:border mly:border-gray-200 mly:px-2 mly:text-sm mly:text-midnight-gray" />
            </label>
          )}
        </div>
      )}
      <Divider type="horizontal" />
      <div className="mly:flex mly:flex-wrap mly:items-center mly:gap-2">
        <TextBubbleContent showListMenu={false} editor={editor} />
      </div>
    </div>
  );
}
