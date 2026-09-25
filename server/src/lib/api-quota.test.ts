import { beforeEach, describe, expect, it } from 'bun:test';
import { orgUsage } from '@temply/shared/schema';
import { createTestDb, givePlan, type TestDb } from '../test/helpers';
import { checkApiQuota, getApiUsage, londonMonthStart, nextResetDate, previousMonth, recordApiCall, ukMonthString } from './api-quota';

let db: TestDb;
const USER = 'user_api';
beforeEach(() => { db = createTestDb(); });

describe('ukMonthString', () => {
  it('uses the London calendar month', () => {
    // 2026-06-30 23:30 UTC is 2026-07-01 00:30 BST.
    expect(ukMonthString(new Date('2026-06-30T23:30:00Z'))).toBe('2026-07');
  });
});

describe('nextResetDate', () => {
  it('is the 1st of the next month', () => {
    expect(nextResetDate(new Date('2026-03-10T12:00:00Z'))).toBe('2026-04-01');
    expect(nextResetDate(new Date('2026-12-10T12:00:00Z'))).toBe('2027-01-01');
  });
});

describe('api usage', () => {
  it('increments per call and separates months', async () => {
    const march = new Date('2026-03-03T10:00:00Z');
    expect(await getApiUsage(db, USER, march)).toBe(0);
    await recordApiCall(db, USER, march);
    await recordApiCall(db, USER, march);
    expect(await getApiUsage(db, USER, march)).toBe(2);
    await recordApiCall(db, USER, new Date('2026-04-03T10:00:00Z'));
    expect(await getApiUsage(db, USER, march)).toBe(2);
  });
});

describe('previousMonth', () => {
  it('steps back a month, across a year', () => {
    expect(previousMonth('2026-03')).toBe('2026-02');
    expect(previousMonth('2026-01')).toBe('2025-12');
  });
});

describe('londonMonthStart', () => {
  it('is midnight UTC in winter and 23:00 UTC the day before in summer', () => {
    expect(londonMonthStart('2026-01').toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(londonMonthStart('2026-07').toISOString()).toBe('2026-06-30T23:00:00.000Z');
    // The clocks go forward on the last Sunday of March, so April starts in summer time.
    expect(londonMonthStart('2026-04').toISOString()).toBe('2026-03-31T23:00:00.000Z');
    expect(londonMonthStart('2026-11').toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });
});

describe('checkApiQuota', () => {
  const now = new Date('2026-03-03T10:00:00Z');

  it('stops a trial’s live calls at the included 10,000 and says what they cost past it', async () => {
    const before = await checkApiQuota(db, USER, now);
    expect(before).toMatchObject({ allowed: true, limit: 10_000 });
    await db.insert(orgUsage).values({ org_id: USER, period: ukMonthString(now), count: 10_000 });
    const blocked = await checkApiQuota(db, USER, now);
    expect(blocked).toMatchObject({ allowed: false, remaining: 0 });
    expect(blocked.message).toBe("This month's 10,000 trial calls are used. Subscribe to keep serving: calls past them cost $1 per 1,000.");
  });

  it('never stops Team: calls past the included ones are billed', async () => {
    await givePlan(db, USER, 'team');
    await db.insert(orgUsage).values({ org_id: USER, period: ukMonthString(now), count: 250_000 });
    expect(await checkApiQuota(db, USER, now)).toMatchObject({ allowed: true, limit: Infinity });
  });

  it('always allows enterprise', async () => {
    await givePlan(db, USER, 'enterprise');
    await recordApiCall(db, USER, now);
    expect(await checkApiQuota(db, USER, now)).toMatchObject({ allowed: true, limit: Infinity });
  });

  it('caps test keys on every plan, apart from live usage', async () => {
    await givePlan(db, USER, 'team');
    await db.insert(orgUsage).values({ org_id: USER, period: `${ukMonthString(now)}#test`, count: 1_000 });
    expect(await checkApiQuota(db, USER, now, 'test')).toMatchObject({ allowed: false, limit: 1_000 });
    expect((await checkApiQuota(db, USER, now)).allowed).toBe(true);
  });

  it('uses the account it is handed rather than reading it again', async () => {
    await db.insert(orgUsage).values({ org_id: USER, period: ukMonthString(now), count: 10_000 });
    const account = { plan: 'team' as const, status: 'active', cancelAt: null, trialEndsAt: null, seats: 1, templatePacks: 0, currentPeriodEnd: null };
    expect((await checkApiQuota(db, USER, now, 'live', account)).allowed).toBe(true);
  });
});
