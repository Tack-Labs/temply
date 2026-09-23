import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '@temply/shared/schema';
import { Elysia } from 'elysia';

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
  sqlite.run(`CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT UNIQUE, stripe_subscription_id TEXT,
    plan TEXT NOT NULL DEFAULT 'free', status TEXT NOT NULL DEFAULT 'active',
    current_period_end TEXT,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  )`);
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
    PRIMARY KEY (org_id, period)
  )`);
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

  addColumnIfMissing(sqlite, 'subscriptions', 'cancel_at', 'TEXT');

  // One-time migration: the top plan was renamed from `scale` to `enterprise`.
  sqlite.run(`UPDATE subscriptions SET plan = 'enterprise' WHERE plan = 'scale'`);

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

export const dbPlugin = new Elysia({ name: 'db' })
  .derive({ as: 'global' }, () => {
    if (!db) {
      const dbPath = process.env.SQLITE_DB_PATH || 'maily.db';
      const sqlite = new Database(dbPath);
      sqlite.run('PRAGMA journal_mode = WAL');
      sqlite.run('PRAGMA foreign_keys = ON');
      initTables(sqlite);
      backfillShortCodes(sqlite);
      db = drizzle(sqlite, { schema });
    }
    return { db };
  });
