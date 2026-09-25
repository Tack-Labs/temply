import { createHmac } from 'node:crypto';

export interface StripeCall {
  method: string;
  path: string;
  /** Form fields as Stripe's SDK flattens them: `line_items[0][price]`. */
  form: Record<string, string>;
}

interface Item {
  id: string;
  object: 'subscription_item';
  price: { id: string; object: 'price' };
  quantity?: number;
  current_period_end: number;
}

export interface FakeSubscription {
  id: string;
  object: 'subscription';
  customer: string;
  status: string;
  metadata: Record<string, string>;
  cancel_at: number | null;
  cancel_at_period_end: boolean;
  items: { object: 'list'; data: Item[] };
}

export const PRICES = { seat: 'price_seat', apiOverage: 'price_overage', templatePack: 'price_pack' };

/** Everything the server reads to talk to Stripe and Clerk, pointed at the fake. */
export const STRIPE_ENV = {
  STRIPE_SECRET_KEY: 'sk_test_fake',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_fake',
  STRIPE_PRICE_SEAT: PRICES.seat,
  STRIPE_PRICE_API_OVERAGE: PRICES.apiOverage,
  STRIPE_PRICE_TEMPLATE_PACK: PRICES.templatePack,
  CLERK_SECRET_KEY: 'sk_clerk_fake',
  CLERK_API_URL: 'https://clerk.test',
  NEXT_PUBLIC_APP_URL: 'https://temply.test',
};

const PERIOD_END = Math.floor(Date.UTC(2099, 0, 1) / 1000);

/**
 * Stripe and Clerk for a test, answered from memory. Under Bun the Stripe
 * SDK sends through `globalThis.fetch`, looked up when a client is made, and
 * `getStripe()` makes one per call — so replacing fetch reaches it without
 * mocking a module for the whole process. Sets STRIPE_ENV and puts back
 * both it and fetch on `restore()`.
 */
export function fakeStripe() {
  const calls: StripeCall[] = [];
  const subscriptions = new Map<string, FakeSubscription>();
  const members = new Map<string, number>();
  const meterEvents: Record<string, string>[] = [];
  let next = 0;
  const id = (prefix: string) => `${prefix}_${++next}`;

  const saved = Object.fromEntries(Object.keys(STRIPE_ENV).map((k) => [k, process.env[k]]));
  Object.assign(process.env, STRIPE_ENV);
  const realFetch = globalThis.fetch;

  const notFound = (what: string) => Response.json({ error: { type: 'invalid_request_error', message: `No such ${what}` } }, { status: 404 });
  const itemById = (itemId: string) => {
    for (const sub of subscriptions.values()) {
      const item = sub.items.data.find((i) => i.id === itemId);
      if (item) return { sub, item };
    }
    return null;
  };

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    // Client tests in the same process install a DOM's AbortController, whose
    // signal a native Request refuses; nothing here aborts, so it is dropped.
    const { signal: _signal, ...rest } = init ?? {};
    const request = new Request(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, rest);
    const url = new URL(request.url);
    const form = Object.fromEntries(new URLSearchParams(request.method === 'GET' || request.method === 'DELETE' ? url.search : await request.text()));
    const path = url.pathname;
    const method = request.method;

    if (url.origin === STRIPE_ENV.CLERK_API_URL) {
      const org = decodeURIComponent(path.replace('/v1/organizations/', ''));
      return Response.json({ id: org, members_count: members.get(org) ?? 1 });
    }
    if (url.hostname !== 'api.stripe.com') return new Response('not faked', { status: 599 });
    calls.push({ method, path, form });

    if (method === 'POST' && path === '/v1/customers') return Response.json({ id: id('cus'), object: 'customer' });
    if (method === 'POST' && path === '/v1/checkout/sessions') {
      const session = id('cs');
      return Response.json({ id: session, object: 'checkout.session', url: `https://checkout.stripe.test/${session}` });
    }
    if (method === 'POST' && path === '/v1/billing_portal/sessions') return Response.json({ id: id('bps'), object: 'billing_portal.session', url: 'https://billing.stripe.test/portal' });
    if (method === 'POST' && path === '/v1/billing/meter_events') {
      meterEvents.push(form);
      return Response.json({ object: 'billing.meter_event', identifier: form.identifier });
    }

    const sub = path.match(/^\/v1\/subscriptions\/([^/]+)$/);
    if (sub) {
      const found = subscriptions.get(sub[1]);
      if (!found) return notFound('subscription');
      if (method === 'DELETE') found.status = 'canceled';
      return Response.json(found);
    }

    if (method === 'POST' && path === '/v1/subscription_items') {
      const target = subscriptions.get(form.subscription);
      if (!target) return notFound('subscription');
      const item: Item = { id: id('si'), object: 'subscription_item', price: { id: form.price, object: 'price' }, quantity: Number(form.quantity), current_period_end: PERIOD_END };
      target.items.data.push(item);
      return Response.json(item);
    }
    const item = path.match(/^\/v1\/subscription_items\/([^/]+)$/);
    if (item) {
      const found = itemById(item[1]);
      if (!found) return notFound('subscription item');
      if (method === 'DELETE') {
        found.sub.items.data = found.sub.items.data.filter((i) => i !== found.item);
        return Response.json({ id: found.item.id, object: 'subscription_item', deleted: true });
      }
      found.item.quantity = Number(form.quantity);
      return Response.json(found.item);
    }
    return new Response(`not faked: ${method} ${path}`, { status: 599 });
  }) as typeof fetch;

  return {
    calls,
    subscriptions,
    members,
    meterEvents,
    /** A Team subscription as Stripe would hold it after checkout. */
    subscription(customer: string, opts: { id?: string; seats?: number; packs?: number; status?: string; metadata?: Record<string, string>; cancelAt?: number | null; cancelAtPeriodEnd?: boolean } = {}) {
      const data: Item[] = [
        { id: id('si'), object: 'subscription_item', price: { id: PRICES.seat, object: 'price' }, quantity: opts.seats ?? 1, current_period_end: PERIOD_END },
        { id: id('si'), object: 'subscription_item', price: { id: PRICES.apiOverage, object: 'price' }, current_period_end: PERIOD_END },
      ];
      if (opts.packs) data.push({ id: id('si'), object: 'subscription_item', price: { id: PRICES.templatePack, object: 'price' }, quantity: opts.packs, current_period_end: PERIOD_END });
      const made: FakeSubscription = {
        id: opts.id ?? id('sub'),
        object: 'subscription',
        customer,
        status: opts.status ?? 'active',
        metadata: opts.metadata ?? {},
        cancel_at: opts.cancelAt ?? null,
        cancel_at_period_end: opts.cancelAtPeriodEnd ?? false,
        items: { object: 'list', data },
      };
      subscriptions.set(made.id, made);
      return made;
    },
    periodEnd: new Date(PERIOD_END * 1000).toISOString(),
    restore() {
      globalThis.fetch = realFetch;
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    },
  };
}

export type FakeStripe = ReturnType<typeof fakeStripe>;

/** A webhook delivery signed the way Stripe signs one:
 *  `t=<ts>,v1=hex(HMAC-SHA256(secret, "<ts>.<body>"))`. */
export function stripeDelivery(event: { type: string; data: { object: unknown } }, secret = STRIPE_ENV.STRIPE_WEBHOOK_SECRET): Request {
  const body = JSON.stringify({ id: `evt_${crypto.randomUUID()}`, object: 'event', created: Math.floor(Date.now() / 1000), ...event });
  const ts = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': `t=${ts},v1=${v1}` },
    body,
  });
}
