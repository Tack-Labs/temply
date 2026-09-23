/**
 * Snapshots the SQLite database to a timestamped file and prunes old ones.
 *
 *   bun run db:backup                # writes ./backups/temply-YYYYMMDD-HHMMSS.db
 *   BACKUP_DIR=/mnt/backups bun run db:backup
 *
 * `VACUUM INTO` is the online-safe way: it reads a consistent snapshot
 * through SQLite itself while the server keeps writing, where copying the
 * file would catch it mid-transaction. Run it from cron (hourly is cheap —
 * the file is small) and ship the directory somewhere off the machine; a
 * backup on the same disk as the database is a backup of nothing.
 */
import { Database } from 'bun:sqlite';
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const source = process.env.SQLITE_DB_PATH || 'maily.db';
const dir = process.env.BACKUP_DIR || 'backups';
const keep = Number(process.env.BACKUP_KEEP || 48);

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
const target = join(dir, `temply-${stamp}.db`);

mkdirSync(dir, { recursive: true });
const db = new Database(source, { readonly: true });
db.run(`VACUUM INTO ${JSON.stringify(target)}`);
db.close();

const bytes = statSync(target).size;
console.log(`Backed up ${source} → ${target} (${(bytes / 1024).toFixed(0)} KB)`);

// Oldest first, keep the newest `keep`.
const backups = readdirSync(dir)
  .filter((name) => /^temply-\d{8}-\d{6}\.db$/.test(name))
  .sort();
for (const name of backups.slice(0, Math.max(0, backups.length - keep))) {
  unlinkSync(join(dir, name));
  console.log(`Pruned ${name}`);
}
