'use client';

import { useAuth } from '@clerk/nextjs';
import { LockIcon } from 'lucide-react';
import Link from 'next/link';
import { PLAN_LABELS, TRIAL_WARNING_DAYS, formatUsd, trialDaysLeft } from '@temply/shared/plans';
import { pressable } from '~/components/ui/button';
import { Skeleton, SkeletonList } from '~/components/ui/skeleton';
import { Badge, Card } from '~/components/ui/surfaces';
import { PLAN_PAGE, daysLeftLabel, shortDate, useQuota, type Quota } from '~/lib/billing';
import { cn } from '~/lib/classname';
import { TONE_FILL, TONE_NOTE, usagePct, usageTone } from './usage-tone';

export { usagePct };

type Surface = 'mint' | 'warn' | 'danger' | 'plain';

// A card is the pastel pair of what it says: mint while a trial has room and
// time, butter once either is running out, rose when work is blocked, and the
// page's plain card for a paying workspace with nothing to flag. Everything on
// a wash is that wash's own ink, the pairs the contrast gate holds, so the
// notes are not muted there. The track is the raised surface on a wash and
// the strong line on a plain card, where raised would vanish into the card.
const SURFACE: Record<Surface, { card: string; ink: string; note: string; track: string; fill: string }> = {
  mint: {
    card: 'border-transparent bg-success-wash',
    ink: 'text-success-ink',
    note: 'text-success-ink',
    track: 'bg-raised',
    fill: 'bg-success',
  },
  warn: {
    card: 'border-transparent bg-warn-wash',
    ink: 'text-warn-ink',
    note: TONE_NOTE.warn,
    track: 'bg-raised',
    fill: TONE_FILL.warn,
  },
  danger: {
    card: 'border-transparent bg-danger-wash',
    ink: 'text-danger-ink',
    note: TONE_NOTE.danger,
    track: 'bg-raised',
    fill: TONE_FILL.danger,
  },
  plain: {
    card: '',
    ink: 'text-ink',
    note: TONE_NOTE.accent,
    track: 'bg-line-strong',
    fill: TONE_FILL.accent,
  },
};

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

  const surface: Surface =
    lapsed || tone === 'danger'
      ? 'danger'
      : tone === 'warn' || (days !== null && days <= TRIAL_WARNING_DAYS)
        ? 'warn'
        : data.plan === 'trial'
          ? 'mint'
          : 'plain';
  const look = SURFACE[surface];

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
    <Card
      inset={false}
      className={cn('fade-in-mount rounded-2xl p-4 shadow-none motion-reduce:transition-none', look.card)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('min-w-0 truncate text-base font-bold', look.ink)}>{PLAN_LABELS[data.plan]}</span>
        {/* A trial's end and a scheduled cancellation are worth a glance from
            anywhere in the app, not only on the plan page. */}
        {days !== null ? (
          <span className={cn('shrink-0 text-base font-semibold whitespace-nowrap', look.ink)}>
            {daysLeftLabel(days)}
          </span>
        ) : data.cancelAt ? (
          <Badge>Ends {shortDate(data.cancelAt)}</Badge>
        ) : null}
      </div>

      {lapsed ? (
        // A lapsed workspace keeps the trial's numbers, but they no longer
        // measure anything: live calls are paused whatever the count says.
        <>
          <p className={cn('mt-2 flex items-center gap-1.5 text-base font-semibold', look.ink)}>
            <LockIcon aria-hidden className="size-3.5 shrink-0" />
            Live keys paused
          </p>
          {isAdmin ? null : <p className={cn('mt-1 text-base', look.ink)}>Ask an admin to subscribe</p>}
        </>
      ) : (
        <>
          {scale !== null ? (
            <div
              className={cn('mt-2 h-2 w-full overflow-hidden rounded-full', look.track)}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label={`${used.toLocaleString()} of ${scale.toLocaleString()} ${limit === null ? 'included ' : ''}monthly API calls used`}
            >
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-slow ease-out motion-reduce:transition-none',
                  look.fill,
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          ) : null}
          {/* Wraps rather than truncates: 184px holds "1,200 over · ~$1.20"
              or the reset date beside a short note, not both beside a long
              one, and a clipped overage cost is the number the line is for. */}
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2 text-base">
            <span className={cn('tabular-nums', look.note)}>{note}</span>
            <span className={cn('shrink-0 tabular-nums', surface === 'plain' ? 'text-muted' : look.ink)}>
              resets {shortDate(data.resetsOn)}
            </span>
          </div>
        </>
      )}

      {isAdmin && (data.plan === 'trial' || lapsed) ? (
        // The text is a link, as on the board. Its padding makes the hit
        // area 44px tall, and the negative margins give that height back so
        // the card stays the height of its words: the text sits 8px under the
        // note, and the area spills into the note's row and the card's own
        // padding, neither of which is a target.
        <Link
          href={PLAN_PAGE}
          className={cn(
            '-mt-1 -mb-3 flex w-fit items-center rounded-field py-3 text-base font-bold underline underline-offset-4 hover:text-ink',
            look.ink,
            pressable,
          )}
        >
          Subscribe
        </Link>
      ) : null}
    </Card>
  );
}

/** The card's shape in placeholders, so the sidebar's foot holds its height
 *  while the numbers are on the way. The rows carry the card's own paddings
 *  and line heights; the Subscribe link an admin on a trial sees is not
 *  reserved, since the plan is not known until the answer comes. */
function QuotaSkeleton() {
  return (
    <Card inset={false} className="rounded-2xl p-4 shadow-none">
      <div className="flex h-6 items-center">
        <Skeleton className="h-3.5 w-20" />
      </div>
      <Skeleton className="mt-2 h-2 w-full rounded-full" />
      <div className="mt-2 flex h-5 items-center justify-between gap-2">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-20" />
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
          <p className="fade-in-mount px-3.5 py-2 text-base text-muted motion-reduce:transition-none">
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
