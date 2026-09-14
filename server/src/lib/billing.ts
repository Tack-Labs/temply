import Stripe from 'stripe';
import { eq, sql, and, isNull, or } from 'drizzle-orm';
import { subscriptions, mails, apiKeysTable, brands, assets } from '@temply/shared/schema';
import type { Db } from '../plugins/db';
import { PLAN_LIMITS as planLimits, type Plan } from '@temply/shared/plans';
import { formatBytes } from '@temply/shared/bytes';


/** The Stripe client. STRIPE_API_BASE, set only by the e2e stack, points it
 *  at a fake on localhost; production never sets it and reaches Stripe.
 *  stripe-node has no basePath config — its base path is always `/v1/` — so
 *  the fake listens on its own port rather than under a path prefix. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  const base = process.env.STRIPE_API_BASE;
  if (!base) return new Stripe(key, {});
  const url = new URL(base);
  return new Stripe(key, {
    host: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
    protocol: url.protocol.replace(':', '') as 'http' | 'https',
  });
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

  if (!sub || sub.plan === 'free' || sub.status !== 'active') {
    return { plan: 'free', status: 'active', cancelAt: null };
  }
  return { plan: sub.plan as Plan, status: sub.status, cancelAt: sub.cancel_at ?? null };
}

export async function getUsage(db: Db, orgId: string) {
  const [templateCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mails)
    .where(eq(mails.org_id, orgId));

  // The cap is on keys that work. A revoked key stays as a row so its history
  // reads, but it holds no slot; test keys sit outside the plan entirely.
  const [apiKeyCount] = await db
    .select({ count: sql<number>`count(*)` })
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
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(brands).where(eq(brands.org_id, orgId));
  if ((row?.count ?? 0) >= limit) {
    return { allowed: false, message: `You can save ${limit} brand${limit === 1 ? '' : 's'} on your current plan. Upgrade for more.` };
  }
  return { allowed: true };
}

export async function getStorageUsed(db: Db, orgId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${assets.bytes}), 0)` })
    .from(assets)
    .where(eq(assets.org_id, orgId));
  return Number(row?.total ?? 0);
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
