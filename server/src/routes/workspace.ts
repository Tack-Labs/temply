import { Elysia } from 'elysia';
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { apiKeysTable, apiUsage, assets, brands, mails, orgPrefs, orgUsage, subscriptions, templateVersions, userPrefs } from '@temply/shared/schema';
import { json, unauthorized } from '../lib/errors';
import { noWorkspace } from '../lib/workspace';
import { authPlugin } from '../plugins/auth';
import { dbPlugin } from '../plugins/db';

/**
 * Moves everything the caller made before organizations into their active
 * one: every row still carrying only their user id is claimed, their usage
 * is folded into the org's month, and their default brand becomes the
 * org's. Idempotent — a second call finds nothing to move — so the
 * dashboard can call it on every load and onboarding can call it once.
 */
export const workspaceRoutes = new Elysia()
  .use(authPlugin)
  .use(dbPlugin)
  .post('/api/v1/workspace/adopt', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const { userId, orgId } = ctx;

    let moved = 0;
    for (const table of [mails, templateVersions, apiKeysTable, brands, assets]) {
      const orphan = and(eq(table.user_id, userId), isNull(table.org_id));
      const [orphans] = await ctx.db.select({ n: count() }).from(table).where(orphan);
      moved += orphans?.n ?? 0;
      await ctx.db.update(table).set({ org_id: orgId }).where(orphan);
    }
    // One subscription per org: a legacy row moves across only if the org
    // has none, otherwise the org's own plan stands and the legacy row goes.
    const orphanSub = and(eq(subscriptions.user_id, userId), isNull(subscriptions.org_id));
    const [existing] = await ctx.db.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.org_id, orgId)).limit(1);
    if (existing) await ctx.db.delete(subscriptions).where(orphanSub);
    else await ctx.db.update(subscriptions).set({ org_id: orgId }).where(orphanSub);

    const usage = await ctx.db.select().from(apiUsage).where(eq(apiUsage.user_id, userId));
    for (const row of usage) {
      await ctx.db
        .insert(orgUsage)
        .values({ org_id: orgId, period: row.period, count: row.count })
        .onConflictDoUpdate({ target: [orgUsage.org_id, orgUsage.period], set: { count: sql`${orgUsage.count} + ${row.count}` } });
    }
    await ctx.db.delete(apiUsage).where(eq(apiUsage.user_id, userId));

    const [prefs] = await ctx.db.select().from(userPrefs).where(eq(userPrefs.user_id, userId)).limit(1);
    if (prefs) {
      await ctx.db.insert(orgPrefs).values({ org_id: orgId, default_brand_id: prefs.default_brand_id }).onConflictDoNothing();
      await ctx.db.delete(userPrefs).where(eq(userPrefs.user_id, userId));
    }

    return json({ status: 'ok', moved });
  });
