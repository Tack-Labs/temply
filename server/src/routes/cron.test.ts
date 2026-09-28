import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { STRIPE_ENV } from '../test/fake-stripe';
import { createTestApp, createTestDb, get } from '../test/helpers';
import { cronRoutes } from './cron';

const SECRET = 'cron_secret_for_tests';
const CONFIGURED = { CRON_SECRET: SECRET, ...STRIPE_ENV };
let app: ReturnType<typeof createTestApp>;

beforeEach(async () => {
  app = createTestApp(await createTestDb(), cronRoutes);
  Object.assign(process.env, CONFIGURED);
});

afterEach(() => {
  for (const key of Object.keys(CONFIGURED)) delete process.env[key];
});

const call = (authorization?: string) =>
  get(app, '/api/cron/overage', null, authorization ? { Authorization: authorization } : {});

describe('GET /api/cron/overage', () => {
  it('runs the report for Vercel Cron and says how many it sent', async () => {
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reported: 0 });
  });

  it('refuses a caller without the secret', async () => {
    expect((await call()).status).toBe(401);
    expect((await call('Bearer wrong')).status).toBe(401);
    expect((await call(SECRET)).status).toBe(401);
  });

  it('refuses everyone while no secret is set, rather than letting anyone run it', async () => {
    delete process.env.CRON_SECRET;
    expect((await call('Bearer ')).status).toBe(503);
  });

  it('reports nothing where billing is not set up', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(await (await call(`Bearer ${SECRET}`)).json()).toEqual({ reported: 0 });
  });
});
