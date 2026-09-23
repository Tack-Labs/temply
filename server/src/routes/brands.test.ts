import { beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { brands } from '@temply/shared/schema';
import { createTestApp, createTestDb, del, get, givePlan, post, put, type TestDb } from '../test/helpers';
import { brandsRoutes } from './brands';

let db: TestDb;
let app: any;
const OWNER = 'user_owner';
const OTHER = 'user_other';

beforeEach(() => { db = createTestDb(); app = createTestApp(db, brandsRoutes); });

const make = (userId: string, name = 'Brand') => post(app, '/api/v1/brands', { name, theme: '{"link":{"color":"#000"}}' }, userId);

describe('POST /api/v1/brands', () => {
  it('401 without a user', async () => { expect((await make(null as any)).status).toBe(401); });
  it('creates one for a free user, blocks the second', async () => {
    expect((await make(OWNER)).status).toBe(200);
    expect((await make(OWNER, 'Second')).status).toBe(402);
  });
  it('does not auto-default a newly created brand', async () => {
    const { brand } = await (await make(OWNER)).json();
    expect(brand.is_default).toBe(0);
  });
});

describe('GET /api/v1/brands', () => {
  it('lists only the caller’s brands and reports the plan cap', async () => {
    await givePlan(db, OWNER, 'pro'); await givePlan(db, OTHER, 'pro');
    await make(OWNER, 'Mine'); await make(OTHER, 'Theirs');
    const body = await (await get(app, '/api/v1/brands', OWNER)).json();
    expect(body.brands).toHaveLength(1);
    expect(body.brands[0].name).toBe('Mine');
    expect(body.limit).toBe(5); // pro
  });

  it('reports null (unlimited) for enterprise', async () => {
    await givePlan(db, OWNER, 'enterprise');
    const body = await (await get(app, '/api/v1/brands', OWNER)).json();
    expect(body.limit).toBeNull();
  });

  it('has no default until one is chosen', async () => {
    await make(OWNER);
    const body = await (await get(app, '/api/v1/brands', OWNER)).json();
    expect(body.defaultBrandId).toBeNull();
  });
});

const defaultOf = async (userId: string) =>
  (await (await get(app, '/api/v1/brands', userId)).json()).defaultBrandId;

describe('POST /api/v1/brands/:id/default', () => {
  it('moves default to the chosen brand', async () => {
    await givePlan(db, OWNER, 'pro');
    await make(OWNER, 'A');
    const b = (await (await make(OWNER, 'B')).json()).brand;
    await post(app, `/api/v1/brands/${b.id}/default`, {}, OWNER);
    expect(await defaultOf(OWNER)).toBe(b.id);
  });

  it('accepts a preset id as the default', async () => {
    await post(app, '/api/v1/brands/classic/default', {}, OWNER);
    expect(await defaultOf(OWNER)).toBe('classic');
  });

  it('404s for an unknown id that is neither a preset nor an owned brand', async () => {
    const res = await post(app, '/api/v1/brands/nope/default', {}, OWNER);
    expect(res.status).toBe(404);
  });

  it('will not default another user’s brand', async () => {
    const { brand } = await (await make(OTHER)).json();
    const res = await post(app, `/api/v1/brands/${brand.id}/default`, {}, OWNER);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/brands/:id', () => {
  it('updates the caller’s own brand', async () => {
    const { brand } = await (await make(OWNER)).json();
    const res = await put(app, `/api/v1/brands/${brand.id}`, { name: 'Renamed' }, OWNER);
    expect(res.status).toBe(200);
    const rows = await db.select().from(brands).where(eq(brands.id, brand.id));
    expect(rows[0].name).toBe('Renamed');
  });
  it('404s and does not modify another user’s brand', async () => {
    const { brand } = await (await make(OWNER)).json();
    const res = await put(app, `/api/v1/brands/${brand.id}`, { name: 'Hacked' }, OTHER);
    expect(res.status).toBe(404);
    const rows = await db.select().from(brands).where(eq(brands.id, brand.id));
    expect(rows[0].name).not.toBe('Hacked');
  });
});

describe('DELETE /api/v1/brands/:id', () => {
  it('will not delete another user’s brand', async () => {
    const { brand } = await (await make(OWNER)).json();
    await del(app, `/api/v1/brands/${brand.id}`, OTHER);
    const rows = await db.select().from(brands).where(eq(brands.id, brand.id));
    expect(rows).toHaveLength(1);
  });

  it('deletes a non-default brand', async () => {
    const { brand } = await (await make(OWNER)).json();
    const res = await del(app, `/api/v1/brands/${brand.id}`, OWNER);
    expect(res.status).toBe(200);
    const rows = await db.select().from(brands).where(eq(brands.id, brand.id));
    expect(rows).toHaveLength(0);
  });

  it('deletes the default brand and hands the default to the next custom brand', async () => {
    await givePlan(db, OWNER, 'pro');
    const a = (await (await make(OWNER, 'A')).json()).brand;
    const b = (await (await make(OWNER, 'B')).json()).brand;
    await post(app, `/api/v1/brands/${a.id}/default`, {}, OWNER);
    const res = await del(app, `/api/v1/brands/${a.id}`, OWNER);
    expect(res.status).toBe(200);
    expect((await db.select().from(brands).where(eq(brands.id, a.id)))).toHaveLength(0);
    // b is the only custom brand left, so it inherits the default.
    const body = await (await get(app, '/api/v1/brands', OWNER)).json();
    expect(body.defaultBrandId).toBe(b.id);
  });

  it('falls back to a preset when the last custom brand (the default) is deleted', async () => {
    const a = (await (await make(OWNER, 'Only')).json()).brand;
    await post(app, `/api/v1/brands/${a.id}/default`, {}, OWNER);
    await del(app, `/api/v1/brands/${a.id}`, OWNER);
    const body = await (await get(app, '/api/v1/brands', OWNER)).json();
    expect(body.defaultBrandId).toBe('classic'); // first preset
  });

  it('leaves the default untouched when a non-default brand is deleted', async () => {
    await givePlan(db, OWNER, 'pro');
    const a = (await (await make(OWNER, 'A')).json()).brand;
    const b = (await (await make(OWNER, 'B')).json()).brand;
    await post(app, `/api/v1/brands/${a.id}/default`, {}, OWNER);
    await del(app, `/api/v1/brands/${b.id}`, OWNER);
    const body = await (await get(app, '/api/v1/brands', OWNER)).json();
    expect(body.defaultBrandId).toBe(a.id);
  });
});
