import * as Sentry from '@sentry/bun';
import { and, eq, gt, isNotNull } from 'drizzle-orm';
import { orgUsage, subscriptions } from '@temply/shared/schema';
import { INCLUDED } from '@temply/shared/plans';
import { getDb, type Db } from '../plugins/db';
import { londonMonthStart, previousMonth, ukMonthString } from './api-quota';
import { getStripe, meterEventName, stripePrices } from './stripe';

export interface MeterEvent {
  customer: string;
  value: number;
  identifier: string;
  /** Seconds since the epoch; decides which billing period the calls land in. */
  timestamp: number;
}

async function sendMeterEvent(event: MeterEvent): Promise<void> {
  await getStripe().billing.meterEvents.create({
    event_name: meterEventName(),
    payload: { stripe_customer_id: event.customer, value: String(event.value) },
    identifier: event.identifier,
    timestamp: event.timestamp,
  });
}

/**
 * Tells Stripe's meter about the live calls each Team workspace made past
 * the included ones, as the difference since the last report. Returns how
 * many reports it sent.
 *
 * `reported` is claimed with a compare-and-set before Stripe hears anything,
 * so two processes never send the same calls; a failed send puts it back
 * for the next run. A crash between the two loses those calls from the bill
 * — the job can under-bill, never double-bill.
 *
 * The usage counter keeps London months and a subscription's periods start
 * at 00:00 UTC on the 1st, an hour later in summer. Last month's calls are
 * stamped inside last month, so the ones made in its final minutes still
 * reach its invoice while Stripe holds it as a draft, about an hour into the
 * new month. This month waits until its period has started. Every call so
 * lands on the bill for the month it was counted in.
 */
export async function reportOverage(db: Db, now: Date = new Date(), send: (event: MeterEvent) => Promise<void> = sendMeterEvent): Promise<number> {
  const current = ukMonthString(now);
  const [y, m] = current.split('-').map(Number);
  const periods = [{ period: previousMonth(current), at: Math.min(now.getTime(), londonMonthStart(current).getTime() - 1000) }];
  if (now.getTime() >= Date.UTC(y, m - 1, 1)) periods.push({ period: current, at: now.getTime() });

  let sent = 0;
  for (const { period, at } of periods) {
    const rows = await db
      .select({ orgId: orgUsage.org_id, count: orgUsage.count, reported: orgUsage.reported, customer: subscriptions.stripe_customer_id })
      .from(orgUsage)
      .innerJoin(subscriptions, eq(subscriptions.org_id, orgUsage.org_id))
      .where(and(eq(orgUsage.period, period), gt(orgUsage.count, INCLUDED.apiCalls), eq(subscriptions.plan, 'team'), isNotNull(subscriptions.stripe_customer_id)));

    for (const row of rows) {
      const overage = row.count - INCLUDED.apiCalls;
      if (overage <= row.reported || !row.customer) continue;
      const here = and(eq(orgUsage.org_id, row.orgId), eq(orgUsage.period, period));
      const claimed = await db
        .update(orgUsage)
        .set({ reported: overage })
        .where(and(here, eq(orgUsage.reported, row.reported)))
        .returning({ reported: orgUsage.reported });
      if (claimed.length === 0) continue;
      try {
        await send({
          customer: row.customer,
          value: overage - row.reported,
          // The same calls always carry the same identifier, so Stripe drops
          // a send that reached it before the reply was lost.
          identifier: `${row.orgId}:${period}:from-${row.reported}`,
          timestamp: Math.floor(at / 1000),
        });
        sent++;
      } catch (error) {
        await db.update(orgUsage).set({ reported: row.reported }).where(and(here, eq(orgUsage.reported, overage)));
        console.error(`Overage for ${row.orgId} in ${period} was not reported:`, error instanceof Error ? error.message : error);
        Sentry.captureException(error);
      }
    }
  }
  return sent;
}

const EVERY = 5 * 60_000;

/** Reports overage every five minutes while this server runs; nothing when
 *  billing is not set up here. Returns the stop. */
export function startOverageReporter(): () => void {
  if (!stripePrices()) return () => {};
  const run = () =>
    void reportOverage(getDb()).catch((error) => {
      console.error('Overage report failed:', error);
      Sentry.captureException(error);
    });
  const timer = setInterval(run, EVERY);
  return () => clearInterval(timer);
}
