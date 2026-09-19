import { TypeIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';
import { BaseButton } from '../base-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useInputDock } from '../ui/input-dock';

/**
 * Alternative text for the image.
 *
 * It matters more here than in most editors: these emails carry remote images,
 * and remote images are blocked by default in a lot of mail clients. When they
 * are, alt text is the only thing the recipient sees in the image's place — no
 * alt means a blank box that reads as a broken email.
 */
export function AltTextInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reseed when the selection moves to a different image.
  useEffect(() => setDraft(value), [value]);

  // On the phone the text is typed in the shell's dock, above the keyboard.
  const dock = useInputDock();
  if (dock) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <BaseButton
            variant="ghost"
            size="sm"
            type="button"
            className="mly:h-7! mly:w-7!"
            data-state={!!value}
            aria-label="Alt text"
            onClick={() =>
              dock.open({
                title: 'Alt text',
                fields: [
                  {
                    key: 'alt',
                    label: 'Alt text',
                    value,
                    placeholder: 'What the image shows',
                    hint: 'Shown when a mail client blocks the image',
                  },
                ],
                onCommit: (values) => {
                  if (values.alt !== value) onChange(values.alt);
                },
              })
            }
          >
            <TypeIcon className="mly:h-3 mly:w-3 mly:shrink-0 mly:stroke-[2.5] mly:text-midnight-gray" />
          </BaseButton>
        </TooltipTrigger>
        <TooltipContent sideOffset={8}>Alt text</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setTimeout(() => inputRef.current?.focus(), 0);
        else if (draft !== value) onChange(draft);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <BaseButton
              variant="ghost"
              size="sm"
              type="button"
              className="mly:h-7! mly:w-7!"
              data-state={!!value}
              aria-label="Alt text"
            >
              <TypeIcon className="mly:h-3 mly:w-3 mly:shrink-0 mly:stroke-[2.5] mly:text-midnight-gray" />
            </BaseButton>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent sideOffset={8}>Alt text</TooltipContent>
      </Tooltip>

      <PopoverContent
        aria-label="Alt text"
        align="end"
        side="top"
        sideOffset={8}
        className="mly:w-64 mly:rounded-lg mly:border mly:border-gray-300 mly:bg-panel mly:p-2.5 mly:shadow-sm"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onChange(draft);
            setOpen(false);
          }}
        >
          <label
            htmlFor="image-alt-text"
            className="mly:text-xs mly:font-medium mly:text-midnight-gray"
          >
            Alt text
          </label>
          <p className="mly:mt-0.5 mly:text-xs mly:text-gray-500">
            Shown when a mail client blocks the image. Describe what it is.
          </p>
          <input
            id="image-alt-text"
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => draft !== value && onChange(draft)}
            placeholder="Company logo"
            className="mly:mt-1.5 mly:block mly:h-8 mly:w-full mly:rounded-lg mly:border mly:border-gray-300 mly:px-2 mly:text-sm mly:placeholder:text-gray-400"
          />
        </form>
      </PopoverContent>
    </Popover>
  );
}
