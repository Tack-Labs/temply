import * as React from 'react';
import Link from 'next/link';
import { cn } from '~/lib/classname';
import { lift } from '~/components/ui/surfaces';

/**
 * The two shapes a dashboard entity takes — a Tile in a grid, a Row in a
 * List — with the same slots in the same places, so a template, a brand, an
 * image and a version all read and behave alike:
 *
 * - The whole item is the primary target when it has an `href` or `onClick`;
 *   the title tints to the accent on hover to say so.
 * - Actions always sit trailing (a tile's footer, a row's right edge), always
 *   visible, and outside the primary target — their own click and tab stops,
 *   never a navigation by accident. Nothing is hidden behind hover, so touch
 *   gets the same product. The slot lifts every button and link in it to a
 *   44px target, so a caller's 28px icon button is a thumb-sized one here
 *   without each call site having to remember.
 * - A `busy` item (an upload in flight) draws dashed and does not respond.
 */

// A descendant selector rather than a size on the slot: the slot's own box is
// not the thing that gets pressed.
const actionTargets = '[&_:is(a,button)]:min-h-11 [&_:is(a,button)]:min-w-11';

type Primary =
  | { href: string; onClick?: never; primaryLabel?: never }
  | { href?: never; onClick: () => void; primaryLabel?: string }
  | { href?: never; onClick?: never; primaryLabel?: never };

// The radius is the card's curve less its 1px border: the padding box's own,
// which is the edge the clip leaves a primary target. A target with square
// corners has its ring cut off where the curve starts. The class names are
// written whole because Tailwind reads them from the source as written, and a
// variant glued onto a name at run time is never generated.
const innerTop = 'rounded-t-[calc(var(--radius-card)-1px)]';
const innerBottom = 'rounded-b-[calc(var(--radius-card)-1px)]';
const firstRowTop = 'group-first/row:rounded-t-[calc(var(--radius-card)-1px)]';
const lastRowBottom = 'group-last/row:rounded-b-[calc(var(--radius-card)-1px)]';

/** Link, button or plain box, depending on what the item does when pressed. */
function PrimaryTarget({
  href,
  onClick,
  label,
  className,
  corners,
  children,
}: {
  href?: string;
  onClick?: () => void;
  label?: string;
  className?: string;
  /** The corners of the item's clip that this target touches. */
  corners?: string;
  children: React.ReactNode;
}) {
  // The item clips its corners, so the focus outline is drawn inside its box
  // rather than being cut off: pulled in by its own 3px width, so the ring's
  // outer edge is the item's edge, and curved with the corners it shares.
  const focus = cn('focus-visible:-outline-offset-3', corners);
  if (href) {
    return (
      <Link href={href} className={cn(className, focus)}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(className, focus, 'w-full cursor-pointer')}
      >
        {children}
      </button>
    );
  }
  return <div className={className}>{children}</div>;
}

type Slots = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** One line and an ellipsis by default; two for a gallery where the
   *  subtitle is the pitch and cutting it mid-sentence reads as broken. */
  subtitleLines?: 1 | 2;
  /** One or more Badges; a tile stacks them top-right, a row keeps them inline. */
  badge?: React.ReactNode;
  /** Small trailing facts — a date, a size. Rows may pass several columns. */
  meta?: React.ReactNode;
  /** Buttons, ConfirmDialogs. Trailing, always visible, never inside the primary target. */
  actions?: React.ReactNode;
  selected?: boolean;
  busy?: boolean;
  className?: string;
};

export function Tile({
  media,
  title,
  subtitle,
  subtitleLines = 1,
  badge,
  meta,
  actions,
  children,
  selected,
  busy,
  className,
  href,
  onClick,
  primaryLabel,
}: Slots &
  Primary & {
    /** Full-bleed top slot: a thumbnail well, an iframe preview. Bring your own aspect ratio. */
    media?: React.ReactNode;
    /** Extra body content under the subtitle — swatches, a snippet. */
    children?: React.ReactNode;
  }) {
  const interactive = !busy && Boolean(href || onClick);
  const footer = meta || actions;

  return (
    <li
      aria-busy={busy || undefined}
      className={cn(
        'group flex flex-col overflow-hidden rounded-card border bg-raised',
        busy ? 'item-motion border-dashed border-line-strong' : 'border-line shadow-sm',
        interactive ? lift : 'item-motion',
        // A focused action inside the tile lights the border the way hover does.
        interactive && 'focus-within:border-line-strong',
        selected && 'border-accent hover:border-accent',
        className,
      )}
    >
      <PrimaryTarget
        href={busy ? undefined : href}
        onClick={busy ? undefined : onClick}
        label={primaryLabel}
        className="flex flex-1 flex-col text-left"
        // With a footer it is the footer, not the target, that meets the bottom edge.
        corners={footer ? innerTop : cn(innerTop, innerBottom)}
      >
        {media}
        <div className={cn('flex items-start gap-2 px-4 pt-4', footer ? 'pb-2' : 'pb-4')}>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'truncate text-18 font-bold text-ink transition-colors duration-fast motion-reduce:transition-none',
                interactive && 'group-hover:text-accent-ink',
              )}
            >
              {title}
            </p>
            {subtitle ? (
              <p className={cn('mt-0.5 text-ui text-muted', subtitleLines === 2 ? 'line-clamp-2' : 'truncate')}>
                {subtitle}
              </p>
            ) : null}
            {children}
          </div>
          {badge ? <div className="flex shrink-0 flex-col items-end gap-1">{badge}</div> : null}
        </div>
      </PrimaryTarget>

      {footer ? (
        <div className="mt-auto flex items-center justify-between gap-2 px-4 pb-3">
          <span className="min-w-0 truncate text-ui text-muted tabular-nums">{meta}</span>
          {actions ? <div className={cn('flex shrink-0 items-center gap-1', actionTargets)}>{actions}</div> : null}
        </div>
      ) : null}
    </li>
  );
}

/** The container Rows sit in: one bordered panel, rows divided by hairlines. */
export function List({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={cn('divide-y divide-line overflow-hidden rounded-card border border-line bg-raised shadow-sm', className)}
      {...props}
    />
  );
}

export function Row({
  leading,
  title,
  subtitle,
  badge,
  meta,
  actions,
  selected,
  busy,
  leaving,
  className,
  bodyClassName,
  contentClassName,
  href,
  onClick,
  primaryLabel,
}: Slots &
  Primary & {
    /** A thumbnail or icon at the left edge, sized by the caller. */
    leading?: React.ReactNode;
    /**
     * Extra classes for the primary target's flex row, for a caller whose
     * `meta` has to drop under the title on a narrow container and sit
     * trailing on a wide one (`flex-wrap`, then `nowrap` from a breakpoint).
     * Row itself stays a single line unless it is told otherwise.
     */
    bodyClassName?: string;
    /** Responsive wrapping of the primary target and its separate actions. */
    contentClassName?: string;
    /**
     * Opt in to closing the row up when its entity goes: pass `false` while it
     * stays and `true` once it has been removed, and it fades and shrinks to
     * nothing instead of snapping out from under the rows below. Leave it
     * unset for a row that never goes and the markup is exactly what it was.
     * Once set, keep it set: the row gains wrapper elements, and switching
     * between set and unset would remount everything inside it.
     */
    leaving?: boolean;
  }) {
  const interactive = !busy && Boolean(href || onClick);

  const content = (
    <>
      <PrimaryTarget
        href={busy ? undefined : href}
        onClick={busy ? undefined : onClick}
        label={primaryLabel}
        className={cn('flex min-w-0 flex-1 items-center gap-4 px-4 py-3 text-left', bodyClassName)}
        // The list's corners clip a row only where it is first or last in it.
        corners={cn(firstRowTop, lastRowBottom)}
      >
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-18 font-bold text-ink transition-colors duration-fast motion-reduce:transition-none',
              interactive && 'group-hover:text-accent-ink',
            )}
          >
            {title}
          </p>
          {subtitle ? <p className="mt-0.5 truncate text-ui text-muted">{subtitle}</p> : null}
        </div>
        {badge ? <div className="flex shrink-0 items-center gap-1">{badge}</div> : null}
        {meta}
      </PrimaryTarget>
      {actions ? <div className={cn('flex shrink-0 items-center gap-1 pr-3', actionTargets)}>{actions}</div> : null}
    </>
  );

  return (
    <li
      aria-busy={busy || undefined}
      className={cn(
        leaving === undefined ? 'group group/row flex items-center item-motion' : 'group group/row item-motion',
        interactive && 'hover:bg-hover active:bg-active',
        selected && 'bg-accent-wash',
        busy && 'opacity-80',
        leaving && 'opacity-0',
        className,
      )}
    >
      {leaving === undefined ? (
        content
      ) : (
        // The height runs from its content to nothing through the grid track,
        // the way Reveal does; inert keeps a row on its way out out of the tab
        // order and the accessibility tree. The overflow clip leaves room for
        // a focus outline because the buttons sit well inside the row's own
        // padding.
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-base ease-out motion-reduce:transition-none',
            leaving ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
          )}
        >
          <div className="min-h-0 overflow-hidden" aria-hidden={leaving} inert={leaving}>
            <div className={cn('flex items-center', contentClassName)}>{content}</div>
          </div>
        </div>
      )}
    </li>
  );
}
