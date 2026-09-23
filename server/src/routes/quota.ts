import { Elysia } from 'elysia';
import { getPlan } from '../lib/billing';
import { getApiUsage, nextResetDate } from '../lib/api-quota';
import { PLAN_LIMITS } from '@temply/shared/plans';
import { json, unauthorized } from '../lib/errors';
import { authPlugin } from '../plugins/auth';
import { noWorkspace } from '../lib/workspace';
import { dbPlugin } from '../plugins/db';

export const quotaRoutes = new Elysia()
  .use(authPlugin)
  .use(dbPlugin)
  .get('/api/v1/quota', async (ctx) => {
  if (!ctx.userId) return unauthorized();
  if (!ctx.orgId) return noWorkspace();
  const { plan, cancelAt } = await getPlan(ctx.db, ctx.orgId);
  const rawLimit = PLAN_LIMITS[plan].maxApiCalls;
  const limit = Number.isFinite(rawLimit) ? rawLimit : null; // null = unlimited over the wire
  const used = await getApiUsage(ctx.db, ctx.orgId);
  return json({
    plan,
    cancelAt,
    api: { used, limit, remaining: limit === null ? null : Math.max(0, limit - used) },
    resetsOn: nextResetDate(),
  });
});
