import * as schema from '@temply/shared/schema';
import { attachDatabasePool } from '@vercel/functions';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { Elysia } from 'elysia';
import { Pool } from 'pg';

/** The pool, a transaction inside it, or the PGlite database the tests run
 *  on: every caller takes any of the three. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let pool: Pool | null = null;
let db: Db | null = null;

/** Connections one instance may hold. Vercel advises against 1: it slows
 *  concurrent requests without lowering the total the pooler sees. */
export function poolSize(value = process.env.DB_POOL_MAX): number {
  if (!value) return 5;
  const size = Number(value);
  if (!Number.isInteger(size) || size < 1) throw new Error(`DB_POOL_MAX must be a positive integer, not "${value}".`);
  return size;
}

/**
 * DATABASE_URL is Supabase's transaction pooler, where a connection belongs
 * to us only for one transaction: nothing session-level (SET, advisory
 * locks, LISTEN) survives between statements. pg's unnamed statements are
 * safe there. The short idle timeout lets an instance that has gone quiet
 * give its connections back, and attachDatabasePool keeps a suspended
 * instance from holding them.
 */
function openPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');
  const opened = new Pool({
    connectionString: url,
    max: poolSize(),
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
    query_timeout: 15_000,
  });
  // The pooler can close an idle connection under us. The pool drops that
  // client by itself, but an 'error' event nobody listens for ends the
  // process.
  opened.on('error', (error) => console.warn('An idle database connection closed:', error.message));
  attachDatabasePool(opened);
  return opened;
}

/** The instance's one pool, made on first use (by a request or a job) so
 *  that importing the app, as `next build` and the tests do, connects to
 *  nothing. Constructing it opens no connection either. */
export function getDb(): Db {
  if (!db) {
    pool = openPool();
    db = drizzle(pool, { schema });
  }
  return db;
}

export async function closeDb() {
  const closing = pool;
  pool = null;
  db = null;
  await closing?.end();
}

export const dbPlugin = new Elysia({ name: 'db' })
  .derive({ as: 'global' }, () => ({ db: getDb() }));
