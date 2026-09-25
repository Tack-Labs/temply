import { Elysia } from 'elysia';
import type Stripe from 'stripe';
import { json } from '../../lib/errors';
import { applySubscription, getStripe } from '../../lib/stripe';
import { dbPlugin } from '../../plugins/db';

const SUBSCRIPTION_EVENTS = new Set(['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted']);

/**
 * Stripe says when a subscription starts, changes or ends. Register the
 * endpoint in the Stripe dashboard for the three customer.subscription
 * events.
 *
 * The event is only the news that something changed. What is written is the
 * subscription as Stripe has it when it is read here, so events that arrive
 * out of order, twice, or not at all still leave the row as Stripe has it.
 */
export const stripeWebhookRoutes = new Elysia()
  .use(dbPlugin)
  .post('/api/webhooks/stripe', async (ctx) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !process.env.STRIPE_SECRET_KEY) return json({ status: 503, message: 'Stripe is not configured' }, 503);
    const signature = ctx.request.headers.get('stripe-signature');
    if (!signature) return json({ status: 400, message: 'Missing signature' }, 400);

    const stripe = getStripe();
    let event: Stripe.Event;
    try {
      // The async variant, and only the async variant: under Bun the SDK's
      // crypto provider is SubtleCrypto, which cannot sign synchronously, so
      // constructEvent throws before it looks at the signature and every
      // webhook reads as forged.
      event = await stripe.webhooks.constructEventAsync(await ctx.request.text(), signature, secret);
    } catch (error) {
      // Say why: a forged request and a stale secret read the same to the
      // caller but must not to whoever reads the log.
      console.error('Stripe webhook rejected:', error instanceof Error ? error.message : error);
      return json({ status: 400, message: 'Invalid signature' }, 400);
    }

    if (SUBSCRIPTION_EVENTS.has(event.type)) {
      const { id } = event.data.object as Stripe.Subscription;
      const syncedAt = new Date().toISOString();
      await applySubscription(ctx.db, await stripe.subscriptions.retrieve(id), syncedAt);
    }
    return json({ received: true });
  });
