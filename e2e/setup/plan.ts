import type { APIRequestContext } from '@playwright/test';
import { stackEnv } from '../env';
import type { fakes as Fakes } from '../fakes/client';

/**
 * A workspace's plan moved the way a paying customer moves it: the app
 * opens a checkout (the fake Stripe answers it and records what the app
 * sent), then Stripe's webhook arrives, signed with the webhook secret, and
 * the app updates the row. Only the webhook is ours to forge — everything
 * else is the real billing path, so a broken checkout route, proxy header
 * or signature check fails here, once, instead of as a 402 inside some
 * unrelated spec.
 */

type FakesClient = Pick<typeof Fakes, 'requests' | 'signStripeEvent'>;
export type PaidPlan = 'pro' | 'enterprise';
export type CheckoutSession = { orgId: string; userId: string; customer: string };

/**
 * The checkout session the app most recently opened with the fake Stripe.
 * Stripe receives form-encoded bodies, so the fake records the metadata flat
 * as `metadata[orgId]`; it is the one place the org id the app is scoped to
 * can be read from outside.
 */
export async function recordedCheckout(fakes: FakesClient): Promise<CheckoutSession> {
  const sessions = (await fakes.requests('stripe')).filter((r) => r.method === 'POST' && r.path === '/v1/checkout/sessions');
  const session = sessions.at(-1);
  if (!session) throw new Error('the fake Stripe recorded no checkout session');
  const sent = session.body as Record<string, string>;
  const out = { orgId: sent['metadata[orgId]'], userId: sent['metadata[userId]'], customer: sent.customer };
  if (!out.orgId || !out.customer) throw new Error(`checkout metadata missing: ${JSON.stringify(out)}`);
  return out;
}

async function postWebhook(request: APIRequestContext, fakes: FakesClient, event: object): Promise<void> {
  // The secret the API was started with — stackEnv() is the one place it is
  // decided, and it is not in this process's own environment.
  const { body, signature } = fakes.signStripeEvent(event, stackEnv().STRIPE_WEBHOOK_SECRET);
  const res = await request.post('/api/webhooks/stripe', { data: body, headers: { 'content-type': 'application/json', 'stripe-signature': signature } });
  if (!res.ok()) throw new Error(`webhook: ${res.status()} ${await res.text()}`);
}

/**
 * Stripe's `checkout.session.completed` for a session the app opened, signed
 * with the webhook secret. Only this event is forged — the checkout itself
 * went through the app — and the app accepts whatever plan the metadata
 * names, which is how the run reaches Enterprise: the checkout route only
 * sells Pro.
 */
export async function completeCheckout(request: APIRequestContext, fakes: FakesClient, session: CheckoutSession, plan: PaidPlan): Promise<void> {
  const stamp = Date.now();
  await postWebhook(request, fakes, {
    id: `evt_e2e_${plan}_${stamp}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `cs_e2e_${stamp}`,
        object: 'checkout.session',
        customer: session.customer,
        subscription: `sub_e2e_${plan}_${stamp}`,
        metadata: { orgId: session.orgId, userId: session.userId, plan },
      },
    },
  });
}

/** Opens a checkout through the app, then completes it on `plan`. */
export async function upgradeTo(request: APIRequestContext, fakes: FakesClient, plan: PaidPlan): Promise<CheckoutSession> {
  const checkout = await request.post('/api/v1/billing/checkout', { data: { plan: 'pro' } });
  if (!checkout.ok()) throw new Error(`checkout: ${checkout.status()} ${await checkout.text()}`);
  const session = await recordedCheckout(fakes);
  await completeCheckout(request, fakes, session, plan);
  return session;
}

/** Stripe's `customer.subscription.deleted` for a customer: the app puts the workspace back on Free. */
export async function cancelSubscription(request: APIRequestContext, fakes: FakesClient, customer: string): Promise<void> {
  const stamp = Date.now();
  await postWebhook(request, fakes, {
    id: `evt_e2e_cancel_${stamp}`,
    object: 'event',
    type: 'customer.subscription.deleted',
    data: { object: { id: `sub_e2e_cancelled_${stamp}`, object: 'subscription', customer, status: 'canceled' } },
  });
}
