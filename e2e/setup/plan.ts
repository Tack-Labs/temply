import type { APIRequestContext } from '@playwright/test';
import { STRIPE } from '../env';
import type { fakes as Fakes } from '../fakes/client';
import type { StripeForm, StripeSubscription, StripeSubscriptionItem } from '../fakes/stripe';

/**
 * A workspace's plan moved the way a paying customer moves it: the app
 * opens a checkout with the fake Stripe, which records what the app sent;
 * what Stripe then does on its side — make the subscription, change it,
 * end it — is written into the fake here; and Stripe's webhook arrives,
 * signed with the webhook secret, through the Next proxy. The app reads the
 * subscription back from the fake and updates the row, as it would from
 * Stripe. Only Stripe's side is ours to forge, so a broken checkout route,
 * proxy header or signature check fails here, once, instead of as a 402
 * inside some unrelated spec.
 */

type FakesClient = Pick<typeof Fakes, 'requests' | 'signStripeEvent' | 'stripeSubscription' | 'putStripeSubscription'>;
/** Team is what checkout sells. Enterprise is arranged by hand, and Stripe
 *  says so with `plan: enterprise` in the subscription's metadata. */
export type PaidPlan = 'team' | 'enterprise';

/** A checkout the app opened, read back from what it sent Stripe. */
export type CheckoutSession = {
  orgId: string;
  customer: string;
  seats: number;
  templatePacks: number;
  /** When the first period ends, in seconds: the 1st of next month. */
  anchor: number;
  lineItems: { price: string; quantity?: number }[];
};

/** A change made on Stripe's side, as the portal or the dashboard would. */
export type SubscriptionPatch = {
  seats?: number;
  templatePacks?: number;
  status?: string;
  /** A cancellation at a set time, the way the portal schedules one. */
  cancelAt?: number | null;
  /** A cancellation at the end of the period. Stripe also fills in
   *  `cancel_at` and `canceled_at` when this is set, and clears them when
   *  it is unset; so does this. */
  cancelAtPeriodEnd?: boolean;
  metadata?: Record<string, string>;
};

const nowSeconds = () => Math.floor(Date.now() / 1000);
const suffix = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

/**
 * The checkout the app most recently opened with the fake Stripe, or the
 * most recent one for `orgId`. With the `fakes` fixture that is scoped to
 * the test calling it; with the bare client, to the whole run.
 */
export async function recordedCheckout(fakes: FakesClient, orgId?: string): Promise<CheckoutSession> {
  const forms = (await fakes.requests('stripe'))
    .filter((r) => r.method === 'POST' && r.path === '/v1/checkout/sessions')
    .map((r) => r.body as StripeForm)
    .filter((form) => !orgId || form.client_reference_id === orgId);
  const form = forms.at(-1);
  if (!form) throw new Error(orgId ? `the fake Stripe recorded no checkout for ${orgId}` : 'the fake Stripe recorded no checkout');

  const lineItems: CheckoutSession['lineItems'] = [];
  for (let i = 0; form[`line_items[${i}][price]`]; i++) {
    const quantity = form[`line_items[${i}][quantity]`];
    lineItems.push({ price: form[`line_items[${i}][price]`], ...(quantity === undefined ? {} : { quantity: Number(quantity) }) });
  }
  const quantityOf = (price: string) => lineItems.find((item) => item.price === price)?.quantity;
  const session = {
    orgId: form['subscription_data[metadata][orgId]'],
    customer: form.customer,
    seats: quantityOf(STRIPE.prices.seat) ?? 0,
    templatePacks: quantityOf(STRIPE.prices.templatePack) ?? 0,
    anchor: Number(form['subscription_data[billing_cycle_anchor]']),
    lineItems,
  };
  if (!session.orgId || !session.customer || !session.anchor || !session.seats) {
    throw new Error(`the checkout the app opened is missing what a subscription needs: ${JSON.stringify(form)}`);
  }
  return session;
}

/**
 * Posts a subscription event as Stripe would, and fails unless the app
 * takes it. The event carries the subscription only as news: the app reads
 * it back from the fake, so the fake must hold it first.
 */
async function deliver(request: APIRequestContext, fakes: FakesClient, type: string, sub: StripeSubscription): Promise<void> {
  const event = { id: `evt_e2e_${suffix()}`, object: 'event', type, created: nowSeconds(), livemode: false, data: { object: sub } };
  // The secret the API was started with; stackEnv() hands it the same one.
  const { body, signature } = fakes.signStripeEvent(event, STRIPE.webhookSecret);
  const res = await request.post('/api/webhooks/stripe', { data: body, headers: { 'content-type': 'application/json', 'stripe-signature': signature } });
  if (res.status() !== 200) throw new Error(`${type}: ${res.status()} ${await res.text()}`);
}

/**
 * Pays for the checkout the app last opened (see `recordedCheckout`): the
 * fake Stripe is given the subscription that checkout makes — every line
 * item the app asked for, its first period ending on the anchor — and
 * `customer.subscription.created` is delivered. Enterprise is reached this
 * way too, by the metadata Stripe would carry. Returns the subscription's id
 * for the helpers below.
 */
export async function completeCheckout(
  request: APIRequestContext,
  fakes: FakesClient,
  opts: { orgId?: string; plan?: PaidPlan; status?: string } = {},
): Promise<string> {
  const session = await recordedCheckout(fakes, opts.orgId);
  const id = `sub_e2e_${suffix()}`;
  const sub: StripeSubscription = {
    id,
    object: 'subscription',
    customer: session.customer,
    status: opts.status ?? 'active',
    metadata: { orgId: session.orgId, ...(opts.plan === 'enterprise' ? { plan: 'enterprise' } : {}) },
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    ended_at: null,
    items: {
      object: 'list',
      data: session.lineItems.map((item, i): StripeSubscriptionItem => ({
        id: `si_${id}_${i}`,
        object: 'subscription_item',
        price: { id: item.price, object: 'price' },
        ...(item.quantity === undefined ? {} : { quantity: item.quantity }),
        current_period_end: session.anchor,
      })),
    },
  };
  await fakes.putStripeSubscription(sub);
  await deliver(request, fakes, 'customer.subscription.created', sub);
  return id;
}

/**
 * Subscribes the request's workspace through the app's own checkout route,
 * then pays for it. The route sells Team; `plan: 'enterprise'` is the
 * metadata Stripe would carry for a plan arranged by hand.
 */
export async function subscribe(
  request: APIRequestContext,
  fakes: FakesClient,
  opts: { plan?: PaidPlan; templatePacks?: number } = {},
): Promise<{ session: CheckoutSession; subscriptionId: string }> {
  const checkout = await request.post('/api/v1/billing/checkout', { data: opts.templatePacks ? { templatePacks: opts.templatePacks } : {} });
  if (!checkout.ok()) throw new Error(`checkout: ${checkout.status()} ${await checkout.text()}`);
  const session = await recordedCheckout(fakes);
  const subscriptionId = await completeCheckout(request, fakes, { orgId: session.orgId, plan: opts.plan });
  return { session, subscriptionId };
}

/**
 * Changes a subscription on Stripe's side — seats, template packs, status, a
 * cancellation — and delivers `customer.subscription.updated`. Returns the
 * subscription as the fake now holds it.
 */
export async function updateSubscription(request: APIRequestContext, fakes: FakesClient, id: string, patch: SubscriptionPatch): Promise<StripeSubscription> {
  const sub = await fakes.stripeSubscription(id);
  if (!sub) throw new Error(`the fake Stripe holds no subscription ${id}`);
  const items = sub.items.data;
  const periodEnd = items[0]?.current_period_end ?? nowSeconds() + 30 * 86_400;
  const setQuantity = (price: string, quantity: number) => {
    const item = items.find((i) => i.price.id === price);
    if (item && quantity > 0) item.quantity = quantity;
    else if (item) items.splice(items.indexOf(item), 1);
    else if (quantity > 0) items.push({ id: `si_e2e_${suffix()}`, object: 'subscription_item', price: { id: price, object: 'price' }, quantity, current_period_end: periodEnd });
  };

  if (patch.seats !== undefined) setQuantity(STRIPE.prices.seat, patch.seats);
  if (patch.templatePacks !== undefined) setQuantity(STRIPE.prices.templatePack, patch.templatePacks);
  if (patch.status !== undefined) sub.status = patch.status;
  if (patch.metadata) sub.metadata = { ...sub.metadata, ...patch.metadata };
  if (patch.cancelAtPeriodEnd !== undefined) {
    sub.cancel_at_period_end = patch.cancelAtPeriodEnd;
    sub.cancel_at = patch.cancelAtPeriodEnd ? periodEnd : null;
    sub.canceled_at = patch.cancelAtPeriodEnd ? nowSeconds() : null;
  }
  if (patch.cancelAt !== undefined) {
    sub.cancel_at = patch.cancelAt;
    sub.canceled_at = patch.cancelAt === null ? null : nowSeconds();
  }

  await fakes.putStripeSubscription(sub);
  await deliver(request, fakes, 'customer.subscription.updated', sub);
  return sub;
}

/** A cancellation made in the portal: renewal stops, and the plan runs to
 *  the end of the period already paid for. */
export async function cancelSubscription(request: APIRequestContext, fakes: FakesClient, id: string): Promise<StripeSubscription> {
  return updateSubscription(request, fakes, id, { cancelAtPeriodEnd: true });
}

/**
 * The subscription ends — its cancellation came due, or Stripe gave up on
 * the card — and `customer.subscription.deleted` is delivered. Paying ended
 * the trial, so the workspace is left lapsed: read-only, with writes and
 * live keys refused with 402.
 */
export async function endSubscription(request: APIRequestContext, fakes: FakesClient, id: string): Promise<StripeSubscription> {
  const sub = await fakes.stripeSubscription(id);
  if (!sub) throw new Error(`the fake Stripe holds no subscription ${id}`);
  const now = nowSeconds();
  Object.assign(sub, { status: 'canceled', canceled_at: sub.canceled_at ?? now, ended_at: now });
  await fakes.putStripeSubscription(sub);
  await deliver(request, fakes, 'customer.subscription.deleted', sub);
  return sub;
}
