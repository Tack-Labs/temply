import type { Editor } from '@tiptap/core';
import { BlockItem } from '@/blocks';
import { ChevronRightIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/editor/components/ui/tooltip';
import { useCallback, useState, useRef, useEffect, RefObject } from 'react';
import { cn } from '@/editor/utils/classname';
import { rowId } from './slash-command-view';

type SlashCommandItemProps = {
  item: BlockItem;
  groupIndex: number;
  commandIndex: number;
  selectedGroupIndex: number;
  selectedCommandIndex: number;
  editor: Editor;
  activeCommandRef: RefObject<HTMLButtonElement | null> | null;
  selectItem: (groupIndex: number, commandIndex: number) => void;
  hoveredItemKey: string | null;
  onHover: (isHovered: boolean) => void;
};

export function SlashCommandItem(props: SlashCommandItemProps) {
  const {
    item,
    groupIndex,
    commandIndex,
    selectedGroupIndex,
    selectedCommandIndex,
    editor,
    activeCommandRef,
    selectItem,
    hoveredItemKey,
    onHover,
  } = props;

  const [open, setOpen] = useState(false);
  const isActive =
    groupIndex === selectedGroupIndex && commandIndex === selectedCommandIndex;

  const itemKey = `${groupIndex}-${commandIndex}`;
  const isHovered = hoveredItemKey === itemKey;

  const isSubCommand = item && 'commands' in item;

  // show tooltip only if this item is hovered OR (active/keyboard selected AND no other item is hovered)
  const shouldOpenTooltip =
    !!item?.preview && (isHovered || (isActive && !hoveredItemKey));

  const hasRenderFunction = typeof item.render === 'function';
  const renderFunctionValue = hasRenderFunction ? item.render?.(editor) : null;

  let value = (
    <>
      <div className="mly:flex mly:h-6 mly:w-6 mly:shrink-0 mly:items-center mly:justify-center">
        {item.icon}
      </div>
      <div className="mly:grow">
        <p className="mly:font-medium">{item.title}</p>
        <p className="mly:text-xs mly:text-gray-400">{item.description}</p>
      </div>

      {isSubCommand && (
        <span className="mly:block mly:px-1 mly:text-gray-400">
          <ChevronRightIcon className="mly:size-3.5 mly:stroke-[2.5]" />
        </span>
      )}
    </>
  );

  if (renderFunctionValue !== null && renderFunctionValue !== true) {
    value = renderFunctionValue!;
  }

  const openTimerRef = useRef<number>(0);
  const handleDelayedOpen = useCallback(() => {
    window.clearTimeout(openTimerRef.current);
    const delay = 200;
    openTimerRef.current = window.setTimeout(() => {
      setOpen(true);
      openTimerRef.current = 0;
    }, delay);
  }, [setOpen]);

  useEffect(() => {
    if (shouldOpenTooltip) {
      handleDelayedOpen();
    } else {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = 0;
      setOpen(false);
    }
  }, [shouldOpenTooltip]);

  useEffect(() => {
    return () => {
      if (openTimerRef.current) {
        window.clearTimeout(openTimerRef.current);
        openTimerRef.current = 0;
      }
    };
  }, []);

  return (
    <Tooltip open={open} key={`${groupIndex}-${commandIndex}`}>
      <TooltipTrigger asChild>
        <button
          id={rowId(groupIndex, commandIndex)}
          role="option"
          aria-selected={isActive}
          // The row's name is the block's name. Left to the content it would
          // be the title and the description run together, which is why the
          // suite's locator needed a word-boundary regex to tell `Image` from
          // `Inline Image`; the description is what the preview is for.
          aria-label={item.title}
          className={cn(
            'mly:flex mly:w-full mly:items-center mly:gap-2 mly:rounded-md mly:px-2 mly:py-1 mly:text-left mly:text-sm mly:text-gray-900 mly:transition-colors mly:hover:bg-gray-100 mly:hover:text-gray-900',
            // The keyboard's row is a selection, so it takes the accent wash;
            // the hover tint alone could not be told from the group header.
            isActive
              ? 'mly:bg-accent-wash mly:text-accent-ink mly:hover:bg-accent-wash mly:hover:text-accent-ink'
              : 'mly:bg-transparent'
          )}
          onClick={() => selectItem(groupIndex, commandIndex)}
          // The canvas keeps the focus through the click. Letting the button
          // take it costs a round trip — out of the document on press, back
          // in when the command runs, and out again when the panel is torn
          // down under it — and the keystrokes typed in that gap land
          // nowhere, which on a block picked to be typed into is the first
          // word of it.
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => onHover(true)}
          onMouseLeave={() => onHover(false)}
          type="button"
          ref={isActive ? activeCommandRef : null}
        >
          {value}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={10}
        className="mly:w-52 mly:rounded-lg mly:border-none mly:p-1 mly:shadow"
      >
        {typeof item.preview === 'function' ? (
          item?.preview(editor)
        ) : (
          <>
            <figure className="mly:relative mly:aspect-[2.5] mly:w-full mly:overflow-hidden mly:rounded-md mly:border mly:border-gray-200">
              <img
                src={item?.preview}
                alt={item?.title}
                className="mly:absolute mly:inset-0 mly:h-full mly:w-full mly:object-cover"
              />
            </figure>
            <p className="mly:mt-2 mly:px-0.5 mly:text-gray-500">
              {item.description}
            </p>
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
