import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { subscriptions } from '@temply/shared/schema';
import { checkoutToken } from '../../lib/lemonsqueezy';
import { createTestApp, createTestDb, type TestDb } from '../../test/helpers';
import { lemonSqueezyWebhookRoutes } from './lemonsqueezy';

const ORG = 'org_billing';
const ENV = {
  LEMONSQUEEZY_WEBHOOK_SECRET: 'ls_webhook_secret_for_tests',
  LEMONSQUEEZY_VARIANT_PRO: '101',
  LEMONSQUEEZY_VARIANT_ENTERPRISE: '202',
};
let saved: Record<string, string | undefined>;
let db: TestDb;
let app: ReturnType<typeof createTestApp>;

beforeEach(async () => {
  saved = Object.fromEntries(Object.keys(ENV).map((k) => [k, process.env[k]]));
  Object.assign(process.env, ENV);
  db = createTestDb();
  app = createTestApp(db, lemonSqueezyWebhookRoutes);
  // Checkout makes the row before the customer pays; the webhook only updates it.
  await db.insert(subscriptions).values({ id: crypto.randomUUID(), user_id: 'user_a', org_id: ORG, plan: 'free', status: 'active' });
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

/** Minutes past a fixed hour, in Lemon Squeezy's microsecond format. */
const at = (minute: number) => `2026-09-23T10:${String(minute).padStart(2, '0')}:00.000000Z`;

function subscriptionEvent(
  name: string,
  attributes: Record<string, unknown> = {},
  opts: { id?: string; custom?: Record<string, string> } = {},
) {
  return JSON.stringify({
    meta: { event_name: name, custom_data: opts.custom ?? { org_id: ORG, user_id: 'user_a', token: checkoutToken(ORG) } },
    data: {
      type: 'subscriptions',
      id: opts.id ?? '1',
      attributes: { status: 'active', variant_id: 101, renews_at: '2026-10-23T00:00:00.000000Z', ends_at: null, updated_at: at(0), ...attributes },
    },
  });
}

/** Lemon Squeezy's scheme: X-Signature is hex(HMAC-SHA256(secret, body)). */
function send(body: string, secret = ENV.LEMONSQUEEZY_WEBHOOK_SECRET) {
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  return app.handle(new Request('http://localhost/api/webhooks/lemonsqueezy', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-signature': signature },
    body,
  }));
}

async function row() {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.org_id, ORG));
  return sub;
}

describe('POST /api/webhooks/lemonsqueezy', () => {
  it('refuses a body signed with any other secret, and one with no signature', async () => {
    expect((await send(subscriptionEvent('subscription_created'), 'not_the_secret')).status).toBe(400);
    const unsigned = await app.handle(new Request('http://localhost/api/webhooks/lemonsqueezy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: subscriptionEvent('subscription_created'),
    }));
    expect(unsigned.status).toBe(400);
    expect((await row()).plan).toBe('free');
  });

  it('grants the plan the variant is sold as, to the workspace the checkout was signed for', async () => {
    expect((await send(subscriptionEvent('subscription_created'))).status).toBe(200);
    const sub = await row();
    expect(sub.plan).toBe('pro');
    expect(sub.status).toBe('active');
    expect(sub.lemonsqueezy_subscription_id).toBe('1');
    expect(sub.current_period_end).toBe('2026-10-23T00:00:00.000Z');
    expect(sub.cancel_at).toBeNull();

    await send(subscriptionEvent('subscription_updated', { variant_id: 202, updated_at: at(1) }));
    expect((await row()).plan).toBe('enterprise');
  });

  it('binds nothing from a buy link that names a workspace without our signature', async () => {
    const forged = subscriptionEvent('subscription_created', {}, { custom: { org_id: ORG, token: checkoutToken('org_attacker') } });
    expect((await send(forged)).status).toBe(200);
    const sub = await row();
    expect(sub.plan).toBe('free');
    expect(sub.lemonsqueezy_subscription_id).toBeNull();
  });

  it('leaves a variant no plan is sold as alone', async () => {
    await send(subscriptionEvent('subscription_created', { variant_id: 999 }));
    expect((await row()).plan).toBe('free');
  });

  it('keeps the plan through the grace period, says when it ends, and clears that on resume', async () => {
    await send(subscriptionEvent('subscription_created'));
    await send(subscriptionEvent('subscription_updated', { status: 'cancelled', ends_at: '2026-10-23T00:00:00.000000Z', updated_at: at(1) }));
    let sub = await row();
    expect(sub.plan).toBe('pro');
    expect(sub.status).toBe('active');
    expect(sub.cancel_at).toBe('2026-10-23T00:00:00.000Z');

    await send(subscriptionEvent('subscription_updated', { status: 'active', updated_at: at(2) }));
    sub = await row();
    expect(sub.plan).toBe('pro');
    expect(sub.cancel_at).toBeNull();
  });

  it('returns the workspace to Free when the subscription expires, and lets go of it', async () => {
    await send(subscriptionEvent('subscription_created'));
    await send(subscriptionEvent('subscription_expired', { status: 'expired', ends_at: at(2), updated_at: at(2) }));
    const sub = await row();
    expect(sub.plan).toBe('free');
    expect(sub.status).toBe('expired');
    expect(sub.lemonsqueezy_subscription_id).toBeNull();
    expect(sub.cancel_at).toBeNull();
  });

  it('drops an event older than the one the row already took', async () => {
    await send(subscriptionEvent('subscription_created', { updated_at: at(0) }));
    await send(subscriptionEvent('subscription_expired', { status: 'expired', updated_at: at(5) }));
    // A retried delivery of an earlier state, arriving last.
    await send(subscriptionEvent('subscription_updated', { status: 'active', updated_at: at(3) }));
    const sub = await row();
    expect(sub.plan).toBe('free');
    expect(sub.status).toBe('expired');
  });

  it('keeps the workspace on the subscription it pays through when a second one starts', async () => {
    await send(subscriptionEvent('subscription_created', { updated_at: at(0) }, { id: '1' }));
    await send(subscriptionEvent('subscription_created', { updated_at: at(1) }, { id: '2' }));
    expect((await row()).lemonsqueezy_subscription_id).toBe('1');
    // The first renewing, and the second winding down, both leave it there.
    await send(subscriptionEvent('subscription_updated', { updated_at: at(2) }, { id: '1' }));
    await send(subscriptionEvent('subscription_expired', { status: 'expired', updated_at: at(3) }, { id: '2' }));
    const sub = await row();
    expect(sub.plan).toBe('pro');
    expect(sub.lemonsqueezy_subscription_id).toBe('1');
  });

  it('moves to a new subscription once the one it holds stops paying, and does not give it back', async () => {
    await send(subscriptionEvent('subscription_created', { updated_at: at(0) }, { id: '1' }));
    await send(subscriptionEvent('subscription_updated', { status: 'past_due', updated_at: at(1) }, { id: '1' }));
    expect((await row()).plan).toBe('free');
    await send(subscriptionEvent('subscription_created', { updated_at: at(2) }, { id: '2' }));
    // The first recovering later is a second charge, not the workspace's plan.
    await send(subscriptionEvent('subscription_updated', { updated_at: at(3) }, { id: '1' }));
    const sub = await row();
    expect(sub.plan).toBe('pro');
    expect(sub.lemonsqueezy_subscription_id).toBe('2');
  });

  it('moves to a new subscription when the cancelled one has passed its end without an expiry arriving', async () => {
    await send(subscriptionEvent('subscription_created', { updated_at: at(0) }, { id: '1' }));
    await send(subscriptionEvent('subscription_updated', { status: 'cancelled', ends_at: '2026-01-01T00:00:00.000000Z', updated_at: at(1) }, { id: '1' }));
    await send(subscriptionEvent('subscription_created', { updated_at: at(2) }, { id: '2' }));
    const sub = await row();
    expect(sub.lemonsqueezy_subscription_id).toBe('2');
    expect(sub.cancel_at).toBeNull();
  });

  it('takes a lapsed subscription to Free even when its variant is no longer sold', async () => {
    await send(subscriptionEvent('subscription_created', { updated_at: at(0) }));
    // A price change moved Pro to a new variant; the old subscription still names 101.
    process.env.LEMONSQUEEZY_VARIANT_PRO = '303';
    await send(subscriptionEvent('subscription_updated', { status: 'past_due', updated_at: at(1) }));
    const sub = await row();
    expect(sub.plan).toBe('free');
    expect(sub.status).toBe('past_due');
  });

  it('acknowledges a payment event without reading it', async () => {
    const invoice = JSON.stringify({ meta: { event_name: 'subscription_payment_success' }, data: { type: 'subscription-invoices', id: '9', attributes: { status: 'paid' } } });
    expect((await send(invoice)).status).toBe(200);
    expect((await row()).plan).toBe('free');
  });
});
