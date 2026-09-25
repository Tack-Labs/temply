import Stripe from 'stripe';
import { and, eq, isNull, lte, notInArray, or, sql } from 'drizzle-orm';
import { subscriptions } from '@temply/shared/schema';
import type { Db } from '../plugins/db';

/**
 * A client per call, reading the key then, so a test or the e2e stack can
 * change it between requests. STRIPE_API_BASE is set only by the e2e stack,
 * to point the client at a fake on localhost.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  const base = process.env.STRIPE_API_BASE;
  if (!base) return new Stripe(key, {});
  const url = new URL(base);
  return new Stripe(key, {
    host: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
    protocol: url.protocol.replace(':', '') as 'http' | 'https',
  });
}

export interface StripePrices {
  /** Licensed, per member, $5. */
  seat: string;
  /** Metered through the billing meter, $1 per thousand calls. */
  apiOverage: string;
  /** Licensed, per pack, $5. */
  templatePack: string;
}

/** The three prices a Team subscription is made of; null when billing is
 *  not set up on this server. */
export function stripePrices(): StripePrices | null {
  const { STRIPE_SECRET_KEY, STRIPE_PRICE_SEAT, STRIPE_PRICE_API_OVERAGE, STRIPE_PRICE_TEMPLATE_PACK } = process.env;
  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_SEAT || !STRIPE_PRICE_API_OVERAGE || !STRIPE_PRICE_TEMPLATE_PACK) return null;
  return { seat: STRIPE_PRICE_SEAT, apiOverage: STRIPE_PRICE_API_OVERAGE, templatePack: STRIPE_PRICE_TEMPLATE_PACK };
}

/** The meter's event name, as set on the meter in Stripe. */
export function meterEventName(): string {
  return process.env.STRIPE_METER_EVENT || 'temply_api_calls';
}

/**
 * Where a new subscription's billing cycle starts: 00:00 UTC on the 1st of
 * next month, so each bill covers the calendar month the usage counter
 * keeps. A Checkout session has to stay open for at least 30 minutes and
 * close before the anchor passes, so within half an hour of a month's end
 * the anchor moves to the month after.
 */
export function cycleAnchor(now: Date): Date {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  if (next - now.getTime() >= 31 * 60_000) return new Date(next);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1));
}

/**
 * Members of an organization, as Clerk counts them: what a workspace is
 * billed for. CLERK_API_URL exists for tests; production never sets it.
 */
export async function countMembers(orgId: string): Promise<number> {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) throw new Error('CLERK_SECRET_KEY is not set');
  const base = (process.env.CLERK_API_URL || 'https://api.clerk.com').replace(/\/$/, '');
  const res = await fetch(`${base}/v1/organizations/${encodeURIComponent(orgId)}?include_members_count=true`, {
    headers: { authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Clerk could not count the members of ${orgId}: ${res.status}`);
  const body = (await res.json()) as { members_count?: number };
  // The person paying is a member; an organization is never billed for none.
  return Math.max(1, body.members_count ?? 1);
}

/** Stripe's statuses under which a subscription still pays for the plan.
 *  `past_due` is Stripe retrying a card, and the plan runs while it does. */
export const PAYING_STATUSES = ['active', 'trialing', 'past_due'];
/** The statuses a subscription never comes back from. */
const ENDED_STATUSES = ['canceled', 'incomplete_expired'];

/**
 * A row that is not paying for its plan right now. A cancellation past its
 * date stops paying even before Stripe's `deleted` event lands: a lost
 * delivery must not leave the plan running for free. lib/billing.ts's
 * `paying` is the same rule in TypeScript; the two must agree.
 */
export function notPaying(now = new Date().toISOString()) {
  return or(eq(subscriptions.plan, 'free'), notInArray(subscriptions.status, PAYING_STATUSES), lte(subscriptions.cancel_at, now));
}

const iso = (seconds: number | null | undefined) => (typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null);

/**
 * Writes what a subscription says onto the workspace that bought it, in one
 * UPDATE whose WHERE holds every rule, so two deliveries racing each other
 * cannot interleave between a read and a write:
 *
 * - The row is the customer's; only checkout gives a row its customer.
 * - A row holds one subscription. Another may take it only while the row is
 *   not paying, so a second checkout cannot unseat a plan that is running.
 * - `syncedAt` is when this subscription was read from Stripe. A write that
 *   read before the row's last one is older news and is dropped.
 *
 * Returns whether the row took it.
 */
export async function applySubscription(db: Db, sub: Stripe.Subscription, syncedAt: string): Promise<boolean> {
  const now = new Date().toISOString();
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const paid = PAYING_STATUSES.includes(sub.status);
  const ended = ENDED_STATUSES.includes(sub.status);
  const prices = stripePrices();
  const quantityOf = (price: string | undefined) =>
    sub.items.data.find((item) => price && item.price.id === price)?.quantity ?? 0;
  const periodEnd = iso(sub.items.data[0]?.current_period_end);
  // The portal schedules a cancellation as cancel_at; the dashboard and
  // older API versions set cancel_at_period_end instead.
  const cancelAt = iso(sub.cancel_at) ?? (sub.cancel_at_period_end ? periodEnd : null);

  const holds = eq(subscriptions.stripe_subscription_id, sub.id);
  const mayClaim = paid ? notPaying(now) : and(notPaying(now), isNull(subscriptions.stripe_subscription_id));
  const fresher = or(isNull(subscriptions.stripe_synced_at), lte(subscriptions.stripe_synced_at, syncedAt));

  const updated = await db
    .update(subscriptions)
    .set({
      plan: paid ? (sub.metadata?.plan === 'enterprise' ? 'enterprise' : 'team') : 'free',
      status: sub.status,
      stripe_subscription_id: ended ? null : sub.id,
      stripe_synced_at: syncedAt,
      current_period_end: ended ? null : periodEnd,
      cancel_at: ended ? null : cancelAt,
      seats: paid ? quantityOf(prices?.seat) : null,
      template_packs: paid ? quantityOf(prices?.templatePack) : 0,
      // Paying ends the trial, so a plan that later ends goes read-only
      // rather than back to a trial.
      ...(paid ? { trial_ends_at: sql`min(coalesce(${subscriptions.trial_ends_at}, ${now}), ${now})` } : {}),
      updated_at: now,
    })
    .where(and(eq(subscriptions.stripe_customer_id, customer), or(holds, mayClaim), fresher))
    .returning({ id: subscriptions.id });

  if (updated.length === 0 && paid) {
    // Either older news, or a second subscription paying while the first
    // runs. The second is a double charge someone has to refund by hand.
    const [row] = await db.select().from(subscriptions).where(eq(subscriptions.stripe_customer_id, customer)).limit(1);
    if (row && row.stripe_subscription_id && row.stripe_subscription_id !== sub.id) {
      console.error(`Stripe subscription ${sub.id} is paying for ${row.org_id}, which ${row.stripe_subscription_id} already pays for. Refund one.`);
    }
  }
  return updated.length > 0;
}

/**
 * Sets how many of a licensed price a subscription carries, and writes the
 * result back through `applySubscription` so the row and Stripe agree
 * before the webhook arrives. Zero removes the item. A change is prorated:
 * a member added mid-month is billed for what is left of it.
 */
export async function setItemQuantity(db: Db, subscriptionId: string, price: string, quantity: number): Promise<void> {
  const stripe = getStripe();
  const current = await stripe.subscriptions.retrieve(subscriptionId);
  const item = current.items.data.find((i) => i.price.id === price);
  if (item && item.quantity === quantity) return;
  if (item && quantity > 0) {
    await stripe.subscriptionItems.update(item.id, { quantity, proration_behavior: 'create_prorations' });
  } else if (item) {
    await stripe.subscriptionItems.del(item.id, { proration_behavior: 'create_prorations' });
  } else if (quantity > 0) {
    await stripe.subscriptionItems.create({ subscription: subscriptionId, price, quantity, proration_behavior: 'create_prorations' });
  } else {
    return;
  }
  const syncedAt = new Date().toISOString();
  await applySubscription(db, await stripe.subscriptions.retrieve(subscriptionId), syncedAt);
}

/**
 * Bills a workspace for the members it has now. Clerk says when someone
 * joins or leaves; a workspace that is not paying has nothing to change.
 */
export async function syncSeats(db: Db, orgId: string, count: (orgId: string) => Promise<number> = countMembers): Promise<void> {
  const prices = stripePrices();
  if (!prices) return;
  const [row] = await db.select().from(subscriptions).where(and(eq(subscriptions.org_id, orgId), eq(subscriptions.plan, 'team'))).limit(1);
  if (!row?.stripe_subscription_id || !PAYING_STATUSES.includes(row.status)) return;
  await setItemQuantity(db, row.stripe_subscription_id, prices.seat, await count(orgId));
}
