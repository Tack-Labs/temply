import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';

export const MIGRATIONS = fileURLToPath(new URL('../drizzle', import.meta.url));

/** Applies every migration in server/drizzle/ that the database lacks, all
 *  in one transaction. */
export async function migrateTo(url: string) {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS });
  } finally {
    await client.end();
  }
}

/**
 * CI runs this after the build succeeds and before the deploy, so a failed
 * migration leaves the running release serving. It uses the session pooler
 * (:5432): the direct connection is IPv6-only, and GitHub's runners have no
 * IPv6. The previous release keeps running against the new schema until
 * the deploy lands, and Instant Rollback brings it back without undoing
 * anything here, so migrations only ever expand (CLAUDE.md).
 */
if (import.meta.main) {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) {
    console.error('MIGRATION_DATABASE_URL is not set.');
    process.exit(1);
  }
  await migrateTo(url);
  console.log('Migrations applied.');
}
