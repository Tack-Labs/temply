import { Elysia } from 'elysia';
import { sql } from 'drizzle-orm';
import { json } from '../lib/errors';
import { dbPlugin } from '../plugins/db';

const startedAt = Date.now();

/**
 * What the uptime monitor and the deploy check ask. It reaches the database
 * on purpose: an app that answers but cannot query is down in every way that
 * matters, and the 503 is what pages someone. Lives under /api so the
 * Next.js route carries it too, and one request from outside then proves
 * the whole chain.
 */
export const healthRoutes = new Elysia()
  .use(dbPlugin)
  .get('/api/health', async ({ db }) => {
    try {
      await db.execute(sql`select 1`);
    } catch (error) {
      console.error('Health check: database unreachable', error);
      return json({ ok: false, db: 'unreachable' }, 503);
    }
    return json({ ok: true, db: 'ok', uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) });
  });
