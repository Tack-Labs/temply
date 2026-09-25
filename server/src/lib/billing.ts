import { eq, sql, and, count, isNull, or } from 'drizzle-orm';
import { subscriptions, mails, apiKeysTable, brands, assets } from '@temply/shared/schema';
import type { Db } from '../plugins/db';
import type { OrgRole } from '../plugins/auth';
import { limitsFor, MAX_TEMPLATE_PACKS, TEMPLATE_PACK, TRIAL_DAYS, type Plan, type PlanLimits } from '@temply/shared/plans';
import { formatBytes } from '@temply/shared/bytes';
import { paymentRequired } from './errors';
import { PAYING_STATUSES } from './stripe';

type SubscriptionRow = typeof subscriptions.$inferSelect;

/** Whether a row pays for its plan right now. lib/stripe.ts's `notPaying`
 *  is the same rule in SQL; the two must agree. */
function paying(sub: SubscriptionRow, now: string): boolean {
  return sub.plan !== 'free' && PAYING_STATUSES.includes(sub.status) && !(sub.cancel_at && sub.cancel_at <= now);
}

export interface Account {
  plan: Plan;
  /** Stripe's word for a paid plan (`active`, `past_due`…); null otherwise. */
  status: string | null;
  cancelAt: string | null;
  /** Null only for a workspace with no row yet, whose trial has not started. */
  trialEndsAt: string | null;
  seats: number | null;
  templatePacks: number;
  currentPeriodEnd: string | null;
}

/**
 * The account for a scope. A scope is an organization id — or, for a row
 * from before organizations that nobody has adopted yet, the user id the
 * row still carries. Both are answered here so a legacy API key keeps its
 * plan until its owner's next visit moves everything across.
 */
export async function getPlan(db: Db, orgId: string, now: Date = new Date()): Promise<Account> {
  const at = now.toISOString();
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(or(eq(subscriptions.org_id, orgId), and(eq(subscriptions.user_id, orgId), isNull(subscriptions.org_id))))
    .limit(1);

  if (sub && paying(sub, at)) {
    return {
      plan: sub.plan === 'enterprise' ? 'enterprise' : 'team',
      status: sub.status,
      cancelAt: sub.cancel_at ?? null,
      trialEndsAt: sub.trial_ends_at ?? null,
      seats: sub.seats ?? null,
      templatePacks: sub.template_packs,
      currentPeriodEnd: sub.current_period_end ?? null,
    };
  }
  const trialEndsAt = sub?.trial_ends_at ?? null;
  return {
    plan: !trialEndsAt || trialEndsAt > at ? 'trial' : 'lapsed',
    status: null,
    cancelAt: null,
    trialEndsAt,
    seats: null,
    templatePacks: 0,
    currentPeriodEnd: null,
  };
}

export function limitsForAccount(account: Pick<Account, 'plan' | 'templatePacks'>): PlanLimits {
  return limitsFor(account.plan, account.templatePacks);
}

/**
 * Makes a workspace's account the first time anyone uses it, which is when
 * its trial starts. The unique index on org_id makes two first visits at
 * once safe: the second insert does nothing.
 */
export async function ensureAccount(db: Db, orgId: string, userId: string, now: Date = new Date()): Promise<void> {
  const [row] = await db.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.org_id, orgId)).limit(1);
  if (row) return;
  await db
    .insert(subscriptions)
    .values({
      id: crypto.randomUUID(),
      user_id: userId,
      org_id: orgId,
      plan: 'free',
      status: 'active',
      trial_ends_at: new Date(now.getTime() + TRIAL_DAYS * 86_400_000).toISOString(),
    })
    .onConflictDoNothing();
}

export function readOnlyMessage(role: OrgRole | null): string {
  return role === 'admin'
    ? 'This workspace is read-only until it has a plan. Subscribe on the Plan page to make changes again.'
    : 'This workspace is read-only until it has a plan. Ask an admin to subscribe on the Plan page.';
}

const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * The read-only rule for a workspace whose trial or plan has ended: it can
 * open and read everything, and delete what it no longer wants, but not
 * make or change anything until someone subscribes. Mounted with
 * `onBeforeHandle` on each module that writes a workspace's content.
 */
export async function refuseWhenLapsed(ctx: { request: Request; db: Db; orgId: string | null; orgRole: OrgRole | null }) {
  if (READS.has(ctx.request.method) || ctx.request.method === 'DELETE' || !ctx.orgId) return;
  const { plan } = await getPlan(ctx.db, ctx.orgId);
  if (plan === 'lapsed') return paymentRequired(readOnlyMessage(ctx.orgRole));
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
  const account = await getPlan(db, orgId);
  const { maxTemplates } = limitsForAccount(account);
  const usage = await getUsage(db, orgId);
  if (usage.templates < maxTemplates) return { allowed: true };
  const more = `a template pack for ${TEMPLATE_PACK.templates} more`;
  const message =
    account.plan === 'trial'
      ? `You've used all ${maxTemplates} templates in the trial. Subscribe, then add ${more}.`
      : account.templatePacks < MAX_TEMPLATE_PACKS
        ? `You've used all ${maxTemplates} templates on your plan. Add ${more}.`
        : `You've used all ${maxTemplates} templates on your plan. Delete one you no longer use to make another.`;
  return { allowed: false, message };
}

export async function checkApiKeyLimit(db: Db, orgId: string): Promise<{ allowed: boolean; message?: string }> {
  const { maxApiKeys } = limitsForAccount(await getPlan(db, orgId));
  const usage = await getUsage(db, orgId);
  if (usage.apiKeys >= maxApiKeys) {
    return { allowed: false, message: `You can have ${maxApiKeys} live API keys. Revoke one you no longer use to make another.` };
  }
  return { allowed: true };
}

export async function checkBrandLimit(db: Db, orgId: string): Promise<{ allowed: boolean; message?: string }> {
  const limit = limitsForAccount(await getPlan(db, orgId)).maxBrands;
  if (!Number.isFinite(limit)) return { allowed: true };
  const [row] = await db.select({ count: count() }).from(brands).where(eq(brands.org_id, orgId));
  if ((row?.count ?? 0) >= limit) {
    return { allowed: false, message: `You can save ${limit} brand${limit === 1 ? '' : 's'}. Delete one to save another.` };
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
  const { plan, templatePacks } = await getPlan(db, orgId);
  const limit = limitsFor(plan, templatePacks).maxStorageBytes;
  if (!Number.isFinite(limit)) return { allowed: true };
  const used = await getStorageUsed(db, orgId);
  if (used + incomingBytes > limit) {
    const full = `Storage is full — ${formatBytes(used)} of ${formatBytes(limit)} used.`;
    const team = limitsFor('team').maxStorageBytes;
    return {
      allowed: false,
      message: plan === 'trial' ? `${full} Delete images in your library, or subscribe for ${formatBytes(team)}.` : `${full} Delete images in your library.`,
    };
  }
  return { allowed: true };
}

/** How many published versions each of a workspace's templates keeps. */
export async function versionsKept(db: Db, orgId: string): Promise<number> {
  return limitsForAccount(await getPlan(db, orgId)).maxVersions;
}
