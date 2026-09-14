import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { apiKeysTable, assets, brands, mails } from '@temply/shared/schema';
import { createTestDb, givePlan, type TestDb } from '../test/helpers';
import {
  checkApiKeyLimit,
  checkBrandLimit,
  checkStorageLimit,
  checkTemplateLimit,
  getPlan,
  getStorageUsed,
  getStripe,
  getUsage,
  planLimits,
  shouldSnapshot,
} from './billing';

let db: TestDb;

beforeEach(() => {
  db = createTestDb();
});

describe('getStripe', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });

  it('talks to Stripe unless told otherwise', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    delete process.env.STRIPE_API_BASE;
    const stripe = getStripe();
    expect(stripe.getApiField('host')).toBe('api.stripe.com');
  });

  it('talks to the host STRIPE_API_BASE names, so a test can stand a fake in', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    process.env.STRIPE_API_BASE = 'http://127.0.0.1:3998';
    const stripe = getStripe();
    expect(stripe.getApiField('host')).toBe('127.0.0.1');
    expect(stripe.getApiField('port')).toBe(3998);
    expect(stripe.getApiField('protocol')).toBe('http');
  });
});

async function addTemplates(userId: string, count: number) {
  for (let i = 0; i < count; i++) {
    await db.insert(mails).values({
      id: crypto.randomUUID(),
      user_id: userId, org_id: userId,
      title: `Template ${i}`,
      content: '{}',
      short_code: `tpl_${userId}_${i}`,
    });
  }
}

async function addApiKeys(userId: string, count: number) {
  for (let i = 0; i < count; i++) {
    await db.insert(apiKeysTable).values({
      id: crypto.randomUUID(),
      user_id: userId, org_id: userId,
      name: `Key ${i}`,
      key_prefix: 'tply_live_aaaa',
      key_hash: `hash-${userId}-${i}`,
    });
  }
}

describe('getPlan', () => {
  it('falls back to free when the user has no subscription row', async () => {
    expect(await getPlan(db, 'user_1')).toEqual({ plan: 'free', status: 'active', cancelAt: null });
  });

  it('returns the paid plan when the subscription is active', async () => {
    await givePlan(db, 'user_1', 'pro');
    expect(await getPlan(db, 'user_1')).toEqual({ plan: 'pro', status: 'active', cancelAt: null });
  });

  it('downgrades to free when a paid subscription is no longer active', async () => {
    await givePlan(db, 'user_1', 'enterprise', 'past_due');
    expect(await getPlan(db, 'user_1')).toEqual({ plan: 'free', status: 'active', cancelAt: null });
  });

  it('does not leak another user’s plan', async () => {
    await givePlan(db, 'user_1', 'enterprise');
    expect(await getPlan(db, 'user_2')).toEqual({ plan: 'free', status: 'active', cancelAt: null });
  });
});

describe('getUsage', () => {
  it('counts only the rows belonging to the user', async () => {
    await addTemplates('user_1', 2);
    await addTemplates('user_2', 5);
    await addApiKeys('user_1', 3);

    expect(await getUsage(db, 'user_1')).toEqual({ templates: 2, apiKeys: 3 });
  });

  it('reports zero for a user with nothing stored', async () => {
    expect(await getUsage(db, 'nobody')).toEqual({ templates: 0, apiKeys: 0 });
  });
});

describe('checkTemplateLimit', () => {
  it('allows a free user below the cap', async () => {
    await addTemplates('user_1', planLimits.free.maxTemplates - 1);
    expect(await checkTemplateLimit(db, 'user_1')).toEqual({ allowed: true });
  });

  it('blocks a free user at the cap', async () => {
    await addTemplates('user_1', planLimits.free.maxTemplates);
    const result = await checkTemplateLimit(db, 'user_1');
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('Upgrade');
  });

  it('lets a paid user go past the free cap', async () => {
    await givePlan(db, 'user_1', 'pro');
    await addTemplates('user_1', planLimits.free.maxTemplates + 1);
    expect(await checkTemplateLimit(db, 'user_1')).toEqual({ allowed: true });
  });
});

describe('checkApiKeyLimit', () => {
  it('allows a free user one key, then blocks the next', async () => {
    expect(await checkApiKeyLimit(db, 'user_1')).toEqual({ allowed: true });
    await addApiKeys('user_1', planLimits.free.maxApiKeys);
    const result = await checkApiKeyLimit(db, 'user_1');
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('API keys');
  });

  it('allows a pro user below their cap', async () => {
    await givePlan(db, 'user_1', 'pro');
    await addApiKeys('user_1', planLimits.pro.maxApiKeys - 1);
    expect(await checkApiKeyLimit(db, 'user_1')).toEqual({ allowed: true });
  });

  it('blocks a pro user at their cap', async () => {
    await givePlan(db, 'user_1', 'pro');
    await addApiKeys('user_1', planLimits.pro.maxApiKeys);
    const result = await checkApiKeyLimit(db, 'user_1');
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('API keys');
  });

  it('never caps an enterprise user', async () => {
    await givePlan(db, 'user_1', 'enterprise');
    await addApiKeys('user_1', planLimits.pro.maxApiKeys + 20);
    expect(await checkApiKeyLimit(db, 'user_1')).toEqual({ allowed: true });
  });
});

describe('checkBrandLimit', () => {
  it('blocks a free user at 1 brand', async () => {
    const db = createTestDb();
    expect((await checkBrandLimit(db, 'u')).allowed).toBe(true);
    await db.insert(brands).values({ id: crypto.randomUUID(), user_id: 'u', org_id: 'u', name: 'B1', theme: '{}' });
    const res = await checkBrandLimit(db, 'u');
    expect(res.allowed).toBe(false);
    expect(res.message).toContain('Upgrade');
  });

  it('lets a pro user reach 5', async () => {
    const db = createTestDb();
    await givePlan(db, 'u', 'pro');
    for (let i = 0; i < 5; i++) await db.insert(brands).values({ id: crypto.randomUUID(), user_id: 'u', org_id: 'u', name: `B${i}`, theme: '{}' });
    expect((await checkBrandLimit(db, 'u')).allowed).toBe(false);
  });
});

describe('shouldSnapshot', () => {
  it('is off for free users', async () => {
    expect(await shouldSnapshot(db, 'user_1')).toBe(false);
  });

  it('is on for paid users', async () => {
    await givePlan(db, 'user_1', 'pro');
    expect(await shouldSnapshot(db, 'user_1')).toBe(true);
  });
});

describe('checkStorageLimit', () => {
  const seed = (userId: string, bytes: number) =>
    db.insert(assets).values({
      id: crypto.randomUUID(), user_id: userId, org_id: userId, imagekit_file_id: 'f', url: 'https://ik.imagekit.io/t/x.png',
      name: 'x.png', mime: 'image/png', bytes,
    });

  it('allows an upload that fits under the free 50 MB', async () => {
    await seed('u_free', 49 * 1024 * 1024);
    const result = await checkStorageLimit(db, 'u_free', 1024 * 1024);
    expect(result.allowed).toBe(true);
  });

  it('blocks the upload that would cross the line, naming the numbers', async () => {
    await seed('u_free', 49 * 1024 * 1024);
    const result = await checkStorageLimit(db, 'u_free', 2 * 1024 * 1024);
    expect(result.allowed).toBe(false);
    expect(result.message).toBe('Storage is full — 49 MB of 50 MB used. Delete images in your library or upgrade.');
  });

  it('never blocks enterprise', async () => {
    await givePlan(db, 'u_ent', 'enterprise');
    await seed('u_ent', 5 * 1024 * 1024 * 1024);
    expect((await checkStorageLimit(db, 'u_ent', 1)).allowed).toBe(true);
  });

  it("sums only the caller's rows", async () => {
    await seed('u_other', 50 * 1024 * 1024);
    expect(await getStorageUsed(db, 'u_free')).toBe(0);
  });
});
