import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { mails, orgUsage, subscriptions } from '@temply/shared/schema';
import { ukMonthString } from '../lib/api-quota';
import { cycleAnchor } from '../lib/stripe';
import { billingRoutes } from './billing';
import { createTestApp, createTestDb, get, givePlan, lapse, post, put, type TestDb } from '../test/helpers';
import { fakeStripe, PRICES, type FakeStripe } from '../test/fake-stripe';

let db: TestDb;
let app: ReturnType<typeof createTestApp>;
let stripe: FakeStripe;
// A user is admin of the one-person workspace named after them, so the
// owner is both the user id and the org id.
const OWNER = 'user_owner';
const member = { 'x-org-id': OWNER, 'x-org-role': 'member' };

beforeEach(() => {
  stripe = fakeStripe();
  db = createTestDb();
  app = createTestApp(db, billingRoutes);
});
afterEach(() => stripe.restore());

const row = async () => (await db.select().from(subscriptions).where(eq(subscriptions.org_id, OWNER)))[0];

async function addTemplates(count: number) {
  for (let i = 0; i < count; i++) {
    await db.insert(mails).values({ id: crypto.randomUUID(), user_id: OWNER, org_id: OWNER, title: `T${i}`, content: '{}', short_code: `tpl_${crypto.randomUUID().slice(0, 8)}` });
  }
}

/** A Team workspace whose row and Stripe agree, as after checkout. */
async function subscribed(opts: { seats?: number; packs?: number } = {}) {
  const sub = stripe.subscription('cus_owner', opts);
  await givePlan(db, OWNER, 'team', 'active', { customer: 'cus_owner', subscription: sub.id, seats: opts.seats ?? 1, templatePacks: opts.packs ?? 0 });
  return sub;
}

describe('GET /api/v1/billing', () => {
  it('401s without a user, and 403s a user with no workspace', async () => {
    expect((await get(app, '/api/v1/billing')).status).toBe(401);
    expect((await get(app, '/api/v1/billing', OWNER, { 'x-org-id': '' })).status).toBe(403);
  });

  it('reports a trial with the numbers it stops at', async () => {
    const body = await (await get(app, '/api/v1/billing', OWNER)).json();
    expect(body).toMatchObject({ plan: 'trial', seats: null, templatePacks: 0, billingConfigured: true, overage: { calls: 0, usd: 0 } });
    expect(body.limits).toMatchObject({ maxTemplates: 10, maxVersions: 10, includedApiCalls: 10_000, maxApiCalls: 10_000 });
  });

  it('reports Team’s seats, packs and the overage so far this month', async () => {
    await subscribed({ seats: 3, packs: 2 });
    await db.insert(orgUsage).values({ org_id: OWNER, period: ukMonthString(new Date()), count: 13_000 });
    const body = await (await get(app, '/api/v1/billing', OWNER)).json();
    expect(body).toMatchObject({ plan: 'team', seats: 3, templatePacks: 2, overage: { calls: 3_000, usd: 3 } });
    expect(body.usage.apiCalls).toBe(13_000);
    expect(body.limits).toMatchObject({ maxTemplates: 30, maxVersions: 50, includedApiCalls: 10_000, maxApiCalls: null });
  });

  it('says when billing is not set up on this server', async () => {
    delete process.env.STRIPE_PRICE_SEAT;
    expect((await (await get(app, '/api/v1/billing', OWNER)).json()).billingConfigured).toBe(false);
  });

  it('still answers for a read-only workspace', async () => {
    await lapse(db, OWNER);
    expect((await (await get(app, '/api/v1/billing', OWNER)).json()).plan).toBe('lapsed');
  });
});

describe('POST /api/v1/billing/checkout', () => {
  it('is for admins, and names who can', async () => {
    const res = await post(app, '/api/v1/billing/checkout', {}, 'user_member', member);
    expect(res.status).toBe(403);
    expect((await res.json()).message).toContain('admin');
    expect(stripe.calls).toHaveLength(0);
  });

  it('opens a checkout billing each member, the metered overage and any packs, renewing on the 1st', async () => {
    stripe.members.set(OWNER, 4);
    const before = Date.now();
    const res = await post(app, '/api/v1/billing/checkout', { templatePacks: 2 }, OWNER);
    expect(res.status).toBe(200);
    expect((await res.json()).url).toMatch(/^https:\/\/checkout\.stripe\.test\//);

    const [customer, checkout] = stripe.calls;
    expect(customer).toMatchObject({ path: '/v1/customers', form: { 'metadata[orgId]': OWNER, 'metadata[userId]': OWNER } });
    expect(checkout.path).toBe('/v1/checkout/sessions');
    const anchor = cycleAnchor(new Date(before)).getTime() / 1000;
    expect(checkout.form).toMatchObject({
      mode: 'subscription',
      customer: 'cus_1',
      client_reference_id: OWNER,
      'line_items[0][price]': PRICES.seat,
      'line_items[0][quantity]': '4',
      'line_items[1][price]': PRICES.apiOverage,
      'line_items[2][price]': PRICES.templatePack,
      'line_items[2][quantity]': '2',
      'subscription_data[metadata][orgId]': OWNER,
      'subscription_data[billing_cycle_anchor]': String(anchor),
      'subscription_data[proration_behavior]': 'create_prorations',
      success_url: 'https://temply.test/dashboard/settings/plan?success=true',
      cancel_url: 'https://temply.test/dashboard/settings/plan',
    });
    // Metered prices take no quantity; Stripe refuses one.
    expect(checkout.form['line_items[1][quantity]']).toBeUndefined();
    expect(Number(checkout.form.expires_at)).toBeLessThan(anchor);
    expect(await row()).toMatchObject({ stripe_customer_id: 'cus_1', plan: 'free' });
  });

  it('starts the trial of a workspace that goes straight to checkout, and leaves out a pack line without packs', async () => {
    await post(app, '/api/v1/billing/checkout', {}, OWNER);
    expect((await row()).trial_ends_at).not.toBeNull();
    expect(stripe.calls[1].form['line_items[2][price]']).toBeUndefined();
  });

  it('keeps the customer a workspace already has', async () => {
    await lapse(db, OWNER);
    await db.update(subscriptions).set({ stripe_customer_id: 'cus_kept' }).where(eq(subscriptions.org_id, OWNER));
    expect((await post(app, '/api/v1/billing/checkout', {}, OWNER)).status).toBe(200);
    expect(stripe.calls.map((c) => c.path)).toEqual(['/v1/checkout/sessions']);
    expect(stripe.calls[0].form.customer).toBe('cus_kept');
  });

  it('will not sell a second plan to a workspace that has one', async () => {
    await subscribed();
    const res = await post(app, '/api/v1/billing/checkout', {}, OWNER);
    expect(res.status).toBe(409);
    expect((await res.json()).message).toBe('This workspace already has a plan. Change it from Manage billing.');
    expect(stripe.calls).toHaveLength(0);
  });

  it('refuses more packs than a workspace can buy', async () => {
    expect((await post(app, '/api/v1/billing/checkout', { templatePacks: 51 }, OWNER)).status).toBe(400);
  });

  it('says so when billing is not set up', async () => {
    delete process.env.STRIPE_PRICE_TEMPLATE_PACK;
    const res = await post(app, '/api/v1/billing/checkout', {}, OWNER);
    expect(res.status).toBe(500);
    expect((await res.json()).message).toBe('Billing is not configured on this server');
  });
});

describe('POST /api/v1/billing/portal', () => {
  it('is for admins, and needs a billing account to open', async () => {
    expect((await post(app, '/api/v1/billing/portal', {}, 'user_member', member)).status).toBe(403);
    const res = await post(app, '/api/v1/billing/portal', {}, OWNER);
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe('This workspace has no billing account yet');
  });

  it('opens the portal for the workspace’s customer, returning to the plan page', async () => {
    await subscribed();
    const res = await post(app, '/api/v1/billing/portal', {}, OWNER);
    expect((await res.json()).url).toBe('https://billing.stripe.test/portal');
    expect(stripe.calls[0].form).toEqual({ customer: 'cus_owner', return_url: 'https://temply.test/dashboard/settings/plan' });
  });
});

describe('PUT /api/v1/billing/template-packs', () => {
  const setPacks = (quantity: number, headers: Record<string, string> = {}) => put(app, '/api/v1/billing/template-packs', { quantity }, headers['x-org-role'] ? 'user_member' : OWNER, headers);

  it('is for admins', async () => {
    await subscribed();
    expect((await setPacks(1, member)).status).toBe(403);
  });

  it('needs a plan to add packs to', async () => {
    const res = await setPacks(1);
    expect(res.status).toBe(409);
    expect((await res.json()).message).toBe('Template packs come with a plan. Subscribe first.');
  });

  it('has nothing to add to enterprise', async () => {
    await givePlan(db, OWNER, 'enterprise');
    expect((await (await setPacks(1)).json()).message).toBe('Enterprise already has unlimited templates.');
  });

  it('adds the first pack as a prorated item and answers with the new limits', async () => {
    const sub = await subscribed();
    const res = await setPacks(2);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ templatePacks: 2, limits: { maxTemplates: 30, maxVersions: 50 } });
    const create = stripe.calls.find((c) => c.method === 'POST' && c.path === '/v1/subscription_items');
    expect(create?.form).toEqual({ subscription: sub.id, price: PRICES.templatePack, quantity: '2', proration_behavior: 'create_prorations' });
    expect((await row()).template_packs).toBe(2);
  });

  it('changes the quantity of packs a workspace has, and removes the item at zero', async () => {
    await subscribed({ packs: 3 });
    await setPacks(1);
    expect((await row()).template_packs).toBe(1);
    expect(stripe.calls.some((c) => c.method === 'POST' && /^\/v1\/subscription_items\/si_/.test(c.path))).toBe(true);
    await setPacks(0);
    expect((await row()).template_packs).toBe(0);
    expect(stripe.calls.some((c) => c.method === 'DELETE')).toBe(true);
  });

  it('asks nothing of Stripe when the number is unchanged', async () => {
    await subscribed({ packs: 1 });
    await setPacks(1);
    expect(stripe.calls.map((c) => c.method)).toEqual(['GET']);
  });

  it('will not drop below the templates a workspace has, and says how many to delete', async () => {
    await subscribed({ packs: 2 });
    await addTemplates(25);
    const res = await setPacks(0);
    expect(res.status).toBe(409);
    expect((await res.json()).message).toBe('This workspace has 25 templates and 0 packs allow 10. Delete 15 templates first.');
    expect(stripe.calls).toHaveLength(0);
  });
});
