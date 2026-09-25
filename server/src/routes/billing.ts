import { Elysia, t } from 'elysia';
import { and, eq, isNull } from 'drizzle-orm';
import { subscriptions } from '@temply/shared/schema';
import { limitsFor, MAX_TEMPLATE_PACKS, overageCalls, overageUsd, serialiseLimits } from '@temply/shared/plans';
import { ensureAccount, getPlan, getStorageUsed, getUsage, limitsForAccount } from '../lib/billing';
import { getApiUsage, nextResetDate } from '../lib/api-quota';
import { countMembers, cycleAnchor, getStripe, setItemQuantity, stripePrices } from '../lib/stripe';
import { json, unauthorized } from '../lib/errors';
import { authPlugin } from '../plugins/auth';
import { askAnAdmin, isAdmin, noWorkspace } from '../lib/workspace';
import { dbPlugin, type Db } from '../plugins/db';

function conflict(message: string) {
  return json({ status: 409, message, errors: [message] }, 409);
}

function notConfigured() {
  return json({ status: 500, message: 'Billing is not configured on this server', errors: ['Server Error'] }, 500);
}

/** Everything the Plan page shows, so it is one request and one truth. */
async function billingSummary(db: Db, orgId: string) {
  const account = await getPlan(db, orgId);
  const limits = limitsForAccount(account);
  const apiCalls = await getApiUsage(db, orgId);
  const calls = overageCalls(apiCalls, limits);
  return {
    ...account,
    usage: { ...(await getUsage(db, orgId)), apiCalls, storageBytes: await getStorageUsed(db, orgId) },
    // Limits go out so the client can tell "full" from "room to spare"
    // without reimplementing the plan rules. Infinity is sent as null.
    limits: serialiseLimits(limits),
    overage: { calls, usd: overageUsd(calls) },
    resetsOn: nextResetDate(),
    billingConfigured: stripePrices() !== null,
  };
}

export const billingRoutes = new Elysia()
  .use(authPlugin)
  .use(dbPlugin)
  .get('/api/v1/billing', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    return json(await billingSummary(ctx.db, ctx.orgId));
  })

  .post('/api/v1/billing/checkout', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    if (!isAdmin(ctx)) return askAnAdmin('subscribe');
    const prices = stripePrices();
    if (!prices) return notConfigured();
    // A second subscription would bill the workspace twice. The page offers
    // Subscribe only without a plan, but one loaded before the webhook
    // landed still shows it.
    const { plan } = await getPlan(ctx.db, ctx.orgId);
    if (plan === 'team' || plan === 'enterprise') return conflict('This workspace already has a plan. Change it from Manage billing.');

    await ensureAccount(ctx.db, ctx.orgId, ctx.userId);
    const [row] = await ctx.db.select().from(subscriptions).where(eq(subscriptions.org_id, ctx.orgId)).limit(1);
    const stripe = getStripe();
    let customer = row.stripe_customer_id;
    if (!customer) {
      const made = await stripe.customers.create({ metadata: { orgId: ctx.orgId, userId: ctx.userId } });
      // Two admins pressing Subscribe at once each make a customer; the row
      // keeps the first, and the other is an empty customer with no charge.
      await ctx.db
        .update(subscriptions)
        .set({ stripe_customer_id: made.id })
        .where(and(eq(subscriptions.id, row.id), isNull(subscriptions.stripe_customer_id)));
      const [kept] = await ctx.db.select({ customer: subscriptions.stripe_customer_id }).from(subscriptions).where(eq(subscriptions.id, row.id));
      customer = kept.customer ?? made.id;
    }

    const packs = ctx.body.templatePacks ?? 0;
    const now = new Date();
    const anchor = cycleAnchor(now);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9000';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: ctx.orgId,
      line_items: [
        { price: prices.seat, quantity: await countMembers(ctx.orgId) },
        // Metered: billed on what the meter hears, so it carries no quantity.
        { price: prices.apiOverage },
        ...(packs > 0 ? [{ price: prices.templatePack, quantity: packs }] : []),
      ],
      subscription_data: {
        metadata: { orgId: ctx.orgId },
        // Renews on the 1st, so a bill and the usage counter cover the same
        // month; the days until then are prorated.
        billing_cycle_anchor: Math.floor(anchor.getTime() / 1000),
        proration_behavior: 'create_prorations',
      },
      // The anchor has to be in the future when the subscription is made,
      // so the session closes before it.
      expires_at: Math.floor(Math.min(anchor.getTime() - 60_000, now.getTime() + 24 * 3_600_000) / 1000),
      success_url: `${appUrl}/dashboard/settings/plan?success=true`,
      cancel_url: `${appUrl}/dashboard/settings/plan`,
    });
    return json({ url: session.url });
  }, { body: t.Object({ templatePacks: t.Optional(t.Integer({ minimum: 0, maximum: MAX_TEMPLATE_PACKS })) }) })

  .post('/api/v1/billing/portal', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    if (!isAdmin(ctx)) return askAnAdmin('manage billing');
    if (!stripePrices()) return notConfigured();
    const [sub] = await ctx.db.select().from(subscriptions).where(eq(subscriptions.org_id, ctx.orgId)).limit(1);
    if (!sub?.stripe_customer_id) return json({ status: 400, message: 'This workspace has no billing account yet', errors: ['Bad Request'] }, 400);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9000';
    const session = await getStripe().billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url: `${appUrl}/dashboard/settings/plan` });
    return json({ url: session.url });
  })

  .put('/api/v1/billing/template-packs', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    if (!isAdmin(ctx)) return askAnAdmin('change template packs');
    const prices = stripePrices();
    if (!prices) return notConfigured();
    const { plan } = await getPlan(ctx.db, ctx.orgId);
    if (plan === 'enterprise') return conflict('Enterprise already has unlimited templates.');
    const [row] = await ctx.db.select().from(subscriptions).where(eq(subscriptions.org_id, ctx.orgId)).limit(1);
    if (plan !== 'team' || !row?.stripe_subscription_id) return conflict('Template packs come with a plan. Subscribe first.');

    const { quantity } = ctx.body;
    // Fewer packs never deletes a template; the admin chooses which go.
    const cap = limitsFor('team', quantity).maxTemplates;
    const { templates } = await getUsage(ctx.db, ctx.orgId);
    if (templates > cap) {
      const over = templates - cap;
      return conflict(`This workspace has ${templates} templates and ${quantity} pack${quantity === 1 ? '' : 's'} allow ${cap}. Delete ${over} template${over === 1 ? '' : 's'} first.`);
    }
    await setItemQuantity(ctx.db, row.stripe_subscription_id, prices.templatePack, quantity);
    return json(await billingSummary(ctx.db, ctx.orgId));
  }, { body: t.Object({ quantity: t.Integer({ minimum: 0, maximum: MAX_TEMPLATE_PACKS }) }) });
