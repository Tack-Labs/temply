import { BASE_URL, FAKES_URL, PORTS, STRIPE_URL } from '../env';
import { imagekitRoutes, resetImagekit } from './imagekit';
import { resendRoutes } from './resend';
import { stripeRoutes } from './stripe';

/** What a fake received, stamped with when: tests run in parallel against
 *  this one process, so a test tells its own requests apart by time. */
export type Recorded = { method: string; path: string; body: unknown; receivedAt: number };
export type Received = Omit<Recorded, 'receivedAt'>;
type Service = 'stripe' | 'imagekit' | 'resend';

const recorded: Record<Service, Recorded[]> = { stripe: [], imagekit: [], resend: [] };
const record = (service: Service) => (r: Received) => { recorded[service].push({ ...r, receivedAt: Date.now() }); };

const stripeHandler = stripeRoutes(BASE_URL, record('stripe'));
const handlers: Record<'imagekit' | 'resend', (req: Request, path: string) => Promise<Response | null>> = {
  imagekit: imagekitRoutes(`${FAKES_URL}/imagekit`, record('imagekit')),
  resend: resendRoutes(record('resend')),
};

/**
 * ImageKit and Resend share this port under their own prefix, plus two
 * test-only routes — what each fake received, and a reset — that answer
 * regardless of which fake the request names. Started by Playwright's
 * webServer alongside the real API and client.
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
      return new Response(null, { status: 204 });
    }
    const [, service, ...rest] = url.pathname.split('/');
    const handler = handlers[service as keyof typeof handlers];
    if (!handler) return new Response('unknown fake', { status: 404 });
    const res = await handler(new Request(req), `/${rest.join('/')}${url.search}`.replace(/\?$/, ''));
    return res ?? new Response(`no route in fake ${service}: ${req.method} /${rest.join('/')}`, { status: 501 });
  },
});

/**
 * Stripe gets its own port rather than a prefix on the one above:
 * stripe-node's config takes a host/port/protocol but has no basePath, so
 * whatever it points at has to answer at the paths the SDK actually
 * requests (`/v1/...`). Its requests still land in `recorded.stripe` and
 * are still readable and resettable through the main port above.
 */
Bun.serve({
  port: PORTS.stripe,
  hostname: '127.0.0.1',
  async fetch(req) {
    const url = new URL(req.url);
    const res = await stripeHandler(new Request(req), `${url.pathname}${url.search}`.replace(/\?$/, ''));
    return res ?? new Response(`no route in fake stripe: ${req.method} ${url.pathname}`, { status: 501 });
  },
});

console.log(`fakes listening on ${FAKES_URL} (stripe on ${STRIPE_URL})`);
