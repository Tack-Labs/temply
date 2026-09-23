import { beforeEach, describe, expect, it } from 'bun:test';
import { orgUsage } from '@temply/shared/schema';
import { createTestDb, givePlan, type TestDb } from '../test/helpers';
import { checkApiQuota, getApiUsage, nextResetDate, recordApiCall, ukMonthString } from './api-quota';

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

describe('checkApiQuota', () => {
  it('blocks a free user once usage reaches the limit', async () => {
    const now = new Date('2026-03-03T10:00:00Z');
    const before = await checkApiQuota(db, USER, now);
    expect(before.allowed).toBe(true);
    // Seed usage to exactly the plan limit rather than looping recordApiCall.
    await db.insert(orgUsage).values({ org_id: USER, period: ukMonthString(now), count: before.limit });
    const blocked = await checkApiQuota(db, USER, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('always allows an unlimited plan', async () => {
    await givePlan(db, USER, 'enterprise');
    const now = new Date('2026-03-03T10:00:00Z');
    await recordApiCall(db, USER, now);
    const res = await checkApiQuota(db, USER, now);
    expect(res.allowed).toBe(true);
    expect(res.limit).toBe(Infinity);
  });
});
