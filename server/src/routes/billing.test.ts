import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { subscriptions } from '@temply/shared/schema';
import { eq } from 'drizzle-orm';
import { verifyCheckoutToken } from '../lib/lemonsqueezy';
import { billingRoutes } from './billing';
import { createTestApp, createTestDb, get, givePlan, post } from '../test/helpers';

let db: ReturnType<typeof createTestDb>;
let app: ReturnType<typeof createTestApp>;
// A user is admin of the one-person workspace named after them, so the
// owner is both the user id and the org id.
const OWNER = 'user_owner';
const member = { 'x-org-id': OWNER, 'x-org-role': 'member' };

// The routes read these per request, so they are set per test and put
// back after: every test file shares the one process.
const ENV = {
  LEMONSQUEEZY_API_KEY: 'ls_test_key',
  LEMONSQUEEZY_API_BASE: 'https://ls.test',
  LEMONSQUEEZY_STORE_ID: '7',
  LEMONSQUEEZY_VARIANT_PRO: '101',
  LEMONSQUEEZY_WEBHOOK_SECRET: 'ls_webhook_secret',
  NEXT_PUBLIC_APP_URL: 'https://temply.test',
};
let saved: Record<string, string | undefined>;

// Lemon Squeezy answers with URLs and records what it was asked; nothing
// reaches the network.
type Call = { method: string; url: string; auth: string | null; body: any };
const calls: Call[] = [];
const realFetch = globalThis.fetch;

beforeEach(() => {
  saved = Object.fromEntries(Object.keys(ENV).map((k) => [k, process.env[k]]));
  Object.assign(process.env, ENV);
  db = createTestDb();
  app = createTestApp(db, billingRoutes);
  calls.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ method: init?.method ?? 'GET', url, auth: new Headers(init?.headers).get('authorization'), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url === 'https://ls.test/v1/checkouts') return Response.json({ data: { attributes: { url: 'https://temply.lemonsqueezy.com/checkout/custom/c_1' } } }, { status: 201 });
    if (url === 'https://ls.test/v1/subscriptions/sub_1') return Response.json({ data: { attributes: { urls: { customer_portal: 'https://temply.lemonsqueezy.com/billing?signature=p_1' } } } });
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('GET /api/v1/billing', () => {
  it('401s without a user, and 403s a user with no workspace', async () => {
    expect((await get(app, '/api/v1/billing')).status).toBe(401);
    expect((await get(app, '/api/v1/billing', OWNER, { 'x-org-id': '' })).status).toBe(403);
  });

  it('reports the plan, the usage and the limits, with an unbounded limit sent as null', async () => {
    await givePlan(db, OWNER, 'enterprise');
    const body = await (await get(app, '/api/v1/billing', OWNER)).json();
    expect(body.plan).toBe('enterprise');
    expect(body.usage.templates).toBe(0);
    expect(body.limits.maxTemplates).toBeNull();
    expect(body.limits.maxVersions).toBe(25);
  });
});

describe('POST /api/v1/billing/checkout', () => {
  it('is for admins, and names who can', async () => {
    const res = await post(app, '/api/v1/billing/checkout', { plan: 'pro' }, 'user_member', member);
    expect(res.status).toBe(403);
    expect((await res.json()).message).toContain('Only an admin can change the plan');
    expect(calls).toHaveLength(0);
  });

  it('opens a checkout for the Pro variant, signed to the workspace and returning to the plan page', async () => {
    const res = await post(app, '/api/v1/billing/checkout', { plan: 'pro' }, OWNER);
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe('https://temply.lemonsqueezy.com/checkout/custom/c_1');
    const [call] = calls;
    expect(call.method).toBe('POST');
    expect(call.auth).toBe('Bearer ls_test_key');
    expect(call.body.data.relationships.store.data.id).toBe('7');
    expect(call.body.data.relationships.variant.data.id).toBe('101');
    expect(call.body.data.attributes.product_options.redirect_url).toBe('https://temply.test/dashboard/settings/plan?success=true');
    const custom = call.body.data.attributes.checkout_data.custom;
    expect(custom).toMatchObject({ org_id: OWNER, user_id: OWNER });
    expect(verifyCheckoutToken(OWNER, custom.token, ENV.LEMONSQUEEZY_WEBHOOK_SECRET)).toBe(true);
    expect(verifyCheckoutToken('org_other', custom.token, ENV.LEMONSQUEEZY_WEBHOOK_SECRET)).toBe(false);
    // The row is made before the customer pays, so the webhook has somewhere to land.
    const [row] = await db.select().from(subscriptions).where(eq(subscriptions.org_id, OWNER));
    expect(row.plan).toBe('free');
  });

  it('keeps the row a workspace already has', async () => {
    await db.insert(subscriptions).values({ id: 'sub_row', user_id: OWNER, org_id: OWNER, plan: 'free', status: 'expired' });
    expect((await post(app, '/api/v1/billing/checkout', { plan: 'pro' }, OWNER)).status).toBe(200);
    const rows = await db.select().from(subscriptions).where(eq(subscriptions.org_id, OWNER));
    expect(rows.map((r) => r.id)).toEqual(['sub_row']);
  });

  it('will not sell a second subscription to a workspace already paying, until its cancellation has run out', async () => {
    await db.insert(subscriptions).values({ id: 'sub_row', user_id: OWNER, org_id: OWNER, lemonsqueezy_subscription_id: 'sub_1', plan: 'pro', status: 'active', cancel_at: '2099-01-01T00:00:00.000Z' });
    const res = await post(app, '/api/v1/billing/checkout', { plan: 'pro' }, OWNER);
    expect(res.status).toBe(409);
    expect((await res.json()).message).toContain('Manage subscription');
    expect(calls).toHaveLength(0);

    await db.update(subscriptions).set({ cancel_at: '2020-01-01T00:00:00.000Z' }).where(eq(subscriptions.id, 'sub_row'));
    expect((await post(app, '/api/v1/billing/checkout', { plan: 'pro' }, OWNER)).status).toBe(200);
  });

  it('refuses a plan checkout does not sell, and says so when the variant is not configured', async () => {
    expect((await post(app, '/api/v1/billing/checkout', { plan: 'enterprise' }, OWNER)).status).toBe(400);
    delete process.env.LEMONSQUEEZY_VARIANT_PRO;
    const res = await post(app, '/api/v1/billing/checkout', { plan: 'pro' }, OWNER);
    expect(res.status).toBe(500);
    expect((await res.json()).message).toContain('not configured');
    expect(calls).toHaveLength(0);
  });

  it('will not open a checkout the webhook could not bind to the workspace', async () => {
    delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    const res = await post(app, '/api/v1/billing/checkout', { plan: 'pro' }, OWNER);
    expect(res.status).toBe(500);
    expect(calls).toHaveLength(0);
  });
});

describe('POST /api/v1/billing/portal', () => {
  it('is for admins, and needs a subscription to open a portal for', async () => {
    expect((await post(app, '/api/v1/billing/portal', {}, 'user_member', member)).status).toBe(403);
    const none = await post(app, '/api/v1/billing/portal', {}, OWNER);
    expect(none.status).toBe(400);
    expect((await none.json()).message).toBe('No subscription found');
  });

  it('opens the portal of the workspace’s subscription', async () => {
    await db.insert(subscriptions).values({ id: 'sub_row', user_id: OWNER, org_id: OWNER, lemonsqueezy_subscription_id: 'sub_1', plan: 'pro', status: 'active' });
    const res = await post(app, '/api/v1/billing/portal', {}, OWNER);
    expect((await res.json()).url).toBe('https://temply.lemonsqueezy.com/billing?signature=p_1');
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(['GET https://ls.test/v1/subscriptions/sub_1']);
  });
});
