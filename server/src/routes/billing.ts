import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import { subscriptions } from '@temply/shared/schema';
import { getPlan, getUsage } from '../lib/billing';
import { checkoutConfigured, checkoutToken, createCheckout, portalUrl, variantFor } from '../lib/lemonsqueezy';
import { PLAN_LIMITS, serialiseLimits } from '@temply/shared/plans';
import { json, unauthorized } from '../lib/errors';
import { authPlugin } from '../plugins/auth';
import { askAnAdmin, isAdmin, noWorkspace } from '../lib/workspace';
import { dbPlugin } from '../plugins/db';

export const billingRoutes = new Elysia()
  .use(authPlugin)
  .use(dbPlugin)
  .get('/api/v1/billing', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const plan = await getPlan(ctx.db, ctx.orgId);
    const usage = await getUsage(ctx.db, ctx.orgId);
    // Limits go out so the client can tell "full" from "room to spare" without
    // reimplementing the plan rules. Infinity is sent as null (see plans.ts).
    const limits = serialiseLimits(PLAN_LIMITS[plan.plan]);
    return json({ ...plan, usage, limits });
  })

  .post('/api/v1/billing/checkout', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    if (!isAdmin(ctx)) return askAnAdmin('change the plan');
    const { plan } = ctx.body;
    const variantId = variantFor(plan);
    if (!variantId || !checkoutConfigured()) return json({ status: 500, message: `Lemon Squeezy is not configured for ${plan}`, errors: ['Server Error'] }, 500);
    // A second subscription would bill the workspace twice for one plan. The
    // page offers Upgrade only on Free, but a page loaded before the webhook
    // landed still shows it.
    if ((await getPlan(ctx.db, ctx.orgId)).plan !== 'free') {
      const message = 'This workspace already has a paid plan. Change it from Manage subscription.';
      return json({ status: 409, message, errors: [message] }, 409);
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9000';
    // The webhook only ever updates, so the row it will look for is made
    // here: a row that cannot be made fails the upgrade before the card is
    // charged rather than after.
    const [sub] = await ctx.db.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.org_id, ctx.orgId)).limit(1);
    if (!sub) await ctx.db.insert(subscriptions).values({ id: crypto.randomUUID(), user_id: ctx.userId, org_id: ctx.orgId, plan: 'free', status: 'active' });
    const url = await createCheckout({
      variantId,
      custom: { org_id: ctx.orgId, user_id: ctx.userId, token: checkoutToken(ctx.orgId) },
      redirectUrl: `${appUrl}/dashboard/settings/plan?success=true`,
    });
    return json({ url });
  }, { body: t.Object({ plan: t.Literal('pro') }) })

  .post('/api/v1/billing/portal', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    if (!isAdmin(ctx)) return askAnAdmin('manage billing');
    const [sub] = await ctx.db.select().from(subscriptions).where(eq(subscriptions.org_id, ctx.orgId)).limit(1);
    if (!sub?.lemonsqueezy_subscription_id) return json({ status: 400, message: 'No subscription found', errors: ['Bad Request'] }, 400);
    return json({ url: await portalUrl(sub.lemonsqueezy_subscription_id) });
  });
