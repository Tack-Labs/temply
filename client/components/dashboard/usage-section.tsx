'use client';

import { formatBytes } from '@temply/shared/bytes';
import { PRICES_USD, formatUsd, isLimitReached } from '@temply/shared/plans';
import Link from 'next/link';
import { RefreshErrorState } from '~/components/dashboard/refresh-error-state';
import { SectionHeading } from '~/components/dashboard/section-heading';
import { TONE_NOTE, usagePct, usageTone, type UsageTone } from '~/components/dashboard/usage-tone';
import { Button } from '~/components/ui/button';
import { StatTile } from '~/components/ui/surfaces';
import { useHydrated } from '~/hooks/use-hydrated';
import { PLAN_PAGE, shortDate, type Billing } from '~/lib/billing';
import { cn } from '~/lib/classname';

// Pinned rather than the reader's locale: this renders on the server, which
// cannot know it, and the copy around the numbers is English.
const count = (n: number) => n.toLocaleString('en-US');

/** The reset date is the reader's locale, so it waits for hydration and fades in; the note beside it, or the note row's own minimum height where there is none, holds the line meanwhile. */
function Resets({ iso }: { iso: string }) {
  const hydrated = useHydrated();
  return hydrated ? (
    <span className="fade-in-mount shrink-0 text-muted tabular-nums motion-reduce:transition-none">
      Resets {shortDate(iso)}
    </span>
  ) : null;
}

/** The colour a bar wears while there is room; once a count nears or reaches its limit, the severity replaces it. */
type Category = 'accent' | 'success' | 'peach';

/**
 * One measured number. Where there is no ceiling to measure against, or it
 * has stopped meaning anything (a read-only workspace), `limit` is null and
 * the number stands alone.
 */
function Meter({
  label,
  value,
  used,
  limit,
  caption,
  category,
  severity,
  note,
  aside,
}: {
  label: string;
  /** The count as it is read: "4,200", "120 MB". */
  value: string;
  used: number;
  limit: number | null;
  /** "of 10,000", "no limit", or nothing. Also what a screen reader hears after the count. */
  caption: string | null;
  category: Category;
  severity: UsageTone;
  note: string | null;
  aside?: React.ReactNode;
}) {
  // The width reads the same floored percentage the tone is chosen by. From
  // the raw ratio, 79.9% would be drawn almost to the 80 where warn starts
  // while still wearing the category colour.
  const pct = limit ? usagePct(used, limit) : 0;

  return (
    <StatTile
      label={label}
      value={
        <>
          {value}
          {caption ? (
            <>
              {' '}
              <span className="font-sans text-ui font-medium tracking-normal text-muted">{caption}</span>
            </>
          ) : null}
        </>
      }
      bar={
        limit !== null
          ? {
              value: pct / 100,
              tone: severity === 'accent' ? category : severity,
              text: [value, caption].filter(Boolean).join(' '),
            }
          : undefined
      }
      hint={
        note || aside ? (
          // One line of text-base is 22px, held here because a plan with no
          // limit has no note and an aside that is empty until hydration: the
          // row would otherwise open from nothing when the date arrives.
          <div className="flex min-h-5.5 flex-wrap items-center justify-between gap-x-2">
            <span className={cn('min-w-0 tabular-nums', TONE_NOTE[severity])}>{note}</span>
            {aside}
          </div>
        ) : undefined
      }
    />
  );
}

function Tiles({ billing, isAdmin }: { billing: Billing; isAdmin: boolean }) {
  const { plan, usage, limits, overage } = billing;
  // A lapsed workspace keeps the trial's numbers, but they measure nothing:
  // live calls are paused and nothing can be made, whatever the count says.
  const lapsed = plan === 'lapsed';

  // A trial is measured against where live calls stop; Team against what the
  // price covers, since past it calls carry on and are billed.
  const apiScale = limits.maxApiCalls ?? limits.includedApiCalls;
  const apiCapped = limits.maxApiCalls !== null && usage.apiCalls >= limits.maxApiCalls;
  const apiSeverity = usageTone({ used: usage.apiCalls, scale: apiScale, capped: apiCapped, over: overage.calls > 0 });
  const apiNote =
    overage.calls > 0
      ? `${count(overage.calls)} over · ~${formatUsd(Math.round(overage.usd * 100) / 100)}`
      : apiCapped
        ? 'Limit reached'
        : apiScale !== null
          ? `${count(Math.max(0, apiScale - usage.apiCalls))} left`
          : null;

  const templateLimit = limits.maxTemplates;
  const templatesAtLimit = isLimitReached(usage.templates, templateLimit);

  const storageLimit = limits.maxStorageBytes;
  const storageAtLimit = isLimitReached(usage.storageBytes, storageLimit);

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(13rem,100%),1fr))] gap-4.5">
      {lapsed ? (
        <Meter
          label="Live API calls this month"
          value={count(usage.apiCalls)}
          used={usage.apiCalls}
          limit={null}
          caption={null}
          category="accent"
          severity="danger"
          note="Live calls paused"
        />
      ) : (
        <Meter
          label="Live API calls this month"
          value={count(usage.apiCalls)}
          used={usage.apiCalls}
          limit={apiScale}
          caption={apiScale === null ? 'no limit' : `of ${count(apiScale)}${limits.maxApiCalls === null ? ' included' : ''}`}
          category="accent"
          severity={apiSeverity}
          note={apiNote}
          aside={<Resets iso={billing.resetsOn} />}
        />
      )}

      {lapsed ? (
        <Meter
          label="Templates"
          value={count(usage.templates)}
          used={usage.templates}
          limit={null}
          caption={null}
          category="success"
          severity="danger"
          note="Read-only"
        />
      ) : (
        <Meter
          label="Templates"
          value={count(usage.templates)}
          used={usage.templates}
          limit={templateLimit}
          caption={templateLimit === null ? 'no limit' : `of ${count(templateLimit)}`}
          category="success"
          severity={usageTone({ used: usage.templates, scale: templateLimit, capped: templatesAtLimit, over: false })}
          note={
            templateLimit === null
              ? null
              : templatesAtLimit
                ? 'Limit reached'
                : `${count(templateLimit - usage.templates)} left`
          }
        />
      )}

      {/* A lapsed workspace's images stay hosted for the emails already sent,
          and what stops an upload is the write guard rather than the
          allowance, so there is no bar to draw and the two tiles beside this
          one have already given the reason. */}
      <Meter
        label="Storage"
        value={formatBytes(usage.storageBytes)}
        used={usage.storageBytes}
        limit={lapsed ? null : storageLimit}
        caption={lapsed ? null : storageLimit === null ? 'no limit' : `of ${formatBytes(storageLimit)}`}
        category="peach"
        severity={usageTone({
          used: usage.storageBytes,
          scale: lapsed ? null : storageLimit,
          capped: !lapsed && storageAtLimit,
          over: false,
        })}
        note={
          lapsed || storageLimit === null
            ? null
            : storageAtLimit
              ? 'Limit reached'
              : `${formatBytes(storageLimit - usage.storageBytes)} left`
        }
      />

      {/* Seats are only counted on a Team subscription; elsewhere there is
          nothing honest to put here, so the tile is left out. The price is
          the plan page's business, and that page is for admins. */}
      {billing.seats !== null ? (
        <StatTile
          label="Members"
          value={billing.seats}
          hint={isAdmin ? `${formatUsd(PRICES_USD.seat)} each a month` : undefined}
        />
      ) : null}
    </div>
  );
}

/**
 * The home's view of the month's numbers, drawn from the same billing read
 * the plan page uses. The sidebar's card says how far along the API count is;
 * this adds the exact counts, the template allowance and, on Team, the
 * seats. A billing failure is this section's alone: it says so, apart from
 * the page, and offers a retry rather than drawing a free plan's zeroes.
 */
export function UsageSection({ billing, isAdmin }: { billing: Billing | null; isAdmin: boolean }) {
  return (
    <section aria-labelledby="usage-heading" className="space-y-3.5">
      {/* 44px whoever is reading: an admin's "Manage plan" is that tall, a
          member has no button, and the loading skeleton cannot know which
          one is coming. */}
      <div className="flex min-h-11 items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          <SectionHeading id="usage-heading">Usage</SectionHeading>
          <span className="text-ui text-muted">This month</span>
        </div>
        {/* The plan page is admin-only, so a member is not sent to it. */}
        {isAdmin ? (
          <Button variant="link" asChild className="h-11 px-0 text-ui font-bold">
            <Link href={PLAN_PAGE}>Manage plan</Link>
          </Button>
        ) : null}
      </div>

      {billing ? (
        <Tiles billing={billing} isAdmin={isAdmin} />
      ) : (
        <RefreshErrorState
          title="Usage could not be loaded"
          description="We could not reach billing, so your usage is not shown. Your plan has not changed."
        />
      )}
    </section>
  );
}
