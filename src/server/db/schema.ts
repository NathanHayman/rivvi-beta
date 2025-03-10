// src/server/db/schema.ts - Updated with new columns
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
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `rivvi_${name}`);

// Enums - unchanged
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
  "in_progress",
  "rejected",
  "completed",
]);

// Type definitions - unchanged
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
  | "in_progress"
  | "rejected"
  | "completed";

// Table Definitions - Updated with new columns

// Organizations - unchanged
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

// Users - unchanged
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

// Patients - updated with new columns
export const patients = createTable(
  "patient",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    patientHash: varchar("patient_hash", { length: 256 }).notNull().unique(),
    // New columns for better deduplication
    secondaryHash: varchar("secondary_hash", { length: 256 }),
    normalizedPhone: varchar("normalized_phone", { length: 20 }),
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
    // New indexes
    secondaryHashIdx: index("patient_secondary_hash_idx").on(
      table.secondaryHash,
    ),
    normalizedPhoneIdx: index("patient_normalized_phone_idx").on(
      table.normalizedPhone,
    ),
  }),
);

// Organization Patients - unchanged
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

// Campaign Templates - unchanged
export const campaignTemplates = createTable(
  "campaign_template",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 256 }).notNull(),
    description: text("description"),
    agentId: varchar("agent_id", { length: 256 }).notNull(),
    llmId: varchar("llm_id", { length: 256 }).notNull(),
    basePrompt: text("base_prompt").notNull(),
    voicemailMessage: text("voicemail_message"),
    postCallWebhookUrl: varchar("post_call_webhook_url", { length: 512 }),
    inboundWebhookUrl: varchar("inbound_webhook_url", { length: 512 }),
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

// Campaigns - unchanged
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
    templateId: uuid("template_id")
      .references(() => campaignTemplates.id, { onDelete: "set null" })
      .notNull(),
    direction: callDirectionEnum("direction").notNull(),
    isActive: boolean("is_active").default(true),
    isDefaultInbound: boolean("is_default_inbound").default(false),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => ({
    orgIdIdx: index("campaign_org_id_idx").on(table.orgId),
    templateIdIdx: index("campaign_template_id_idx").on(table.templateId),
  }),
);

// Agent Variations - updated with new columns
export const agentVariations = createTable(
  "agent_variation",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    campaignId: uuid("campaign_id")
      .references(() => campaigns.id, { onDelete: "cascade" })
      .notNull(),
    userInput: text("user_input").notNull(),
    originalBasePrompt: text("original_base_prompt").notNull(),
    originalVoicemailMessage: text("original_voicemail_message"),
    customizedPrompt: text("customized_prompt").notNull(),
    customizedVoicemailMessage: text("customized_voicemail_message"),
    suggestedRunName: varchar("suggested_run_name", { length: 256 }),
    changeDescription: text("change_description"),
    metadata: json("metadata").$type<{
      categories?: string[];
      tags?: string[];
      keyChanges?: string[];
      toneShift?: string;
      focusArea?: string;
      promptLength?: {
        before: number;
        after: number;
        difference: number;
      };
      changeIntent?: string;
      sentimentShift?: {
        before?: string;
        after?: string;
      };
      formalityLevel?: {
        before?: number;
        after?: number;
      };
      complexityScore?: {
        before?: number;
        after?: number;
      };
    }>(),
    comparison: json("comparison").$type<{
      structuralChanges?: Array<{
        section?: string;
        changeType?: "added" | "removed" | "modified" | "unchanged";
        description?: string;
      }>;
      keyPhrases?: {
        added?: string[];
        removed?: string[];
        modified?: Array<{
          before?: string;
          after?: string;
        }>;
      };
      performancePrediction?: {
        expectedImpact?: "positive" | "neutral" | "negative" | "uncertain";
        confidenceLevel?: number;
        rationale?: string;
      };
    }>(),
    diffData: json("diff_data").$type<{
      promptDiff?: Array<{
        type?: "unchanged" | "added" | "removed";
        value?: string;
      }>;
      voicemailDiff?: Array<{
        type?: "unchanged" | "added" | "removed";
        value?: string;
      }>;
    }>(),
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

// Runs - updated with new columns
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
    customPrompt: text("custom_prompt"),
    customVoicemailMessage: text("custom_voicemail_message"),
    variationNotes: text("variation_notes"),
    // New columns for AI prompt generation
    naturalLanguageInput: text("natural_language_input"),
    promptVersion: integer("prompt_version").default(1),
    aiGenerated: boolean("ai_generated").default(false),
    status: runStatusEnum("status").default("draft").notNull(),
    metadata: json("metadata").$type<{
      rows?: {
        total: number;
        invalid: number;
      };
      calls?: {
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
      run?: {
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
      // Add new fields for AI-generated metadata
      summary?: string;
      metadata?: {
        categories?: string[];
        tags?: string[];
        keyChanges?: string[];
        toneShift?: string;
        focusArea?: string;
        promptLength?: {
          before: number;
          after: number;
          difference: number;
        };
        changeIntent?: string;
        sentimentShift?: {
          before?: string;
          after?: string;
        };
        formalityLevel?: {
          before?: number;
          after?: number;
        };
        complexityScore?: {
          before?: number;
          after?: number;
        };
      };
      // Add new fields for comparison data
      comparison?: {
        structuralChanges?: Array<{
          section?: string;
          changeType?: "added" | "removed" | "modified" | "unchanged";
          description?: string;
        }>;
        keyPhrases?: {
          added?: string[];
          removed?: string[];
          modified?: Array<{
            before?: string;
            after?: string;
          }>;
        };
        performancePrediction?: {
          expectedImpact?: "positive" | "neutral" | "negative" | "uncertain";
          confidenceLevel?: number;
          rationale?: string;
        };
      };
      // Add new fields for diff data
      diffData?: {
        promptDiff?: Array<{
          type?: "unchanged" | "added" | "removed";
          value?: string;
        }>;
        voicemailDiff?: Array<{
          type?: "unchanged" | "added" | "removed";
          value?: string;
        }>;
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

// Rows - updated with new columns
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
    // New column for storing preprocessed variables
    processedVariables: json("processed_variables").$type<
      Record<string, unknown>
    >(),
    analysis: json("analysis").$type<Record<string, unknown>>(),
    status: rowStatusEnum("status").default("pending").notNull(),
    error: text("error"),
    retellCallId: varchar("retell_call_id", { length: 256 }),
    sortIndex: integer("sort_index").notNull(),
    // New columns for better processing
    priority: integer("priority").default(0),
    batchEligible: boolean("batch_eligible").default(true),
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
    // New index for priority
    priorityIdx: index("row_priority_idx").on(table.priority),
  }),
);

// Calls - updated with new columns
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
    agentId: varchar("agent_id", { length: 256 }).notNull(),
    direction: callDirectionEnum("direction").notNull(),
    status: callStatusEnum("status").default("pending").notNull(),
    retellCallId: varchar("retell_call_id", { length: 256 }),
    recordingUrl: varchar("recording_url", { length: 512 }),
    toNumber: varchar("to_number", { length: 20 }).notNull(),
    fromNumber: varchar("from_number", { length: 20 }).notNull(),
    // New columns for better batch management
    batchId: varchar("batch_id", { length: 256 }),
    retryCount: integer("retry_count").default(0),
    nextRetryTime: timestamp("next_retry_time", { withTimezone: true }),
    callMetrics: json("call_metrics").$type<Record<string, unknown>>(),
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
    // New index for batch_id
    batchIdIdx: index("call_batch_id_idx").on(table.batchId),
  }),
);

// Campaign Requests - updated with new columns
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
    mainGoal: text("main_goal"),
    desiredAnalysis: json("desired_analysis").$type<string[]>(),
    exampleSheets: json("example_sheets").$type<
      Array<{
        name: string;
        url: string;
        fileType: string;
      }>
    >(),
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
