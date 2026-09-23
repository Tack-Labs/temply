import { Elysia } from 'elysia';
import { sql } from 'drizzle-orm';
import { json } from '../lib/errors';
import { dbPlugin } from '../plugins/db';

const startedAt = Date.now();

/**
 * What a load balancer or an uptime monitor asks. It reaches the database on
 * purpose: a process that answers but cannot read its own file is down in
 * every way that matters, and the 503 is what makes the platform restart it.
 * Lives under /api so the Next.js proxy carries it too — one request from
 * the edge then proves the whole chain.
 */
export const healthRoutes = new Elysia()
  .use(dbPlugin)
  .get('/api/health', ({ db }) => {
    try {
      db.get(sql`select 1`);
    } catch (error) {
      console.error('Health check: database unreachable', error);
      return json({ ok: false, db: 'unreachable' }, 503);
    }
    return json({ ok: true, db: 'ok', uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) });
  });
