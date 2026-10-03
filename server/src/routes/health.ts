import { Elysia } from 'elysia';
import { isTable, sql } from 'drizzle-orm';
import * as schema from '@temply/shared/schema';
import { json } from '../lib/errors';
import { dbPlugin } from '../plugins/db';

const startedAt = Date.now();
const tables = Object.values(schema).filter(isTable);

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
      // LIMIT 0 reads no customer data, but Postgres must resolve every
      // application table. A reachable, unmigrated database is not ready.
      await db.execute(sql`select 1 from ${sql.join(tables.map((table) => sql`${table}`), sql`, `)} limit 0`);
    } catch (error) {
      console.error('Health check: database unreachable', error);
      return json({ ok: false, db: 'unreachable' }, 503);
    }
    return json({ ok: true, db: 'ok', uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) });
  });
