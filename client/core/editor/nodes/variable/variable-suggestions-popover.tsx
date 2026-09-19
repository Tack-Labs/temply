import { cn } from '@/editor/utils/classname';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Braces,
  CornerDownLeftIcon,
} from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Variable } from './variable';

export type VariableSuggestionsPopoverProps = {
  items: Variable[];
  onSelectItem: (item: Variable) => void;
  /** Called with the hovered item, and with null when the pointer leaves it. */
  onHoverItem?: (item: Variable | null) => void;
};

export type VariableSuggestionsPopoverRef = {
  moveUp: () => void;
  moveDown: () => void;
  select: () => void;
};

export type VariableSuggestionsPopoverType = React.ForwardRefExoticComponent<
  VariableSuggestionsPopoverProps &
    React.RefAttributes<VariableSuggestionsPopoverRef>
>;

export const VariableSuggestionsPopover: VariableSuggestionsPopoverType =
  forwardRef((props, ref) => {
    const { items, onSelectItem, onHoverItem } = props;

    const [selectedIndex, setSelectedIndex] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const scrollSelectedIntoView = (index: number) => {
      const container = scrollContainerRef.current;
      const selectedItem = itemRefs.current[index];

      if (!container || !selectedItem) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const itemRect = selectedItem.getBoundingClientRect();

      const padding = 4;
      if (itemRect.bottom > containerRect.bottom) {
        container.scrollTop += itemRect.bottom - containerRect.bottom + padding;
      } else if (itemRect.top < containerRect.top) {
        container.scrollTop += itemRect.top - containerRect.top - padding;
      }
    };

    useEffect(() => {
      setSelectedIndex(0);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      itemRefs.current = items.map(() => null);
    }, [items]);

    useEffect(() => {
      scrollSelectedIntoView(selectedIndex);
    }, [selectedIndex]);

    useImperativeHandle(
      ref,
      () => ({
        moveUp: () => {
          setSelectedIndex((selectedIndex + items.length - 1) % items.length);
        },
        moveDown: () => {
          setSelectedIndex((selectedIndex + 1) % items.length);
        },
        select: () => {
          const item = items[selectedIndex];
          if (!item) {
            return;
          }

          onSelectItem(item);
        },
      }),
      [items, selectedIndex, onSelectItem]
    );

    return (
      // overlay-panel is the app's anchored-panel entrance (globals.css); the
      // menu pops in like every other floating surface instead of appearing.
      <div
        data-state="open"
        data-side="bottom"
        className="overlay-panel mly:z-50 mly:w-64 mly:rounded-lg mly:border mly:border-gray-200 mly:bg-panel mly:shadow-md"
      >
        <div className="mly:flex mly:items-center mly:justify-between mly:gap-2 mly:border-b mly:border-gray-200 mly:bg-soft-gray/40 mly:px-1 mly:py-1.5 mly:text-gray-500">
          <span className="mly:text-xs mly:uppercase">Variables</span>
          <VariableIcon>
            <Braces className="mly:size-3 mly:stroke-[2.5]" />
          </VariableIcon>
        </div>

        <div
          ref={scrollContainerRef}
          className="mly:max-h-52 mly:overflow-y-auto mly:scrollbar-thin mly:scrollbar-track-transparent mly:scrollbar-thumb-gray-400"
        >
          <div className="mly:flex mly:w-fit mly:min-w-full mly:flex-col mly:gap-0.5 mly:p-1">
            {items?.length ? (
              items?.map((item, index: number) => (
                <button
                  type="button"
                  key={index}
                  ref={(el) => { itemRefs.current[index] = el; }}
                  onClick={() => onSelectItem(item)}
                  onMouseEnter={() => onHoverItem?.(item)}
                  onMouseLeave={() => onHoverItem?.(null)}
                  className={cn(
                    'mly:flex mly:w-fit mly:min-w-full mly:items-center mly:gap-2 mly:rounded-md mly:px-2 mly:py-1 mly:text-left mly:font-mono mly:text-sm mly:text-gray-900 mly:transition-colors mly:hover:bg-soft-gray',
                    // The keyboard's row is a selection, so it takes the
                    // accent wash — the hover tint alone read as nothing.
                    index === selectedIndex
                      ? 'mly:bg-accent-wash mly:text-accent-ink mly:hover:bg-accent-wash'
                      : 'mly:bg-transparent'
                  )}
                >
                  <Braces className="mly:size-3 mly:stroke-[2.5] mly:text-gray-500" />
                  {item?.label || item.name}
                </button>
              ))
            ) : (
              <div className="mly:flex mly:h-7 mly:w-full mly:items-center mly:gap-2 mly:rounded-md mly:px-2 mly:py-1 mly:text-left mly:font-mono mly:text-[13px] mly:text-gray-500">
                No result
              </div>
            )}
          </div>
        </div>

        <div className="mly:flex mly:items-center mly:justify-between mly:gap-2 mly:border-t mly:border-gray-200 mly:px-1 mly:py-1.5 mly:text-gray-500">
          <div className="mly:flex mly:items-center mly:gap-1">
            <VariableIcon>
              <ArrowDownIcon className="mly:size-3 mly:stroke-[2.5]" />
            </VariableIcon>
            <VariableIcon>
              <ArrowUpIcon className="mly:size-3 mly:stroke-[2.5]" />
            </VariableIcon>
            <span className="mly:text-xs mly:text-gray-500">Navigate</span>
          </div>
          <VariableIcon>
            <CornerDownLeftIcon className="mly:size-3 mly:stroke-[2.5]" />
          </VariableIcon>
        </div>
      </div>
    );
  });

type VariableIconProps = {
  className?: string;
  children: React.ReactNode;
};

function VariableIcon(props: VariableIconProps) {
  const { className, children } = props;

  return (
    <div
      className={cn(
        'mly:flex mly:size-5 mly:items-center mly:justify-center mly:rounded-md mly:border mly:border-gray-200',
        className
      )}
    >
      {children}
    </div>
  );
}
