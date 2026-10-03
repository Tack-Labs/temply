'use client';

import * as React from 'react';
import { cn } from '~/lib/classname';

export interface SegmentedOption<T extends string> {
  value: T;
  /** A string gets a `title` for when it is cut to an ellipsis; a node does not, so keep it short. */
  label: React.ReactNode;
  /** A tally shown beside the label, e.g. how many templates a filter holds. */
  count?: number;
  disabled?: boolean;
}

/**
 * One choice out of a few, shown side by side: a filter, a view switch. The
 * chosen option is a raised pill sitting in a sunken track.
 *
 * It is a radiogroup: one option is checked, arrow keys move focus and choose
 * in the same step (Home and End jump to the ends), and both ends wrap. Focus
 * is roving, so the control is one tab stop: the chosen option, or the first
 * enabled one when `value` matches none. A disabled option is announced but
 * the arrows step over it. With no options it renders nothing, since a
 * radiogroup with no radios is not a valid widget.
 *
 * A count is read after the label with a comma ("Drafts, 3"), not run into it.
 *
 * It shrinks before it overflows: an option gives up its label to an
 * ellipsis, never its count, so a narrow screen never scrolls sideways.
 * Transitions are colour, background and shadow only — the pill does not slide.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  /** Names the group for a screen reader; required so it cannot ship unnamed. */
  label: string;
  className?: string;
}) {
  const radios = React.useRef<Array<HTMLButtonElement | null>>([]);

  const enabled = options.flatMap((option, index) => (option.disabled ? [] : [index]));
  const chosen = options.findIndex((option) => option.value === value && !option.disabled);
  const tabStop = chosen === -1 ? enabled[0] : chosen;

  if (options.length === 0) return null;

  const move = (from: number, key: string) => {
    const at = enabled.indexOf(from);
    if (at === -1) return;
    const last = enabled.length - 1;
    const next =
      key === 'ArrowRight' || key === 'ArrowDown'
        ? enabled[at === last ? 0 : at + 1]
        : key === 'ArrowLeft' || key === 'ArrowUp'
          ? enabled[at === 0 ? last : at - 1]
          : key === 'Home'
            ? enabled[0]
            : enabled[last];
    const target = options[next];
    if (!target) return;
    radios.current[next]?.focus();
    onValueChange(target.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex max-w-full gap-0.5 rounded-lg border border-line bg-sunken p-1', className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              radios.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            tabIndex={index === tabStop ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => {
              // A held modifier is the browser's (Alt+Left is Back), not ours.
              if (event.altKey || event.ctrlKey || event.metaKey) return;
              if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                move(index, event.key);
              }
            }}
            className={cn(
              // The border is always there, transparent until chosen, so the
              // pill never shifts its neighbours and does not rest on a
              // background difference alone.
              'inline-flex h-7 min-w-0 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium whitespace-nowrap pointer-coarse:h-11',
              'transition-[background-color,color,border-color,box-shadow,outline-color] duration-fast ease-out motion-reduce:transition-none',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink',
              'disabled:pointer-events-none disabled:opacity-45',
              selected ? 'border-line bg-raised text-ink shadow-xs' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            <span className="min-w-0 truncate" title={typeof option.label === 'string' ? option.label : undefined}>
              {option.label}
            </span>
            {option.count !== undefined ? (
              <>
                <span className="sr-only">, </span>
                <span className="shrink-0 tabular-nums">{option.count}</span>
              </>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
