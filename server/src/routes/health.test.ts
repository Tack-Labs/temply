import { describe, expect, it } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@temply/shared/schema';
import { createTestApp, createTestDb, get } from '../test/helpers';
import { healthRoutes } from './health';

describe('GET /api/health', () => {
  it('answers 200 with the database reachable', async () => {
    const app = createTestApp(await createTestDb(), healthRoutes);
    const res = await get(app, '/api/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; db: string; uptimeSeconds: number };
    expect(body.ok).toBe(true);
    expect(body.db).toBe('ok');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('needs no session', async () => {
    const app = createTestApp(await createTestDb(), healthRoutes);
    expect((await get(app, '/api/health', null)).status).toBe(200);
  });

  it('answers 503 for a reachable database without the application schema', async () => {
    const database = new PGlite();
    try {
      const app = createTestApp(drizzle(database, { schema }), healthRoutes);
      const res = await get(app, '/api/health');
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ ok: false, db: 'unreachable' });
    } finally {
      await database.close();
    }
  });
});
