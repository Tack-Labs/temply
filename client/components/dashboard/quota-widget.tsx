'use client';

import { useAuth } from '@clerk/nextjs';
import { LockIcon } from 'lucide-react';
import Link from 'next/link';
import { PLAN_LABELS, TRIAL_WARNING_DAYS, formatUsd, trialDaysLeft } from '@temply/shared/plans';
import { Button } from '~/components/ui/button';
import { Skeleton, SkeletonList } from '~/components/ui/skeleton';
import { Badge, Card } from '~/components/ui/surfaces';
import { PLAN_PAGE, daysLeftLabel, shortDate, useQuota, type Quota } from '~/lib/billing';
import { cn } from '~/lib/classname';
import { TONE_FILL, TONE_NOTE, usagePct, usageTone } from './usage-tone';

export { usagePct };

/** The sidebar's plan and usage card. Split from the hooks that feed it so
 *  each state can be drawn from a plain `Quota`. */
export function QuotaCard({ data, isAdmin }: { data: Quota; isAdmin: boolean }) {
  const { used, limit, included } = data.api;
  // A trial is measured against where live calls stop; Team against what the
  // price covers, since past it calls carry on and are billed.
  const scale = limit ?? included;
  const pct = scale ? usagePct(used, scale) : 0;
  const capped = limit !== null && used >= limit;
  const over = data.overage.calls > 0;
  const lapsed = data.plan === 'lapsed';
  const tone = usageTone({ used, scale, capped, over });
  const days = data.plan === 'trial' && data.trialEndsAt ? trialDaysLeft(data.trialEndsAt) : null;

  // A percentage answers the question this card exists for, how close am I,
  // at a glance. The exact counts are on the plan page, and the progress bar's
  // label carries them for anyone reading with assistive tech.
  const note =
    scale === null
      ? `${used.toLocaleString()} calls`
      : over
        ? `${data.overage.calls.toLocaleString()} over · ~${formatUsd(Math.round(data.overage.usd * 100) / 100)}`
        : capped
          ? 'Limit reached'
          : `${pct}% used`;

  return (
    <Card inset={false} className="fade-in-mount rounded-lg p-3 shadow-none motion-reduce:transition-none">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-semibold text-ink">{PLAN_LABELS[data.plan]}</span>
        {/* A trial's end and a scheduled cancellation are worth a glance from
            anywhere in the app, not only on the plan page. */}
        {days !== null ? (
          <Badge tone={days <= TRIAL_WARNING_DAYS ? 'warn' : 'accent'}>{daysLeftLabel(days)}</Badge>
        ) : data.cancelAt ? (
          <Badge>Ends {shortDate(data.cancelAt)}</Badge>
        ) : null}
      </div>

      {lapsed ? (
        // A lapsed workspace keeps the trial's numbers, but they no longer
        // measure anything: live calls are paused whatever the count says.
        <>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-danger-ink">
            <LockIcon aria-hidden className="size-3 shrink-0" />
            Live keys paused
          </p>
          {isAdmin ? null : <p className="mt-1 text-xs text-muted">Ask an admin to subscribe</p>}
        </>
      ) : (
        <>
          {scale !== null ? (
            <div
              // The empty track has to read against the card it sits on, and
              // a new account sits at zero every time, so it takes the
              // stronger line rather than the one the card's own border uses.
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line-strong"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label={`${used.toLocaleString()} of ${scale.toLocaleString()} ${limit === null ? 'included ' : ''}monthly API calls used`}
            >
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-slow ease-out motion-reduce:transition-none',
                  TONE_FILL[tone],
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          ) : null}
          <div className="mt-1.5 flex items-center justify-between gap-2 text-2xs">
            <span className={cn('min-w-0 truncate tabular-nums', TONE_NOTE[tone])}>{note}</span>
            <span className="shrink-0 text-muted tabular-nums">resets {shortDate(data.resetsOn)}</span>
          </div>
        </>
      )}

      {isAdmin && (data.plan === 'trial' || lapsed) ? (
        <Button variant="primary" size="sm" touch asChild className="mt-2.5 w-full">
          <Link href={PLAN_PAGE}>Subscribe</Link>
        </Button>
      ) : null}
    </Card>
  );
}

/** The card's shape in placeholders, so the sidebar's foot holds its height
 *  while the numbers are on the way. The rows carry the card's own paddings
 *  and line heights; the Subscribe button an admin on a trial sees is not
 *  reserved, since the plan is not known until the answer comes. */
function QuotaSkeleton() {
  return (
    <Card inset={false} className="rounded-lg p-3 shadow-none">
      <div className="flex h-4.5 items-center">
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
      <div className="mt-1.5 flex h-4 items-center justify-between gap-2">
        <Skeleton className="h-2.5 w-12" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    </Card>
  );
}

/**
 * What the sidebar's foot shows for a given answer from /api/v1/quota: the
 * placeholder until it arrives, a quiet line if it failed, the card once it
 * has. Every plan draws a card, so a missing answer always means "not yet" or
 * "could not", never "nothing to show here". A refetch that fails after an
 * answer keeps the card on the numbers it has, which is truer than a line
 * saying there are none.
 *
 * The status region is mounted for the whole life of the widget and only its
 * words change (see SkeletonList), but the card sits beside it rather than in
 * it: inside, every change to a count would be read out again as the whole
 * card.
 */
export function QuotaPanel({ data, isError, isAdmin }: { data?: Quota; isError: boolean; isAdmin: boolean }) {
  const failed = !data && isError;
  return (
    <div>
      <SkeletonList label={data ? 'Usage loaded' : failed ? '' : 'Loading usage'}>
        {data ? null : failed ? (
          // Muted, not warn or danger: the app works without this number, and
          // an alarm in the corner of every page would say otherwise.
          <p className="fade-in-mount px-3 py-2 text-xs text-muted motion-reduce:transition-none">
            Usage unavailable
          </p>
        ) : (
          <QuotaSkeleton />
        )}
      </SkeletonList>
      {data ? <QuotaCard data={data} isAdmin={isAdmin} /> : null}
    </div>
  );
}

export function QuotaWidget() {
  const { data, isError } = useQuota();
  const { orgRole } = useAuth();

  return <QuotaPanel data={data} isError={isError} isAdmin={orgRole === 'org:admin'} />;
}
