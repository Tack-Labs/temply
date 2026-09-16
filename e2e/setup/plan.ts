import type { APIRequestContext } from '@playwright/test';
import { stackEnv } from '../env';
import type { fakes as Fakes } from '../fakes/client';

/**
 * Puts the signed-in user's workspace on Pro the way a paying customer gets
 * there: the app opens a checkout (the fake Stripe answers it and records
 * what the app sent), then Stripe's `checkout.session.completed` arrives,
 * signed with the webhook secret, and the app upgrades the row. Only the
 * webhook is ours to forge — everything else is the real billing path, so a
 * broken checkout route, proxy header or signature check fails here, once,
 * instead of as a 402 inside some unrelated spec.
 */
export async function upgradeToPro(request: APIRequestContext, fakes: typeof Fakes): Promise<void> {
  const checkout = await request.post('/api/v1/billing/checkout', { data: { plan: 'pro' } });
  if (!checkout.ok()) throw new Error(`checkout: ${checkout.status()} ${await checkout.text()}`);

  // Stripe receives form-encoded bodies, so the fake records the session's
  // metadata flat as `metadata[orgId]`; it is the one place the org id the
  // app is scoped to can be read from outside.
  const session = (await fakes.requests('stripe')).find((r) => r.method === 'POST' && r.path === '/v1/checkout/sessions');
  if (!session) throw new Error('the fake Stripe recorded no checkout session');
  const sent = session.body as Record<string, string>;
  const metadata = { orgId: sent['metadata[orgId]'], userId: sent['metadata[userId]'], plan: sent['metadata[plan]'] };
  if (!metadata.orgId || metadata.plan !== 'pro') throw new Error(`checkout metadata missing: ${JSON.stringify(metadata)}`);

  // The secret the API was started with — stackEnv() is the one place it is
  // decided, and it is not in this process's own environment.
  const secret = stackEnv().STRIPE_WEBHOOK_SECRET;
  const event = {
    id: 'evt_e2e_upgrade',
    object: 'event',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_e2e_upgrade', object: 'checkout.session', customer: sent.customer, subscription: 'sub_e2e_pro', metadata } },
  };
  const { body, signature } = fakes.signStripeEvent(event, secret);
  const webhook = await request.post('/api/webhooks/stripe', { data: body, headers: { 'content-type': 'application/json', 'stripe-signature': signature } });
  if (!webhook.ok()) throw new Error(`webhook: ${webhook.status()} ${await webhook.text()}`);
}
