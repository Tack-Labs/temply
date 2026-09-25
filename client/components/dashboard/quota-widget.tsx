'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { PLAN_LABELS, formatUsd, trialDaysLeft } from '@temply/shared/plans';
import { Button } from '~/components/ui/button';
import { PLAN_PAGE, daysLeftLabel, shortDate, useQuota } from '~/lib/billing';
import { cn } from '~/lib/classname';

export function QuotaWidget() {
  const { data } = useQuota();
  const { orgRole } = useAuth();

  if (!data) return null;

  const { used, limit, included } = data.api;
  // A trial is measured against where live calls stop; Team against what the
  // price covers, since past it calls carry on and are billed.
  const scale = limit ?? included;
  const pct = scale ? Math.round((used / scale) * 100) : 0;
  const capped = limit !== null && used >= limit;
  const over = data.overage.calls > 0;
  const days = data.plan === 'trial' && data.trialEndsAt ? trialDaysLeft(data.trialEndsAt) : null;
  const needsPlan = data.plan === 'trial' || data.plan === 'lapsed';

  return (
    <div className="rounded-md border border-rail-line bg-rail-raised p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-medium text-rail-ink">
          {PLAN_LABELS[data.plan]}
          {/* A trial's end and a scheduled cancellation are worth a glance
              from anywhere in the app, not only on the plan page. */}
          {days !== null ? (
            <span className="font-normal text-rail-muted"> · {daysLeftLabel(days).toLowerCase()}</span>
          ) : data.cancelAt ? (
            <span className="font-normal text-rail-muted"> · ends {shortDate(data.cancelAt)}</span>
          ) : null}
        </span>
        {/* A percentage answers the question this widget exists for — how
            close am I? — in a glance. The exact counts are a click away on the
            plan page, and the progress bar's label carries them for anyone
            reading with assistive tech. */}
        <span className="shrink-0 text-2xs text-rail-muted tabular-nums">
          {scale === null ? `${used.toLocaleString()} · ∞` : `${pct}%`}
        </span>
      </div>
      {scale !== null ? (
        <div
          // The empty track has to read against the card it sits on. `hover`
          // is one value away from `raised`, so at zero usage — a new account,
          // every time — the bar looked missing rather than empty.
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-rail-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, pct)}
          aria-label={`${used.toLocaleString()} of ${scale.toLocaleString()} ${limit === null ? 'included ' : ''}monthly API calls used`}
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-slow ease-out motion-reduce:transition-none',
              capped ? 'bg-danger' : over ? 'bg-warn' : 'bg-accent',
            )}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      ) : null}
      <div className="mt-1.5 flex items-center justify-between gap-2 text-2xs text-rail-muted">
        <span className="min-w-0 truncate tabular-nums">
          {over
            ? `${data.overage.calls.toLocaleString()} over · ~${formatUsd(Math.round(data.overage.usd * 100) / 100)}`
            : 'API calls this month'}
        </span>
        <span className="shrink-0">resets {shortDate(data.resetsOn)}</span>
      </div>
      {needsPlan && orgRole === 'org:admin' ? (
        <Button variant="primary" size="sm" asChild className="mt-2 w-full">
          <Link href={PLAN_PAGE}>Subscribe</Link>
        </Button>
      ) : null}
    </div>
  );
}
