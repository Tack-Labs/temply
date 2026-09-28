CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"mode" text DEFAULT 'live' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'),
	"last_used_at" text,
	"revoked_at" text
);
--> statement-breakpoint
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "api_usage" (
	"user_id" text NOT NULL,
	"period" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_usage_user_id_period_pk" PRIMARY KEY("user_id","period")
);
--> statement-breakpoint
ALTER TABLE "api_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text,
	"imagekit_file_id" text NOT NULL,
	"url" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
);
--> statement-breakpoint
ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brands" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text,
	"name" text NOT NULL,
	"theme" text NOT NULL,
	"is_default" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'),
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
);
--> statement-breakpoint
ALTER TABLE "brands" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"message" text NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
);
--> statement-breakpoint
ALTER TABLE "contact_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mails" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text,
	"title" text NOT NULL,
	"preview_text" text,
	"content" text NOT NULL,
	"theme" text,
	"short_code" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'),
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'),
	"published_content" text,
	"published_theme" text,
	"published_preview_text" text,
	"published_at" text,
	"share_token" text,
	CONSTRAINT "mails_short_code_unique" UNIQUE("short_code")
);
--> statement-breakpoint
ALTER TABLE "mails" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "org_prefs" (
	"org_id" text PRIMARY KEY NOT NULL,
	"default_brand_id" text
);
--> statement-breakpoint
ALTER TABLE "org_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "org_usage" (
	"org_id" text NOT NULL,
	"period" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reported" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "org_usage_org_id_period_pk" PRIMARY KEY("org_id","period")
);
--> statement-breakpoint
ALTER TABLE "org_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rate_windows" (
	"bucket" text NOT NULL,
	"window_start" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_windows_bucket_window_start_pk" PRIMARY KEY("bucket","window_start")
);
--> statement-breakpoint
ALTER TABLE "rate_windows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_synced_at" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"trial_ends_at" text,
	"seats" integer,
	"template_packs" integer DEFAULT 0 NOT NULL,
	"current_period_end" text,
	"cancel_at" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'),
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "template_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text,
	"title" text NOT NULL,
	"preview_text" text,
	"content" text NOT NULL,
	"theme" text,
	"version_number" integer NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
);
--> statement-breakpoint
ALTER TABLE "template_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_prefs" (
	"user_id" text PRIMARY KEY NOT NULL,
	"default_brand_id" text
);
--> statement-breakpoint
ALTER TABLE "user_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "api_keys_org_id" ON "api_keys" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "api_keys_key_hash" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "assets_org_id" ON "assets" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "assets_user_id" ON "assets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "brands_org_id" ON "brands" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "mails_org_id" ON "mails" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mails_share_token" ON "mails" USING btree ("share_token");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_org_id_unique" ON "subscriptions" USING btree ("org_id") WHERE "subscriptions"."org_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_stripe_customer_id" ON "subscriptions" USING btree ("stripe_customer_id") WHERE "subscriptions"."stripe_customer_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "subscriptions_user_id" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "template_versions_org_id" ON "template_versions" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "template_versions_number" ON "template_versions" USING btree ("template_id","version_number");