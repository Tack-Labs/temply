import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { subscriptions } from '@temply/shared/schema';
import { createTestDb, givePlan, type TestDb } from '../test/helpers';
import { fakeStripe, PRICES, type FakeStripe } from '../test/fake-stripe';
import { countMembers, cycleAnchor, setItemQuantity, syncSeats } from './stripe';

let db: TestDb;
let stripe: FakeStripe;

beforeEach(() => {
  stripe = fakeStripe();
  db = createTestDb();
});
afterEach(() => stripe.restore());

const ORG = 'org_seats';
const row = async () => (await db.select().from(subscriptions).where(eq(subscriptions.org_id, ORG)))[0];
const seatItem = (subId: string) => stripe.subscriptions.get(subId)!.items.data.find((i) => i.price.id === PRICES.seat)!;

describe('cycleAnchor', () => {
  it('starts the cycle at 00:00 UTC on the 1st of next month', () => {
    expect(cycleAnchor(new Date('2026-09-25T10:00:00.000Z')).toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(cycleAnchor(new Date('2026-12-31T12:00:00.000Z')).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('moves to the month after when checkout could not close before the 1st', () => {
    expect(cycleAnchor(new Date('2026-09-30T23:30:00.000Z')).toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(cycleAnchor(new Date('2026-09-30T23:29:00.000Z')).toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });
});

describe('countMembers', () => {
  it('asks Clerk how many members an organization has', async () => {
    stripe.members.set(ORG, 7);
    expect(await countMembers(ORG)).toBe(7);
  });

  it('never bills for fewer than one', async () => {
    stripe.members.set(ORG, 0);
    expect(await countMembers(ORG)).toBe(1);
  });

  it('throws rather than guess, so the Clerk webhook is retried', async () => {
    globalThis.fetch = (async () => new Response('down', { status: 503 })) as unknown as typeof fetch;
    await expect(countMembers(ORG)).rejects.toThrow('503');
    delete process.env.CLERK_SECRET_KEY;
    await expect(countMembers(ORG)).rejects.toThrow('CLERK_SECRET_KEY');
  });
});

describe('syncSeats', () => {
  it('bills a paying workspace for the members it has now', async () => {
    const sub = stripe.subscription('cus_seats', { seats: 2 });
    await givePlan(db, ORG, 'team', 'active', { customer: 'cus_seats', subscription: sub.id, seats: 2 });
    stripe.members.set(ORG, 5);
    await syncSeats(db, ORG);
    expect(seatItem(sub.id).quantity).toBe(5);
    expect((await row()).seats).toBe(5);
  });

  it('keeps billing seats while Stripe retries a card', async () => {
    const sub = stripe.subscription('cus_seats', { status: 'past_due' });
    await givePlan(db, ORG, 'team', 'past_due', { customer: 'cus_seats', subscription: sub.id });
    stripe.members.set(ORG, 3);
    await syncSeats(db, ORG);
    expect(seatItem(sub.id).quantity).toBe(3);
  });

  it('leaves a trial, an ended plan and enterprise alone', async () => {
    await givePlan(db, ORG, 'free');
    await givePlan(db, 'org_ended', 'team', 'canceled', { customer: 'cus_ended' });
    await givePlan(db, 'org_ent', 'enterprise', 'active', { customer: 'cus_ent' });
    for (const org of [ORG, 'org_ended', 'org_ent']) await syncSeats(db, org);
    expect(stripe.calls).toHaveLength(0);
  });

  it('does nothing on a server without billing', async () => {
    const sub = stripe.subscription('cus_seats');
    await givePlan(db, ORG, 'team', 'active', { customer: 'cus_seats', subscription: sub.id });
    delete process.env.STRIPE_PRICE_SEAT;
    await syncSeats(db, ORG);
    expect(stripe.calls).toHaveLength(0);
  });
});

describe('setItemQuantity', () => {
  it('reads the subscription and changes nothing when the number already matches', async () => {
    const sub = stripe.subscription('cus_seats', { seats: 4 });
    await setItemQuantity(db, sub.id, PRICES.seat, 4);
    expect(stripe.calls).toEqual([{ method: 'GET', path: `/v1/subscriptions/${sub.id}`, form: {} }]);
  });

  it('prorates a change and writes Stripe’s answer to the row', async () => {
    const sub = stripe.subscription('cus_seats', { seats: 1 });
    await givePlan(db, ORG, 'team', 'active', { customer: 'cus_seats', subscription: sub.id, seats: 1 });
    await setItemQuantity(db, sub.id, PRICES.seat, 3);
    const update = stripe.calls.find((c) => c.method === 'POST');
    expect(update?.form).toEqual({ quantity: '3', proration_behavior: 'create_prorations' });
    expect((await row()).seats).toBe(3);
  });
});
