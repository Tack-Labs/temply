import { Editor } from '@tiptap/core';
import { Eye, InfoIcon } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { cn } from '../utils/classname';
import { highlightShowIfKey } from '../utils/highlight-show-if';
import { useVariableOptions } from '../utils/node-options';
import { useKnownNames } from '../utils/use-known-names';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { InputAutocomplete } from './ui/input-autocomplete';
import { useInputDock, type InputDockSpec } from './ui/input-dock';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

/** The condition as the phone's dock takes it. Shared with the Repeat
 *  sheet's Show-if row, so the two ask the same question in the same words. */
export function showIfDockSpec(showIfKey: string, names: (query: string) => string[], onChange: (when: string) => void): InputDockSpec {
  return {
    title: 'Show if',
    fields: [
      {
        key: 'condition',
        label: 'Show if',
        value: showIfKey,
        placeholder: 'e.g. isMember',
        hint: 'Shown only when this is true in the data you send',
        options: names,
      },
    ],
    onCommit: (values) => onChange(values.condition.trim()),
  };
}

type ShowPopoverProps = {
  showIfKey?: string;
  onShowIfKeyValueChange?: (when: string) => void;

  editor: Editor;
};

function _ShowPopover(props: ShowPopoverProps) {
  const { showIfKey = '', onShowIfKeyValueChange, editor } = props;

  const opts = useVariableOptions(editor);
  const variables = opts?.variables;
  const inputRef = useRef<HTMLInputElement>(null);

  // Condition keys already used elsewhere in this email, then the app's
  // list. Nothing records them, so the document is the list — and reusing
  // one key across blocks is the normal case (a section, its spacer, and its
  // button all hang off `isMember`). Taken at open (both below).
  const { search, snapshot } = useKnownNames(editor, 'conditions', variables, 'bubble-variable');
  // Controlled so picking a suggestion can dismiss the panel: the choice is
  // made, leaving it open just hides the block it applies to.
  const [open, setOpen] = useState(false);

  const autoCompleteOptions = search(showIfKey || '');

  // A highlight must not outlive the popover that painted it.
  useEffect(() => () => highlightShowIfKey(editor, null), [editor]);

  // On the phone the key is typed in the shell's dock, above the keyboard,
  // with the keys already in use offered as chips.
  const dock = useInputDock();
  if (dock) {
    return (
      <Tooltip>
        <TooltipTrigger
          type="button"
          aria-label="Show block conditionally"
          className={cn(
            'mly:flex mly:size-7 mly:items-center mly:justify-center mly:gap-1 mly:rounded-md mly:px-1.5 mly:text-sm mly:transition-colors mly:hover:bg-soft-gray',
            showIfKey && 'mly:bg-accent-wash mly:text-accent-ink mly:hover:bg-accent-wash'
          )}
          onClick={() => dock.open(showIfDockSpec(showIfKey, snapshot(), (when) => onShowIfKeyValueChange?.(when)))}
        >
          <Eye className="mly:h-3 mly:w-3 mly:stroke-[2.5]" />
        </TooltipTrigger>
        <TooltipContent sideOffset={8}>Show block conditionally</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) snapshot();
        else highlightShowIfKey(editor, null);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger
            className={cn(
              'mly:flex mly:size-7 mly:items-center mly:justify-center mly:gap-1 mly:rounded-md mly:px-1.5 mly:text-sm mly:data-[state=open]:bg-soft-gray mly:transition-colors mly:hover:bg-soft-gray mly:focus-visible:relative mly:focus-visible:z-10 ',
              // A configured condition is a normal state, not a problem: it
                // used to light up in the danger colour.
                showIfKey &&
                'mly:bg-accent-wash mly:text-accent-ink mly:data-[state=open]:bg-accent-wash mly:hover:bg-accent-wash'
            )}
          >
            <Eye className="mly:h-3 mly:w-3 mly:stroke-[2.5]" />
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent sideOffset={8}>Show block conditionally</TooltipContent>
      </Tooltip>
      <PopoverContent
        className="mly:flex mly:w-max mly:rounded-lg mly:p-0.5!"
        side="top"
        sideOffset={8}
        align="end"
        onOpenAutoFocus={(e) => {
          // Put the caret in the key field rather than on the panel, so the
          // popover opens ready to type.
          e.preventDefault();
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
        }}
      >
        <div className="mly:flex mly:items-center mly:gap-1.5 mly:px-1.5 mly:text-sm mly:leading-none">
          Show if
          <Tooltip>
            <TooltipTrigger>
              <InfoIcon
                className={cn('mly:size-3 mly:stroke-[2.5] mly:text-gray-500')}
              />
            </TooltipTrigger>
            <TooltipContent
              sideOffset={14}
              className="mly:max-w-[285px]"
              align="start"
            >
              Show this block only when the named value is true in the data you
              send. Leave it empty and the block always shows.
            </TooltipContent>
          </Tooltip>
        </div>

        {/* The field stays mounted, and nothing here may swap it for another
            element on click: Radix decides "outside" by testing the clicked
            node against the popover's tree, and a node removed by its own
            click is no longer in either — so the popover closes on the very
            gesture meant to reach the input. */}
        <form onSubmit={(e) => e.preventDefault()}>
          <InputAutocomplete
            editor={editor}
            value={showIfKey || ''}
            onValueChange={(value) => onShowIfKeyValueChange?.(value)}
            onSelectOption={(value) => {
              highlightShowIfKey(editor, null);
              onShowIfKeyValueChange?.(value);
              setOpen(false);
            }}
            onHoverOption={(key) => highlightShowIfKey(editor, key)}
            autoCompleteOptions={autoCompleteOptions}
            placeholder="e.g. isMember"
            ref={inputRef}
          />
        </form>
      </PopoverContent>
    </Popover>
  );
}

export const ShowPopover = memo(_ShowPopover);
