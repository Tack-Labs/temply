import { and, eq } from 'drizzle-orm';
import { brands, orgPrefs } from '@temply/shared/schema';
import { BRAND_PRESETS } from '@temply/shared/brand-presets';
import type { Db } from '../plugins/db';

/** The preset a workspace falls back to when it has chosen no default, or
 *  its chosen default is gone. */
export const FALLBACK_PRESET_ID = BRAND_PRESETS[0].id;

/** The organization's default look: a preset id or a custom brand id, or null. */
export async function readDefault(db: Db, orgId: string): Promise<string | null> {
  const [row] = await db.select().from(orgPrefs).where(eq(orgPrefs.org_id, orgId)).limit(1);
  return row?.default_brand_id ?? null;
}

/**
 * The default look as a stored theme, for a row that needs one. A workspace
 * that has never chosen gets the first preset — the same look the editor's
 * Brand panel offers a signed-out visitor, so a new account's first email
 * and the playground agree. A default pointing at a brand that no longer
 * exists falls back the same way rather than leaving the row without a
 * theme.
 */
export async function defaultBrandTheme(db: Db, orgId: string): Promise<string> {
  const id = await readDefault(db, orgId);
  const preset = BRAND_PRESETS.find((p) => p.id === id);
  if (preset) return JSON.stringify(preset.theme);
  if (id) {
    const [own] = await db.select({ theme: brands.theme }).from(brands)
      .where(and(eq(brands.id, id), eq(brands.org_id, orgId))).limit(1);
    if (own) return own.theme;
  }
  return JSON.stringify(BRAND_PRESETS.find((p) => p.id === FALLBACK_PRESET_ID)!.theme);
}
