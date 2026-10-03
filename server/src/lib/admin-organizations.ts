import { and, count, inArray, sql } from 'drizzle-orm';
import { assets, mails, orgUsage, subscriptions } from '@temply/shared/schema';
import { ADMIN_PAGE_SIZE, type AdminOrganizations } from '@temply/shared/admin';
import type { Db } from '../plugins/db';
import { ukMonthString } from './api-quota';
import { accountFromSubscription } from './billing';
import type { AdminDirectory } from './platform-admin';

export async function listAdminOrganizations(
  db: Db,
  directory: AdminDirectory,
  options: { page: number; query: string },
  now: Date = new Date(),
): Promise<AdminOrganizations> {
  const period = ukMonthString(now);
  const { data, totalCount } = await directory.list({
    limit: ADMIN_PAGE_SIZE, offset: (options.page - 1) * ADMIN_PAGE_SIZE, query: options.query,
  });
  const base = { totalCount, page: options.page, pageSize: ADMIN_PAGE_SIZE, period };
  if (!data.length) return { ...base, organizations: [] };
  const ids = data.map((organization) => organization.id);

  // Aggregate the page in bulk; a larger directory must not make one query per customer.
  const [plans, calls, templates, storage] = await Promise.all([
    db.select().from(subscriptions).where(inArray(subscriptions.org_id, ids)),
    db.select().from(orgUsage).where(and(inArray(orgUsage.org_id, ids), inArray(orgUsage.period, [period, `${period}#test`]))),
    db.select({ orgId: mails.org_id, total: count() }).from(mails).where(inArray(mails.org_id, ids)).groupBy(mails.org_id),
    db.select({ orgId: assets.org_id, total: sql`coalesce(sum(${assets.bytes}), 0)`.mapWith(Number) })
      .from(assets).where(inArray(assets.org_id, ids)).groupBy(assets.org_id),
  ]);
  const planByOrg = new Map(plans.map((row) => [row.org_id, row]));
  const callsByOrg = new Map(calls.map((row) => [`${row.org_id}/${row.period}`, row.count]));
  const templatesByOrg = new Map(templates.map((row) => [row.orgId, row.total]));
  const storageByOrg = new Map(storage.map((row) => [row.orgId, row.total]));

  return {
    ...base,
    organizations: data.map((organization) => {
      const sub = planByOrg.get(organization.id);
      const account = accountFromSubscription(sub, now);
      return {
        id: organization.id,
        name: organization.name,
        createdAt: organization.createdAt,
        members: organization.membersCount ?? null,
        usage: {
          liveCalls: callsByOrg.get(`${organization.id}/${period}`) ?? 0,
          testCalls: callsByOrg.get(`${organization.id}/${period}#test`) ?? 0,
          templates: templatesByOrg.get(organization.id) ?? 0,
          storageBytes: storageByOrg.get(organization.id) ?? 0,
        },
        subscription: {
          plan: sub ? account.plan : 'not-started',
          // Keep Stripe's recorded status visible even when the entitlement has ended.
          status: sub && (sub.plan !== 'free' || sub.stripe_customer_id) ? sub.status : null,
          seats: sub?.seats ?? null,
          templatePacks: sub?.template_packs ?? 0,
          trialEndsAt: sub?.trial_ends_at ?? null,
          currentPeriodEnd: sub?.current_period_end ?? null,
          cancelAt: sub?.cancel_at ?? null,
        },
      };
    }),
  };
}
