import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '@temply/shared/schema';
import { Elysia } from 'elysia';
import { TRIAL_DAYS } from '@temply/shared/plans';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

let db: Db | null = null;

export function initTables(sqlite: Database) {
  sqlite.run(`CREATE TABLE IF NOT EXISTS mails (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL,
    preview_text TEXT, content TEXT NOT NULL, short_code TEXT UNIQUE,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  )`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
    key_prefix TEXT NOT NULL, key_hash TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'live',
    created_at TEXT DEFAULT (datetime('now')), last_used_at TEXT, revoked_at TEXT
  )`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS template_versions (
    id TEXT PRIMARY KEY, template_id TEXT NOT NULL, user_id TEXT NOT NULL,
    title TEXT NOT NULL, preview_text TEXT, content TEXT NOT NULL,
    version_number INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now'))
  )`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS subscriptions (${SUBSCRIPTION_COLUMNS})`);
  rebuildSubscriptions(sqlite);
  sqlite.run(`CREATE TABLE IF NOT EXISTS api_usage (
    user_id TEXT NOT NULL, period TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, period)
  )`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
    theme TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  )`);
  // The default look is a preset id or a custom brand id, so it can't live on
  // the brands table (presets are not rows).
  sqlite.run(`CREATE TABLE IF NOT EXISTS user_prefs (
    user_id TEXT PRIMARY KEY, default_brand_id TEXT
  )`);
  // Carry over any pre-existing default from the old is_default column.
  sqlite.run(`INSERT OR IGNORE INTO user_prefs (user_id, default_brand_id)
    SELECT user_id, id FROM brands WHERE is_default = 1`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
    message TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))
  )`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
    imagekit_file_id TEXT NOT NULL, url TEXT NOT NULL,
    name TEXT NOT NULL, mime TEXT NOT NULL, bytes INTEGER NOT NULL,
    width INTEGER, height INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS assets_user_id ON assets(user_id)`);
  // Every integrator call finds its key by hash.
  sqlite.run(`CREATE INDEX IF NOT EXISTS api_keys_key_hash ON api_keys(key_hash)`);
  // One number per version of a template. Its leading column also serves
  // every lookup of a template's versions, which need no index of their own.
  renumberClashingVersions(sqlite);
  sqlite.run(`CREATE UNIQUE INDEX IF NOT EXISTS template_versions_number ON template_versions(template_id, version_number)`);

  addColumnIfMissing(sqlite, 'mails', 'theme', 'TEXT');
  addColumnIfMissing(sqlite, 'template_versions', 'theme', 'TEXT');
  // Every key from before test keys existed was a live one.
  addColumnIfMissing(sqlite, 'api_keys', 'mode', "TEXT NOT NULL DEFAULT 'live'");

  // Organizations. Every scoped row learns which org it belongs to; rows
  // from before stay null until the owner's first visit adopts them (see
  // routes/workspace.ts). Usage and prefs move to org-keyed tables.
  for (const table of ['mails', 'api_keys', 'template_versions', 'subscriptions', 'brands', 'assets']) {
    addColumnIfMissing(sqlite, table, 'org_id', 'TEXT');
    sqlite.run(`CREATE INDEX IF NOT EXISTS ${table}_org_id ON ${table}(org_id)`);
  }
  sqlite.run(`CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_org_id_unique ON subscriptions(org_id) WHERE org_id IS NOT NULL`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS org_usage (
    org_id TEXT NOT NULL, period TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
    reported INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (org_id, period)
  )`);
  addColumnIfMissing(sqlite, 'org_usage', 'reported', 'INTEGER NOT NULL DEFAULT 0');
  sqlite.run(`CREATE TABLE IF NOT EXISTS org_prefs (
    org_id TEXT PRIMARY KEY, default_brand_id TEXT
  )`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS rate_windows (
    bucket TEXT NOT NULL, window_start TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (bucket, window_start)
  )`);

  // Draft / published split. Rows from before it exist only as a single copy
  // the API was already serving, so that copy becomes the published one and
  // nothing an integrator fetches changes. Create and duplicate publish in
  // the same request, so a row with no published_at at startup can only be
  // one of those legacy rows — the backfill is safe to run every boot.
  addColumnIfMissing(sqlite, 'mails', 'published_content', 'TEXT');
  addColumnIfMissing(sqlite, 'mails', 'published_theme', 'TEXT');
  addColumnIfMissing(sqlite, 'mails', 'published_preview_text', 'TEXT');
  addColumnIfMissing(sqlite, 'mails', 'published_at', 'TEXT');
  addColumnIfMissing(sqlite, 'mails', 'share_token', 'TEXT');
  sqlite.run(`CREATE UNIQUE INDEX IF NOT EXISTS mails_share_token ON mails(share_token)`);
  sqlite.run(`UPDATE mails SET
    published_content = content, published_theme = theme,
    published_preview_text = preview_text, published_at = updated_at
    WHERE published_at IS NULL`);

  // Every Stripe webhook finds its row by customer.
  sqlite.run(`CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS subscriptions_user_id ON subscriptions(user_id)`);

  // One-time migrations: the top plan was renamed from `scale` to
  // `enterprise`, and Pro became Team when pricing went per member.
  sqlite.run(`UPDATE subscriptions SET plan = 'enterprise' WHERE plan = 'scale'`);
  sqlite.run(`UPDATE subscriptions SET plan = 'team' WHERE plan = 'pro'`);
  // Rows from before trials: a workspace on the old free plan gets a full
  // trial from the day this ships, and one already paying has had its trial,
  // so a plan that ends later goes read-only rather than back to a trial.
  sqlite.run(`UPDATE subscriptions SET trial_ends_at = CASE
      WHEN plan = 'free' THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+${TRIAL_DAYS} days')
      ELSE strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END
    WHERE trial_ends_at IS NULL`);

  // Heal timestamps: Drizzle used to send explicit NULLs past the DDL
  // defaults, so every historic row is missing its dates. Idempotent — only
  // NULLs are touched, and only once.
  for (const [table, cols] of [
    ['mails', ['created_at', 'updated_at']],
    ['api_keys', ['created_at']],
    ['template_versions', ['created_at']],
    ['subscriptions', ['created_at', 'updated_at']],
    ['brands', ['created_at', 'updated_at']],
    ['contact_messages', ['created_at']],
  ] as const) {
    for (const col of cols) {
      sqlite.run(`UPDATE ${table} SET ${col} = datetime('now') WHERE ${col} IS NULL`);
    }
  }
}

/**
 * A unique index refuses to build over a clash, and a boot that fails takes
 * the service down. Versions used to be numbered by reading the highest and
 * writing the next, so two publishes of one template at once could have
 * shared a number. The later copy moves to the top of its template's
 * history; nothing is deleted. Runs only until the index exists.
 */
function renumberClashingVersions(sqlite: Database) {
  if (sqlite.query(`SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'template_versions_number'`).get()) return;
  const clashes = sqlite
    .query(`SELECT v.id, v.template_id FROM template_versions v WHERE EXISTS (
      SELECT 1 FROM template_versions o
      WHERE o.template_id = v.template_id AND o.version_number = v.version_number AND o.rowid < v.rowid
    ) ORDER BY v.rowid`)
    .all() as Array<{ id: string; template_id: string }>;
  const renumber = sqlite.prepare(`UPDATE template_versions
    SET version_number = (SELECT MAX(version_number) + 1 FROM template_versions WHERE template_id = ?)
    WHERE id = ?`);
  sqlite.transaction(() => {
    for (const clash of clashes) renumber.run(clash.template_id, clash.id);
  })();
}

/** No UNIQUE here: uniqueness lives in the indexes initTables builds, where a
 *  later change can drop it without rebuilding the table. */
const SUBSCRIPTION_COLUMNS = `
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, org_id TEXT,
    stripe_customer_id TEXT, stripe_subscription_id TEXT, stripe_synced_at TEXT,
    plan TEXT NOT NULL DEFAULT 'free', status TEXT NOT NULL DEFAULT 'active',
    trial_ends_at TEXT, seats INTEGER, template_packs INTEGER NOT NULL DEFAULT 0,
    current_period_end TEXT, cancel_at TEXT,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))`;

const SUBSCRIPTION_COLUMN_NAMES = [
  'id', 'user_id', 'org_id', 'stripe_customer_id', 'stripe_subscription_id', 'stripe_synced_at',
  'plan', 'status', 'trial_ends_at', 'seats', 'template_packs', 'current_period_end', 'cancel_at',
  'created_at', 'updated_at',
];

/**
 * The table used to hold one row per user, UNIQUE on user_id — which refused
 * a second workspace started by the same person — and SQLite cannot drop a
 * constraint in place. So a table still declaring one, or missing a column,
 * is copied into the current shape and swapped in, keeping every column the
 * two share. The Lemon Squeezy columns of a database from that unreleased
 * branch are left behind. Runs only while the table is out of date.
 */
function rebuildSubscriptions(sqlite: Database) {
  const table = sqlite.query(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'subscriptions'`).get() as { sql: string } | null;
  if (!table) return;
  const existing = new Set((sqlite.query(`PRAGMA table_info(subscriptions)`).all() as Array<{ name: string }>).map((c) => c.name));
  if (!/\bUNIQUE\b/i.test(table.sql) && SUBSCRIPTION_COLUMN_NAMES.every((c) => existing.has(c))) return;
  const shared = SUBSCRIPTION_COLUMN_NAMES.filter((c) => existing.has(c)).join(', ');
  sqlite.transaction(() => {
    sqlite.run(`CREATE TABLE subscriptions_rebuilt (${SUBSCRIPTION_COLUMNS})`);
    sqlite.run(`INSERT INTO subscriptions_rebuilt (${shared}) SELECT ${shared} FROM subscriptions`);
    sqlite.run(`DROP TABLE subscriptions`);
    sqlite.run(`ALTER TABLE subscriptions_rebuilt RENAME TO subscriptions`);
  })();
}

/** SQLite has no `ADD COLUMN IF NOT EXISTS`, and existing installs already have
 *  the table, so widen it here rather than in the CREATE above. */
function addColumnIfMissing(sqlite: Database, table: string, column: string, type: string) {
  const columns = sqlite.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (columns.some((c) => c.name === column)) return;
  sqlite.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function simpleShortCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let code = 'tpl_';
  for (let i = 0; i < 8; i++) code += BASE62[bytes[i] % 62];
  return code;
}

export function backfillShortCodes(sqlite: Database) {
  const row = sqlite.prepare("SELECT COUNT(*) as count FROM mails WHERE short_code IS NULL").get() as { count: number };
  if (!row?.count) return;
  const rows = sqlite.prepare("SELECT id FROM mails WHERE short_code IS NULL").all() as { id: string }[];
  const update = sqlite.prepare("UPDATE mails SET short_code = ? WHERE id = ?");
  const tx = sqlite.transaction(() => {
    for (const r of rows) {
      let code: string;
      do code = simpleShortCode(); while (sqlite.prepare("SELECT 1 FROM mails WHERE short_code = ?").get(code));
      update.run(code, r.id);
    }
  });
  tx();
}

/** Closing the last connection folds the write-ahead log back into the
 *  database file, so a copy of the volume taken afterwards is whole. */
export function closeDb() {
  db?.$client.close();
  db = null;
}

/** The process's one connection, opened on first use — by a request, or by
 *  a job that runs outside one. */
export function getDb(): Db {
  if (!db) {
    const dbPath = process.env.SQLITE_DB_PATH || 'maily.db';
    const sqlite = new Database(dbPath);
    sqlite.run('PRAGMA journal_mode = WAL');
    sqlite.run('PRAGMA foreign_keys = ON');
    initTables(sqlite);
    backfillShortCodes(sqlite);
    db = drizzle(sqlite, { schema });
  }
  return db;
}

export const dbPlugin = new Elysia({ name: 'db' })
  .derive({ as: 'global' }, () => ({ db: getDb() }));
