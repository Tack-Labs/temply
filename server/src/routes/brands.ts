import { Elysia, t } from 'elysia';
import { and, desc, eq } from 'drizzle-orm';
import { brands, orgPrefs } from '@temply/shared/schema';
import { BRAND_PRESETS } from '@temply/shared/brand-presets';
import { checkBrandLimit, getPlan, limitsForAccount, refuseWhenLapsed } from '../lib/billing';
import { FALLBACK_PRESET_ID, readDefault } from '../lib/brands';
import { json, unauthorized, paymentRequired, notFound } from '../lib/errors';
import { authPlugin } from '../plugins/auth';
import { noWorkspace } from '../lib/workspace';
import { dbPlugin, type Db } from '../plugins/db';

const PRESET_IDS = new Set(BRAND_PRESETS.map((p) => p.id));

async function writeDefault(db: Db, orgId: string, id: string | null): Promise<void> {
  await db.insert(orgPrefs).values({ org_id: orgId, default_brand_id: id })
    .onConflictDoUpdate({ target: orgPrefs.org_id, set: { default_brand_id: id } });
}

export const brandsRoutes = new Elysia()
  .use(authPlugin)
  .use(dbPlugin)
  // A workspace without a plan reads and deletes, and changes nothing.
  .onBeforeHandle(refuseWhenLapsed)
  .get('/api/v1/brands', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const list = await ctx.db.select().from(brands).where(eq(brands.org_id, ctx.orgId)).orderBy(desc(brands.created_at));
    // The client needs the cap to render the "custom brands used up" banner.
    // null means unlimited (Enterprise). Presets do not count — only these rows.
    const raw = limitsForAccount(await getPlan(ctx.db, ctx.orgId)).maxBrands;
    return json({
      brands: list,
      limit: Number.isFinite(raw) ? raw : null,
      defaultBrandId: await readDefault(ctx.db, ctx.orgId),
    });
  })

  .post('/api/v1/brands', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const limit = await checkBrandLimit(ctx.db, ctx.orgId);
    if (!limit.allowed) return paymentRequired(limit.message!);
    const { name, theme } = ctx.body;
    const id = crypto.randomUUID();
    // Not auto-defaulted: choosing a default is an explicit, opt-in action.
    await ctx.db.insert(brands).values({ id, user_id: ctx.userId, org_id: ctx.orgId, name, theme, is_default: 0 });
    return json({ brand: { id, name, theme, is_default: 0 } });
  }, { body: t.Object({ name: t.String({ minLength: 1 }), theme: t.String({ minLength: 1 }) }) })

  .put('/api/v1/brands/:id', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const [owned] = await ctx.db.select({ id: brands.id }).from(brands)
      .where(and(eq(brands.id, ctx.params.id), eq(brands.org_id, ctx.orgId))).limit(1);
    if (!owned) return notFound('Brand not found');
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof ctx.body.name === 'string') patch.name = ctx.body.name;
    if (typeof ctx.body.theme === 'string') patch.theme = ctx.body.theme;
    await ctx.db.update(brands).set(patch).where(and(eq(brands.id, ctx.params.id), eq(brands.org_id, ctx.orgId)));
    return json({ status: 'ok' });
  }, { body: t.Object({ name: t.Optional(t.String({ minLength: 1 })), theme: t.Optional(t.String({ minLength: 1 })) }) })

  .delete('/api/v1/brands/:id', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const [target] = await ctx.db.select().from(brands)
      .where(and(eq(brands.id, ctx.params.id), eq(brands.org_id, ctx.orgId))).limit(1);
    if (!target) return json({ status: 'ok' });
    await ctx.db.delete(brands).where(and(eq(brands.id, ctx.params.id), eq(brands.org_id, ctx.orgId)));
    // If we just deleted the default look, hand the default to the next custom
    // brand, falling back to a preset so there is always a sensible default.
    if ((await readDefault(ctx.db, ctx.orgId)) === ctx.params.id) {
      const [next] = await ctx.db.select({ id: brands.id }).from(brands)
        .where(eq(brands.org_id, ctx.orgId)).orderBy(desc(brands.created_at)).limit(1);
      await writeDefault(ctx.db, ctx.orgId, next?.id ?? FALLBACK_PRESET_ID);
    }
    return json({ status: 'ok' });
  })

  .post('/api/v1/brands/:id/default', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    // The default may be a preset (not a row) or one of the caller's own brands.
    let valid = PRESET_IDS.has(ctx.params.id);
    if (!valid) {
      const [owned] = await ctx.db.select({ id: brands.id }).from(brands)
        .where(and(eq(brands.id, ctx.params.id), eq(brands.org_id, ctx.orgId))).limit(1);
      valid = !!owned;
    }
    if (!valid) return notFound('Brand not found');
    await writeDefault(ctx.db, ctx.orgId, ctx.params.id);
    return json({ status: 'ok' });
  });
