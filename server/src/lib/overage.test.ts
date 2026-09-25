import { beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { orgUsage } from '@temply/shared/schema';
import { createTestDb, givePlan, type TestDb } from '../test/helpers';
import { reportOverage, type MeterEvent } from './overage';

let db: TestDb;
let sent: MeterEvent[];
const send = async (event: MeterEvent) => { sent.push(event); };

beforeEach(() => {
  db = createTestDb();
  sent = [];
});

// Mid-month in winter, well clear of either month's edge.
const MID = new Date('2026-02-15T12:00:00.000Z');
const usage = (org: string, period: string, count: number) => db.insert(orgUsage).values({ org_id: org, period, count });
const setCount = (org: string, period: string, count: number) =>
  db.update(orgUsage).set({ count }).where(and(eq(orgUsage.org_id, org), eq(orgUsage.period, period)));
const reported = async (org: string, period: string) =>
  (await db.select().from(orgUsage).where(and(eq(orgUsage.org_id, org), eq(orgUsage.period, period))))[0].reported;

describe('reportOverage', () => {
  it('reports a Team workspace’s calls past the included ones, stamped now', async () => {
    await givePlan(db, 'org_a', 'team', 'active', { customer: 'cus_a' });
    await usage('org_a', '2026-02', 12_500);
    expect(await reportOverage(db, MID, send)).toBe(1);
    expect(sent).toEqual([{ customer: 'cus_a', value: 2_500, identifier: 'org_a:2026-02:from-0', timestamp: MID.getTime() / 1000 }]);
    expect(await reported('org_a', '2026-02')).toBe(2_500);
  });

  it('sends only what is new since the last report', async () => {
    await givePlan(db, 'org_a', 'team', 'active', { customer: 'cus_a' });
    await usage('org_a', '2026-02', 12_500);
    await reportOverage(db, MID, send);
    expect(await reportOverage(db, MID, send)).toBe(0);
    await setCount('org_a', '2026-02', 13_000);
    await reportOverage(db, MID, send);
    expect(sent[1]).toMatchObject({ value: 500, identifier: 'org_a:2026-02:from-2500' });
  });

  it('reports nothing under the included calls, nor for a trial, enterprise or a row with no customer', async () => {
    await givePlan(db, 'org_under', 'team', 'active', { customer: 'cus_under' });
    await usage('org_under', '2026-02', 10_000);
    await usage('org_trial', '2026-02', 50_000);
    await givePlan(db, 'org_ent', 'enterprise', 'active', { customer: 'cus_ent' });
    await usage('org_ent', '2026-02', 50_000);
    await givePlan(db, 'org_nocus', 'team');
    await usage('org_nocus', '2026-02', 50_000);
    expect(await reportOverage(db, MID, send)).toBe(0);
  });

  it('puts the claim back when Stripe fails, so the next run sends the same calls under the same identifier', async () => {
    await givePlan(db, 'org_a', 'team', 'active', { customer: 'cus_a' });
    await usage('org_a', '2026-02', 11_000);
    const error = spyOn(console, 'error').mockImplementation(() => {});
    expect(await reportOverage(db, MID, async () => { throw new Error('stripe down'); })).toBe(0);
    error.mockRestore();
    expect(await reported('org_a', '2026-02')).toBe(0);
    await reportOverage(db, MID, send);
    expect(sent).toEqual([expect.objectContaining({ value: 1_000, identifier: 'org_a:2026-02:from-0' })]);
  });

  it('never sends the same calls twice when two runs overlap', async () => {
    await givePlan(db, 'org_a', 'team', 'active', { customer: 'cus_a' });
    await usage('org_a', '2026-02', 11_000);
    await Promise.all([reportOverage(db, MID, send), reportOverage(db, MID, send)]);
    expect(sent).toHaveLength(1);
  });

  it('stamps last month’s late calls inside last month, so they reach its invoice', async () => {
    await givePlan(db, 'org_a', 'team', 'active', { customer: 'cus_a' });
    await usage('org_a', '2026-06', 10_300);
    // 00:30 UTC on 1 July is 01:30 in London, so June ended at 23:00 UTC.
    const now = new Date('2026-07-01T00:30:00.000Z');
    await reportOverage(db, now, send);
    expect(sent[0]).toMatchObject({ value: 300, identifier: 'org_a:2026-06:from-0', timestamp: Date.parse('2026-06-30T22:59:59.000Z') / 1000 });
  });

  it('holds a new London month’s calls until its UTC billing period has begun', async () => {
    await givePlan(db, 'org_a', 'team', 'active', { customer: 'cus_a' });
    await usage('org_a', '2026-07', 10_300);
    // 23:30 UTC on 30 June is already July in London, but not yet on the bill.
    expect(await reportOverage(db, new Date('2026-06-30T23:30:00.000Z'), send)).toBe(0);
    expect(await reportOverage(db, new Date('2026-07-01T00:05:00.000Z'), send)).toBe(1);
  });
});
