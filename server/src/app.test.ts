import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Next minifies the API into its server bundle, and Elysia decides from a
// handler's source whether to read the request body before calling it. Once
// the names are mangled it can guess yes, which leaves a handler that checks
// a signature over the raw body with nothing to read. The unit tests run the
// source as written, so only this and the browser run see it.
describe('the minified app', () => {
  const saved = { ...process.env };
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'temply-app-'));
    // Nothing connects until a query runs, and these requests stop at the
    // signature.
    process.env.DATABASE_URL = 'postgres://nobody:nothing@127.0.0.1:1/none';
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = `whsec_${Buffer.from('a'.repeat(32)).toString('base64')}`;
  });

  afterEach(async () => {
    for (const key of ['DATABASE_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'CLERK_WEBHOOK_SIGNING_SECRET']) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    await rm(dir, { recursive: true, force: true });
  });

  it('leaves the body of a signed webhook for its handler to read', async () => {
    const built = await Bun.build({ entrypoints: [join(import.meta.dir, 'app.ts')], outdir: dir, target: 'node', minify: true });
    expect(built.success).toBe(true);
    const { app, default: entrypoint } = (await import(join(dir, 'app.js'))) as {
      app: { handle(request: Request): Promise<Response> };
      default: { fetch(request: Request): Promise<Response> };
    };
    expect(entrypoint).toBe(app);
    expect(typeof entrypoint.fetch).toBe('function');

    const error = spyOn(console, 'error').mockImplementation(() => {});
    try {
      for (const path of ['/api/webhooks/stripe', '/api/webhooks/clerk']) {
        error.mockClear();
        const res = await entrypoint.fetch(
          new Request(`http://api.internal${path}`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'stripe-signature': 't=1,v1=00',
              'svix-id': 'msg_test',
              'svix-timestamp': String(Math.floor(Date.now() / 1000)),
              'svix-signature': 'v1,AAAA',
            },
            body: new TextEncoder().encode('{"type":"test"}'),
          }),
        );
        // Refused for the signature, which only happens once the handler has
        // read the body: a body read twice says so instead.
        expect(res.status).toBe(400);
        expect(String(error.mock.calls[0]?.[1])).toMatch(/signature/i);
      }
    } finally {
      error.mockRestore();
    }
  }, 30_000);
});
