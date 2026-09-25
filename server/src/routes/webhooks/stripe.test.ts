import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { eq } from 'drizzle-orm';
import { subscriptions } from '@temply/shared/schema';
import { getPlan } from '../../lib/billing';
import { createTestApp, createTestDb, givePlan, type TestDb } from '../../test/helpers';
import { fakeStripe, stripeDelivery, type FakeStripe } from '../../test/fake-stripe';
import { stripeWebhookRoutes } from './stripe';

const ORG = 'org_billing';
let db: TestDb;
let app: ReturnType<typeof createTestApp>;
let stripe: FakeStripe;

beforeEach(async () => {
  stripe = fakeStripe();
  db = createTestDb();
  app = createTestApp(db, stripeWebhookRoutes);
  // As after checkout made the customer: a workspace on its trial.
  await givePlan(db, ORG, 'free', 'active', { customer: 'cus_a' });
});
afterEach(() => stripe.restore());

const row = async () => (await db.select().from(subscriptions).where(eq(subscriptions.org_id, ORG)))[0];
const deliver = (type: string, id: string) => app.handle(stripeDelivery({ type, data: { object: { id, object: 'subscription' } } }));

describe('POST /api/webhooks/stripe', () => {
  it('answers 503 until Stripe is configured, and 400 without a signature', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect((await deliver('customer.subscription.created', 'sub_a')).status).toBe(503);
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
    const unsigned = new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body: '{}' });
    expect((await app.handle(unsigned)).status).toBe(400);
  });

  it('rejects a body signed with another secret and changes nothing', async () => {
    const error = spyOn(console, 'error').mockImplementation(() => {});
    stripe.subscription('cus_a', { id: 'sub_a' });
    const res = await app.handle(stripeDelivery({ type: 'customer.subscription.created', data: { object: { id: 'sub_a' } } }, 'whsec_other'));
    error.mockRestore();
    expect(res.status).toBe(400);
    expect((await row()).plan).toBe('free');
    expect(stripe.calls).toHaveLength(0);
  });

  it('writes the subscription as Stripe has it, not as the event said', async () => {
    stripe.subscription('cus_a', { id: 'sub_a', seats: 4, packs: 2 });
    expect((await deliver('customer.subscription.created', 'sub_a')).status).toBe(200);
    expect(stripe.calls).toEqual([{ method: 'GET', path: '/v1/subscriptions/sub_a', form: {} }]);
    expect(await row()).toMatchObject({ plan: 'team', status: 'active', stripe_subscription_id: 'sub_a', seats: 4, template_packs: 2, current_period_end: stripe.periodEnd, cancel_at: null });
    expect(await getPlan(db, ORG)).toMatchObject({ plan: 'team', seats: 4, templatePacks: 2 });
  });

  it('ends the trial on payment, so a plan that ends goes read-only', async () => {
    const sub = stripe.subscription('cus_a', { id: 'sub_a' });
    await deliver('customer.subscription.created', 'sub_a');
    expect(Date.parse((await row()).trial_ends_at!)).toBeLessThanOrEqual(Date.now());
    sub.status = 'canceled';
    await deliver('customer.subscription.deleted', 'sub_a');
    expect(await row()).toMatchObject({ plan: 'free', status: 'canceled', stripe_subscription_id: null, seats: null, template_packs: 0 });
    expect((await getPlan(db, ORG)).plan).toBe('lapsed');
  });

  it('marks enterprise from the subscription’s metadata', async () => {
    stripe.subscription('cus_a', { id: 'sub_a', metadata: { plan: 'enterprise' } });
    await deliver('customer.subscription.created', 'sub_a');
    expect((await row()).plan).toBe('enterprise');
  });

  it('keeps the plan to a scheduled cancellation, from either way Stripe says it', async () => {
    const sub = stripe.subscription('cus_a', { id: 'sub_a', cancelAtPeriodEnd: true });
    await deliver('customer.subscription.updated', 'sub_a');
    expect(await row()).toMatchObject({ plan: 'team', cancel_at: stripe.periodEnd });
    sub.cancel_at_period_end = false;
    sub.cancel_at = Math.floor(Date.UTC(2098, 5, 1) / 1000);
    await deliver('customer.subscription.updated', 'sub_a');
    expect((await row()).cancel_at).toBe('2098-06-01T00:00:00.000Z');
  });

  it('drops a write that read Stripe before the row last did', async () => {
    stripe.subscription('cus_a', { id: 'sub_a', seats: 4 });
    await db.update(subscriptions).set({ stripe_synced_at: '2999-01-01T00:00:00.000Z' }).where(eq(subscriptions.org_id, ORG));
    await deliver('customer.subscription.updated', 'sub_a');
    expect((await row()).plan).toBe('free');
  });

  it('will not let a second subscription unseat one that is paying, and says to refund it', async () => {
    stripe.subscription('cus_a', { id: 'sub_a', seats: 2 });
    stripe.subscription('cus_a', { id: 'sub_b', seats: 9 });
    await deliver('customer.subscription.created', 'sub_a');
    const error = spyOn(console, 'error').mockImplementation(() => {});
    await deliver('customer.subscription.created', 'sub_b');
    const logged = error.mock.calls.map((c) => String(c[0]));
    error.mockRestore();
    expect(await row()).toMatchObject({ stripe_subscription_id: 'sub_a', seats: 2 });
    expect(logged.some((m) => m.includes('sub_b') && m.includes('Refund'))).toBe(true);
  });

  it('lets a new subscription take a row whose plan has ended', async () => {
    const first = stripe.subscription('cus_a', { id: 'sub_a' });
    await deliver('customer.subscription.created', 'sub_a');
    first.status = 'canceled';
    await deliver('customer.subscription.deleted', 'sub_a');
    stripe.subscription('cus_a', { id: 'sub_b', seats: 3 });
    await deliver('customer.subscription.created', 'sub_b');
    expect(await row()).toMatchObject({ plan: 'team', stripe_subscription_id: 'sub_b', seats: 3 });
  });

  it('does not let a stale event about an old subscription end the new one', async () => {
    const first = stripe.subscription('cus_a', { id: 'sub_a' });
    await deliver('customer.subscription.created', 'sub_a');
    first.status = 'canceled';
    await deliver('customer.subscription.deleted', 'sub_a');
    stripe.subscription('cus_a', { id: 'sub_b' });
    await deliver('customer.subscription.created', 'sub_b');
    await deliver('customer.subscription.deleted', 'sub_a');
    expect(await row()).toMatchObject({ plan: 'team', stripe_subscription_id: 'sub_b' });
  });

  it('touches only the customer’s own row', async () => {
    await givePlan(db, 'org_other', 'free', 'active', { customer: 'cus_other' });
    stripe.subscription('cus_a', { id: 'sub_a' });
    await deliver('customer.subscription.created', 'sub_a');
    const [other] = await db.select().from(subscriptions).where(eq(subscriptions.org_id, 'org_other'));
    expect(other.plan).toBe('free');
  });

  it('acknowledges other events without reading anything', async () => {
    const res = await app.handle(stripeDelivery({ type: 'invoice.paid', data: { object: { id: 'in_1', object: 'invoice' } } }));
    expect(res.status).toBe(200);
    expect(stripe.calls).toHaveLength(0);
  });
});
