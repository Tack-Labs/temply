import { beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { apiKeysTable } from '@temply/shared/schema';
import { hashApiKey } from '../lib/codes';
import { createTestApp, createTestDb, del, get, givePlan, post, type TestDb } from '../test/helpers';
import { apiKeysRoutes } from './api-keys';

let db: TestDb;
let app: any;

const OWNER = 'user_owner';
const OTHER = 'user_other';

beforeEach(() => {
  db = createTestDb();
  app = createTestApp(db, apiKeysRoutes);
});

async function createKey(userId: string, name = 'Production') {
  const res = await post(app, '/api/v1/api-keys', { name }, userId);
  return { status: res.status, body: await res.json() };
}

describe('authentication', () => {
  it('rejects every api-key route when the request has no user', async () => {
    const responses = await Promise.all([
      get(app, '/api/v1/api-keys'),
      post(app, '/api/v1/api-keys', { name: 'Production' }),
      del(app, '/api/v1/api-keys/some-id'),
    ]);

    for (const res of responses) expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/api-keys', () => {
  it('lets a free user create one key, then blocks the second', async () => {
    expect((await createKey(OWNER)).status).toBe(200);
    const { status } = await createKey(OWNER, 'Second');
    expect(status).toBe(402);
  });

  it('returns the full key exactly once and stores only its hash', async () => {
    await givePlan(db, OWNER, 'pro');
    const { body } = await createKey(OWNER);

    expect(body.key.full_key).toMatch(/^tply_live_[0-9A-Za-z]{32}$/);
    expect(body.key.key_prefix).toBe(body.key.full_key.slice(0, 14));

    const [stored] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.id, body.key.id));
    expect(stored.key_hash).toBe(hashApiKey(body.key.full_key));
    expect(JSON.stringify(stored)).not.toContain(body.key.full_key);
  });

  it('a revoked key gives its slot back', async () => {
    const { body } = await createKey(OWNER);
    expect((await createKey(OWNER, 'Second')).status).toBe(402);

    await del(app, `/api/v1/api-keys/${body.key.id}`, OWNER);

    expect((await createKey(OWNER, 'Second')).status).toBe(200);
  });

  it('mints a test key on the free plan, outside the live-key cap', async () => {
    const res = await post(app, '/api/v1/api-keys', { name: 'Staging', mode: 'test' }, OWNER);
    expect(res.status).toBe(200);
    const { key } = await res.json();
    expect(key.full_key).toMatch(/^tply_test_[0-9A-Za-z]{32}$/);
    expect(key.key_prefix).toBe(key.full_key.slice(0, 14));
    expect(key.mode).toBe('test');

    // The live cap is untouched: a free user still gets their one live key.
    expect((await createKey(OWNER)).status).toBe(200);
  });

  it('lists the mode of each key', async () => {
    await post(app, '/api/v1/api-keys', { name: 'Staging', mode: 'test' }, OWNER);
    const { keys } = await (await get(app, '/api/v1/api-keys', OWNER)).json();
    expect(keys[0].mode).toBe('test');
  });

  it('rejects an empty name', async () => {
    await givePlan(db, OWNER, 'pro');
    const res = await post(app, '/api/v1/api-keys', { name: '' }, OWNER);
    expect(res.status).toBe(400);
  });

  it('stops a pro user after 5 keys', async () => {
    await givePlan(db, OWNER, 'pro');
    for (let i = 0; i < 5; i++) expect((await createKey(OWNER, `Key ${i}`)).status).toBe(200);

    const { status, body } = await createKey(OWNER, 'Sixth');
    expect(status).toBe(402);
    expect(body.message).toContain('API keys');
  });
});

describe('GET /api/v1/api-keys', () => {
  it('never returns the hash or the full key', async () => {
    await givePlan(db, OWNER, 'pro');
    const { body: created } = await createKey(OWNER);

    const { keys } = await (await get(app, '/api/v1/api-keys', OWNER)).json();
    expect(keys).toHaveLength(1);
    expect(keys[0].key_hash).toBeUndefined();
    expect(JSON.stringify(keys)).not.toContain(created.key.full_key);
  });

  it('lists only the caller’s keys', async () => {
    await givePlan(db, OWNER, 'pro');
    await givePlan(db, OTHER, 'pro');
    await createKey(OWNER, 'Mine');
    await createKey(OTHER, 'Theirs');

    const { keys } = await (await get(app, '/api/v1/api-keys', OWNER)).json();
    expect(keys).toHaveLength(1);
    expect(keys[0].name).toBe('Mine');
  });
});

describe('DELETE /api/v1/api-keys/:id', () => {
  it('revokes the key rather than deleting the row', async () => {
    await givePlan(db, OWNER, 'pro');
    const { body } = await createKey(OWNER);

    await del(app, `/api/v1/api-keys/${body.key.id}`, OWNER);

    const [stored] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.id, body.key.id));
    expect(stored.revoked_at).not.toBeNull();
  });

  it('will not revoke another user’s key', async () => {
    await givePlan(db, OWNER, 'pro');
    const { body } = await createKey(OWNER);

    await del(app, `/api/v1/api-keys/${body.key.id}`, OTHER);

    const [stored] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.id, body.key.id));
    expect(stored.revoked_at).toBeNull();
  });
});
