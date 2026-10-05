ALTER TABLE "mails" ADD COLUMN "staged_content" text;--> statement-breakpoint
ALTER TABLE "mails" ADD COLUMN "staged_theme" text;--> statement-breakpoint
ALTER TABLE "mails" ADD COLUMN "staged_preview_text" text;--> statement-breakpoint
ALTER TABLE "mails" ADD COLUMN "staged_at" text;--> statement-breakpoint
ALTER TABLE "mails" ADD COLUMN "staged_by" text;--> statement-breakpoint
ALTER TABLE "mails" ADD COLUMN "review_requested_at" text;--> statement-breakpoint
ALTER TABLE "mails" ADD COLUMN "review_requested_by" text;--> statement-breakpoint
ALTER TABLE "mails" ADD COLUMN "returned_at" text;--> statement-breakpoint
ALTER TABLE "mails" ADD COLUMN "returned_by" text;--> statement-breakpoint
ALTER TABLE "mails" ADD COLUMN "return_note" text;