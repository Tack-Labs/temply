import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

/** Drizzle sends an explicit NULL for omitted columns, so a default declared
 *  only in the DDL never fires — it has to live here to reach any insert. */
const now = sql`(datetime('now'))`;

export const mails = sqliteTable('mails', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  /** The organization this row belongs to; every query scopes on it.
   *  user_id stays as who did it. Null only on rows from before
   *  organizations, until adoption moves them. */
  org_id: text('org_id'),
  title: text('title').notNull(),
  preview_text: text('preview_text'),
  content: text('content').notNull(),
  /** Serialised RendererThemeOptions. Null means the shipped defaults. */
  theme: text('theme'),
  short_code: text('short_code').unique(),
  created_at: text('created_at').default(now),
  updated_at: text('updated_at').default(now),
  /**
   * The copy the public API renders. `content`, `theme` and `preview_text`
   * above are the draft the editor works on; nothing reaches an integrator
   * until the author publishes, which copies the draft here. A null
   * published_at means never published — the API answers 404 until then.
   * "Unpublished changes" is `updated_at !== published_at`: publishing
   * writes the same stamp to both, a draft save bumps only updated_at.
   */
  published_content: text('published_content'),
  published_theme: text('published_theme'),
  published_preview_text: text('published_preview_text'),
  published_at: text('published_at'),
  /** A review link's secret: anyone holding it can view the draft, signed
   *  out. Null means no link. Turning the link off clears it; making a new
   *  one mints a new secret, so an old link stays dead. */
  share_token: text('share_token').unique(),
});

export const apiKeysTable = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  /** The organization this row belongs to; every query scopes on it.
   *  user_id stays as who did it. Null only on rows from before
   *  organizations, until adoption moves them. */
  org_id: text('org_id'),
  name: text('name').notNull(),
  key_prefix: text('key_prefix').notNull(),
  key_hash: text('key_hash').notNull(),
  /**
   * `live` renders the published copy and spends the plan's quota. `test`
   * renders the draft, is free on every plan, and has its own small monthly
   * cap — for staging, never for sending.
   */
  mode: text('mode', { enum: ['live', 'test'] }).notNull().default('live'),
  created_at: text('created_at').default(now),
  last_used_at: text('last_used_at'),
  revoked_at: text('revoked_at'),
});

export const templateVersions = sqliteTable('template_versions', {
  id: text('id').primaryKey(),
  template_id: text('template_id').notNull(),
  user_id: text('user_id').notNull(),
  /** The organization this row belongs to; every query scopes on it.
   *  user_id stays as who did it. Null only on rows from before
   *  organizations, until adoption moves them. */
  org_id: text('org_id'),
  title: text('title').notNull(),
  preview_text: text('preview_text'),
  content: text('content').notNull(),
  /** Serialised RendererThemeOptions at snapshot time. Null on versions from
   *  before this column existed — "unknown", not "no theme". */
  theme: text('theme'),
  version_number: integer('version_number').notNull(),
  created_at: text('created_at').default(now),
});

export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().unique(),
  /** The organization this row belongs to; every query scopes on it.
   *  user_id stays as who did it. Null only on rows from before
   *  organizations, until adoption moves them. */
  org_id: text('org_id'),
  /** The Lemon Squeezy subscription that can still bill this workspace;
   *  null once it has expired, so nothing tries to cancel it again. */
  lemonsqueezy_subscription_id: text('lemonsqueezy_subscription_id'),
  /** The subscription's own `updated_at` as of the event this row last
   *  took. Webhooks can arrive out of order, and one older than this is
   *  dropped rather than rolling the plan back. */
  lemonsqueezy_updated_at: text('lemonsqueezy_updated_at'),
  plan: text('plan').notNull().default('free'),
  status: text('status').notNull().default('active'),
  current_period_end: text('current_period_end'),
  /** When a cancellation made in the portal takes effect; null while the
   *  plan simply renews. The plan stays paid until this passes, so the
   *  page can say "ends 5 Oct" instead of pretending nothing happened. */
  cancel_at: text('cancel_at'),
  created_at: text('created_at').default(now),
  updated_at: text('updated_at').default(now),
});

export type Mail = typeof mails.$inferSelect;
export type NewMail = typeof mails.$inferInsert;

export type ApiKey = typeof apiKeysTable.$inferSelect;
export type NewApiKey = typeof apiKeysTable.$inferInsert;

export type TemplateVersion = typeof templateVersions.$inferSelect;
export type NewTemplateVersion = typeof templateVersions.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

/** One row per user per UK calendar month. Counts successful public API
 *  template fetches. */
export const apiUsage = sqliteTable(
  'api_usage',
  {
    user_id: text('user_id').notNull(),
    period: text('period').notNull(), // "YYYY-MM" in Europe/London
    count: integer('count').notNull().default(0),
  },
  (t) => ({ pk: primaryKey({ columns: [t.user_id, t.period] }) }),
);

export type ApiUsage = typeof apiUsage.$inferSelect;

/** One row per organization per UK calendar month, and a suffixed period
 *  for test keys. Replaces api_usage, which was keyed by user. */
export const orgUsage = sqliteTable(
  'org_usage',
  {
    org_id: text('org_id').notNull(),
    period: text('period').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => ({ pk: primaryKey({ columns: [t.org_id, t.period] }) }),
);

/**
 * How many calls a rate-limit bucket has let through in one window, keyed by
 * the window's start as an ISO timestamp. It lives in the database rather
 * than in the process so that every process running the API counts against
 * the same number. See lib/rate-limit.ts.
 */
export const rateWindows = sqliteTable(
  'rate_windows',
  {
    bucket: text('bucket').notNull(),
    window_start: text('window_start').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => ({ pk: primaryKey({ columns: [t.bucket, t.window_start] }) }),
);

export const brands = sqliteTable('brands', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  /** The organization this row belongs to; every query scopes on it.
   *  user_id stays as who did it. Null only on rows from before
   *  organizations, until adoption moves them. */
  org_id: text('org_id'),
  name: text('name').notNull(),
  /** Serialised RendererThemeOptions. */
  theme: text('theme').notNull(),
  is_default: integer('is_default').notNull().default(0),
  created_at: text('created_at').default(now),
  updated_at: text('updated_at').default(now),
});

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;

/** One row per user. `default_brand_id` points at the user's default look — a
 *  preset id (e.g. 'classic') or a custom brand id. Presets are not rows, so
 *  the default cannot live on the brands table. */
export const userPrefs = sqliteTable('user_prefs', {
  user_id: text('user_id').primaryKey(),
  default_brand_id: text('default_brand_id'),
});

export type UserPrefs = typeof userPrefs.$inferSelect;

/** The organization's default look — same shape as user_prefs, keyed by
 *  org. The default is shared by the team, not per member. */
export const orgPrefs = sqliteTable('org_prefs', {
  org_id: text('org_id').primaryKey(),
  default_brand_id: text('default_brand_id'),
});

/** Landing-page contact submissions. Stored before any delivery attempt, so a
 *  mail outage never loses a message. */
export const contactMessages = sqliteTable('contact_messages', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  message: text('message').notNull(),
  created_at: text('created_at').default(now),
});

export type ContactMessage = typeof contactMessages.$inferSelect;

/** One row per image a user uploaded. `url` is the bare ImageKit URL — the
 *  email-safe transform is added by the client at insert time, so the same
 *  asset can serve a 240px thumbnail and a 1200px email image. */
export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  /** The organization this row belongs to; every query scopes on it.
   *  user_id stays as who did it. Null only on rows from before
   *  organizations, until adoption moves them. */
  org_id: text('org_id'),
  imagekit_file_id: text('imagekit_file_id').notNull(),
  url: text('url').notNull(),
  name: text('name').notNull(),
  mime: text('mime').notNull(),
  bytes: integer('bytes').notNull(),
  width: integer('width'),
  height: integer('height'),
  created_at: text('created_at').default(now),
});

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
