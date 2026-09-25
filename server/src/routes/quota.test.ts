import { beforeEach, describe, expect, it } from 'bun:test';
import { createTestApp, createTestDb, get, givePlan, type TestDb } from '../test/helpers';
import { orgUsage } from '@temply/shared/schema';
import { recordApiCall, nextResetDate, ukMonthString } from '../lib/api-quota';
import { quotaRoutes } from './quota';

let db: TestDb;
let app: any;
const USER = 'user_q';

beforeEach(() => {
  db = createTestDb();
  app = createTestApp(db, quotaRoutes);
});

describe('GET /api/v1/quota', () => {
  it('rejects a request with no user', async () => {
    expect((await get(app, '/api/v1/quota')).status).toBe(401);
  });

  it('reports a trial’s monthly usage against where it stops', async () => {
    await recordApiCall(db, USER);
    await recordApiCall(db, USER);
    const body = await (await get(app, '/api/v1/quota', USER)).json();
    expect(body).toMatchObject({ plan: 'trial', cancelAt: null, trialEndsAt: null, resetsOn: nextResetDate() });
    expect(body.api).toEqual({ used: 2, limit: 10_000, included: 10_000, remaining: 9_998 });
    expect(body.overage).toEqual({ calls: 0, usd: 0 });
  });

  it('reports Team as unbounded, with the calls past the included ones and their cost', async () => {
    await givePlan(db, USER, 'team');
    await db.insert(orgUsage).values({ org_id: USER, period: ukMonthString(new Date()), count: 12_500 });
    const body = await (await get(app, '/api/v1/quota', USER)).json();
    expect(body.plan).toBe('team');
    expect(body.api).toEqual({ used: 12_500, limit: null, included: 10_000, remaining: null });
    expect(body.overage).toEqual({ calls: 2_500, usd: 2.5 });
  });

  it('reports unlimited (null) for enterprise', async () => {
    await givePlan(db, USER, 'enterprise');
    const body = await (await get(app, '/api/v1/quota', USER)).json();
    expect(body.api).toMatchObject({ limit: null, included: null, remaining: null });
    expect(body.overage).toEqual({ calls: 0, usd: 0 });
  });
});
