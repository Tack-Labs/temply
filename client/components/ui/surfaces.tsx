import * as React from 'react';
import { cn } from '~/lib/classname';

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
        'rounded-lg border border-line bg-raised shadow-sm',
        inset && 'p-4',
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
        <h1 className="font-display text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * An empty screen is an invitation to act, so the action is part of the state
 * rather than something the page has to remember to put nearby.
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
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line px-6 py-14 text-center">
      <Icon className="size-5 text-faint" />
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
    <div className="flex flex-col items-center justify-center rounded-lg border border-line bg-danger-wash px-6 py-14 text-center">
      <p className="text-base font-medium text-danger-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 h-8 rounded-sm border border-line bg-raised px-3 text-sm font-medium text-ink transition-colors hover:bg-hover"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'accent' | 'success' | 'warn' | 'danger';
}) {
  const tones = {
    neutral: 'bg-hover text-muted',
    accent: 'bg-accent-wash text-accent-ink',
    success: 'bg-success-wash text-success-ink',
    warn: 'bg-warn-wash text-warn-ink',
    danger: 'bg-danger-wash text-danger-ink',
  } as const;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-xs px-1.5 py-0.5 text-2xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Label above, value below — the dashboard and billing pages drew this two
 *  different ways for the same numbers. */
export function StatTile({
  label,
  value,
  hint,
  className,
  interactive,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <Card className={cn('p-3.5', className)} interactive={interactive}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-faint">{hint}</p> : null}
    </Card>
  );
}
