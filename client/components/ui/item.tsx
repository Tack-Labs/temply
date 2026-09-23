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
 *   gets the same product.
 * - A `busy` item (an upload in flight) draws dashed and does not respond.
 */

type Primary =
  | { href: string; onClick?: never; primaryLabel?: never }
  | { href?: never; onClick: () => void; primaryLabel?: string }
  | { href?: never; onClick?: never; primaryLabel?: never };

/** Link, button or plain box, depending on what the item does when pressed. */
function PrimaryTarget({
  href,
  onClick,
  label,
  className,
  children,
}: {
  href?: string;
  onClick?: () => void;
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  // The item clips its corners, so the focus outline is drawn inside its box
  // rather than being cut off.
  const focus = 'focus-visible:-outline-offset-2';
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
        'group flex flex-col overflow-hidden rounded-lg border bg-raised',
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
      >
        {media}
        <div className={cn('flex items-start gap-2 px-3 pt-2.5', footer ? 'pb-1.5' : 'pb-2.5')}>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'truncate text-sm font-medium text-ink transition-colors duration-fast motion-reduce:transition-none',
                interactive && 'group-hover:text-accent-ink',
              )}
            >
              {title}
            </p>
            {subtitle ? (
              <p className={cn('mt-0.5 text-xs text-muted', subtitleLines === 2 ? 'line-clamp-2' : 'truncate')}>
                {subtitle}
              </p>
            ) : null}
            {children}
          </div>
          {badge ? <div className="flex shrink-0 flex-col items-end gap-1">{badge}</div> : null}
        </div>
      </PrimaryTarget>

      {footer ? (
        <div className="mt-auto flex items-center justify-between gap-2 px-3 pb-2">
          <span className="min-w-0 truncate text-xs text-muted tabular-nums">{meta}</span>
          {actions ? <div className="flex shrink-0 items-center gap-0.5">{actions}</div> : null}
        </div>
      ) : null}
    </li>
  );
}

/** The container Rows sit in: one bordered panel, rows divided by hairlines. */
export function List({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={cn('divide-y divide-line overflow-hidden rounded-lg border border-line bg-raised shadow-sm', className)}
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
  className,
  href,
  onClick,
  primaryLabel,
}: Slots &
  Primary & {
    /** A thumbnail or icon at the left edge, sized by the caller. */
    leading?: React.ReactNode;
  }) {
  const interactive = !busy && Boolean(href || onClick);

  return (
    <li
      aria-busy={busy || undefined}
      className={cn(
        'group flex items-center item-motion',
        interactive && 'hover:bg-hover active:bg-active',
        selected && 'bg-accent-wash',
        busy && 'opacity-80',
        className,
      )}
    >
      <PrimaryTarget
        href={busy ? undefined : href}
        onClick={busy ? undefined : onClick}
        label={primaryLabel}
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left"
      >
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-sm font-medium text-ink transition-colors duration-fast motion-reduce:transition-none',
              interactive && 'group-hover:text-accent-ink',
            )}
          >
            {title}
          </p>
          {subtitle ? <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p> : null}
        </div>
        {badge ? <div className="flex shrink-0 items-center gap-1">{badge}</div> : null}
        {meta}
      </PrimaryTarget>
      {actions ? <div className="flex shrink-0 items-center gap-0.5 pr-2">{actions}</div> : null}
    </li>
  );
}
