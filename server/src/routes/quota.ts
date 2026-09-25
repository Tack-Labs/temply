import { Elysia } from 'elysia';
import { getPlan, limitsForAccount } from '../lib/billing';
import { getApiUsage, nextResetDate } from '../lib/api-quota';
import { overageCalls, overageUsd } from '@temply/shared/plans';
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
  const { plan, cancelAt, trialEndsAt, templatePacks } = await getPlan(ctx.db, ctx.orgId);
  const limits = limitsForAccount({ plan, templatePacks });
  // null means unbounded over the wire: `limit` is where calls stop,
  // `included` is what the price covers before calls are billed.
  const wire = (n: number) => (Number.isFinite(n) ? n : null);
  const limit = wire(limits.maxApiCalls);
  const used = await getApiUsage(ctx.db, ctx.orgId);
  const overage = overageCalls(used, limits);
  return json({
    plan,
    cancelAt,
    trialEndsAt,
    api: { used, limit, included: wire(limits.includedApiCalls), remaining: limit === null ? null : Math.max(0, limit - used) },
    overage: { calls: overage, usd: overageUsd(overage) },
    resetsOn: nextResetDate(),
  });
});
