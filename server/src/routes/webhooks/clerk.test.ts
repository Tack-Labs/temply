import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { apiKeysTable, assets, brands, mails, orgPrefs, orgUsage, subscriptions, templateVersions } from '@temply/shared/schema';
import { createTestApp, createTestDb, type TestDb } from '../../test/helpers';
import { fakeStripe, PRICES } from '../../test/fake-stripe';
import { purgeOrganization } from '../../lib/purge';
import { clerkWebhookRoutes } from './clerk';

const SECRET_BYTES = Buffer.from('a'.repeat(32));
const SIGNING_SECRET = `whsec_${SECRET_BYTES.toString('base64')}`;

let db: TestDb;
let app: any;

beforeEach(() => {
  db = createTestDb();
  app = createTestApp(db, clerkWebhookRoutes);
  process.env.CLERK_WEBHOOK_SIGNING_SECRET = SIGNING_SECRET;
});

afterEach(() => {
  delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
});

/** Standard Webhooks: v1,base64(HMAC-SHA256(secret, `${id}.${timestamp}.${body}`)). */
function signed(body: string, secret = SECRET_BYTES) {
  const id = 'msg_test';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', secret).update(`${id}.${timestamp}.${body}`).digest('base64');
  return new Request('http://localhost/api/webhooks/clerk', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${signature}`,
    },
    body,
  });
}

async function seedOrg(orgId: string) {
  const owner = `user_of_${orgId}`;
  const mailId = crypto.randomUUID();
  await db.insert(mails).values({ id: mailId, user_id: owner, org_id: orgId, title: 'Welcome', content: '{}', short_code: `tpl_${orgId}` });
  await db.insert(templateVersions).values({ id: crypto.randomUUID(), template_id: mailId, user_id: owner, org_id: orgId, title: 'Welcome', content: '{}', version_number: 1 });
  await db.insert(apiKeysTable).values({ id: crypto.randomUUID(), user_id: owner, org_id: orgId, name: 'Prod', key_prefix: 'tply_', key_hash: `hash_${orgId}`, mode: 'live' });
  await db.insert(brands).values({ id: crypto.randomUUID(), user_id: owner, org_id: orgId, name: 'Look', theme: '{}' });
  await db.insert(assets).values({ id: crypto.randomUUID(), user_id: owner, org_id: orgId, imagekit_file_id: `file_${orgId}`, url: 'https://ik/x.png', name: 'x.png', mime: 'image/png', bytes: 10 });
  await db.insert(subscriptions).values({ id: crypto.randomUUID(), user_id: owner, org_id: orgId, plan: 'team', status: 'active', stripe_customer_id: `cus_${orgId}`, stripe_subscription_id: `sub_${orgId}`, seats: 1 });
  await db.insert(orgUsage).values({ org_id: orgId, period: '2026-09', count: 5 });
  await db.insert(orgPrefs).values({ org_id: orgId, default_brand_id: 'classic' });
}

async function countFor(orgId: string) {
  const n = async (rows: unknown[]) => rows.length;
  return {
    mails: await n(await db.select().from(mails).where(eq(mails.org_id, orgId))),
    versions: await n(await db.select().from(templateVersions).where(eq(templateVersions.org_id, orgId))),
    keys: await n(await db.select().from(apiKeysTable).where(eq(apiKeysTable.org_id, orgId))),
    brands: await n(await db.select().from(brands).where(eq(brands.org_id, orgId))),
    assets: await n(await db.select().from(assets).where(eq(assets.org_id, orgId))),
    subs: await n(await db.select().from(subscriptions).where(eq(subscriptions.org_id, orgId))),
    usage: await n(await db.select().from(orgUsage).where(eq(orgUsage.org_id, orgId))),
    prefs: await n(await db.select().from(orgPrefs).where(eq(orgPrefs.org_id, orgId))),
  };
}

describe('POST /api/webhooks/clerk', () => {
  it('rejects a bad signature', async () => {
    const res = await app.handle(signed(JSON.stringify({ type: 'organization.deleted', data: { id: 'org_x' } }), Buffer.from('b'.repeat(32))));
    expect(res.status).toBe(400);
  });

  it('answers 503 until the secret is configured', async () => {
    delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    const res = await app.handle(signed(JSON.stringify({ type: 'organization.deleted', data: { id: 'org_x' } })));
    expect(res.status).toBe(503);
  });

  it('purges a deleted organization and leaves its neighbours alone', async () => {
    await seedOrg('org_gone');
    await seedOrg('org_stays');

    const res = await app.handle(signed(JSON.stringify({ type: 'organization.deleted', object: 'event', data: { id: 'org_gone', object: 'organization', deleted: true } })));
    expect(res.status).toBe(200);

    const gone = await countFor('org_gone');
    expect(Object.values(gone).every((n) => n === 0)).toBe(true);
    const stays = await countFor('org_stays');
    expect(Object.values(stays).every((n) => n === 1)).toBe(true);
  });

  it('ignores events it does not handle', async () => {
    await seedOrg('org_a');
    const res = await app.handle(signed(JSON.stringify({ type: 'organization.updated', object: 'event', data: { id: 'org_a', object: 'organization' } })));
    expect(res.status).toBe(200);
    expect((await countFor('org_a')).mails).toBe(1);
  });
});

describe('Stripe, from the Clerk webhook', () => {
  let stripe: ReturnType<typeof fakeStripe>;
  beforeEach(() => { stripe = fakeStripe(); });
  afterEach(() => stripe.restore());

  const membership = (type: string, orgId: string) =>
    signed(JSON.stringify({ type, object: 'event', data: { id: 'orgmem_1', object: 'organization_membership', role: 'org:member', organization: { id: orgId, object: 'organization' } } }));

  it('cancels a deleted organization’s subscription', async () => {
    await seedOrg('org_gone');
    stripe.subscription('cus_org_gone', { id: 'sub_org_gone' });
    expect((await app.handle(signed(JSON.stringify({ type: 'organization.deleted', object: 'event', data: { id: 'org_gone', deleted: true } })))).status).toBe(200);
    expect(stripe.calls).toContainEqual({ method: 'DELETE', path: '/v1/subscriptions/sub_org_gone', form: {} });
  });

  it('bills a Team workspace for the members Clerk counts when someone joins or leaves', async () => {
    await seedOrg('org_team');
    const sub = stripe.subscription('cus_org_team', { id: 'sub_org_team', seats: 1 });
    stripe.members.set('org_team', 3);
    expect((await app.handle(membership('organizationMembership.created', 'org_team'))).status).toBe(200);
    expect(sub.items.data.find((i) => i.price.id === PRICES.seat)?.quantity).toBe(3);
    expect((await db.select().from(subscriptions).where(eq(subscriptions.org_id, 'org_team')))[0].seats).toBe(3);

    stripe.members.set('org_team', 2);
    await app.handle(membership('organizationMembership.deleted', 'org_team'));
    expect((await db.select().from(subscriptions).where(eq(subscriptions.org_id, 'org_team')))[0].seats).toBe(2);
  });

  it('asks Stripe nothing for a workspace without a plan', async () => {
    expect((await app.handle(membership('organizationMembership.created', 'org_trial'))).status).toBe(200);
    expect(stripe.calls).toHaveLength(0);
  });
});

describe('purgeOrganization', () => {
  it('cancels the subscription and deletes the files, and still clears the rows when either fails', async () => {
    await seedOrg('org_p');
    const cancelled: string[] = [];
    const report = await purgeOrganization(db, 'org_p', {
      cancelSubscription: async (id) => { cancelled.push(id); },
      deleteFile: async () => { throw new Error('image host down'); },
    });
    expect(cancelled).toEqual(['sub_org_p']);
    expect(report.subscriptionCancelled).toBe(true);
    expect(report.filesDeleted).toBe(0);
    expect(report.rows).toBe(6);
    expect((await countFor('org_p')).assets).toBe(0);
  });
});
