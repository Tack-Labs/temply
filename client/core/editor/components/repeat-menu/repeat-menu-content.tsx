import { cn } from '@/editor/utils/classname';
import { Editor } from '@tiptap/core';
import { InfoIcon, MinusIcon, Pencil, PlusIcon } from 'lucide-react';
import { useEditorState } from '@tiptap/react';
import { LIST_ITEMS_MAX } from '@temply/shared/template-data';
import { repeatPreviewCount, setRepeatPreviewCount } from '@/editor/extensions/repeat-preview';
import { BubbleMenuButton } from '../bubble-menu-button';
import { useMemo, useRef, useState } from 'react';
import { selectedBlock } from '@/editor/commands/block';
import { knownNames } from '@/editor/utils/variable';
import { ShowPopover, showIfDockSpec } from '../show-popover';
import { Divider } from '../ui/divider';
import { InputAutocomplete } from '../ui/input-autocomplete';
import { useInputDock } from '../ui/input-dock';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../ui/tooltip';
import { useRepeatState } from './use-repeat-state';
import { processVariables } from '@/editor/utils/variable';
import { useVariableOptions } from '@/editor/utils/node-options';

export function RepeatMenuContent({ editor }: { editor: Editor }) {
  const state = useRepeatState(editor);

  const opts = useVariableOptions(editor);
  const variables = opts?.variables;
  const renderVariable = opts?.renderVariable;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUpdatingKey, setIsUpdatingKey] = useState(false);
  // Controlled so a click opens it too: a tooltip alone closes on the
  // pointer going down, which reads as the ⓘ doing nothing to anyone who
  // clicks it rather than waits on it.
  const [infoOpen, setInfoOpen] = useState(false);
  const dock = useInputDock();

  const eachKey = state?.each || '';
  // The rows the canvas previews this Repeat with. Read off the editor, so
  // the sample-data panel and this stepper always show the same number.
  const previewCount = useEditorState({ editor, selector: ({ editor }) => repeatPreviewCount(editor.state, eachKey) }) ?? 0;
  const stepPreview = (delta: number) => setRepeatPreviewCount(editor, eachKey, previewCount + delta);
  const autoCompleteOptions = useMemo(() => {
    return processVariables(variables, {
      query: eachKey || '',
      editor,
      from: 'repeat-variable',
    }).map((variable) => variable.name);
  }, [variables, eachKey, editor]);

  const isValidEachKey = eachKey;

  // On the phone both settings are rows that open the shell's dock, the way a
  // pill's name and a link's address do: the key is typed above the keyboard
  // with the names already in use as chips, and the sheet comes back after.
  // The block re-selected after each write is whichever one was tapped —
  // usually a paragraph inside the repeat, since the tap model never lands
  // on the wrapper — so the sheet stays on it.
  if (dock) {
    const update = (attrs: { each?: string; showIfKey?: string }) => {
      const block = selectedBlock(editor);
      const chain = editor.chain().updateRepeat(attrs);
      if (block) chain.setNodeSelection(block.pos);
      chain.run();
    };
    const rowClass = 'mly:flex mly:h-11 mly:w-full mly:items-center mly:justify-between mly:gap-3 mly:rounded-md mly:border mly:border-gray-200 mly:px-3 mly:text-left mly:text-sm mly:text-midnight-gray mly:transition-colors mly:hover:bg-soft-gray';
    const valueClass = 'mly:flex mly:min-w-0 mly:items-center mly:gap-2';
    const showIfKey = state.currentShowIfKey;
    return (
      <div className="mly:flex mly:w-full mly:flex-col mly:gap-2">
        <button
          type="button"
          className={rowClass}
          onClick={() =>
            dock.open({
              title: 'Repeat',
              fields: [
                {
                  key: 'each',
                  label: 'Repeat over',
                  value: eachKey,
                  placeholder: 'items',
                  hint: 'A list in your data, one copy per item',
                  options: knownNames(editor, 'variables', variables, 'repeat-variable'),
                },
              ],
              onCommit: (values) => update({ each: values.each.trim() }),
            })
          }
        >
          <span className="mly:shrink-0 mly:text-xs mly:text-gray-500">Repeat over</span>
          <span className={valueClass}>
            <span className="mly:truncate mly:font-mono">{eachKey || '—'}</span>
            <Pencil className="mly:h-3 mly:w-3 mly:shrink-0 mly:stroke-[2.5]" />
          </span>
        </button>
        <button
          type="button"
          className={rowClass}
          onClick={() => dock.open(showIfDockSpec(showIfKey, knownNames(editor, 'conditions', variables, 'bubble-variable'), (when) => update({ showIfKey: when })))}
        >
          <span className="mly:shrink-0 mly:text-xs mly:text-gray-500">Show if</span>
          <span className={valueClass}>
            <span className={cn('mly:truncate', showIfKey ? 'mly:font-mono' : 'mly:text-gray-400')}>{showIfKey || 'Always'}</span>
            <Pencil className="mly:h-3 mly:w-3 mly:shrink-0 mly:stroke-[2.5]" />
          </span>
        </button>
        <div className={cn(rowClass, 'mly:hover:bg-transparent')}>
          <span className="mly:shrink-0 mly:text-xs mly:text-gray-500">Preview rows</span>
          <span className="mly:flex mly:items-center mly:gap-1">
            <button type="button" aria-label="Fewer preview rows" disabled={previewCount <= 0} onClick={() => stepPreview(-1)} className="mly:flex mly:size-7 mly:items-center mly:justify-center mly:rounded-md mly:hover:bg-soft-gray mly:disabled:opacity-40">
              <MinusIcon className="mly:h-3 mly:w-3 mly:stroke-[2.5]" />
            </button>
            <span className="mly:min-w-6 mly:text-center mly:font-mono mly:tabular-nums" aria-live="polite">{previewCount}</span>
            <button type="button" aria-label="More preview rows" disabled={previewCount >= LIST_ITEMS_MAX} onClick={() => stepPreview(1)} className="mly:flex mly:size-7 mly:items-center mly:justify-center mly:rounded-md mly:hover:bg-soft-gray mly:disabled:opacity-40">
              <PlusIcon className="mly:h-3 mly:w-3 mly:stroke-[2.5]" />
            </button>
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mly:flex mly:items-center mly:gap-1.5 mly:px-1.5 mly:text-sm mly:leading-none">
        Repeat
        <Tooltip open={infoOpen} onOpenChange={setInfoOpen}>
          <TooltipTrigger type="button" aria-label="About Repeat" onClick={() => setInfoOpen(true)}>
            <InfoIcon
              className={cn('mly:size-3 mly:stroke-[2.5] mly:text-gray-500')}
            />
          </TooltipTrigger>
          <TooltipContent
            sideOffset={14}
            className="mly:max-w-[260px]"
            align="start"
          >
            Ensure the selected variable is iterable, such as an array of
            objects.
          </TooltipContent>
        </Tooltip>
      </div>
      {!isUpdatingKey && (
        <button
          onClick={() => {
            setIsUpdatingKey(true);
            setTimeout(() => {
              inputRef.current?.focus();
            }, 0);
          }}
        >
          {renderVariable({
            variable: {
              name: state?.each,
              valid: isValidEachKey,
            },
            fallback: '',
            from: 'bubble-variable',
            editor,
          })}
        </button>
      )}
      {isUpdatingKey && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setIsUpdatingKey(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsUpdatingKey(false);
            }
          }}
        >
          <InputAutocomplete
            editor={editor}
            placeholder="ie. payload.items"
            value={state?.each || ''}
            onValueChange={(value) => {
              editor.commands.updateRepeat({
                each: value,
              });
            }}
            onOutsideClick={() => {
              setIsUpdatingKey(false);
            }}
            onSelectOption={(value) => {
              editor.commands.updateRepeat({
                each: value,
              });
              setIsUpdatingKey(false);
            }}
            autoCompleteOptions={autoCompleteOptions}
            ref={inputRef}
          />
        </form>
      )}

      <Divider />
      {/* How many rows the canvas draws under the one being edited. The same
          number the Preview data panel holds; this is the place a person
          looks for it while writing. */}
      <div className="mly:flex mly:items-center mly:gap-0.5" title="Rows the canvas previews this Repeat with">
        <BubbleMenuButton icon={MinusIcon} tooltip="Fewer preview rows" command={() => stepPreview(-1)} disbabled={previewCount <= 0} />
        <span className="mly:min-w-6 mly:text-center mly:font-mono mly:text-xs mly:text-gray-500 mly:tabular-nums" aria-live="polite">×{previewCount}</span>
        <BubbleMenuButton icon={PlusIcon} tooltip="More preview rows" command={() => stepPreview(1)} disbabled={previewCount >= LIST_ITEMS_MAX} />
      </div>
      <Divider />
      <ShowPopover
        showIfKey={state.currentShowIfKey}
        onShowIfKeyValueChange={(value) => {
          editor.commands.updateRepeat({
            showIfKey: value,
          });
        }}
        editor={editor}
      />
    </>
  );
}
