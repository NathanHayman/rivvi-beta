ALTER TABLE "rivvi_campaign_request" ADD COLUMN "main_goal" text;--> statement-breakpoint
ALTER TABLE "rivvi_campaign_request" ADD COLUMN "desired_analysis" json;--> statement-breakpoint
ALTER TABLE "rivvi_campaign_request" ADD COLUMN "example_sheets" json;