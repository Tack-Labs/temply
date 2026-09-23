import type { APIRequestContext } from '@playwright/test';
import { stackEnv } from '../env';
import type { fakes as Fakes } from '../fakes/client';

/**
 * A workspace's plan moved the way a paying customer moves it: the app
 * opens a checkout (the fake Lemon Squeezy answers it and records what the
 * app sent), then Lemon Squeezy's webhook arrives, signed with the webhook
 * secret, and the app updates the row. Only the webhook is ours to forge —
 * everything else is the real billing path, so a broken checkout route,
 * proxy header or signature check fails here, once, instead of as a 402
 * inside some unrelated spec.
 */

type FakesClient = Pick<typeof Fakes, 'requests' | 'signLemonSqueezyEvent'>;
export type PaidPlan = 'pro' | 'enterprise';
/** The custom data the app signed into the checkout, which Lemon Squeezy
 *  hands back on every event of the subscription it starts. */
export type CheckoutData = { orgId: string; userId: string; token: string };

/** The variant each plan is sold as, as stackEnv() configured the API. */
function variantOf(plan: PaidPlan): number {
  const env = stackEnv();
  return Number(plan === 'pro' ? env.LEMONSQUEEZY_VARIANT_PRO : env.LEMONSQUEEZY_VARIANT_ENTERPRISE);
}

/** The checkout the app most recently opened with the fake Lemon Squeezy —
 *  the one place the org id the app is scoped to, and the token binding it,
 *  can be read from outside. */
export async function recordedCheckout(fakes: FakesClient): Promise<CheckoutData> {
  const checkouts = (await fakes.requests('lemonsqueezy')).filter((r) => r.method === 'POST' && r.path === '/v1/checkouts');
  const checkout = checkouts.at(-1);
  if (!checkout) throw new Error('the fake Lemon Squeezy recorded no checkout');
  const sent = checkout.body as { data?: { attributes?: { checkout_data?: { custom?: Record<string, string> } } } };
  const custom = sent.data?.attributes?.checkout_data?.custom ?? {};
  const out = { orgId: custom.org_id, userId: custom.user_id, token: custom.token };
  if (!out.orgId || !out.userId || !out.token) throw new Error(`checkout custom data missing: ${JSON.stringify(out)}`);
  return out;
}

async function postWebhook(request: APIRequestContext, fakes: FakesClient, event: object): Promise<void> {
  // The secret the API was started with — stackEnv() is the one place it is
  // decided, and it is not in this process's own environment.
  const { body, signature } = fakes.signLemonSqueezyEvent(event, stackEnv().LEMONSQUEEZY_WEBHOOK_SECRET);
  const res = await request.post('/api/webhooks/lemonsqueezy', { data: body, headers: { 'content-type': 'application/json', 'x-signature': signature } });
  if (!res.ok()) throw new Error(`webhook: ${res.status()} ${await res.text()}`);
}

/**
 * A subscription event as Lemon Squeezy sends it. `updated_at` is the time
 * of sending: the app drops an event older than the last one it applied, so
 * events a test sends in order must be stamped in order.
 */
function subscriptionEvent(
  name: string,
  subscriptionId: string,
  session: CheckoutData,
  attributes: { status: string; variant_id: number; renews_at?: string | null; ends_at?: string | null },
) {
  return {
    meta: { event_name: name, custom_data: { org_id: session.orgId, user_id: session.userId, token: session.token } },
    data: {
      type: 'subscriptions',
      id: subscriptionId,
      attributes: { renews_at: null, ends_at: null, ...attributes, updated_at: new Date().toISOString() },
    },
  };
}

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

/**
 * `subscription_created` for a checkout the app opened. Only this event is
 * forged — the checkout itself went through the app — and the app grants
 * whichever plan the variant is sold as, which is how the run reaches
 * Enterprise: the checkout route only sells Pro. Returns the subscription id
 * later events name.
 */
export async function completeCheckout(request: APIRequestContext, fakes: FakesClient, session: CheckoutData, plan: PaidPlan): Promise<string> {
  const subscriptionId = `sub_e2e_${plan}_${Date.now()}`;
  await postWebhook(request, fakes, subscriptionEvent('subscription_created', subscriptionId, session, {
    status: 'active',
    variant_id: variantOf(plan),
    renews_at: inDays(30),
  }));
  return subscriptionId;
}

/** Opens a checkout through the app, then completes it on `plan`. */
export async function upgradeTo(request: APIRequestContext, fakes: FakesClient, plan: PaidPlan): Promise<CheckoutData> {
  const checkout = await request.post('/api/v1/billing/checkout', { data: { plan: 'pro' } });
  if (!checkout.ok()) throw new Error(`checkout: ${checkout.status()} ${await checkout.text()}`);
  const session = await recordedCheckout(fakes);
  await completeCheckout(request, fakes, session, plan);
  return session;
}

/** `subscription_updated` for a cancellation made in the portal: renewal
 *  stops, and the plan runs to the end of the period already paid for. */
export async function cancelSubscription(request: APIRequestContext, fakes: FakesClient, session: CheckoutData, subscriptionId: string, plan: PaidPlan): Promise<void> {
  await postWebhook(request, fakes, subscriptionEvent('subscription_updated', subscriptionId, session, {
    status: 'cancelled',
    variant_id: variantOf(plan),
    ends_at: inDays(30),
  }));
}

/** `subscription_expired`: the period ran out, and the app puts the
 *  workspace back on Free. */
export async function expireSubscription(request: APIRequestContext, fakes: FakesClient, session: CheckoutData, subscriptionId: string, plan: PaidPlan): Promise<void> {
  await postWebhook(request, fakes, subscriptionEvent('subscription_expired', subscriptionId, session, {
    status: 'expired',
    variant_id: variantOf(plan),
    ends_at: new Date().toISOString(),
  }));
}
