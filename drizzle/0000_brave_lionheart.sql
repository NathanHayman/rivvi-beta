DO $$ BEGIN
 CREATE TYPE "public"."call_direction" AS ENUM('inbound', 'outbound');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."call_status" AS ENUM('pending', 'in-progress', 'completed', 'failed', 'voicemail', 'no-answer');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."campaign_request_status" AS ENUM('pending', 'approved', 'rejected', 'completed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."row_status" AS ENUM('pending', 'calling', 'completed', 'failed', 'skipped');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."run_status" AS ENUM('draft', 'processing', 'ready', 'running', 'paused', 'completed', 'failed', 'scheduled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rivvi_agent_variation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_input" text NOT NULL,
	"original_base_prompt" text NOT NULL,
	"original_voicemail_message" text,
	"customized_prompt" text NOT NULL,
	"customized_voicemail_message" text,
	"suggested_run_name" varchar(256),
	"change_description" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rivvi_call" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"run_id" uuid,
	"campaign_id" uuid,
	"row_id" uuid,
	"patient_id" uuid,
	"agent_id" varchar(256) NOT NULL,
	"direction" "call_direction" NOT NULL,
	"status" "call_status" DEFAULT 'pending' NOT NULL,
	"retell_call_id" varchar(256) NOT NULL,
	"recording_url" varchar(512),
	"to_number" varchar(20) NOT NULL,
	"from_number" varchar(20) NOT NULL,
	"metadata" json,
	"analysis" json,
	"transcript" text,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"duration" integer,
	"error" text,
	"related_outbound_call_id" uuid,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rivvi_campaign_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"requested_by" uuid,
	"name" varchar(256) NOT NULL,
	"direction" "call_direction" DEFAULT 'outbound' NOT NULL,
	"description" text NOT NULL,
	"status" "campaign_request_status" DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"resulting_campaign_id" uuid,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rivvi_campaign_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"agent_id" varchar(256) NOT NULL,
	"llm_id" varchar(256) NOT NULL,
	"base_prompt" text NOT NULL,
	"voicemail_message" text,
	"post_call_webhook_url" varchar(512),
	"inbound_webhook_url" varchar(512),
	"variables_config" json NOT NULL,
	"analysis_config" json NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rivvi_campaign" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"template_id" uuid NOT NULL,
	"direction" "call_direction" NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_default_inbound" boolean DEFAULT false,
	"metadata" json,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rivvi_organization_patient" (
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"emr_id_in_org" varchar(256),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "rivvi_organization_patient_org_id_patient_id_pk" PRIMARY KEY("org_id","patient_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rivvi_organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" varchar(256) NOT NULL,
	"name" varchar(256) NOT NULL,
	"phone" varchar(20),
	"timezone" varchar(50) DEFAULT 'America/New_York',
	"office_hours" json,
	"concurrent_call_limit" integer DEFAULT 20,
	"is_super_admin" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "rivvi_organization_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rivvi_patient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_hash" varchar(256) NOT NULL,
	"first_name" varchar(256) NOT NULL,
	"last_name" varchar(256) NOT NULL,
	"dob" date NOT NULL,
	"is_minor" boolean DEFAULT false,
	"primary_phone" varchar(20) NOT NULL,
	"secondary_phone" varchar(20),
	"external_ids" json,
	"metadata" json,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "rivvi_patient_patient_hash_unique" UNIQUE("patient_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rivvi_row" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid,
	"variables" json NOT NULL,
	"analysis" json,
	"status" "row_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"retell_call_id" varchar(256),
	"sort_index" integer NOT NULL,
	"retry_count" integer DEFAULT 0,
	"call_attempts" integer DEFAULT 0,
	"metadata" json,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rivvi_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"custom_prompt" text,
	"custom_voicemail_message" text,
	"variation_notes" text,
	"status" "run_status" DEFAULT 'draft' NOT NULL,
	"metadata" json,
	"raw_file_url" varchar(512),
	"processed_file_url" varchar(512),
	"scheduled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rivvi_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" varchar(256) NOT NULL,
	"org_id" uuid,
	"email" varchar(256) NOT NULL,
	"first_name" varchar(256),
	"last_name" varchar(256),
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "rivvi_user_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_agent_variation" ADD CONSTRAINT "rivvi_agent_variation_campaign_id_rivvi_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."rivvi_campaign"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_agent_variation" ADD CONSTRAINT "rivvi_agent_variation_user_id_rivvi_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."rivvi_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_call" ADD CONSTRAINT "rivvi_call_org_id_rivvi_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."rivvi_organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_call" ADD CONSTRAINT "rivvi_call_run_id_rivvi_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."rivvi_run"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_call" ADD CONSTRAINT "rivvi_call_campaign_id_rivvi_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."rivvi_campaign"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_call" ADD CONSTRAINT "rivvi_call_row_id_rivvi_row_id_fk" FOREIGN KEY ("row_id") REFERENCES "public"."rivvi_row"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_call" ADD CONSTRAINT "rivvi_call_patient_id_rivvi_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."rivvi_patient"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_call" ADD CONSTRAINT "rivvi_call_related_outbound_call_id_rivvi_call_id_fk" FOREIGN KEY ("related_outbound_call_id") REFERENCES "public"."rivvi_call"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_campaign_request" ADD CONSTRAINT "rivvi_campaign_request_org_id_rivvi_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."rivvi_organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_campaign_request" ADD CONSTRAINT "rivvi_campaign_request_requested_by_rivvi_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."rivvi_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_campaign_request" ADD CONSTRAINT "rivvi_campaign_request_resulting_campaign_id_rivvi_campaign_id_fk" FOREIGN KEY ("resulting_campaign_id") REFERENCES "public"."rivvi_campaign"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_campaign_template" ADD CONSTRAINT "rivvi_campaign_template_created_by_rivvi_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."rivvi_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_campaign" ADD CONSTRAINT "rivvi_campaign_org_id_rivvi_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."rivvi_organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_campaign" ADD CONSTRAINT "rivvi_campaign_template_id_rivvi_campaign_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."rivvi_campaign_template"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_organization_patient" ADD CONSTRAINT "rivvi_organization_patient_org_id_rivvi_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."rivvi_organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_organization_patient" ADD CONSTRAINT "rivvi_organization_patient_patient_id_rivvi_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."rivvi_patient"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_row" ADD CONSTRAINT "rivvi_row_run_id_rivvi_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."rivvi_run"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_row" ADD CONSTRAINT "rivvi_row_org_id_rivvi_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."rivvi_organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_row" ADD CONSTRAINT "rivvi_row_patient_id_rivvi_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."rivvi_patient"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_run" ADD CONSTRAINT "rivvi_run_campaign_id_rivvi_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."rivvi_campaign"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_run" ADD CONSTRAINT "rivvi_run_org_id_rivvi_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."rivvi_organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rivvi_user" ADD CONSTRAINT "rivvi_user_org_id_rivvi_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."rivvi_organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_variation_campaign_id_idx" ON "rivvi_agent_variation" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_variation_user_id_idx" ON "rivvi_agent_variation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_org_id_idx" ON "rivvi_call" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_run_id_idx" ON "rivvi_call" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_campaign_id_idx" ON "rivvi_call" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_row_id_idx" ON "rivvi_call" USING btree ("row_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_patient_id_idx" ON "rivvi_call" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_agent_id_idx" ON "rivvi_call" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_retell_call_id_idx" ON "rivvi_call" USING btree ("retell_call_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_status_idx" ON "rivvi_call" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_direction_idx" ON "rivvi_call" USING btree ("direction");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "call_retell_call_id_unique_idx" ON "rivvi_call" USING btree ("retell_call_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_request_org_id_idx" ON "rivvi_campaign_request" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_request_status_idx" ON "rivvi_campaign_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "template_agent_id_idx" ON "rivvi_campaign_template" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "template_llm_id_idx" ON "rivvi_campaign_template" USING btree ("llm_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "template_created_by_idx" ON "rivvi_campaign_template" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_org_id_idx" ON "rivvi_campaign" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_template_id_idx" ON "rivvi_campaign" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_patient_org_id_idx" ON "rivvi_organization_patient" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_patient_patient_id_idx" ON "rivvi_organization_patient" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_clerk_id_idx" ON "rivvi_organization" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "patient_hash_idx" ON "rivvi_patient" USING btree ("patient_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "patient_phone_idx" ON "rivvi_patient" USING btree ("primary_phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "row_run_id_idx" ON "rivvi_row" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "row_org_id_idx" ON "rivvi_row" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "row_patient_id_idx" ON "rivvi_row" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "row_status_idx" ON "rivvi_row" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "run_campaign_id_idx" ON "rivvi_run" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "run_org_id_idx" ON "rivvi_run" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "run_status_idx" ON "rivvi_run" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_clerk_id_idx" ON "rivvi_user" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_org_id_idx" ON "rivvi_user" USING btree ("org_id");