import type Stripe from 'stripe';
import { PRICES_USD, STRIPE_LOOKUP_KEYS, type StripePriceName } from '@temply/shared/plans';
import { billingConfigured, getStripe, meterEventName } from '../src/lib/stripe';

/** The events routes/webhooks/stripe.ts acts on; any other is ignored there. */
const WEBHOOK_EVENTS = ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'] as const;

type Outcome = 'created' | 'found';

export interface SetupReport {
  meter: Outcome;
  product: Outcome;
  prices: Record<StripePriceName, Outcome>;
  /** Prices that exist in Stripe with an amount other than the one the pages state. */
  mismatches: string[];
}

const cents = (usd: number) => Math.round(usd * 100);

/**
 * Makes the Stripe objects billing is built from: the meter that hears API
 * calls, one product, and the three prices under their lookup keys. Safe to
 * run again, and to run once per Stripe account and mode (test, live): what
 * exists is left alone, and only what is missing is made.
 *
 * A price's amount cannot be edited in Stripe. One that exists with another
 * amount than shared/plans.ts states is reported, not changed: swapping it
 * means making a new price with `transfer_lookup_key`, and the subscriptions
 * on the old price keep what they agreed to.
 */
export async function setupStripe(stripe: Stripe): Promise<SetupReport> {
  const event = meterEventName();
  const meters = await stripe.billing.meters.list({ status: 'active', limit: 100 });
  let meter = meters.data.find((m) => m.event_name === event);
  const meterOutcome: Outcome = meter ? 'found' : 'created';
  // The server reports each workspace's calls past the included ones under
  // these two payload keys (lib/overage.ts).
  meter ??= await stripe.billing.meters.create({
    display_name: 'Temply API calls',
    event_name: event,
    default_aggregation: { formula: 'sum' },
    customer_mapping: { event_payload_key: 'stripe_customer_id', type: 'by_id' },
    value_settings: { event_payload_key: 'value' },
  });

  const keys = Object.values(STRIPE_LOOKUP_KEYS);
  const existing = await stripe.prices.list({ lookup_keys: [...keys], active: true, limit: keys.length });
  const held = existing.data[0]?.product;
  let productOutcome: Outcome = 'found';
  let product = typeof held === 'string' ? held : held?.id;
  if (!product) {
    productOutcome = 'created';
    product = (await stripe.products.create({ name: 'Temply' })).id;
  }

  const monthly = { interval: 'month' } as const;
  const wanted: Record<StripePriceName, { nickname: string; unitAmount: number; create: Stripe.PriceCreateParams }> = {
    seat: {
      nickname: 'Seat',
      unitAmount: cents(PRICES_USD.seat),
      create: { unit_amount: cents(PRICES_USD.seat), recurring: monthly },
    },
    // Stripe prices a metered unit in cents, fractions allowed: a dollar per
    // thousand calls is a tenth of a cent a call.
    apiOverage: {
      nickname: 'API overage',
      unitAmount: cents(PRICES_USD.overagePer1000Calls) / 1000,
      create: { unit_amount_decimal: String(cents(PRICES_USD.overagePer1000Calls) / 1000), recurring: { ...monthly, usage_type: 'metered', meter: meter.id } },
    },
    templatePack: {
      nickname: 'Template pack',
      unitAmount: cents(PRICES_USD.templatePack),
      create: { unit_amount: cents(PRICES_USD.templatePack), recurring: monthly },
    },
  };

  const prices = {} as Record<StripePriceName, Outcome>;
  const mismatches: string[] = [];
  for (const name of Object.keys(wanted) as StripePriceName[]) {
    const key = STRIPE_LOOKUP_KEYS[name];
    const found = existing.data.find((p) => p.lookup_key === key);
    if (found) {
      prices[name] = 'found';
      const amount = Number(found.unit_amount_decimal ?? found.unit_amount);
      if (amount !== wanted[name].unitAmount) mismatches.push(`${key} is ${amount} cents in Stripe and ${wanted[name].unitAmount} in shared/plans.ts`);
      continue;
    }
    prices[name] = 'created';
    // The key may sit on an archived price, which would refuse it to a new one.
    await stripe.prices.create({ ...wanted[name].create, currency: 'usd', product, nickname: wanted[name].nickname, lookup_key: key, transfer_lookup_key: true });
  }
  return { meter: meterOutcome, product: productOutcome, prices, mismatches };
}

export interface WebhookReport {
  id: string;
  created: boolean;
  /** The signing secret. Stripe shows it only in the reply that creates the
   *  endpoint, so it is null for one that already existed. */
  secret: string | null;
}

/** Points Stripe's subscription events at `url`, or brings an endpoint already
 *  there up to date. */
export async function ensureWebhook(stripe: Stripe, url: string): Promise<WebhookReport> {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const ours = endpoints.data.find((e) => e.url === url);
  const enabled_events = [...WEBHOOK_EVENTS];
  if (ours) {
    await stripe.webhookEndpoints.update(ours.id, { enabled_events });
    return { id: ours.id, created: false, secret: null };
  }
  const made = await stripe.webhookEndpoints.create({ url, enabled_events });
  return { id: made.id, created: true, secret: made.secret ?? null };
}

/**
 * `STRIPE_SECRET_KEY=sk_test_… bun run stripe:setup`, then again with the
 * live key. `--webhook https://<app>/api/webhooks/stripe` also registers the
 * endpoint and prints its signing secret, the one value that cannot be read
 * back later.
 */
if (import.meta.main) {
  const args = process.argv.slice(2);
  const flag = args.indexOf('--webhook');
  const webhookUrl = flag >= 0 ? args[flag + 1] : undefined;
  if (flag >= 0 && !(webhookUrl && URL.canParse(webhookUrl))) {
    console.error('--webhook needs the endpoint URL, e.g. --webhook https://your-app.example/api/webhooks/stripe');
    process.exit(1);
  }
  if (!billingConfigured()) {
    console.error('STRIPE_SECRET_KEY is not set. Run it as: STRIPE_SECRET_KEY=sk_test_… bun run stripe:setup');
    process.exit(1);
  }

  const stripe = getStripe();
  const live = /^[rs]k_live_/.test(process.env.STRIPE_SECRET_KEY ?? '');
  console.log(`Stripe account, ${live ? 'live' : 'test'} mode`);
  const report = await setupStripe(stripe);
  console.log(`  meter ${meterEventName()}: ${report.meter}`);
  console.log(`  product: ${report.product}`);
  for (const name of Object.keys(report.prices) as StripePriceName[]) console.log(`  price ${STRIPE_LOOKUP_KEYS[name]}: ${report.prices[name]}`);

  if (webhookUrl) {
    const hook = await ensureWebhook(stripe, webhookUrl);
    console.log(`  webhook ${hook.id}: ${hook.created ? 'created' : 'found, events brought up to date'}`);
    if (hook.secret) console.log(`\nSet this in the app's environment now; Stripe will not show it again:\nSTRIPE_WEBHOOK_SECRET=${hook.secret}`);
    else console.log("\nThe signing secret is shown only when an endpoint is created. If it is lost, roll it in the Stripe dashboard (Developers → Webhooks).");
  }

  for (const mismatch of report.mismatches) console.error(`\nWarning: ${mismatch}. Stripe prices cannot be edited; make a new one with transfer_lookup_key.`);
  if (report.mismatches.length > 0) process.exit(1);
}
