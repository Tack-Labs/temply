import { Elysia, t } from 'elysia';
import { authPlugin } from '../plugins/auth';
import { dbPlugin } from '../plugins/db';
import { json, unauthorized } from '../lib/errors';
import { canViewPlatformAdmin, clerkAdminDirectory, type AdminDirectory } from '../lib/platform-admin';
import { listAdminOrganizations } from '../lib/admin-organizations';

export function createAdminRoutes(directory: AdminDirectory = clerkAdminDirectory) {
  return new Elysia()
    .use(authPlugin)
    .use(dbPlugin)
    .onRequest(({ set }) => { set.headers['Cache-Control'] = 'private, no-store'; })
    .get('/api/v1/admin/access', async (ctx) => {
      if (!ctx.userId) return unauthorized();
      return json({ allowed: await canViewPlatformAdmin(ctx, directory) });
    })
    .get('/api/v1/admin/organizations', async (ctx) => {
      if (!ctx.userId) return unauthorized();
      if (!(await canViewPlatformAdmin(ctx, directory))) {
        return json({ status: 403, code: 'platform-admin-only', message: 'Temply admin access required' }, 403);
      }
      return json(await listAdminOrganizations(ctx.db, directory, {
        page: ctx.query.page ?? 1, query: (ctx.query.q ?? '').trim(),
      }));
    }, {
      query: t.Object({
        page: t.Optional(t.Numeric({ minimum: 1, maximum: 100_000, multipleOf: 1 })),
        q: t.Optional(t.String({ maxLength: 100 })),
      }),
    });
}

export const adminRoutes = createAdminRoutes();
