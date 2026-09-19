import { Elysia } from 'elysia';
import type Stripe from 'stripe';
import { and, eq, isNull } from 'drizzle-orm';
import { subscriptions } from '@temply/shared/schema';
import { getStripe } from '../../lib/billing';
import { json } from '../../lib/errors';
import { authPlugin } from '../../plugins/auth';
import { dbPlugin } from '../../plugins/db';

export const webhookRoutes = new Elysia()
  .use(authPlugin)
  .use(dbPlugin)
  .post('/api/webhooks/stripe', async (ctx) => {
    const stripe = getStripe();
    const sig = ctx.request.headers.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !webhookSecret) return json({ status: 400, message: 'Missing signature or webhook secret' }, 400);
    const rawBody = await ctx.request.text();
    // The async variant, and only the async variant: under Bun the SDK's
    // crypto provider is SubtleCrypto, which cannot sign synchronously, so
    // constructEvent throws before it looks at the signature — and every
    // webhook read as forged. Log the reason so a real forgery and a broken
    // setup are told apart in the log.
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
    } catch (error) {
      console.error('Stripe webhook rejected:', error instanceof Error ? error.message : error);
      return json({ status: 400, message: 'Invalid signature' }, 400);
    }
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const orgId = session.metadata?.orgId;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;
        // Sessions opened before organizations carry only a userId; their
        // row is the one still keyed by user.
        const scope = orgId
          ? eq(subscriptions.org_id, orgId)
          : userId
            ? and(eq(subscriptions.user_id, userId), isNull(subscriptions.org_id))
            : null;
        if (scope && plan) await ctx.db.update(subscriptions).set({ plan, stripe_subscription_id: session.subscription as string, stripe_customer_id: session.customer as string, status: 'active', cancel_at: null, updated_at: new Date().toISOString() }).where(scope);
        break;
      }
      case 'customer.subscription.updated': {
        const stripeSub = event.data.object;
        const customerId = stripeSub.customer as string;
        const [sub] = await ctx.db.select().from(subscriptions).where(eq(subscriptions.stripe_customer_id, customerId)).limit(1);
        if (sub) {
          const status = stripeSub.status === 'active' ? 'active' : stripeSub.status === 'past_due' ? 'past_due' : stripeSub.status === 'canceled' ? 'canceled' : 'inactive';
          const plan = 'pro';
          // Newer Stripe API versions moved current_period_end off the top-level
          // subscription onto each item, so the SDK types no longer declare it —
          // the pinned API version still sends the old spot, but read both so an
          // API upgrade shifts the source instead of silently writing null.
          // The portal schedules a cancellation as cancel_at; older API versions
          // and the dashboard set cancel_at_period_end instead. Read both so
          // "ends on" is right whichever way it was cancelled, and clear it
          // when the customer resumes.
          const cancelAt =
            typeof stripeSub.cancel_at === 'number'
              ? stripeSub.cancel_at
              : stripeSub.cancel_at_period_end
                ? (typeof stripeSub.items?.data?.[0]?.current_period_end === 'number' ? stripeSub.items.data[0].current_period_end : undefined)
                : undefined;
          const periodEnd =
            'current_period_end' in stripeSub && typeof stripeSub.current_period_end === 'number'
              ? stripeSub.current_period_end
              : typeof stripeSub.items?.data?.[0]?.current_period_end === 'number'
                ? stripeSub.items.data[0].current_period_end
                : undefined;
          await ctx.db.update(subscriptions).set({ plan: status === 'active' ? plan : 'free', status, current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null, cancel_at: cancelAt ? new Date(cancelAt * 1000).toISOString() : null, updated_at: new Date().toISOString() }).where(eq(subscriptions.stripe_customer_id, customerId));
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const deletedSub = event.data.object;
        await ctx.db.update(subscriptions).set({ plan: 'free', status: 'canceled', stripe_subscription_id: null, current_period_end: null, cancel_at: null, updated_at: new Date().toISOString() }).where(eq(subscriptions.stripe_customer_id, deletedSub.customer as string));
        break;
      }
    }
    return json({ received: true });
  });
