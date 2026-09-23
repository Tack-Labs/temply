import { Elysia } from 'elysia';
import { and, eq, isNull, lte, or } from 'drizzle-orm';
import { subscriptions } from '@temply/shared/schema';
import { notPaying } from '../../lib/billing';
import { planForVariant, verifyCheckoutToken, verifySignature } from '../../lib/lemonsqueezy';
import { json } from '../../lib/errors';
import { dbPlugin } from '../../plugins/db';

type SubscriptionEvent = {
  meta?: { event_name?: string; custom_data?: Record<string, unknown> | null };
  data?: {
    type?: string;
    id?: string;
    attributes?: {
      status?: string;
      variant_id?: number;
      renews_at?: string | null;
      ends_at?: string | null;
      updated_at?: string;
    };
  };
};

/** Statuses under which the workspace keeps what it paid for. `cancelled`
 *  is the grace period: renewal has stopped, but the period already paid
 *  for runs to `ends_at`. */
const PAID = new Set(['on_trial', 'active', 'cancelled']);

function isoOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Every subscription event carries the whole subscription as it stands, so
 * each one is handled the same way: find the workspace, write the state.
 * Register the endpoint for subscription_created, subscription_updated and
 * subscription_expired; payment events carry an invoice rather than the
 * subscription and are acknowledged without being read.
 */
export const lemonSqueezyWebhookRoutes = new Elysia()
  .use(dbPlugin)
  .post('/api/webhooks/lemonsqueezy', async (ctx) => {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret) return json({ status: 503, message: 'Lemon Squeezy webhook secret is not configured' }, 503);
    const rawBody = await ctx.request.text();
    if (!verifySignature(rawBody, ctx.request.headers.get('x-signature'), secret)) {
      // A forged request and a stale secret or a stripped header read the
      // same to the caller; the log is where they are told apart.
      console.error(`Lemon Squeezy webhook rejected: ${ctx.request.headers.get('x-signature') ? 'signature does not match' : 'no X-Signature header'}`);
      return json({ status: 400, message: 'Invalid signature' }, 400);
    }
    let event: SubscriptionEvent;
    try {
      event = JSON.parse(rawBody) as SubscriptionEvent;
    } catch {
      return json({ status: 400, message: 'Invalid body' }, 400);
    }

    const { data, meta } = event;
    const attrs = data?.attributes;
    if (data?.type !== 'subscriptions' || !data.id || !attrs?.status) return json({ received: true });

    const at = isoOrNull(attrs.updated_at);
    if (!at) {
      console.error(`Lemon Squeezy webhook ignored: subscription ${data.id} has no updated_at`);
      return json({ received: true });
    }
    const paid = PAID.has(attrs.status);
    // Only a paid state needs a plan. One that has stopped paying takes the
    // workspace to Free whatever it was sold as — a variant since unmapped
    // must not keep a lapsed plan running. A paid state on another product
    // in the store is acknowledged and left alone; retrying changes nothing.
    const plan = planForVariant(attrs.variant_id);
    if (paid && !plan) {
      console.error(`Lemon Squeezy webhook ignored: subscription ${data.id} is for variant ${attrs.variant_id}, which no plan is sold as`);
      return json({ received: true });
    }

    const heldBy = eq(subscriptions.lemonsqueezy_subscription_id, data.id);
    const [held] = await ctx.db.select({ id: subscriptions.id }).from(subscriptions).where(heldBy).limit(1);
    // A subscription the workspace does not hold yet is bound through the org
    // id its checkout signed.
    const orgId = meta?.custom_data?.org_id;
    const scope = held
      ? eq(subscriptions.id, held.id)
      : typeof orgId === 'string' && verifyCheckoutToken(orgId, meta?.custom_data?.token, secret)
        ? eq(subscriptions.org_id, orgId)
        : null;
    if (!scope) {
      console.error(`Lemon Squeezy webhook ignored: subscription ${data.id} belongs to no workspace`);
      return json({ received: true });
    }

    // Both rules sit in the write itself, so events racing through different
    // replicas settle the same way they would one at a time. A subscription
    // takes the row from another only once that one has stopped paying, and
    // only by paying itself unless the row holds nothing: a second one must
    // not take the plan from the first, nor the first win it back at its
    // next renewal. And retries deliver out of order, so the newer event wins.
    const claim = paid ? notPaying() : and(notPaying(), isNull(subscriptions.lemonsqueezy_subscription_id));
    const applied = await ctx.db
      .update(subscriptions)
      .set({
        plan: paid && plan ? plan : 'free',
        status: paid ? 'active' : attrs.status,
        lemonsqueezy_subscription_id: attrs.status === 'expired' ? null : data.id,
        lemonsqueezy_updated_at: at,
        current_period_end: paid ? isoOrNull(attrs.status === 'cancelled' ? attrs.ends_at : attrs.renews_at) : null,
        cancel_at: attrs.status === 'cancelled' ? isoOrNull(attrs.ends_at) : null,
        updated_at: new Date().toISOString(),
      })
      .where(
        and(
          scope,
          or(heldBy, claim),
          or(isNull(subscriptions.lemonsqueezy_updated_at), lte(subscriptions.lemonsqueezy_updated_at, at)),
        ),
      )
      .returning({ id: subscriptions.id });

    // An out-of-date retry, or a spare subscription winding down, is expected
    // and says nothing. A second one paying means someone is charged twice.
    if (!applied.length && !held && paid) {
      const [current] = await ctx.db.select().from(subscriptions).where(scope).limit(1);
      if (!current) console.error(`Lemon Squeezy webhook ignored: subscription ${data.id} belongs to no workspace`);
      else if (current.lemonsqueezy_subscription_id && current.lemonsqueezy_subscription_id !== data.id) {
        console.error(`Lemon Squeezy webhook ignored: workspace ${orgId} already pays through subscription ${current.lemonsqueezy_subscription_id}, so ${data.id} is a second one; refund and cancel it in the dashboard`);
      }
    }
    return json({ received: true });
  });
