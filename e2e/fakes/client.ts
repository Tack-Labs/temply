import { createHmac } from 'node:crypto';
import { FAKES_URL, STRIPE_URL } from '../env';
// Types only: importing either module for real would start the fakes' servers
// inside the test process.
import type { Recorded, Service } from './index';
import type { StripeSubscription } from './stripe';

export const fakes = {
  /** What a fake has received, or only what it received at or after `since`
   *  (a `Date.now()` from the same machine, since the fakes stamp with theirs). */
  async requests(service: Service, since = 0): Promise<Recorded[]> {
    const all = (await (await fetch(`${FAKES_URL}/__requests?service=${service}`)).json()) as Recorded[];
    return all.filter((r) => r.receivedAt >= since);
  },
  async reset(): Promise<void> {
    await fetch(`${FAKES_URL}/__reset`, { method: 'POST' });
  },
  /** A webhook body signed the way Stripe signs one —
   *  `t=<ts>,v1=hex(HMAC-SHA256(secret, "<ts>.<body>"))` — so the app's
   *  verification runs for real. `secret` is the STRIPE_WEBHOOK_SECRET the
   *  stack started with, and the body must be sent exactly as returned. */
  signStripeEvent(event: object, secret: string): { body: string; signature: string } {
    const body = JSON.stringify(event);
    const ts = Math.floor(Date.now() / 1000);
    const v1 = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
    return { body, signature: `t=${ts},v1=${v1}` };
  },
  /** A subscription as the Stripe fake holds it, or null if it holds none
   *  by that id. Read without being recorded. */
  async stripeSubscription(id: string): Promise<StripeSubscription | null> {
    const res = await fetch(`${STRIPE_URL}/__subscriptions/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`the Stripe fake could not read ${id}: ${res.status} ${await res.text()}`);
    return (await res.json()) as StripeSubscription;
  },
  /** Makes or replaces a subscription on Stripe's side, as checkout or the
   *  portal would. The app hears nothing until a webhook says so. */
  async putStripeSubscription(sub: StripeSubscription): Promise<void> {
    const res = await fetch(`${STRIPE_URL}/__subscriptions/${encodeURIComponent(sub.id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sub),
    });
    if (!res.ok) throw new Error(`the Stripe fake refused ${sub.id}: ${res.status} ${await res.text()}`);
  },
};
