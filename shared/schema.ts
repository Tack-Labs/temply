import { sql } from 'drizzle-orm';
import { index, integer, pgTable, primaryKey, text, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Timestamps are text in SQLite's `datetime('now')` shape, which every row
 * copied from the SQLite database carries, so this default writes the same
 * shape. See shared/publish.ts before mixing it with ISO stamps.
 *
 * Every table turns row-level security on and has no policy. Only the API
 * reaches the database, as the owner role, which RLS does not restrict;
 * Supabase's anon and authenticated roles see no rows.
 */
const now = sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`;

export const mails = pgTable('mails', {
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
  share_token: text('share_token'),
}, (t) => [
  index('mails_org_id').on(t.org_id),
  uniqueIndex('mails_share_token').on(t.share_token),
]).enableRLS();

export const apiKeysTable = pgTable('api_keys', {
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
}, (t) => [
  index('api_keys_org_id').on(t.org_id),
  // Every integrator call finds its key by hash.
  index('api_keys_key_hash').on(t.key_hash),
]).enableRLS();

export const templateVersions = pgTable('template_versions', {
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
}, (t) => [
  index('template_versions_org_id').on(t.org_id),
  // One number per version of a template. Its leading column also serves
  // every lookup of a template's versions, which need no index of their own.
  uniqueIndex('template_versions_number').on(t.template_id, t.version_number),
]).enableRLS();

/**
 * A workspace's account: one row per organization, made on its first visit,
 * which is when its trial starts. `user_id` is who that was — not unique,
 * since one person can start several workspaces.
 */
export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  /** The organization this row belongs to; every query scopes on it.
   *  user_id stays as who did it. Null only on rows from before
   *  organizations, until adoption moves them. */
  org_id: text('org_id'),
  /** The Stripe customer made for this workspace at its first checkout.
   *  Webhooks find the row through it, so it is unique. */
  stripe_customer_id: text('stripe_customer_id'),
  /** The Stripe subscription that can still bill this workspace; null once
   *  it has ended, so nothing tries to change or cancel it again. */
  stripe_subscription_id: text('stripe_subscription_id'),
  /** When this row last read its subscription from Stripe. Two webhooks can
   *  read it a moment apart and write in the other order; a write that read
   *  earlier than this is dropped rather than rolling the plan back. */
  stripe_synced_at: text('stripe_synced_at'),
  /** `free` means nothing is paying; whether that is a trial or read-only
   *  is `trial_ends_at`'s to say. Otherwise the plan paid for. */
  plan: text('plan').notNull().default('free'),
  /** Stripe's word for the subscription (`active`, `past_due`, `canceled`…). */
  status: text('status').notNull().default('active'),
  /** Set when the row is made. Subscribing brings it forward to that moment,
   *  so a plan that later ends goes read-only rather than back to a trial. */
  trial_ends_at: text('trial_ends_at'),
  /** Members billed for, as the subscription last said. */
  seats: integer('seats'),
  template_packs: integer('template_packs').notNull().default(0),
  current_period_end: text('current_period_end'),
  /** When a cancellation made in the portal takes effect; null while the
   *  plan simply renews. The plan stays paid until this passes, so the
   *  page can say "ends 5 Oct" instead of pretending nothing happened. */
  cancel_at: text('cancel_at'),
  created_at: text('created_at').default(now),
  updated_at: text('updated_at').default(now),
}, (t) => [
  // Also serves every lookup by org: `org_id = $1` implies the predicate.
  uniqueIndex('subscriptions_org_id_unique').on(t.org_id).where(sql`${t.org_id} IS NOT NULL`),
  // Every Stripe webhook finds its row by customer.
  uniqueIndex('subscriptions_stripe_customer_id').on(t.stripe_customer_id).where(sql`${t.stripe_customer_id} IS NOT NULL`),
  index('subscriptions_user_id').on(t.user_id),
]).enableRLS();

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
export const apiUsage = pgTable(
  'api_usage',
  {
    user_id: text('user_id').notNull(),
    period: text('period').notNull(), // "YYYY-MM" in Europe/London
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.period] })],
).enableRLS();

export type ApiUsage = typeof apiUsage.$inferSelect;

/** One row per organization per UK calendar month, and a suffixed period
 *  for test keys. Replaces api_usage, which was keyed by user. */
export const orgUsage = pgTable(
  'org_usage',
  {
    org_id: text('org_id').notNull(),
    period: text('period').notNull(),
    count: integer('count').notNull().default(0),
    /** Calls past the included ones already sent to Stripe's meter for this
     *  month. See lib/overage.ts. */
    reported: integer('reported').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.org_id, t.period] })],
).enableRLS();

/**
 * How many calls a rate-limit bucket has let through in one window, keyed by
 * the window's start as an ISO timestamp. It lives in the database rather
 * than in the process so that every process running the API counts against
 * the same number. See lib/rate-limit.ts.
 */
export const rateWindows = pgTable(
  'rate_windows',
  {
    bucket: text('bucket').notNull(),
    window_start: text('window_start').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bucket, t.window_start] })],
).enableRLS();

export const brands = pgTable('brands', {
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
}, (t) => [index('brands_org_id').on(t.org_id)]).enableRLS();

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;

/** One row per user. `default_brand_id` points at the user's default look — a
 *  preset id (e.g. 'classic') or a custom brand id. Presets are not rows, so
 *  the default cannot live on the brands table. */
export const userPrefs = pgTable('user_prefs', {
  user_id: text('user_id').primaryKey(),
  default_brand_id: text('default_brand_id'),
}).enableRLS();

export type UserPrefs = typeof userPrefs.$inferSelect;

/** The organization's default look — same shape as user_prefs, keyed by
 *  org. The default is shared by the team, not per member. */
export const orgPrefs = pgTable('org_prefs', {
  org_id: text('org_id').primaryKey(),
  default_brand_id: text('default_brand_id'),
}).enableRLS();

/** Landing-page contact submissions. Stored before any delivery attempt, so a
 *  mail outage never loses a message. */
export const contactMessages = pgTable('contact_messages', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  message: text('message').notNull(),
  created_at: text('created_at').default(now),
}).enableRLS();

export type ContactMessage = typeof contactMessages.$inferSelect;

/** One row per image a user uploaded. `url` is the bare ImageKit URL — the
 *  email-safe transform is added by the client at insert time, so the same
 *  asset can serve a 240px thumbnail and a 1200px email image. */
export const assets = pgTable('assets', {
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
}, (t) => [
  index('assets_org_id').on(t.org_id),
  index('assets_user_id').on(t.user_id),
]).enableRLS();

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
