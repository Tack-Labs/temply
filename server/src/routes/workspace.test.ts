import { beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { apiKeysTable, apiUsage, brands, mails, orgPrefs, orgUsage, subscriptions, userPrefs } from '@temply/shared/schema';
import { generateApiKey, generateShortCode } from '../lib/codes';
import { createTestApp, createTestDb, del, get, post, type TestDb } from '../test/helpers';
import { apiKeysRoutes } from './api-keys';
import { billingRoutes } from './billing';
import { publicRoutes } from './public';
import { templatesRoutes } from './templates';
import { workspaceRoutes } from './workspace';

let db: TestDb;
let app: any;

const ALICE = 'user_alice';
const BOB = 'user_bob';
const ACME = 'org_acme';

/** Alice and Bob both in Acme; Bob as a member, Alice as admin. */
const inAcme = (role: 'admin' | 'member' = 'admin') => ({ 'x-org-id': ACME, 'x-org-role': role });

beforeEach(() => {
  db = createTestDb();
  app = createTestApp(
    db,
    new Elysia().use(templatesRoutes).use(apiKeysRoutes).use(billingRoutes).use(publicRoutes).use(workspaceRoutes),
  );
});

describe('one organization, two people', () => {
  it('a template made by one member is listed for the other', async () => {
    const res = await post(app, '/api/v1/templates', { title: 'Welcome', content: '{"type":"doc"}' }, ALICE, inAcme());
    expect(res.status).toBe(200);

    const { templates } = await (await get(app, '/api/v1/templates', BOB, inAcme('member'))).json();
    expect(templates.map((t: { title: string }) => t.title)).toEqual(['Welcome']);
  });

  it('and not for someone in another organization', async () => {
    await post(app, '/api/v1/templates', { title: 'Welcome', content: '{"type":"doc"}' }, ALICE, inAcme());
    const { templates } = await (await get(app, '/api/v1/templates', BOB)).json();
    expect(templates).toEqual([]);
  });

  it('a member can publish; only an admin can touch keys and billing', async () => {
    const { template } = await (await post(app, '/api/v1/templates', { title: 'Welcome', content: '{"type":"doc"}' }, ALICE, inAcme())).json();
    expect((await post(app, `/api/v1/templates/${template.id}/publish`, {}, BOB, inAcme('member'))).status).toBe(200);

    const key = await post(app, '/api/v1/api-keys', { name: 'Staging', mode: 'test' }, BOB, inAcme('member'));
    expect(key.status).toBe(403);
    expect((await key.json()).code).toBe('admin-only');
    expect((await del(app, '/api/v1/api-keys/some-id', BOB, inAcme('member'))).status).toBe(403);
    expect((await post(app, '/api/v1/billing/checkout', { plan: 'pro' }, BOB, inAcme('member'))).status).toBe(403);
    expect((await post(app, '/api/v1/billing/portal', {}, BOB, inAcme('member'))).status).toBe(403);

    expect((await post(app, '/api/v1/api-keys', { name: 'Staging', mode: 'test' }, ALICE, inAcme())).status).toBe(200);
  });
});

describe('no workspace', () => {
  it('is a named 403 so the client can send the user to onboarding', async () => {
    const res = await get(app, '/api/v1/templates', ALICE, { 'x-org-id': '' });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('no-workspace');
  });
});

describe('POST /api/v1/workspace/adopt', () => {
  async function legacyRows(userId: string) {
    await db.insert(mails).values({ id: 'legacy-mail', user_id: userId, title: 'Old', content: '{"type":"doc"}', short_code: generateShortCode() });
    const { prefix, hash } = generateApiKey();
    await db.insert(apiKeysTable).values({ id: 'legacy-key', user_id: userId, name: 'Old key', key_prefix: prefix, key_hash: hash });
    await db.insert(brands).values({ id: 'legacy-brand', user_id: userId, name: 'Old brand', theme: '{}' });
    await db.insert(subscriptions).values({ id: 'legacy-sub', user_id: userId, plan: 'pro', status: 'active' });
    await db.insert(apiUsage).values({ user_id: userId, period: '2026-09', count: 7 });
    await db.insert(userPrefs).values({ user_id: userId, default_brand_id: 'legacy-brand' });
  }

  it('moves everything the caller made before organizations into the active one', async () => {
    await legacyRows(ALICE);
    const res = await post(app, '/api/v1/workspace/adopt', {}, ALICE, inAcme());
    expect(res.status).toBe(200);
    expect((await res.json()).moved).toBe(3);

    const [mail] = await db.select().from(mails).where(eq(mails.id, 'legacy-mail'));
    expect(mail.org_id).toBe(ACME);
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, 'legacy-sub'));
    expect(sub.org_id).toBe(ACME);
    const [usage] = await db.select().from(orgUsage).where(eq(orgUsage.org_id, ACME));
    expect(usage).toMatchObject({ period: '2026-09', count: 7 });
    const [prefs] = await db.select().from(orgPrefs).where(eq(orgPrefs.org_id, ACME));
    expect(prefs.default_brand_id).toBe('legacy-brand');
    expect(await db.select().from(apiUsage)).toEqual([]);
    expect(await db.select().from(userPrefs)).toEqual([]);

    // The org now lists it, and Bob sees it too.
    const { templates } = await (await get(app, '/api/v1/templates', BOB, inAcme('member'))).json();
    expect(templates.map((t: { id: string }) => t.id)).toEqual(['legacy-mail']);
  });

  it('is idempotent', async () => {
    await legacyRows(ALICE);
    await post(app, '/api/v1/workspace/adopt', {}, ALICE, inAcme());
    const again = await (await post(app, '/api/v1/workspace/adopt', {}, ALICE, inAcme())).json();
    expect(again.moved).toBe(0);
    expect(await db.select().from(orgUsage)).toHaveLength(1);
  });

  it('keeps the org’s own plan when it already has one', async () => {
    await db.insert(subscriptions).values({ id: 'org-sub', user_id: BOB, org_id: ACME, plan: 'enterprise', status: 'active' });
    await legacyRows(ALICE);
    await post(app, '/api/v1/workspace/adopt', {}, ALICE, inAcme());
    const rows = await db.select().from(subscriptions).where(eq(subscriptions.org_id, ACME));
    expect(rows).toHaveLength(1);
    expect(rows[0].plan).toBe('enterprise');
  });
});

describe('a key from before organizations', () => {
  it('still renders its owner’s legacy templates until adoption', async () => {
    const { fullKey, prefix, hash } = generateApiKey();
    await db.insert(apiKeysTable).values({ id: 'legacy-key', user_id: ALICE, name: 'Production', key_prefix: prefix, key_hash: hash });
    await db.insert(subscriptions).values({ id: 'legacy-sub', user_id: ALICE, plan: 'pro', status: 'active' });
    const shortCode = generateShortCode();
    const stamp = '2026-01-01T00:00:00.000Z';
    await db.insert(mails).values({ id: 'legacy-mail', user_id: ALICE, title: 'Old', content: '{"type":"doc"}', short_code: shortCode, updated_at: stamp, published_content: '{"type":"doc"}', published_at: stamp });

    const res = await app.handle(new Request(`http://localhost/api/public/v1/templates/${shortCode}`, { headers: { Authorization: `Bearer ${fullKey}` } }));
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe('Old');
  });
});
