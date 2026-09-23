import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Plan } from '@temply/shared/plans';

export type PaidPlan = Exclude<Plan, 'free'>;
const PAID_PLANS: PaidPlan[] = ['pro', 'enterprise'];

/** LEMONSQUEEZY_API_BASE, set only by the e2e stack, points the client at a
 *  fake on localhost; production never sets it and reaches Lemon Squeezy.
 *  Read per call so a test can flip it. */
export function apiBase(): string {
  return (process.env.LEMONSQUEEZY_API_BASE || 'https://api.lemonsqueezy.com').replace(/\/$/, '');
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const key = process.env.LEMONSQUEEZY_API_KEY;
  if (!key) throw new Error('LEMONSQUEEZY_API_KEY is not set');
  const method = init.method ?? 'GET';
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${key}`,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) {
    // The reply is JSON:API diagnostics meant for us, and the message ends up
    // in an admin's toast; the detail rides as the cause, which the error
    // log and Sentry both keep.
    const detail = `Lemon Squeezy ${method} ${path} failed: ${res.status} ${await res.text()}`;
    throw new Error('Lemon Squeezy could not complete the request. Try again in a minute.', { cause: new Error(detail) });
  }
  return (await res.json()) as T;
}

/** The variant a plan is sold as. Each paid plan names its own, so the
 *  webhook can tell which plan was bought from the variant alone. */
export function variantFor(plan: PaidPlan): string | undefined {
  return process.env[`LEMONSQUEEZY_VARIANT_${plan.toUpperCase()}`] || undefined;
}

/** The plan a variant grants, or null for one we do not sell — another
 *  product in the same store must never be read as Pro. */
export function planForVariant(variantId: string | number | undefined): PaidPlan | null {
  if (variantId === undefined) return null;
  return PAID_PLANS.find((plan) => variantFor(plan) === String(variantId)) ?? null;
}

/** Checkout needs the key and the store to open at all, and the webhook
 *  secret to sign the workspace into it — without that the webhook could
 *  never grant what was paid for. */
export function checkoutConfigured(): boolean {
  return Boolean(process.env.LEMONSQUEEZY_API_KEY && process.env.LEMONSQUEEZY_STORE_ID && process.env.LEMONSQUEEZY_WEBHOOK_SECRET);
}

function sign(secret: string, value: string): Buffer {
  return createHmac('sha256', secret).update(value).digest();
}

function matches(expected: Buffer, givenHex: unknown): boolean {
  if (typeof givenHex !== 'string') return false;
  const given = Buffer.from(givenHex, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Anyone can open a store's buy link with `checkout[custom][org_id]=…` in
 * the query string, and Lemon Squeezy passes it through to the webhook as if
 * we had set it. So the org id is carried with a signature only this server
 * can make, keyed by the webhook secret — rotating that secret orphans
 * checkouts opened before the rotation, which then need binding by hand.
 */
export function checkoutToken(orgId: string): string {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) throw new Error('LEMONSQUEEZY_WEBHOOK_SECRET is not set');
  return sign(secret, `checkout:${orgId}`).toString('hex');
}

export function verifyCheckoutToken(orgId: string, token: unknown, secret: string): boolean {
  return matches(sign(secret, `checkout:${orgId}`), token);
}

/** X-Signature is a hex HMAC-SHA256 of the raw body. It carries no
 *  timestamp, so a captured event can be replayed; the webhook's ordering
 *  check is what makes a replay change nothing. */
export function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  return matches(sign(secret, rawBody), signature);
}

/** A hosted checkout for one variant, returned as the URL to send the
 *  browser to. The customer comes back through the confirmation's button,
 *  which Lemon Squeezy points at `redirectUrl`; an abandoned checkout has no
 *  way back but the browser's. */
export async function createCheckout(opts: {
  variantId: string;
  custom: Record<string, string>;
  redirectUrl: string;
}): Promise<string> {
  const res = await call<{ data: { attributes: { url: string } } }>('/v1/checkouts', {
    method: 'POST',
    body: {
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: { custom: opts.custom },
          product_options: { redirect_url: opts.redirectUrl, enabled_variants: [Number(opts.variantId)] },
        },
        relationships: {
          store: { data: { type: 'stores', id: process.env.LEMONSQUEEZY_STORE_ID } },
          variant: { data: { type: 'variants', id: opts.variantId } },
        },
      },
    },
  });
  return res.data.attributes.url;
}

/** The customer portal for a subscription. The URL is signed and lasts a
 *  day, so it is fetched when asked for rather than stored. */
export async function portalUrl(subscriptionId: string): Promise<string> {
  const res = await call<{ data: { attributes: { urls?: { customer_portal?: string | null } } } }>(
    `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
  );
  const url = res.data.attributes.urls?.customer_portal;
  if (!url) throw new Error(`Lemon Squeezy sent no portal URL for subscription ${subscriptionId}`);
  return url;
}

/** Stops renewal. Lemon Squeezy keeps the subscription `cancelled` until the
 *  period that was paid for runs out, then expires it; nothing more is
 *  charged either way. */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await call(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: 'DELETE' });
}
