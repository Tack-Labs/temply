'use client';

import { PRICES_USD, formatUsd, isLimitReached } from '@temply/shared/plans';
import Link from 'next/link';
import { RefreshErrorState } from '~/components/dashboard/refresh-error-state';
import { TONE_FILL, TONE_NOTE, usagePct, usageTone, type UsageTone } from '~/components/dashboard/usage-tone';
import { Button } from '~/components/ui/button';
import { Card, StatTile } from '~/components/ui/surfaces';
import { useHydrated } from '~/hooks/use-hydrated';
import { PLAN_PAGE, shortDate, type Billing } from '~/lib/billing';
import { cn } from '~/lib/classname';

// Pinned rather than the reader's locale: this renders on the server, which
// cannot know it, and the copy around the numbers is English.
const count = (n: number) => n.toLocaleString('en-US');

/** The reset date is the reader's locale, so it waits for hydration; the note beside it, or the note row's own minimum height where there is none, holds the line meanwhile. */
function Resets({ iso }: { iso: string }) {
  const hydrated = useHydrated();
  return <span className="shrink-0 text-muted tabular-nums">{hydrated ? `Resets ${shortDate(iso)}` : null}</span>;
}

/**
 * StatTile has a label, a value and a hint but nowhere to put a bar, so a
 * measured number is drawn here with the same label and value type. Where
 * there is no ceiling to measure against, or it has stopped meaning anything
 * (a read-only workspace), `limit` is null and the number stands alone.
 */
function Meter({
  label,
  used,
  limit,
  caption,
  tone,
  note,
  aside,
}: {
  label: string;
  used: number;
  limit: number | null;
  /** "of 10,000", "no limit", or nothing. Also what a screen reader hears after the count. */
  caption: string | null;
  tone: UsageTone;
  note: string | null;
  aside?: React.ReactNode;
}) {
  // The width reads the same floored percentage the tone is chosen by. From
  // the raw ratio, 79.9% would be drawn almost to the 80 where warn starts
  // while still wearing the accent colour.
  const pct = limit ? usagePct(used, limit) : 0;

  return (
    <Card className="p-3.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
        <span className="font-display text-2xl font-semibold tracking-display tabular-nums text-ink">{count(used)}</span>
        {caption ? <span className="text-sm text-muted tabular-nums">{caption}</span> : null}
      </p>
      {limit !== null ? (
        <div
          // A new account sits at zero, so the empty track has to read
          // against the card: it takes the stronger line, as the sidebar's does.
          className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-line-strong"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
          aria-valuetext={[count(used), caption].filter(Boolean).join(' ')}
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
      {note || aside ? (
        // One line of text-xs is 18px, held here because a plan with no limit has no
        // note and an aside that is empty until hydration: the row would
        // otherwise open from nothing when the date arrives.
        <div className="mt-2 flex min-h-4.5 flex-wrap items-center justify-between gap-x-2 text-xs">
          <span className={cn('min-w-0 tabular-nums', TONE_NOTE[tone])}>{note}</span>
          {aside}
        </div>
      ) : null}
    </Card>
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
  const apiTone = usageTone({ used: usage.apiCalls, scale: apiScale, capped: apiCapped, over: overage.calls > 0 });
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

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(16rem,100%),1fr))] gap-3">
      {lapsed ? (
        <Meter
          label="Live API calls this month"
          used={usage.apiCalls}
          limit={null}
          caption={null}
          tone="danger"
          note="Live calls paused"
        />
      ) : (
        <Meter
          label="Live API calls this month"
          used={usage.apiCalls}
          limit={apiScale}
          caption={apiScale === null ? 'no limit' : `of ${count(apiScale)}${limits.maxApiCalls === null ? ' included' : ''}`}
          tone={apiTone}
          note={apiNote}
          aside={<Resets iso={billing.resetsOn} />}
        />
      )}

      {lapsed ? (
        <Meter label="Templates" used={usage.templates} limit={null} caption={null} tone="danger" note="Read-only" />
      ) : (
        <Meter
          label="Templates"
          used={usage.templates}
          limit={templateLimit}
          caption={templateLimit === null ? 'no limit' : `of ${count(templateLimit)}`}
          tone={usageTone({ used: usage.templates, scale: templateLimit, capped: templatesAtLimit, over: false })}
          note={
            templateLimit === null
              ? null
              : templatesAtLimit
                ? 'Limit reached'
                : `${count(templateLimit - usage.templates)} left`
          }
        />
      )}

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
    <section aria-labelledby="usage-heading" className="space-y-2.5">
      {/* As tall as the row is with the "Manage plan" button in it, 28px and 44px
          on a coarse pointer, whoever is reading: a member has no button, and
          the loading skeleton cannot know which one is coming. */}
      <div className="flex min-h-7 items-center justify-between gap-3 pointer-coarse:min-h-11">
        <h2 id="usage-heading" className="font-display text-sm font-semibold tracking-display text-ink">
          Usage
        </h2>
        {/* The plan page is admin-only, so a member is not sent to it. */}
        {isAdmin ? (
          <Button variant="link" size="sm" touch asChild className="px-0">
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
