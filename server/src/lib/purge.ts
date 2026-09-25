import { and, eq, isNull, type SQL } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import {
  apiKeysTable,
  apiUsage,
  assets,
  brands,
  mails,
  orgPrefs,
  orgUsage,
  subscriptions,
  templateVersions,
  userPrefs,
} from '@temply/shared/schema';
import type { Db } from '../plugins/db';

/** The two outside systems a purge has to reach. Injected so the purge is
 *  testable without either, and so a missing ImageKit config skips files
 *  instead of failing the whole purge. */
export type PurgeSideEffects = {
  cancelSubscription?: (stripeSubscriptionId: string) => Promise<void>;
  deleteFile?: (imagekitFileId: string) => Promise<void>;
};

export type PurgeReport = { rows: number; filesDeleted: number; subscriptionCancelled: boolean };

/**
 * Everything an organization owns, gone. Clerk has already deleted the
 * organization by the time its webhook arrives, so nobody can sign in to
 * see or pay for any of this — a subscription left running would bill a
 * customer for a workspace that no longer exists, and the files would sit
 * on the image host counting against our storage forever. Stripe and
 * ImageKit are best effort and logged: the rows go regardless, because a
 * retry of the webhook must find nothing left rather than half a workspace.
 */
export async function purgeOrganization(db: Db, orgId: string, effects: PurgeSideEffects = {}): Promise<PurgeReport> {
  return purgeScope(db, (table) => eq(table.org_id, orgId), effects, {
    subscription: eq(subscriptions.org_id, orgId),
    usage: () => db.delete(orgUsage).where(eq(orgUsage.org_id, orgId)),
    prefs: () => db.delete(orgPrefs).where(eq(orgPrefs.org_id, orgId)),
  });
}

/**
 * A deleted user's rows from before organizations — the ones still keyed by
 * user id alone because no visit ever adopted them into a workspace. Rows
 * that did move belong to the organization now and outlive the person.
 */
export async function purgeLegacyUser(db: Db, userId: string, effects: PurgeSideEffects = {}): Promise<PurgeReport> {
  return purgeScope(db, (table) => and(eq(table.user_id, userId), isNull(table.org_id))!, effects, {
    subscription: and(eq(subscriptions.user_id, userId), isNull(subscriptions.org_id))!,
    usage: () => db.delete(apiUsage).where(eq(apiUsage.user_id, userId)),
    prefs: () => db.delete(userPrefs).where(eq(userPrefs.user_id, userId)),
  });
}

/** Any table that carries the two ownership columns. */
type Scoped = { org_id: AnySQLiteColumn; user_id: AnySQLiteColumn };

async function purgeScope(
  db: Db,
  scope: (table: Scoped) => SQL,
  effects: PurgeSideEffects,
  own: { subscription: SQL; usage: () => Promise<unknown>; prefs: () => Promise<unknown> },
): Promise<PurgeReport> {
  const report: PurgeReport = { rows: 0, filesDeleted: 0, subscriptionCancelled: false };

  const [sub] = await db.select().from(subscriptions).where(own.subscription).limit(1);
  if (sub?.stripe_subscription_id && effects.cancelSubscription) {
    try {
      await effects.cancelSubscription(sub.stripe_subscription_id);
      report.subscriptionCancelled = true;
    } catch (error) {
      console.error(`Purge: could not cancel Stripe subscription ${sub.stripe_subscription_id}`, error);
    }
  }

  const files = await db.select({ id: assets.id, fileId: assets.imagekit_file_id }).from(assets).where(scope(assets));
  for (const file of files) {
    if (!effects.deleteFile) break;
    try {
      await effects.deleteFile(file.fileId);
      report.filesDeleted += 1;
    } catch (error) {
      console.error(`Purge: could not delete image ${file.fileId}`, error);
    }
  }

  // One statement per table: Drizzle types each delete by its table, and a
  // loop over a union would lose that.
  const deletes = [
    db.delete(mails).where(scope(mails)).returning({ id: mails.id }),
    db.delete(templateVersions).where(scope(templateVersions)).returning({ id: templateVersions.id }),
    db.delete(apiKeysTable).where(scope(apiKeysTable)).returning({ id: apiKeysTable.id }),
    db.delete(brands).where(scope(brands)).returning({ id: brands.id }),
    db.delete(assets).where(scope(assets)).returning({ id: assets.id }),
    db.delete(subscriptions).where(scope(subscriptions)).returning({ id: subscriptions.id }),
  ];
  for (const query of deletes) report.rows += (await query).length;
  await own.usage();
  await own.prefs();
  return report;
}
