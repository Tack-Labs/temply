import { eq, sql, and, count, isNull, lte, ne, or } from 'drizzle-orm';
import { subscriptions, mails, apiKeysTable, brands, assets } from '@temply/shared/schema';
import type { Db } from '../plugins/db';
import { PLAN_LIMITS as planLimits, type Plan } from '@temply/shared/plans';
import { formatBytes } from '@temply/shared/bytes';

type SubscriptionRow = typeof subscriptions.$inferSelect;

/**
 * Whether a row pays for its plan right now. A cancellation past its end
 * date no longer does, even before `subscription_expired` lands: Lemon
 * Squeezy retries a failed delivery only a few times, and a lost one must
 * not leave the plan running for free. `notPaying` is the same rule in SQL,
 * for a write that must not race it; the two must agree.
 */
function paying(sub: SubscriptionRow, now = new Date().toISOString()): boolean {
  return sub.plan !== 'free' && sub.status === 'active' && !(sub.cancel_at && sub.cancel_at <= now);
}

export function notPaying(now = new Date().toISOString()) {
  return or(eq(subscriptions.plan, 'free'), ne(subscriptions.status, 'active'), lte(subscriptions.cancel_at, now));
}

/**
 * The plan for a scope. A scope is an organization id — or, for a row from
 * before organizations that nobody has adopted yet, the user id the row
 * still carries. Both are answered here so a legacy API key keeps its plan
 * until its owner's next visit moves everything across.
 */
export async function getPlan(db: Db, orgId: string): Promise<{ plan: Plan; status: string; cancelAt: string | null }> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(or(eq(subscriptions.org_id, orgId), and(eq(subscriptions.user_id, orgId), isNull(subscriptions.org_id))))
    .limit(1);

  if (!sub || !paying(sub)) {
    return { plan: 'free', status: 'active', cancelAt: null };
  }
  return { plan: sub.plan as Plan, status: sub.status, cancelAt: sub.cancel_at ?? null };
}

export async function getUsage(db: Db, orgId: string) {
  const [templateCount] = await db
    .select({ count: count() })
    .from(mails)
    .where(eq(mails.org_id, orgId));

  // The cap is on keys that work. A revoked key stays as a row so its history
  // reads, but it holds no slot; test keys sit outside the plan entirely.
  const [apiKeyCount] = await db
    .select({ count: count() })
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.org_id, orgId), eq(apiKeysTable.mode, 'live'), isNull(apiKeysTable.revoked_at)));

  return { templates: templateCount?.count ?? 0, apiKeys: apiKeyCount?.count ?? 0 };
}

export async function checkTemplateLimit(db: Db, orgId: string): Promise<{ allowed: boolean; message?: string }> {
  const { plan } = await getPlan(db, orgId);
  const limits = planLimits[plan];
  const usage = await getUsage(db, orgId);
  if (usage.templates >= limits.maxTemplates) {
    return { allowed: false, message: `Free plan is limited to ${limits.maxTemplates} templates. Upgrade to create more.` };
  }
  return { allowed: true };
}

export async function checkApiKeyLimit(db: Db, orgId: string): Promise<{ allowed: boolean; message?: string }> {
  const { plan } = await getPlan(db, orgId);
  const limits = planLimits[plan];
  if (limits.maxApiKeys === 0) {
    return { allowed: false, message: 'API keys are not available on the Free plan. Upgrade to Pro to create API keys.' };
  }
  const usage = await getUsage(db, orgId);
  if (usage.apiKeys >= limits.maxApiKeys) {
    return { allowed: false, message: `You can only create ${limits.maxApiKeys} API keys on your current plan. Upgrade for more.` };
  }
  return { allowed: true };
}

export async function checkBrandLimit(db: Db, orgId: string): Promise<{ allowed: boolean; message?: string }> {
  const { plan } = await getPlan(db, orgId);
  const limit = planLimits[plan].maxBrands;
  if (!Number.isFinite(limit)) return { allowed: true };
  const [row] = await db.select({ count: count() }).from(brands).where(eq(brands.org_id, orgId));
  if ((row?.count ?? 0) >= limit) {
    return { allowed: false, message: `You can save ${limit} brand${limit === 1 ? '' : 's'} on your current plan. Upgrade for more.` };
  }
  return { allowed: true };
}

export async function getStorageUsed(db: Db, orgId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql`coalesce(sum(${assets.bytes}), 0)`.mapWith(Number) })
    .from(assets)
    .where(eq(assets.org_id, orgId));
  return row?.total ?? 0;
}

/** Checked before the bytes reach ImageKit, so a refused upload costs nothing
 *  and the DB never has to be reconciled against storage. */
export async function checkStorageLimit(db: Db, orgId: string, incomingBytes: number): Promise<{ allowed: boolean; message?: string }> {
  const { plan } = await getPlan(db, orgId);
  const limit = planLimits[plan].maxStorageBytes;
  if (!Number.isFinite(limit)) return { allowed: true };
  const used = await getStorageUsed(db, orgId);
  if (used + incomingBytes > limit) {
    return {
      allowed: false,
      message: `Storage is full — ${formatBytes(used)} of ${formatBytes(limit)} used. Delete images in your library or upgrade.`,
    };
  }
  return { allowed: true };
}

export async function shouldSnapshot(db: Db, orgId: string): Promise<boolean> {
  const { plan } = await getPlan(db, orgId);
  return plan !== 'free';
}

export { planLimits };
