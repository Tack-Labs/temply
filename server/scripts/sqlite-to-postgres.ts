/**
 * Copies a snapshot of the SQLite database into Postgres, once, at the
 * cutover (handoff.md §6.6 rehearses it on staging).
 *
 *   MIGRATION_DATABASE_URL=… bun run scripts/sqlite-to-postgres.ts <snapshot.db>
 *
 * The target must already be migrated (`bun run db:migrate`). Everything
 * happens in one transaction: each table is emptied and refilled, and the
 * row counts are compared before it commits, so a run that fails or finds a
 * mismatch leaves the target as it was, and running it again is as safe as
 * the first time.
 *
 * Columns come from the Postgres schema, not the snapshot. A column only an
 * older SQLite shape has, such as the Lemon Squeezy branch's
 * `lemonsqueezy_*`, has nowhere to go and nothing reads it; one the
 * snapshot lacks is left to its default.
 */
import { Database } from 'bun:sqlite';
import { getTableColumns, getTableName } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { Client } from 'pg';
import * as schema from '@temply/shared/schema';

/** Every table but rate_windows: no row in it is older than a day, and
 *  starting it empty resets each limit once. Nothing here has a foreign
 *  key, so the order is free. */
const TABLES: PgTable[] = [
  schema.mails,
  schema.apiKeysTable,
  schema.templateVersions,
  schema.subscriptions,
  schema.apiUsage,
  schema.orgUsage,
  schema.brands,
  schema.userPrefs,
  schema.orgPrefs,
  schema.contactMessages,
  schema.assets,
];

/** Postgres takes at most 65,535 parameters in one statement: a batch this
 *  size of the widest table stays far under it. */
const BATCH_ROWS = 1000;

/** The names come from our own schema; quoting keeps a reserved word safe. */
const quoteSqlite = (name: string) => `"${name.replaceAll('"', '""')}"`;

/** Empty when the snapshot predates the table. */
function sourceColumns(sqlite: Database, table: string): Set<string> {
  const rows = sqlite.query('select name from pragma_table_info(?)').all(table) as { name: string }[];
  return new Set(rows.map((row) => row.name));
}

async function insertBatch(pg: Client, table: string, columns: string[], rows: unknown[][]): Promise<void> {
  const tuples = rows.map((_, r) => `(${columns.map((_, c) => `$${r * columns.length + c + 1}`).join(', ')})`);
  const names = columns.map((column) => pg.escapeIdentifier(column)).join(', ');
  await pg.query(`insert into ${pg.escapeIdentifier(table)} (${names}) values ${tuples.join(', ')}`, rows.flat());
}

async function copyTable(sqlite: Database, pg: Client, table: PgTable): Promise<void> {
  const name = getTableName(table);
  const present = sourceColumns(sqlite, name);
  const columns = Object.values(getTableColumns(table)).map((column) => column.name).filter((column) => present.has(column));
  if (!columns.length) return;
  const select = sqlite.query(`select ${columns.map(quoteSqlite).join(', ')} from ${quoteSqlite(name)}`);
  let batch: unknown[][] = [];
  for (const row of select.iterate() as IterableIterator<Record<string, unknown>>) {
    batch.push(columns.map((column) => row[column]));
    if (batch.length === BATCH_ROWS) {
      await insertBatch(pg, name, columns, batch);
      batch = [];
    }
  }
  if (batch.length) await insertBatch(pg, name, columns, batch);
}

function sourceCount(sqlite: Database, table: string): number {
  if (!sourceColumns(sqlite, table).size) return 0;
  return (sqlite.query(`select count(*) as n from ${quoteSqlite(table)}`).get() as { n: number }).n;
}

/** Prints each table's count on both sides; true when every pair agrees. */
async function countsMatch(sqlite: Database, pg: Client): Promise<boolean> {
  let matched = true;
  for (const table of TABLES.map(getTableName)) {
    const from = sourceCount(sqlite, table);
    const { rows } = await pg.query<{ n: number }>(`select count(*)::int as n from ${pg.escapeIdentifier(table)}`);
    const to = rows[0].n;
    console.log(`${table.padEnd(18)} ${String(from).padStart(8)} → ${String(to).padStart(8)}${from === to ? '' : '  differs'}`);
    matched &&= from === to;
  }
  return matched;
}

/** Commits only when every count agrees, and says whether it did. */
async function copy(snapshot: string, url: string): Promise<boolean> {
  const sqlite = new Database(snapshot, { readonly: true });
  const pg = new Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
  await pg.connect();
  try {
    await pg.query('begin');
    await pg.query(`truncate ${TABLES.map((table) => pg.escapeIdentifier(getTableName(table))).join(', ')}`);
    for (const table of TABLES) await copyTable(sqlite, pg, table);
    const matched = await countsMatch(sqlite, pg);
    await pg.query(matched ? 'commit' : 'rollback');
    return matched;
  } catch (error) {
    await pg.query('rollback');
    throw error;
  } finally {
    await pg.end();
    sqlite.close();
  }
}

const [snapshot] = process.argv.slice(2);
const url = process.env.MIGRATION_DATABASE_URL;
if (!snapshot || !url) {
  console.error('Usage: MIGRATION_DATABASE_URL=… bun run scripts/sqlite-to-postgres.ts <snapshot.db>');
  process.exit(1);
}
if (!(await copy(snapshot, url))) {
  console.error('Row counts differ: nothing was committed.');
  process.exit(1);
}
console.log('Copied and committed.');
