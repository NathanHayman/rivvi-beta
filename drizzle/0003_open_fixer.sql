ALTER TABLE "rivvi_call" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "rivvi_call" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "rivvi_row" ADD COLUMN "analysis" json;--> statement-breakpoint
ALTER TABLE "rivvi_row" ADD COLUMN "retry_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "rivvi_row" ADD COLUMN "call_attempts" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "rivvi_row" ADD COLUMN "metadata" json;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_call" ADD CONSTRAINT "rivvi_call_campaign_id_rivvi_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."rivvi_campaign"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_campaign_id_idx" ON "rivvi_call" USING btree ("campaign_id");--> statement-breakpoint
ALTER TABLE "rivvi_row" DROP COLUMN IF EXISTS "post_call_data";