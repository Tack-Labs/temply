import * as React from 'react';
import { cn } from '~/lib/classname';
import { Button } from './button';

/**
 * How a surface answers the pointer when the whole of it is a target: it
 * lifts a hair and its shadow deepens, then settles back on press. One string
 * so a stat tile, a template card and a brand card all move the same way.
 * Reduced motion keeps the shadow and border change and drops the lift.
 */
export const lift =
  'item-motion hover:border-line-strong hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0';

/**
 * The panel treatment the dashboard previously repeated as an inline class
 * string in eleven places. One definition means one place to change it.
 *
 * A padded card rests on its fill and its shadow, not an outline. Its border
 * is still there, transparent, so a call site can mark one (`border-accent`)
 * and a lifting card can draw its edge on hover without the content moving.
 * A card whose content brings its own padding holds a list or a form and
 * keeps the hairline, since there is no padding for the shadow to read
 * against.
 */
export function Card({
  className,
  inset = true,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  inset?: boolean;
  /** The whole card is a target (it sits inside a link or carries onClick). */
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-card border bg-raised shadow-sm',
        inset ? 'border-transparent p-5.5' : 'border-line',
        interactive && lift,
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-34 font-bold tracking-display text-ink sm:text-4xl">{title}</h1>
        {description ? <p className="mt-1.5 text-18 text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * An empty screen is an invitation to act, so the action is part of the state
 * rather than something the page has to remember to put nearby. It and
 * ErrorState take Card's radius because they stand where a Card would, and
 * a page that swaps one for the other should not change its corners.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line px-6 py-14 text-center">
      <Icon className="size-5 text-muted" />
      <p className="mt-3 text-base font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/**
 * Distinct from EmptyState on purpose. The old dashboard coerced a failed fetch
 * into an empty result, so "we could not reach the server" and "you have not
 * made anything yet" drew the same screen — on billing that showed a paying
 * customer their account as free.
 */
export function ErrorState({
  title = 'Could not load this',
  description,
  onRetry,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-line bg-danger-wash px-6 py-14 text-center">
      <p className="text-base font-medium text-danger-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {onRetry ? (
        <Button onClick={onRetry} className="mt-4">
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The six pastels by the hue the design gives them, and the severity names the
 * app already used. They are the same colours: lavender is `accent`, mint
 * `success`, butter `warn`, rose `danger`. Sky and peach have no severity and
 * mark a stage or a category without passing a verdict on it. Reach for the
 * hue where the badge names a stage or a kind, and for the severity where it
 * reports how things are going.
 */
export type BadgeTone =
  | 'neutral'
  | 'lavender'
  | 'mint'
  | 'butter'
  | 'rose'
  | 'sky'
  | 'peach'
  | 'accent'
  | 'success'
  | 'warn'
  | 'danger';

const badgeTones: Record<BadgeTone, string> = {
  // On `track`, not `hover`: a row under the pointer is filled with `hover`,
  // and a badge in that colour would have no edge against it.
  neutral: 'bg-track text-muted',
  lavender: 'bg-accent-wash text-accent-ink',
  mint: 'bg-success-wash text-success-ink',
  butter: 'bg-warn-wash text-warn-ink',
  rose: 'bg-danger-wash text-danger-ink',
  sky: 'bg-sky-wash text-sky-ink',
  peach: 'bg-peach-wash text-peach-ink',
  accent: 'bg-accent-wash text-accent-ink',
  success: 'bg-success-wash text-success-ink',
  warn: 'bg-warn-wash text-warn-ink',
  danger: 'bg-danger-wash text-danger-ink',
};

/**
 * A pill, so it never wraps: a status label that broke onto two lines would
 * turn into a rounded blob. Keep the text to a word or a count.
 *
 * `dot` puts a small mark in the badge's own ink ahead of the label. It is for
 * a status ("Published", "In sign-off"); a count, a kicker or a plain label
 * has no status to point at, so it is off by default.
 */
export function Badge({
  tone = 'neutral',
  dot = false,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-2 rounded-full px-3 text-sm font-bold whitespace-nowrap',
        badgeTones[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/**
 * Content that comes and goes grows from nothing rather than popping in.
 * Collapsed, it is inert as well as hidden, so neither the tab order nor a
 * screen reader lands on something that isn't there. Spacing belongs inside
 * the children: a margin on the wrapper would stay behind when it closes.
 */
export function Reveal({
  open,
  className,
  children,
}: {
  open: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-base ease-out motion-reduce:transition-none',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        className,
      )}
    >
      <div className="min-h-0 overflow-hidden" aria-hidden={!open} inert={!open}>
        {children}
      </div>
    </div>
  );
}

export type StatBarTone = 'accent' | 'success' | 'peach' | 'warn' | 'danger';

// The track is the tone's wash. The fill is the solid colour for `success` and
// `peach`, and the ink for the three that mean something: the solid accent,
// warn and danger do not stand 3:1 off their wash in both themes, and the ink
// does. The contrast gate holds each pair.
const statBarTones: Record<StatBarTone, { track: string; fill: string }> = {
  accent: { track: 'bg-accent-wash', fill: 'bg-accent-ink' },
  success: { track: 'bg-success-wash', fill: 'bg-success' },
  peach: { track: 'bg-peach-wash', fill: 'bg-peach' },
  warn: { track: 'bg-warn-wash', fill: 'bg-warn-ink' },
  danger: { track: 'bg-danger-wash', fill: 'bg-danger-ink' },
};

/** Label above, value below — the dashboard and billing pages drew this two
 *  different ways for the same numbers. A `bar` shows how much of something
 *  is used: `value` runs from 0 to 1, and a number outside that is held to
 *  the ends of the track. It is a progressbar named by the label, so what a
 *  screen reader hears is the percentage unless `text` says it in words. */
export function StatTile({
  label,
  value,
  hint,
  bar,
  className,
  interactive,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  bar?: { value: number; tone?: StatBarTone; text?: string };
  className?: string;
  interactive?: boolean;
}) {
  const pct = bar && Number.isFinite(bar.value) ? Math.round(Math.min(1, Math.max(0, bar.value)) * 100) : 0;
  const tone = statBarTones[bar?.tone ?? 'accent'];
  return (
    <Card className={className} interactive={interactive}>
      <p className="text-ui text-muted">{label}</p>
      <p className="mt-2.5 font-display text-34 font-bold tracking-display tabular-nums text-ink">{value}</p>
      {bar ? (
        <div
          className={cn('mt-2.5 h-2.5 w-full overflow-hidden rounded-full', tone.track)}
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={bar.text}
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-base ease-out motion-reduce:transition-none',
              tone.fill,
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
      {hint ? <div className="mt-2 text-base text-muted">{hint}</div> : null}
    </Card>
  );
}
