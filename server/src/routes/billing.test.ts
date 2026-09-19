import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { subscriptions } from '@temply/shared/schema';
import { eq } from 'drizzle-orm';

// Stripe answers with ids and URLs and records what it was asked; nothing
// reaches the network. The fake extends the real SDK rather than replacing
// it: Bun's module mock is process-wide, and the webhook tests need the
// real signature check from the same module.
const { default: RealStripe } = await import('stripe');
const customersCreated: unknown[] = [];
const checkoutsCreated: Array<Record<string, unknown>> = [];
const portalsCreated: Array<Record<string, unknown>> = [];
mock.module('stripe', () => ({
  default: class Stripe extends RealStripe {
    customers = {
      create: async (args: unknown) => {
        customersCreated.push(args);
        return { id: `cus_${customersCreated.length}` };
      },
    } as unknown as RealStripe['customers'];
    checkout = {
      sessions: {
        create: async (args: Record<string, unknown>) => {
          checkoutsCreated.push(args);
          return { url: 'https://checkout.stripe.test/s_1' };
        },
      },
    } as unknown as RealStripe['checkout'];
    billingPortal = {
      sessions: {
        create: async (args: Record<string, unknown>) => {
          portalsCreated.push(args);
          return { url: 'https://portal.stripe.test/p_1' };
        },
      },
    } as unknown as RealStripe['billingPortal'];
  },
}));

const { billingRoutes } = await import('./billing');
const { createTestApp, createTestDb, get, givePlan, post } = await import('../test/helpers');

let db: ReturnType<typeof createTestDb>;
let app: ReturnType<typeof createTestApp>;
// A user is admin of the one-person workspace named after them, so the
// owner is both the user id and the org id.
const OWNER = 'user_owner';
const member = { 'x-org-id': OWNER, 'x-org-role': 'member' };

// The routes read these per request, so they are set per test and put
// back after: every test file shares the one process.
const ENV = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PRICE_PRO: 'price_pro', NEXT_PUBLIC_APP_URL: 'https://temply.test' };
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(Object.keys(ENV).map((k) => [k, process.env[k]]));
  Object.assign(process.env, ENV);
  db = createTestDb();
  app = createTestApp(db, billingRoutes);
  customersCreated.length = 0;
  checkoutsCreated.length = 0;
  portalsCreated.length = 0;
});
afterEach(() => {
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
    expect(checkoutsCreated).toHaveLength(0);
  });

  it('makes a Stripe customer for a workspace that has none, then a session pointing back at the plan page', async () => {
    const res = await post(app, '/api/v1/billing/checkout', { plan: 'pro' }, OWNER);
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe('https://checkout.stripe.test/s_1');
    expect(customersCreated).toEqual([{ metadata: { orgId: OWNER, userId: OWNER } }]);
    const [session] = checkoutsCreated;
    expect(session.customer).toBe('cus_1');
    expect(session.line_items).toEqual([{ price: 'price_pro', quantity: 1 }]);
    expect(session.success_url).toBe('https://temply.test/dashboard/settings/plan?success=true');
    expect(session.metadata).toEqual({ orgId: OWNER, userId: OWNER, plan: 'pro' });
    // The row was made with the customer on it, so the webhook has somewhere to land.
    const [row] = await db.select().from(subscriptions).where(eq(subscriptions.org_id, OWNER));
    expect(row.stripe_customer_id).toBe('cus_1');
    expect(row.plan).toBe('free');
  });

  it('reuses the customer a workspace already has', async () => {
    await db.insert(subscriptions).values({ id: 'sub_row', user_id: OWNER, org_id: OWNER, stripe_customer_id: 'cus_existing', plan: 'free', status: 'active' });
    await post(app, '/api/v1/billing/checkout', { plan: 'pro' }, OWNER);
    expect(customersCreated).toHaveLength(0);
    expect(checkoutsCreated[0].customer).toBe('cus_existing');
  });

  it('refuses a plan Checkout does not sell, and says so when the price is not configured', async () => {
    expect((await post(app, '/api/v1/billing/checkout', { plan: 'enterprise' }, OWNER)).status).toBe(400);
    const price = process.env.STRIPE_PRICE_PRO;
    delete process.env.STRIPE_PRICE_PRO;
    try {
      const res = await post(app, '/api/v1/billing/checkout', { plan: 'pro' }, OWNER);
      expect(res.status).toBe(500);
      expect((await res.json()).message).toContain('not configured');
    } finally {
      process.env.STRIPE_PRICE_PRO = price;
    }
  });
});

describe('POST /api/v1/billing/portal', () => {
  it('is for admins, and needs a customer to open a portal for', async () => {
    expect((await post(app, '/api/v1/billing/portal', {}, 'user_member', member)).status).toBe(403);
    const none = await post(app, '/api/v1/billing/portal', {}, OWNER);
    expect(none.status).toBe(400);
    expect((await none.json()).message).toBe('No subscription found');
  });

  it('opens the portal for the workspace’s customer, returning to the plan page', async () => {
    await db.insert(subscriptions).values({ id: 'sub_row', user_id: OWNER, org_id: OWNER, stripe_customer_id: 'cus_existing', plan: 'pro', status: 'active' });
    const res = await post(app, '/api/v1/billing/portal', {}, OWNER);
    expect((await res.json()).url).toBe('https://portal.stripe.test/p_1');
    expect(portalsCreated).toEqual([{ customer: 'cus_existing', return_url: 'https://temply.test/dashboard/settings/plan' }]);
  });
});
