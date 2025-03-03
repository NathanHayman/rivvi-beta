// src/server/db/schema.ts
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  json,
  pgEnum,
  pgTableCreator,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `rivvi_${name}`);

// ------------------------
// Define native PostgreSQL enums using pgEnum
// ------------------------

export const runStatusEnum = pgEnum("run_status", [
  "draft",
  "processing",
  "ready",
  "running",
  "paused",
  "completed",
  "failed",
  "scheduled",
]);

export const rowStatusEnum = pgEnum("row_status", [
  "pending",
  "calling",
  "completed",
  "failed",
  "skipped",
]);

export const callDirectionEnum = pgEnum("call_direction", [
  "inbound",
  "outbound",
]);

export const callStatusEnum = pgEnum("call_status", [
  "pending",
  "in-progress",
  "completed",
  "failed",
  "voicemail",
  "no-answer",
]);

export const campaignRequestStatusEnum = pgEnum("campaign_request_status", [
  "pending",
  "approved",
  "rejected",
  "completed",
]);

// Optionally keep TypeScript union types if needed elsewhere in your code:
export type RunStatus =
  | "draft"
  | "processing"
  | "ready"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "scheduled";

export type RowStatus =
  | "pending"
  | "calling"
  | "completed"
  | "failed"
  | "skipped";

export type CallDirection = "inbound" | "outbound";

export type CallStatus =
  | "pending"
  | "in-progress"
  | "completed"
  | "failed"
  | "voicemail"
  | "no-answer";

export type CampaignRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed";

// ------------------------
// Table Definitions
// ------------------------

export const organizations = createTable(
  "organization",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clerkId: varchar("clerk_id", { length: 256 }).notNull().unique(),
    name: varchar("name", { length: 256 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    timezone: varchar("timezone", { length: 50 }).default("America/New_York"),
    officeHours: json("office_hours").$type<{
      monday: { start: string; end: string };
      tuesday: { start: string; end: string };
      wednesday: { start: string; end: string };
      thursday: { start: string; end: string };
      friday: { start: string; end: string };
      saturday: { start: string; end: string } | null;
      sunday: { start: string; end: string } | null;
    }>(),
    concurrentCallLimit: integer("concurrent_call_limit").default(20),
    isSuperAdmin: boolean("is_super_admin").default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => ({
    clerkIdIdx: index("organization_clerk_id_idx").on(table.clerkId),
  }),
);

export const users = createTable(
  "user",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clerkId: varchar("clerk_id", { length: 256 }).notNull().unique(),
    orgId: uuid("org_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    email: varchar("email", { length: 256 }).notNull(),
    firstName: varchar("first_name", { length: 256 }),
    lastName: varchar("last_name", { length: 256 }),
    role: varchar("role", { length: 50 }).default("member").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => ({
    clerkIdIdx: index("user_clerk_id_idx").on(table.clerkId),
    orgIdIdx: index("user_org_id_idx").on(table.orgId),
  }),
);

export const patients = createTable(
  "patient",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    patientHash: varchar("patient_hash", { length: 256 }).notNull().unique(), // Hash of phone + DOB for deduplication
    firstName: varchar("first_name", { length: 256 }).notNull(),
    lastName: varchar("last_name", { length: 256 }).notNull(),
    dob: date("dob").notNull(),
    isMinor: boolean("is_minor").default(false),
    primaryPhone: varchar("primary_phone", { length: 20 }).notNull(),
    secondaryPhone: varchar("secondary_phone", { length: 20 }),
    externalIds: json("external_ids").$type<Record<string, string>>(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => ({
    patientHashIdx: index("patient_hash_idx").on(table.patientHash),
    phoneIdx: index("patient_phone_idx").on(table.primaryPhone),
  }),
);

// Junction table for organization-patient relationship
export const organizationPatients = createTable(
  "organization_patient",
  {
    orgId: uuid("org_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    patientId: uuid("patient_id")
      .references(() => patients.id, { onDelete: "cascade" })
      .notNull(),
    emrIdInOrg: varchar("emr_id_in_org", { length: 256 }),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.orgId, table.patientId] }),
    orgIdIdx: index("org_patient_org_id_idx").on(table.orgId),
    patientIdIdx: index("org_patient_patient_id_idx").on(table.patientId),
  }),
);

/**
 * Campaign Templates - Store reusable configurations for campaigns
 * This centralizes agent settings, prompts, webhook URLs, and field definitions
 */
export const campaignTemplates = createTable(
  "campaign_template",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 256 }).notNull(),
    description: text("description"),
    // Retell agent configuration
    agentId: varchar("agent_id", { length: 256 }).notNull(),
    llmId: varchar("llm_id", { length: 256 }).notNull(),
    // Base messages
    basePrompt: text("base_prompt").notNull(),
    voicemailMessage: text("voicemail_message"),
    // Webhook configuration
    postCallWebhookUrl: varchar("post_call_webhook_url", { length: 512 }),
    inboundWebhookUrl: varchar("inbound_webhook_url", { length: 512 }),
    // Configuration for patient and campaign fields
    variablesConfig: json("variables_config")
      .$type<{
        patient: {
          fields: Array<{
            key: string;
            label: string;
            possibleColumns: string[];
            transform?:
              | "text"
              | "short_date"
              | "long_date"
              | "time"
              | "phone"
              | "provider";
            required: boolean;
            description?: string;
          }>;
          validation: {
            requireValidPhone: boolean;
            requireValidDOB: boolean;
            requireName: boolean;
          };
        };
        campaign: {
          fields: Array<{
            key: string;
            label: string;
            possibleColumns: string[];
            transform?:
              | "text"
              | "short_date"
              | "long_date"
              | "time"
              | "phone"
              | "provider";
            required: boolean;
            description?: string;
          }>;
        };
      }>()
      .notNull(),
    // Retell post-call analysis field definitions
    analysisConfig: json("analysis_config")
      .$type<{
        standard: {
          fields: Array<{
            key: string;
            label: string;
            type: "boolean" | "string" | "date" | "enum";
            options?: string[];
            required: boolean;
            description?: string;
          }>;
        };
        campaign: {
          fields: Array<{
            key: string;
            label: string;
            type: "boolean" | "string" | "date" | "enum";
            options?: string[];
            required: boolean;
            description?: string;
            isMainKPI?: boolean;
          }>;
        };
      }>()
      .notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => ({
    agentIdIdx: index("template_agent_id_idx").on(table.agentId),
    llmIdIdx: index("template_llm_id_idx").on(table.llmId),
    createdByIdx: index("template_created_by_idx").on(table.createdBy),
  }),
);

// Campaign Type: appointment_confirmation, annual_wellness_visit, medication_adherence, etc.
export const campaigns = createTable(
  "campaign",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`)
      .notNull(),
    orgId: uuid("org_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    agentId: varchar("agent_id", { length: 256 }).notNull(),
    llmId: varchar("llm_id", { length: 256 }).notNull(),
    // Direction for this campaign
    direction: callDirectionEnum("direction").notNull(),
    isActive: boolean("is_active").default(true),
    isDefaultInbound: boolean("is_default_inbound").default(false),
    // Configuration for prompts and variables
    config: json("config")
      .$type<{
        basePrompt: string;
        voicemailMessage: string;
        variables: {
          patient: {
            fields: Array<{
              key: string;
              label: string;
              possibleColumns: string[];
              transform?:
                | "text"
                | "short_date"
                | "long_date"
                | "time"
                | "phone"
                | "provider";
              required: boolean;
              description?: string;
            }>;
            validation: {
              requireValidPhone: boolean;
              requireValidDOB: boolean;
              requireName: boolean;
            };
          };
          campaign: {
            fields: Array<{
              key: string;
              label: string;
              possibleColumns: string[];
              transform?:
                | "short_date"
                | "long_date"
                | "time"
                | "phone"
                | "text"
                | "provider";
              required: boolean;
              description?: string;
            }>;
          };
        };
        analysis: {
          standard: {
            fields: Array<{
              key: string;
              label: string;
              type: "boolean" | "string" | "date" | "enum";
              options?: string[];
              required: boolean;
              description?: string;
            }>;
          };
          campaign: {
            fields: Array<{
              key: string;
              label: string;
              type: "boolean" | "string" | "date" | "enum";
              options?: string[];
              required: boolean;
              description?: string;
              isMainKPI?: boolean;
            }>;
          };
        };
      }>()
      .notNull(),
    // Will be linked to a template in the future when implemented
    // templateId: uuid("template_id").references(() => campaignTemplates.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => ({
    orgIdIdx: index("campaign_org_id_idx").on(table.orgId),
    agentIdIdx: index("campaign_agent_id_idx").on(table.agentId),
  }),
);

/**
 * Agent Variations - Generated prompt variations for specific runs
 * Created by AI using Vercel AI SDK and Anthropic
 */
export const agentVariations = createTable(
  "agent_variation",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    campaignId: uuid("campaign_id")
      .references(() => campaigns.id, { onDelete: "cascade" })
      .notNull(),
    // User's natural language input for customization
    userInput: text("user_input").notNull(),
    // Original content before customization (from template)
    originalBasePrompt: text("original_base_prompt").notNull(),
    originalVoicemailMessage: text("original_voicemail_message"),
    // AI-generated content
    customizedPrompt: text("customized_prompt").notNull(),
    customizedVoicemailMessage: text("customized_voicemail_message"),
    suggestedRunName: varchar("suggested_run_name", { length: 256 }),
    changeDescription: text("change_description"),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    campaignIdIdx: index("agent_variation_campaign_id_idx").on(
      table.campaignId,
    ),
    userIdIdx: index("agent_variation_user_id_idx").on(table.userId),
  }),
);

/**
 * Runs table with reference to agent variation
 * This links runs with their customized prompt and voicemail message
 */
export const runs = createTable(
  "run",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    campaignId: uuid("campaign_id")
      .references(() => campaigns.id, { onDelete: "cascade" })
      .notNull(),
    orgId: uuid("org_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    // Store variation details directly to avoid circular references
    customPrompt: text("custom_prompt"),
    customVoicemailMessage: text("custom_voicemail_message"),
    variationNotes: text("variation_notes"),
    status: runStatusEnum("status").default("draft").notNull(),
    metadata: json("metadata").$type<{
      rows: {
        total: number;
        invalid: number;
      };
      calls: {
        total: number;
        completed: number;
        failed: number;
        calling: number;
        pending: number;
        skipped: number;
        voicemail: number;
        connected: number;
        converted: number;
      };
      run: {
        error?: string;
        startTime?: string;
        endTime?: string;
        lastPausedAt?: string;
        scheduledTime?: string;
        duration?: number;
        batchSize?: number;
        callsPerMinute?: number;
        respectPatientTimezone?: boolean;
        callStartHour?: number;
        callEndHour?: number;
        maxRetries?: number;
        pausedOutsideHours?: boolean;
        lastCallTime?: string;
      };
    }>(),
    rawFileUrl: varchar("raw_file_url", { length: 512 }),
    processedFileUrl: varchar("processed_file_url", { length: 512 }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => ({
    campaignIdIdx: index("run_campaign_id_idx").on(table.campaignId),
    orgIdIdx: index("run_org_id_idx").on(table.orgId),
    statusIdx: index("run_status_idx").on(table.status),
  }),
);

export const rows = createTable(
  "row",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    runId: uuid("run_id")
      .references(() => runs.id, { onDelete: "cascade" })
      .notNull(),
    orgId: uuid("org_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    patientId: uuid("patient_id").references(() => patients.id, {
      onDelete: "set null",
    }),
    variables: json("variables").$type<Record<string, unknown>>().notNull(),
    analysis: json("analysis").$type<Record<string, unknown>>(),
    status: rowStatusEnum("status").default("pending").notNull(),
    error: text("error"),
    retellCallId: varchar("retell_call_id", { length: 256 }),
    sortIndex: integer("sort_index").notNull(), // For preserving the original order in the spreadsheet
    retryCount: integer("retry_count").default(0),
    callAttempts: integer("call_attempts").default(0),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => ({
    runIdIdx: index("row_run_id_idx").on(table.runId),
    orgIdIdx: index("row_org_id_idx").on(table.orgId),
    patientIdIdx: index("row_patient_id_idx").on(table.patientId),
    statusIdx: index("row_status_idx").on(table.status),
  }),
);

export const calls = createTable(
  "call",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: uuid("org_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    runId: uuid("run_id").references(() => runs.id, { onDelete: "set null" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    rowId: uuid("row_id").references(() => rows.id, { onDelete: "set null" }),
    patientId: uuid("patient_id").references(() => patients.id, {
      onDelete: "set null",
    }),
    // Agent ID from Retell, not a foreign key reference
    agentId: varchar("agent_id", { length: 256 }).notNull(),
    direction: callDirectionEnum("direction").notNull(),
    status: callStatusEnum("status").default("pending").notNull(),
    retellCallId: varchar("retell_call_id", { length: 256 }).notNull(),
    recordingUrl: varchar("recording_url", { length: 512 }),
    toNumber: varchar("to_number", { length: 20 }).notNull(),
    fromNumber: varchar("from_number", { length: 20 }).notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    analysis: json("analysis").$type<Record<string, unknown>>(),
    transcript: text("transcript"),
    startTime: timestamp("start_time", { withTimezone: true }),
    endTime: timestamp("end_time", { withTimezone: true }),
    duration: integer("duration"),
    error: text("error"),
    relatedOutboundCallId: uuid("related_outbound_call_id").references(
      () => calls.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => ({
    orgIdIdx: index("call_org_id_idx").on(table.orgId),
    runIdIdx: index("call_run_id_idx").on(table.runId),
    campaignIdIdx: index("call_campaign_id_idx").on(table.campaignId),
    rowIdIdx: index("call_row_id_idx").on(table.rowId),
    patientIdIdx: index("call_patient_id_idx").on(table.patientId),
    agentIdIdx: index("call_agent_id_idx").on(table.agentId),
    retellCallIdIdx: index("call_retell_call_id_idx").on(table.retellCallId),
    statusIdx: index("call_status_idx").on(table.status),
    directionIdx: index("call_direction_idx").on(table.direction),
    retellCallIdUniqueIdx: uniqueIndex("call_retell_call_id_unique_idx").on(
      table.retellCallId,
    ),
  }),
);

export const campaignRequests = createTable(
  "campaign_request",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: uuid("org_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    requestedBy: uuid("requested_by").references(() => users.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 256 }).notNull(),
    direction: callDirectionEnum("direction").default("outbound").notNull(),
    description: text("description").notNull(),
    status: campaignRequestStatusEnum("status").default("pending").notNull(),
    adminNotes: text("admin_notes"),
    resultingCampaignId: uuid("resulting_campaign_id").references(
      () => campaigns.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => ({
    orgIdIdx: index("campaign_request_org_id_idx").on(table.orgId),
    statusIdx: index("campaign_request_status_idx").on(table.status),
  }),
);
