import type { Received } from './index';

/** A subscription item as Stripe returns one, cut to what the app reads.
 *  The metered overage item carries no quantity. */
export interface StripeSubscriptionItem {
  id: string;
  object: 'subscription_item';
  price: { id: string; object: 'price' };
  quantity?: number;
  /** Seconds since the epoch, as Stripe sends every time. */
  current_period_end: number;
}

/** A subscription as Stripe returns one, cut to what the app reads. */
export interface StripeSubscription {
  id: string;
  object: 'subscription';
  customer: string;
  status: string;
  metadata: Record<string, string>;
  cancel_at: number | null;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  ended_at: number | null;
  items: { object: 'list'; data: StripeSubscriptionItem[] };
}

/** A request as Stripe's SDK sends it, flattened the way it encodes one:
 *  `line_items[0][price]`, `subscription_data[metadata][orgId]`. POST
 *  bodies are form-encoded; GET and DELETE carry theirs in the query. */
export type StripeForm = Record<string, string>;

const subscriptions = new Map<string, StripeSubscription>();
const checkouts = new Map<string, StripeForm>();
const portals = new Map<string, StripeForm>();
let made = 0;
// Never reset, so an id is never handed out twice in one run.
const newId = (prefix: string) => `${prefix}_fake${++made}`;

export function resetStripe() {
  subscriptions.clear();
  checkouts.clear();
  portals.clear();
}

const stripeError = (status: number, message: string, code?: string) =>
  Response.json({ error: { type: 'invalid_request_error', message, ...(code ? { code } : {}) } }, { status });
const missing = (what: string, id: string) => stripeError(404, `No such ${what}: '${id}'`, 'resource_missing');

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const portalHtml = (returnUrl: string) =>
  `<!doctype html><title>Billing portal</title><h1>Billing portal</h1><a href="${escapeHtml(returnUrl)}">Return to Temply</a>`;

function itemById(id: string) {
  for (const sub of subscriptions.values()) {
    const item = sub.items.data.find((i) => i.id === id);
    if (item) return { sub, item };
  }
  return null;
}

/**
 * Just enough of Stripe for the app, on an origin of its own: the SDK is
 * given a host and port but no base path, so it cannot sit under a prefix on
 * the shared fakes port the way ImageKit and Resend do.
 *
 * Three kinds of route:
 * - Stripe's API at `/v1/...`, answered from memory and recorded, with the
 *   key checked as Stripe checks it.
 * - The two pages Stripe hosts. `/checkout/:id` sends the browser straight
 *   back to the session's `success_url`, where a customer lands once they
 *   have paid; the subscription that payment makes is the test's to create.
 *   `/portal/:id` stays on this origin, as the real portal does, with a link
 *   back to the session's `return_url`.
 * - `/__subscriptions/:id`, test-only and not recorded: what Stripe does on
 *   its own side — make a subscription at checkout, change it in the portal,
 *   end it — is written here by setup/plan.ts, and the app reads it back
 *   through the API routes.
 *
 * It sends no webhooks of its own. A test delivers them, so each spec
 * decides when Stripe's news arrives.
 */
export function stripeRoutes(origin: string, secretKey: string, record: (r: Received) => void) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    const control = path.match(/^\/__subscriptions\/([^/]+)$/);
    if (control && method === 'PUT') {
      const sub = (await req.json()) as StripeSubscription;
      if (sub.id !== control[1]) return new Response(`subscription ${sub.id} put at ${control[1]}`, { status: 400 });
      subscriptions.set(sub.id, sub);
      return Response.json(sub);
    }
    if (control && method === 'GET') {
      const sub = subscriptions.get(control[1]);
      return sub ? Response.json(sub) : new Response(null, { status: 404 });
    }

    const checkoutPage = path.match(/^\/checkout\/([^/]+)$/);
    if (checkoutPage && method === 'GET') {
      record({ method, path, body: {} });
      const back = checkouts.get(checkoutPage[1])?.success_url?.replace('{CHECKOUT_SESSION_ID}', checkoutPage[1]);
      return back ? Response.redirect(back, 303) : new Response(`no checkout session ${checkoutPage[1]}`, { status: 404 });
    }
    const portalPage = path.match(/^\/portal\/([^/]+)$/);
    if (portalPage && method === 'GET') {
      record({ method, path, body: {} });
      const back = portals.get(portalPage[1])?.return_url;
      if (!back) return new Response(`no portal session ${portalPage[1]}`, { status: 404 });
      return new Response(portalHtml(back), { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    if (!path.startsWith('/v1/')) return new Response(null, { status: 404 });
    const form: StripeForm = Object.fromEntries(new URLSearchParams(method === 'GET' || method === 'DELETE' ? url.search : await req.text()));
    record({ method, path, body: form });
    if (req.headers.get('authorization') !== `Bearer ${secretKey}`) return stripeError(401, 'Invalid API Key provided');
    const now = Math.floor(Date.now() / 1000);

    if (method === 'POST' && path === '/v1/customers') return Response.json({ id: newId('cus'), object: 'customer' });

    if (method === 'POST' && path === '/v1/checkout/sessions') {
      const id = newId('cs');
      checkouts.set(id, form);
      return Response.json({
        id,
        object: 'checkout.session',
        mode: form.mode,
        customer: form.customer ?? null,
        status: 'open',
        success_url: form.success_url,
        cancel_url: form.cancel_url,
        url: `${origin}/checkout/${id}`,
      });
    }

    if (method === 'POST' && path === '/v1/billing_portal/sessions') {
      const id = newId('bps');
      portals.set(id, form);
      return Response.json({ id, object: 'billing_portal.session', customer: form.customer, return_url: form.return_url, url: `${origin}/portal/${id}` });
    }

    if (method === 'POST' && path === '/v1/billing/meter_events') {
      return Response.json({
        object: 'billing.meter_event',
        event_name: form.event_name,
        identifier: form.identifier,
        payload: { stripe_customer_id: form['payload[stripe_customer_id]'], value: form['payload[value]'] },
        timestamp: Number(form.timestamp),
        created: now,
        livemode: false,
      });
    }

    const subscription = path.match(/^\/v1\/subscriptions\/([^/]+)$/);
    if (subscription && (method === 'GET' || method === 'DELETE')) {
      const sub = subscriptions.get(subscription[1]);
      if (!sub) return missing('subscription', subscription[1]);
      if (method === 'DELETE') Object.assign(sub, { status: 'canceled', canceled_at: sub.canceled_at ?? now, ended_at: now });
      return Response.json(sub);
    }

    if (method === 'POST' && path === '/v1/subscription_items') {
      const sub = subscriptions.get(form.subscription);
      if (!sub) return missing('subscription', form.subscription);
      const item: StripeSubscriptionItem = {
        id: newId('si'),
        object: 'subscription_item',
        price: { id: form.price, object: 'price' },
        quantity: Number(form.quantity ?? 1),
        // Every item of a subscription shares its billing period.
        current_period_end: sub.items.data[0]?.current_period_end ?? now + 30 * 86_400,
      };
      sub.items.data.push(item);
      return Response.json({ ...item, subscription: sub.id });
    }

    const subscriptionItem = path.match(/^\/v1\/subscription_items\/([^/]+)$/);
    if (subscriptionItem && (method === 'POST' || method === 'DELETE')) {
      const found = itemById(subscriptionItem[1]);
      if (!found) return missing('subscription_item', subscriptionItem[1]);
      if (method === 'DELETE') {
        found.sub.items.data = found.sub.items.data.filter((i) => i !== found.item);
        return Response.json({ id: found.item.id, object: 'subscription_item', deleted: true });
      }
      if (form.quantity !== undefined) found.item.quantity = Number(form.quantity);
      return Response.json({ ...found.item, subscription: found.sub.id });
    }

    // In Stripe's own error shape, so the SDK in the API surfaces it as a
    // message in the log rather than as unreadable JSON.
    return stripeError(501, `no route in the Stripe fake: ${method} ${path}`);
  };
}
