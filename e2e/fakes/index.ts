import { FAKES_URL, PORTS, STRIPE, STRIPE_URL } from '../env';
import { imagekitRoutes, resetImagekit } from './imagekit';
import { resendRoutes } from './resend';
import { resetStripe, stripeRoutes } from './stripe';

/** What a fake received, stamped with when: tests run in parallel against
 *  this one process, so a test tells its own requests apart by time. */
export type Recorded = { method: string; path: string; body: unknown; receivedAt: number };
export type Received = Omit<Recorded, 'receivedAt'>;
export type Service = 'stripe' | 'imagekit' | 'resend';

const recorded: Record<Service, Recorded[]> = { stripe: [], imagekit: [], resend: [] };
const record = (service: Service) => (r: Received) => { recorded[service].push({ ...r, receivedAt: Date.now() }); };

const handlers: Record<Exclude<Service, 'stripe'>, (req: Request, path: string) => Promise<Response | null>> = {
  imagekit: imagekitRoutes(`${FAKES_URL}/imagekit`, record('imagekit')),
  resend: resendRoutes(record('resend')),
};

// Listening before the shared port below, whose /__health is what Playwright
// waits on: once that answers, both are up.
Bun.serve({
  port: PORTS.stripe,
  hostname: '127.0.0.1',
  fetch: stripeRoutes(STRIPE_URL, STRIPE.secretKey, record('stripe')),
});

/**
 * Every other fake shares this port under its own prefix, plus three
 * test-only routes — health, what each fake received (Stripe's included),
 * and a reset — that answer regardless of which fake the request names.
 * Started by Playwright's webServer alongside the real API and client.
 */
Bun.serve({
  port: PORTS.fakes,
  hostname: '127.0.0.1',
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/__health') return new Response('ok');
    if (url.pathname === '/__requests') {
      const service = url.searchParams.get('service') as Service | null;
      return Response.json(service ? recorded[service] : recorded);
    }
    if (url.pathname === '/__reset' && req.method === 'POST') {
      for (const s of Object.keys(recorded) as Service[]) recorded[s] = [];
      resetImagekit();
      resetStripe();
      return new Response(null, { status: 204 });
    }
    const [, service, ...rest] = url.pathname.split('/');
    const handler = handlers[service as keyof typeof handlers];
    if (!handler) return new Response('unknown fake', { status: 404 });
    const res = await handler(new Request(req), `/${rest.join('/')}${url.search}`.replace(/\?$/, ''));
    return res ?? new Response(`no route in fake ${service}: ${req.method} /${rest.join('/')}`, { status: 501 });
  },
});

console.log(`fakes listening on ${FAKES_URL}, Stripe on ${STRIPE_URL}`);
