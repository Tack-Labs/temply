import { BASE_URL, FAKES_URL, PORTS } from '../env';
import { imagekitRoutes, resetImagekit } from './imagekit';
import { lemonSqueezyRoutes } from './lemonsqueezy';
import { resendRoutes } from './resend';

/** What a fake received, stamped with when: tests run in parallel against
 *  this one process, so a test tells its own requests apart by time. */
export type Recorded = { method: string; path: string; body: unknown; receivedAt: number };
export type Received = Omit<Recorded, 'receivedAt'>;
type Service = 'lemonsqueezy' | 'imagekit' | 'resend';

const recorded: Record<Service, Recorded[]> = { lemonsqueezy: [], imagekit: [], resend: [] };
const record = (service: Service) => (r: Received) => { recorded[service].push({ ...r, receivedAt: Date.now() }); };

const handlers: Record<Service, (req: Request, path: string) => Promise<Response | null>> = {
  lemonsqueezy: lemonSqueezyRoutes(BASE_URL, record('lemonsqueezy')),
  imagekit: imagekitRoutes(`${FAKES_URL}/imagekit`, record('imagekit')),
  resend: resendRoutes(record('resend')),
};

/**
 * Every fake shares this port under its own prefix, plus two test-only
 * routes — what each fake received, and a reset — that answer regardless of
 * which fake the request names. Started by Playwright's webServer alongside
 * the real API and client.
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

console.log(`fakes listening on ${FAKES_URL}`);
