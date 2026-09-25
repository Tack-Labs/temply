import { beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { apiKeysTable, assets, brands, mails, subscriptions } from '@temply/shared/schema';
import { INCLUDED, limitsFor, MAX_TEMPLATE_PACKS, TRIAL_DAYS } from '@temply/shared/plans';
import { createTestDb, givePlan, lapse, type TestDb } from '../test/helpers';
import {
  checkApiKeyLimit,
  checkBrandLimit,
  checkStorageLimit,
  checkTemplateLimit,
  ensureAccount,
  getPlan,
  getStorageUsed,
  getUsage,
  readOnlyMessage,
  refuseWhenLapsed,
  versionsKept,
} from './billing';

let db: TestDb;

beforeEach(() => {
  db = createTestDb();
});

async function addTemplates(userId: string, count: number) {
  for (let i = 0; i < count; i++) {
    await db.insert(mails).values({
      id: crypto.randomUUID(),
      user_id: userId, org_id: userId,
      title: `Template ${i}`,
      content: '{}',
      short_code: `tpl_${userId}_${crypto.randomUUID().slice(0, 8)}`,
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
      key_hash: `hash-${crypto.randomUUID()}`,
    });
  }
}

const DAY = 86_400_000;

describe('getPlan', () => {
  it('is a trial for a workspace with no row yet', async () => {
    expect(await getPlan(db, 'user_1')).toMatchObject({ plan: 'trial', status: null, trialEndsAt: null, templatePacks: 0 });
  });

  it('is a trial until trial_ends_at, then read-only', async () => {
    const ends = new Date(Date.now() + DAY).toISOString();
    await givePlan(db, 'user_1', 'free', 'active', { trialEndsAt: ends });
    expect(await getPlan(db, 'user_1')).toMatchObject({ plan: 'trial', trialEndsAt: ends });
    expect((await getPlan(db, 'user_1', new Date(Date.now() + 2 * DAY))).plan).toBe('lapsed');
  });

  it('is Team with its seats and packs while the subscription pays', async () => {
    await givePlan(db, 'user_1', 'team', 'active', { seats: 3, templatePacks: 2 });
    expect(await getPlan(db, 'user_1')).toMatchObject({ plan: 'team', status: 'active', seats: 3, templatePacks: 2, cancelAt: null });
  });

  it('keeps the plan while a payment is retried', async () => {
    await givePlan(db, 'user_1', 'enterprise', 'past_due');
    expect(await getPlan(db, 'user_1')).toMatchObject({ plan: 'enterprise', status: 'past_due' });
  });

  it('goes read-only, not back to a trial, when a paid plan ends', async () => {
    await givePlan(db, 'user_1', 'team', 'canceled');
    expect(await getPlan(db, 'user_1')).toMatchObject({ plan: 'lapsed', status: null, seats: null, templatePacks: 0 });
  });

  it('keeps a cancelled plan to its end date, then drops it whether or not the webhook arrived', async () => {
    await givePlan(db, 'user_1', 'team', 'active', { cancelAt: '2099-01-01T00:00:00.000Z' });
    expect(await getPlan(db, 'user_1')).toMatchObject({ plan: 'team', cancelAt: '2099-01-01T00:00:00.000Z' });
    await db.update(subscriptions).set({ cancel_at: '2020-01-01T00:00:00.000Z' }).where(eq(subscriptions.user_id, 'user_1'));
    expect((await getPlan(db, 'user_1')).plan).toBe('lapsed');
  });

  it('does not leak another workspace’s plan', async () => {
    await givePlan(db, 'user_1', 'enterprise');
    expect((await getPlan(db, 'user_2')).plan).toBe('trial');
  });

  it('answers for a legacy row that carries only a user id', async () => {
    await db.insert(subscriptions).values({ id: 'legacy', user_id: 'user_1', plan: 'team', status: 'active', seats: 1 });
    expect((await getPlan(db, 'user_1')).plan).toBe('team');
  });
});

describe('ensureAccount', () => {
  it('starts a trial of TRIAL_DAYS on the first visit', async () => {
    const now = new Date('2026-09-01T12:00:00.000Z');
    await ensureAccount(db, 'org_1', 'user_1', now);
    const [row] = await db.select().from(subscriptions).where(eq(subscriptions.org_id, 'org_1'));
    expect(row).toMatchObject({ user_id: 'user_1', plan: 'free', trial_ends_at: new Date(now.getTime() + TRIAL_DAYS * DAY).toISOString() });
  });

  it('never restarts a trial that has run', async () => {
    await ensureAccount(db, 'org_1', 'user_1', new Date('2026-01-01T00:00:00.000Z'));
    await ensureAccount(db, 'org_1', 'user_2');
    expect(await db.select().from(subscriptions).where(eq(subscriptions.org_id, 'org_1'))).toHaveLength(1);
    expect((await getPlan(db, 'org_1')).plan).toBe('lapsed');
  });

  it('makes one row when two first visits race', async () => {
    await Promise.all([ensureAccount(db, 'org_1', 'user_1'), ensureAccount(db, 'org_1', 'user_2')]);
    expect(await db.select().from(subscriptions).where(eq(subscriptions.org_id, 'org_1'))).toHaveLength(1);
  });
});

describe('refuseWhenLapsed', () => {
  const ctx = (method: string, orgRole: 'admin' | 'member' = 'admin') => ({ request: new Request('http://x/', { method }), db, orgId: 'org_1', orgRole });

  it('lets a lapsed workspace read and delete', async () => {
    await lapse(db, 'org_1');
    for (const method of ['GET', 'HEAD', 'OPTIONS', 'DELETE']) expect(await refuseWhenLapsed(ctx(method))).toBeUndefined();
  });

  it('refuses a lapsed workspace’s writes with 402, telling a member to ask an admin', async () => {
    await lapse(db, 'org_1');
    const admin = await refuseWhenLapsed(ctx('POST'));
    expect(admin?.status).toBe(402);
    expect((await admin!.json()).message).toBe(readOnlyMessage('admin'));
    const member = await refuseWhenLapsed(ctx('PUT', 'member'));
    expect((await member!.json()).message).toBe(readOnlyMessage('member'));
  });

  it('lets a trial or a paying workspace write', async () => {
    expect(await refuseWhenLapsed(ctx('POST'))).toBeUndefined();
    await givePlan(db, 'org_1', 'team');
    expect(await refuseWhenLapsed(ctx('PATCH'))).toBeUndefined();
  });
});

describe('getUsage', () => {
  it('counts only the rows belonging to the workspace', async () => {
    await addTemplates('user_1', 2);
    await addTemplates('user_2', 5);
    await addApiKeys('user_1', 3);

    expect(await getUsage(db, 'user_1')).toEqual({ templates: 2, apiKeys: 3 });
  });

  it('reports zero for a workspace with nothing stored', async () => {
    expect(await getUsage(db, 'nobody')).toEqual({ templates: 0, apiKeys: 0 });
  });
});

describe('checkTemplateLimit', () => {
  it('allows a trial below the included templates', async () => {
    await addTemplates('user_1', INCLUDED.templates - 1);
    expect(await checkTemplateLimit(db, 'user_1')).toEqual({ allowed: true });
  });

  it('blocks a trial at the included templates and says what gets more', async () => {
    await addTemplates('user_1', INCLUDED.templates);
    expect(await checkTemplateLimit(db, 'user_1')).toEqual({
      allowed: false,
      message: "You've used all 10 templates in the trial. Subscribe, then add a template pack for 10 more.",
    });
  });

  it('offers Team a pack when it is full', async () => {
    await givePlan(db, 'user_1', 'team');
    await addTemplates('user_1', INCLUDED.templates);
    expect((await checkTemplateLimit(db, 'user_1')).message).toBe("You've used all 10 templates on your plan. Add a template pack for 10 more.");
  });

  it('counts each pack', async () => {
    await givePlan(db, 'user_1', 'team', 'active', { templatePacks: 2 });
    await addTemplates('user_1', 29);
    expect(await checkTemplateLimit(db, 'user_1')).toEqual({ allowed: true });
    await addTemplates('user_1', 1);
    expect((await checkTemplateLimit(db, 'user_1')).allowed).toBe(false);
  });

  it('stops offering packs at the most a workspace can buy', async () => {
    await givePlan(db, 'user_1', 'team', 'active', { templatePacks: MAX_TEMPLATE_PACKS });
    await addTemplates('user_1', limitsFor('team', MAX_TEMPLATE_PACKS).maxTemplates);
    expect((await checkTemplateLimit(db, 'user_1')).message).toContain('Delete one you no longer use');
  });

  it('never caps enterprise', async () => {
    await givePlan(db, 'user_1', 'enterprise');
    await addTemplates('user_1', INCLUDED.templates + 1);
    expect(await checkTemplateLimit(db, 'user_1')).toEqual({ allowed: true });
  });
});

describe('checkApiKeyLimit', () => {
  it('allows keys up to the cap, then blocks the next', async () => {
    const { maxApiKeys } = limitsFor('trial');
    await addApiKeys('user_1', maxApiKeys - 1);
    expect(await checkApiKeyLimit(db, 'user_1')).toEqual({ allowed: true });
    await addApiKeys('user_1', 1);
    expect(await checkApiKeyLimit(db, 'user_1')).toEqual({
      allowed: false,
      message: `You can have ${maxApiKeys} live API keys. Revoke one you no longer use to make another.`,
    });
  });

  it('never caps enterprise', async () => {
    await givePlan(db, 'user_1', 'enterprise');
    await addApiKeys('user_1', limitsFor('team').maxApiKeys + 20);
    expect(await checkApiKeyLimit(db, 'user_1')).toEqual({ allowed: true });
  });
});

describe('checkBrandLimit', () => {
  it('blocks at the brand cap', async () => {
    const limit = limitsFor('trial').maxBrands;
    for (let i = 0; i < limit - 1; i++) await db.insert(brands).values({ id: crypto.randomUUID(), user_id: 'u', org_id: 'u', name: `B${i}`, theme: '{}' });
    expect((await checkBrandLimit(db, 'u')).allowed).toBe(true);
    await db.insert(brands).values({ id: crypto.randomUUID(), user_id: 'u', org_id: 'u', name: 'last', theme: '{}' });
    expect(await checkBrandLimit(db, 'u')).toEqual({ allowed: false, message: `You can save ${limit} brands. Delete one to save another.` });
  });
});

describe('versionsKept', () => {
  it('keeps the included versions without a pack, and the pack’s with one', async () => {
    expect(await versionsKept(db, 'user_1')).toBe(INCLUDED.versionsPerTemplate);
    await givePlan(db, 'user_2', 'team');
    expect(await versionsKept(db, 'user_2')).toBe(INCLUDED.versionsPerTemplate);
    await givePlan(db, 'user_3', 'team', 'active', { templatePacks: 1 });
    expect(await versionsKept(db, 'user_3')).toBe(50);
  });
});

describe('checkStorageLimit', () => {
  const MB = 1024 * 1024;
  const seed = (userId: string, bytes: number) =>
    db.insert(assets).values({
      id: crypto.randomUUID(), user_id: userId, org_id: userId, imagekit_file_id: 'f', url: 'https://ik.imagekit.io/t/x.png',
      name: 'x.png', mime: 'image/png', bytes,
    });

  it('allows an upload that fits under the trial’s 100 MB', async () => {
    await seed('u_trial', 99 * MB);
    expect((await checkStorageLimit(db, 'u_trial', MB)).allowed).toBe(true);
  });

  it('blocks the upload that would cross the line, naming the numbers and what a plan holds', async () => {
    await seed('u_trial', 99 * MB);
    expect(await checkStorageLimit(db, 'u_trial', 2 * MB)).toEqual({
      allowed: false,
      message: 'Storage is full — 99 MB of 100 MB used. Delete images in your library, or subscribe for 1 GB.',
    });
  });

  it('does not tell Team to subscribe', async () => {
    await givePlan(db, 'u_team', 'team');
    await seed('u_team', 1024 * MB);
    expect((await checkStorageLimit(db, 'u_team', 1)).message).toBe('Storage is full — 1 GB of 1 GB used. Delete images in your library.');
  });

  it('never blocks enterprise', async () => {
    await givePlan(db, 'u_ent', 'enterprise');
    await seed('u_ent', 5 * 1024 * MB);
    expect((await checkStorageLimit(db, 'u_ent', 1)).allowed).toBe(true);
  });

  it("sums only the caller's rows", async () => {
    await seed('u_other', 50 * MB);
    expect(await getStorageUsed(db, 'u_trial')).toBe(0);
  });
});
