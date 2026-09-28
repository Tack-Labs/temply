import { Client } from 'pg';
import { migrateTo } from '../server/scripts/migrate';
import { DATABASE, DATABASE_PREFIX, POSTGRES_URL, databaseUrl } from './env';

/**
 * This run's database, made ready before the client is built. Earlier runs'
 * go here rather than in a teardown of their own: the server holding one
 * open outlives globalTeardown. Only this checkout's are touched, and this
 * run's is kept if it exists, so `E2E_RUN_ID` can reuse one.
 */
const admin = new Client({ connectionString: POSTGRES_URL, connectionTimeoutMillis: 10_000 });
await admin.connect();
try {
  const { rows } = await admin.query<{ datname: string }>('select datname from pg_database where starts_with(datname, $1)', [DATABASE_PREFIX]);
  for (const { datname } of rows) {
    if (datname !== DATABASE) await admin.query(`drop database ${admin.escapeIdentifier(datname)} with (force)`);
  }
  if (!rows.some(({ datname }) => datname === DATABASE)) await admin.query(`create database ${admin.escapeIdentifier(DATABASE)}`);
} finally {
  await admin.end();
}
await migrateTo(databaseUrl(DATABASE));
