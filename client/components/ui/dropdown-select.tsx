'use client';

import type { ComponentProps, ReactNode } from 'react';
import { CheckIcon, ChevronDownIcon, type LucideIcon } from 'lucide-react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { pressable } from '~/components/ui/button';
import { cn } from '~/lib/classname';

export type DropdownOption = {
  value: string;
  label: string;
  /** Rendered before the label — colour swatches, an icon, anything. */
  leading?: ReactNode;
  /** Chip on the row's right edge, e.g. "Preset". */
  tag?: string;
  /** Draws a divider above this row. */
  separatorBefore?: boolean;
};

/**
 * The app's dropdown. A native <select> paints its popup with OS chrome — a
 * white list over a dark panel in dark mode — and cannot show anything but
 * text, so this replaces it everywhere: rows carry swatches and tags, and the
 * popup is ours to theme. Radix supplies keyboard navigation and type-ahead.
 */
export function DropdownSelect({
  label,
  options,
  value,
  onValueChange,
  size = 'md',
  variant = 'bordered',
  placeholder,
  icon: Icon,
  iconClassName,
  className,
  align = 'start',
  touch = false,
  keepFocus = false,
}: {
  /** Accessible name; the trigger has no visible label of its own. */
  label: string;
  options: DropdownOption[];
  value: string;
  onValueChange: (value: string) => void;
  /** `sm` fits the editor's bubble-menu chrome; `md` is a form field, the
   *  same box as `Input`, so a dropdown under a text field lines up with it. */
  size?: 'sm' | 'md';
  /** `plain` drops the border and background — for toolbars, where a boxed
   *  control per option would fight the row it sits in. */
  variant?: 'bordered' | 'plain';
  /** Shown when the value matches no option. */
  placeholder?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  className?: string;
  align?: 'start' | 'end';
  /** Sizes the trigger and the rows for a thumb. The menu renders in a portal,
   *  so a sheet cannot reach the rows with a wrapper class — it has to be asked
   *  for here. Off by default: every desktop dropdown keeps its `size`. This
   *  is set by the surface (the phone sheets), whatever the pointer is; it is
   *  not Button's `touch`, which defers to the pointer media query. */
  touch?: boolean;
  /** Leaves focus where it is when the menu opens and closes. For a dropdown
   *  inside the editor's bubble menus: the menu opens on pointerdown and
   *  moves focus into itself, the editor blurs, and the bubble menu hides on
   *  blur unless a mousedown inside it came first — which it cannot, since
   *  mousedown follows pointerdown. The menu then floats at the page's
   *  corner with nothing to anchor to. The mouse still drives the rows and
   *  Escape still closes; only the keyboard walk from the trigger is given
   *  up, and the bubble menu never had one. */
  keepFocus?: boolean;
}) {
  const selected = options.find((option) => option.value === value);
  // The form field is already a thumb's height, so `touch` only changes the
  // dense one; the rows below grow for either.
  const dense = size === 'sm' && !touch;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            'flex max-w-full items-center gap-1.5 text-ink hover:bg-hover',
            dense
              ? 'h-7 rounded-sm px-1.5 text-sm'
              : size === 'sm'
                ? 'h-11 rounded-sm px-2.5 text-sm'
                : 'h-12 rounded-field px-4 text-lg',
            variant === 'bordered'
              ? dense || size === 'sm'
                ? 'border border-line bg-raised'
                : 'border-[1.5px] border-line-strong bg-raised'
              : 'bg-transparent',
            pressable,
            className
          )}
        >
          {Icon && <Icon className={cn('shrink-0 text-faint', dense ? 'size-3.5' : 'size-4', iconClassName)} />}
          {selected?.leading}
          <span className="flex-1 truncate text-left">
            {selected?.label ?? placeholder ?? ''}
          </span>
          {selected?.tag && <Tag>{selected.tag}</Tag>}
          <ChevronDownIcon className="size-4 shrink-0 text-faint" />
        </button>
      </DropdownMenuTrigger>

      {/* The dense dropdown keeps the tighter box of the editor's chrome;
          the form one takes the menu's own card and rows. */}
      <DropdownMenuContent
        align={align}
        className={cn(
          'max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] min-w-[11rem] overflow-y-auto',
          dense && 'rounded-xl p-1.5',
        )}
        {...(keepFocus ? KEEP_FOCUS : {})}
      >
        <DropdownMenuPrimitive.RadioGroup value={value} onValueChange={onValueChange}>
          {options.map((option) => (
            <div key={option.value}>
              {option.separatorBefore && <div className={cn('h-px bg-line', dense ? '-mx-1.5 my-1.5' : '-mx-2 my-2')} />}
              <DropdownMenuPrimitive.RadioItem
                value={option.value}
                className={cn(
                  'flex cursor-pointer items-center gap-2 outline-none transition-colors duration-fast ease-out motion-reduce:transition-none',
                  dense ? 'h-8 rounded-md px-2.5 text-sm' : 'h-11 rounded-field px-3.5 text-ui',
                  option.value === value
                    ? 'bg-accent-wash text-accent-ink'
                    : 'text-ink hover:bg-hover focus:bg-hover'
                )}
              >
                {option.leading}
                <span className="flex-1 truncate">{option.label}</span>
                {option.tag && <Tag>{option.tag}</Tag>}
                {option.value === value && <CheckIcon className="size-3.5 shrink-0" />}
              </DropdownMenuPrimitive.RadioItem>
            </div>
          ))}
        </DropdownMenuPrimitive.RadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const keepFocusEvent = (event: Event) => event.preventDefault();
// Radix's DropdownMenu types list onOpenAutoFocus as private, but its menu
// content composes whatever handler it is handed (react-menu's
// MenuContentImpl), which is the only way to keep focus where it was at
// open. Typed as the public props so the spread compiles; should a Radix
// upgrade stop forwarding it, the bubble-menu symptom above comes back.
const KEEP_FOCUS = { onOpenAutoFocus: keepFocusEvent, onCloseAutoFocus: keepFocusEvent } as ComponentProps<typeof DropdownMenuContent>;

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-sm bg-sunken px-1.5 text-xs text-muted">{children}</span>
  );
}
