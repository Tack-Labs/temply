import { beforeEach, describe, expect, it } from 'bun:test';
import { createTestApp, createTestDb, get, givePlan, type TestDb } from '../test/helpers';
import { recordApiCall, nextResetDate } from '../lib/api-quota';
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

  it('reports a free user’s monthly API usage', async () => {
    await recordApiCall(db, USER);
    await recordApiCall(db, USER);
    const body = await (await get(app, '/api/v1/quota', USER)).json();
    expect(body.plan).toBe('free');
    expect(body.api).toEqual({ used: 2, limit: 10000, remaining: 9998 });
    expect(body.resetsOn).toBe(nextResetDate());
  });

  it('reports unlimited (null limit) for enterprise', async () => {
    await givePlan(db, USER, 'enterprise');
    const body = await (await get(app, '/api/v1/quota', USER)).json();
    expect(body.api.limit).toBeNull();
    expect(body.api.remaining).toBeNull();
  });
});
