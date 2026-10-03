import { beforeEach, describe, expect, it } from 'bun:test';
import { assets, mails, orgUsage } from '@temply/shared/schema';
import { ADMIN_PAGE_SIZE } from '@temply/shared/admin';
import { ukMonthString } from '../lib/api-quota';
import type { AdminDirectory } from '../lib/platform-admin';
import { createTestApp, createTestDb, get, givePlan, type TestDb } from '../test/helpers';
import { createAdminRoutes } from './admin';

let db: TestDb;
let app: ReturnType<typeof createTestApp>;
let flag: boolean;
let membership: boolean;
let failClerk: boolean;
let lists: { limit: number; offset: number; query: string }[];
const MAIN = { 'x-org-id': 'org_temply' };
const organizations = [
  { id: 'org_team', name: 'Team customer', createdAt: 1_790_000_000_000, membersCount: 3 },
  { id: 'org_trial', name: 'Trial customer', createdAt: 1_790_000_000_000, membersCount: 1 },
  { id: 'org_new', name: 'New signup', createdAt: 1_790_000_000_000, membersCount: 0 },
  { id: 'org_lapsed', name: 'Expired customer', createdAt: 1_790_000_000_000 },
];

beforeEach(async () => {
  db = await createTestDb();
  flag = true;
  membership = true;
  failClerk = false;
  lists = [];
  const directory: AdminDirectory = {
    async isPlatformOrganization(orgId) {
      if (failClerk) throw new Error('Directory unavailable');
      return orgId === 'org_temply' && flag;
    },
    async hasAdminMembership(_orgId, userId) { return userId === 'user_owner' && membership; },
    async list(options) {
      lists.push(options);
      return { data: options.offset ? [] : organizations, totalCount: 40 };
    },
  };
  app = createTestApp(db, createAdminRoutes(directory));
});

describe('platform admin authorization', () => {
  it('requires sign-in and rejects customer admins, members and missing workspaces', async () => {
    expect((await get(app, '/api/v1/admin/organizations')).status).toBe(401);
    for (const [user, headers] of [
      ['user_customer', { 'x-org-id': 'org_team' }],
      ['user_owner', { ...MAIN, 'x-org-role': 'member' }],
      ['user_owner', { 'x-org-id': '' }],
      ['user_other', MAIN],
    ] as const) {
      const response = await get(app, '/api/v1/admin/organizations', user, headers);
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe('platform-admin-only');
    }
    expect(lists).toHaveLength(0);
  });

  it('revokes access immediately when the flag or membership changes', async () => {
    expect((await get(app, '/api/v1/admin/organizations', 'user_owner', MAIN)).status).toBe(200);
    flag = false;
    expect((await get(app, '/api/v1/admin/organizations', 'user_owner', MAIN)).status).toBe(403);
    flag = true;
    membership = false;
    expect((await get(app, '/api/v1/admin/organizations', 'user_owner', MAIN)).status).toBe(403);
    expect(lists).toHaveLength(1);
  });

  it('fails closed when Clerk is unavailable', async () => {
    failClerk = true;
    expect((await get(app, '/api/v1/admin/organizations', 'user_owner', MAIN)).status).toBe(500);
    expect(lists).toHaveLength(0);
  });

  it('only advertises the admin link to authorized users, and disables caching', async () => {
    const response = await get(app, '/api/v1/admin/access', 'user_owner', MAIN);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ allowed: true });
    expect(await (await get(app, '/api/v1/admin/access', 'user_customer')).json()).toEqual({ allowed: false });
    expect((await get(app, '/api/v1/admin/access')).status).toBe(401);
  });
});

describe('the platform organisation directory', () => {
  it('joins Clerk signups with current usage and subscription records without starting trials', async () => {
    const period = ukMonthString();
    await givePlan(db, 'org_team', 'team', 'past_due', { seats: 3, templatePacks: 2 });
    await givePlan(db, 'org_trial', 'free');
    await givePlan(db, 'org_lapsed', 'team', 'canceled');
    await givePlan(db, 'org_outside', 'enterprise');
    await db.insert(orgUsage).values([
      { org_id: 'org_team', period, count: 1200 },
      { org_id: 'org_team', period: `${period}#test`, count: 25 },
      { org_id: 'org_team', period: '2000-01', count: 9000 },
      { org_id: 'org_outside', period, count: 7000 },
    ]);
    await db.insert(mails).values([
      { id: 'team_mail', org_id: 'org_team', user_id: 'user_customer', title: 'Private title', content: 'secret content' },
      { id: 'outside_mail', org_id: 'org_outside', user_id: 'user_customer', title: 'Other', content: '{}' },
    ]);
    await db.insert(assets).values({
      id: 'asset', user_id: 'user_customer', org_id: 'org_team', imagekit_file_id: 'file',
      url: 'https://example.com/private', name: 'Private asset', mime: 'image/png', bytes: 4096,
    });
    const response = await get(app, '/api/v1/admin/organizations', 'user_owner', MAIN);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const body = await response.json();
    expect(body).toMatchObject({ totalCount: 40, page: 1, pageSize: ADMIN_PAGE_SIZE, period });
    expect(body.organizations).toHaveLength(4);
    expect(body.organizations[0]).toMatchObject({
      id: 'org_team', members: 3,
      usage: { liveCalls: 1200, testCalls: 25, templates: 1, storageBytes: 4096 },
      subscription: { plan: 'team', status: 'past_due', seats: 3, templatePacks: 2 },
    });
    expect(body.organizations[1].subscription.plan).toBe('trial');
    expect(body.organizations[2]).toMatchObject({
      members: 0, usage: { liveCalls: 0, testCalls: 0, templates: 0, storageBytes: 0 },
      subscription: { plan: 'not-started', trialEndsAt: null },
    });
    expect(body.organizations[3]).toMatchObject({ members: null, subscription: { plan: 'lapsed', status: 'canceled' } });
    expect(JSON.stringify(body)).not.toMatch(/secret content|Private title|stripe_customer_id|stripe_subscription_id|org_outside/);
    // Reading the directory must not create a customer's subscription or trial.
    const { subscriptions } = await import('@temply/shared/schema');
    expect(await db.select().from(subscriptions)).toHaveLength(4);
  });

  it('passes search and pagination to Clerk and handles an empty page', async () => {
    const response = await get(app, '/api/v1/admin/organizations?page=2&q=Acme', 'user_owner', MAIN);
    expect(await response.json()).toMatchObject({ organizations: [], totalCount: 40, page: 2 });
    expect(lists).toEqual([{ offset: ADMIN_PAGE_SIZE, limit: ADMIN_PAGE_SIZE, query: 'Acme' }]);
  });

  it('rejects invalid pages and excessive search input', async () => {
    for (const query of ['page=0', 'page=-1', 'page=1.5', 'page=nope', 'page=100001', `q=${'a'.repeat(101)}`]) {
      expect((await get(app, `/api/v1/admin/organizations?${query}`, 'user_owner', MAIN)).status).toBe(400);
    }
    expect(lists).toHaveLength(0);
  });
});
