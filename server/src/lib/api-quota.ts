import { and, eq, sql } from 'drizzle-orm';
import { orgUsage } from '@temply/shared/schema';
import type { Db } from '../plugins/db';
import { PLAN_LIMITS, TEST_API_CALLS_PER_MONTH } from '@temply/shared/plans';
import { getPlan } from './billing';
import type { ApiKeyMode } from './codes';

/**
 * Test calls are counted in their own bucket, under the same (user, period)
 * primary key with a suffix — a second table for one extra counter would be
 * more schema than the distinction is worth.
 */
function periodFor(now: Date, mode: ApiKeyMode): string {
  const month = ukMonthString(now);
  return mode === 'test' ? `${month}#test` : month;
}

const londonParts = (now: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .split('-'); // ["YYYY","MM","DD"]

/** "YYYY-MM" for the London calendar month. */
export function ukMonthString(now: Date = new Date()): string {
  const [y, m] = londonParts(now);
  return `${y}-${m}`;
}

/** ISO date ("YYYY-MM-DD") of the 1st of next London month. */
export function nextResetDate(now: Date = new Date()): string {
  const [y, m] = londonParts(now).map(Number);
  const year = m === 12 ? y + 1 : y;
  const month = m === 12 ? 1 : m + 1;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export async function getApiUsage(db: Db, orgId: string, now: Date = new Date(), mode: ApiKeyMode = 'live'): Promise<number> {
  const period = periodFor(now, mode);
  const [row] = await db
    .select()
    .from(orgUsage)
    .where(and(eq(orgUsage.org_id, orgId), eq(orgUsage.period, period)))
    .limit(1);
  return row?.count ?? 0;
}

export async function checkApiQuota(
  db: Db,
  orgId: string,
  now: Date = new Date(),
  mode: ApiKeyMode = 'live',
): Promise<{ allowed: boolean; message?: string; used: number; limit: number; remaining: number }> {
  const used = await getApiUsage(db, orgId, now, mode);
  if (mode === 'test') {
    const limit = TEST_API_CALLS_PER_MONTH;
    const remaining = Math.max(0, limit - used);
    if (used >= limit) {
      return {
        allowed: false,
        used,
        limit,
        remaining,
        message: `Test keys are limited to ${limit} calls a month. Use a live key for real traffic.`,
      };
    }
    return { allowed: true, used, limit, remaining };
  }
  const { plan } = await getPlan(db, orgId);
  const limit = PLAN_LIMITS[plan].maxApiCalls;
  if (!Number.isFinite(limit)) return { allowed: true, used, limit, remaining: Infinity };
  const remaining = Math.max(0, limit - used);
  if (used >= limit) {
    return {
      allowed: false,
      used,
      limit,
      remaining,
      message: `Monthly API limit reached — ${limit} calls on the ${plan} plan. Upgrade for more.`,
    };
  }
  return { allowed: true, used, limit, remaining };
}

export async function recordApiCall(db: Db, orgId: string, now: Date = new Date(), mode: ApiKeyMode = 'live'): Promise<void> {
  const period = periodFor(now, mode);
  await db
    .insert(orgUsage)
    .values({ org_id: orgId, period, count: 1 })
    .onConflictDoUpdate({
      target: [orgUsage.org_id, orgUsage.period],
      set: { count: sql`${orgUsage.count} + 1` },
    });
}
