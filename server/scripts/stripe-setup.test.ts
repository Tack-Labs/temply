import { describe, expect, it } from 'bun:test';
import type Stripe from 'stripe';
import { STRIPE_LOOKUP_KEYS } from '@temply/shared/plans';
import { ensureWebhook, setupStripe } from './stripe-setup';

/** The corners of Stripe's API the script touches, kept in memory. */
function stubStripe() {
  let next = 0;
  const id = (prefix: string) => `${prefix}_${++next}`;
  const meters: any[] = [];
  const products: any[] = [];
  const prices: any[] = [];
  const endpoints: any[] = [];
  const updates: { id: string; params: any }[] = [];
  const stripe = {
    billing: {
      meters: {
        list: async () => ({ data: meters }),
        create: async (params: any) => {
          const made = { id: id('mtr'), ...params };
          meters.push(made);
          return made;
        },
      },
    },
    products: {
      create: async (params: any) => {
        const made = { id: id('prod'), ...params };
        products.push(made);
        return made;
      },
    },
    prices: {
      list: async (params: { lookup_keys: string[] }) => ({ data: prices.filter((p) => params.lookup_keys.includes(p.lookup_key)) }),
      create: async (params: any) => {
        const made = { id: id('price'), ...params, unit_amount_decimal: String(params.unit_amount_decimal ?? params.unit_amount) };
        prices.push(made);
        return made;
      },
    },
    webhookEndpoints: {
      list: async () => ({ data: endpoints }),
      create: async (params: any) => {
        const made = { id: id('we'), ...params, secret: 'whsec_made' };
        endpoints.push({ ...made, secret: undefined });
        return made;
      },
      update: async (endpointId: string, params: any) => {
        updates.push({ id: endpointId, params });
        return {};
      },
    },
  } as unknown as Stripe;
  return { stripe, meters, products, prices, endpoints, updates };
}

describe('setupStripe', () => {
  it('makes the meter, one product and the three prices on an empty account', async () => {
    const s = stubStripe();
    const report = await setupStripe(s.stripe);
    expect(report).toEqual({ meter: 'created', product: 'created', prices: { seat: 'created', apiOverage: 'created', templatePack: 'created' }, mismatches: [] });

    // The server reports calls under these two payload keys.
    expect(s.meters[0]).toMatchObject({
      event_name: 'temply_api_calls',
      default_aggregation: { formula: 'sum' },
      customer_mapping: { event_payload_key: 'stripe_customer_id', type: 'by_id' },
      value_settings: { event_payload_key: 'value' },
    });
    expect(s.products).toHaveLength(1);

    const byKey = Object.fromEntries(s.prices.map((p) => [p.lookup_key, p]));
    expect(Object.keys(byKey).sort()).toEqual(Object.values(STRIPE_LOOKUP_KEYS).sort());
    expect(byKey[STRIPE_LOOKUP_KEYS.seat]).toMatchObject({ unit_amount: 500, currency: 'usd', product: s.products[0].id, recurring: { interval: 'month' } });
    expect(byKey[STRIPE_LOOKUP_KEYS.templatePack]).toMatchObject({ unit_amount: 500, recurring: { interval: 'month' } });
    // A dollar per thousand calls, metered on the meter above: a tenth of a cent a call.
    expect(byKey[STRIPE_LOOKUP_KEYS.apiOverage]).toMatchObject({ unit_amount_decimal: '0.1', recurring: { interval: 'month', usage_type: 'metered', meter: s.meters[0].id } });
    expect(byKey[STRIPE_LOOKUP_KEYS.apiOverage].unit_amount).toBeUndefined();
    // Prices are made to take the key from an archived price that holds it.
    expect(s.prices.every((p) => p.transfer_lookup_key === true)).toBe(true);
  });

  it('makes nothing the second time', async () => {
    const s = stubStripe();
    await setupStripe(s.stripe);
    const report = await setupStripe(s.stripe);
    expect(report).toEqual({ meter: 'found', product: 'found', prices: { seat: 'found', apiOverage: 'found', templatePack: 'found' }, mismatches: [] });
    expect([s.meters.length, s.products.length, s.prices.length]).toEqual([1, 1, 3]);
  });

  it('fills in only what is missing, under the product the others hang from', async () => {
    const s = stubStripe();
    await setupStripe(s.stripe);
    s.prices.splice(s.prices.findIndex((p) => p.lookup_key === STRIPE_LOOKUP_KEYS.templatePack), 1);
    const report = await setupStripe(s.stripe);
    expect(report.prices).toEqual({ seat: 'found', apiOverage: 'found', templatePack: 'created' });
    expect(s.products).toHaveLength(1);
    expect(s.prices.at(-1)).toMatchObject({ lookup_key: STRIPE_LOOKUP_KEYS.templatePack, product: s.products[0].id });
  });

  it('reports a price whose amount is not the one the pages state, and leaves it alone', async () => {
    const s = stubStripe();
    await setupStripe(s.stripe);
    const seat = s.prices.find((p) => p.lookup_key === STRIPE_LOOKUP_KEYS.seat);
    seat.unit_amount_decimal = '700';
    const report = await setupStripe(s.stripe);
    expect(report.mismatches).toEqual(['temply_seat is 700 cents in Stripe and 500 in shared/plans.ts']);
    expect(s.prices).toHaveLength(3);
    expect(seat.unit_amount_decimal).toBe('700');
  });
});

describe('ensureWebhook', () => {
  const URL_ = 'https://app.example/api/webhooks/stripe';

  it('registers the three subscription events and returns the signing secret', async () => {
    const s = stubStripe();
    const hook = await ensureWebhook(s.stripe, URL_);
    expect(hook).toEqual({ id: expect.stringMatching(/^we_/), created: true, secret: 'whsec_made' });
    expect(s.endpoints[0]).toMatchObject({ url: URL_, enabled_events: ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'] });
  });

  it('brings an endpoint that is already there up to date, without a secret to show', async () => {
    const s = stubStripe();
    await ensureWebhook(s.stripe, URL_);
    const again = await ensureWebhook(s.stripe, URL_);
    expect(again).toEqual({ id: s.endpoints[0].id, created: false, secret: null });
    expect(s.endpoints).toHaveLength(1);
    expect(s.updates).toEqual([{ id: s.endpoints[0].id, params: { enabled_events: s.endpoints[0].enabled_events } }]);
  });
});
