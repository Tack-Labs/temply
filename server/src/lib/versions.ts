import { and, eq, isNull, lt, max, or, sql, type SQL } from 'drizzle-orm';
import { PINNED_VERSION_KEPT_DAYS } from '@temply/shared/plans';
import { templateVersions } from '@temply/shared/schema';
import type { Db } from '../plugins/db';

const DAY_MS = 86_400_000;

/**
 * The newest version number of the template `templateId` evaluates to. The
 * list selects it as a correlated subquery, and a single-table select
 * unqualifies the columns written straight into its sql, so a reference to
 * the outer row has to arrive as an sql chunk of its own — `${mails}.id`,
 * not `${mails.id}` — or it would read as the version's own id.
 */
export function liveVersionOf(templateId: SQL) {
  return sql<number | null>`(SELECT MAX(${templateVersions.version_number}) FROM ${templateVersions} WHERE ${templateVersions.template_id} = ${templateId})`.mapWith(Number);
}

/** The number the live copy was published as: every copy that goes live is
 *  snapshotted at the next number, so the newest version is the live one.
 *  Null for a template that has never been published. */
export async function liveVersion(db: Db, templateId: string): Promise<number | null> {
  const [found] = await db.select({ newest: max(templateVersions.version_number) }).from(templateVersions).where(eq(templateVersions.template_id, templateId));
  return found?.newest ?? null;
}

/** A version pinned at or after this instant is spared by pruning. */
export function pinnedSince(now = Date.now()): string {
  return new Date(now - PINNED_VERSION_KEPT_DAYS * DAY_MS).toISOString();
}

/**
 * Records that an API call pinned `version`, at most once a day. The stamp
 * only has to outlast the retention window, so a render of a hot version
 * does not write on every call; the row already read says whether it must.
 */
export async function notePin(db: Db, version: { id: string; pinned_at: string | null }, now = Date.now()) {
  const dayAgo = new Date(now - DAY_MS).toISOString();
  if (version.pinned_at !== null && version.pinned_at >= dayAgo) return;
  await db
    .update(templateVersions)
    .set({ pinned_at: new Date(now).toISOString() })
    .where(and(eq(templateVersions.id, version.id), or(isNull(templateVersions.pinned_at), lt(templateVersions.pinned_at, dayAgo))));
}
