import * as z from "zod";

/* Organization Schemas */
const zOrganization = z.object({
  id: z.string(),
  clerkId: z.string(),
  name: z.string(),
  phone: z.string(),
  timezone: z.string(),
  officeHours: z.object({
    monday: z.object({ start: z.string(), end: z.string() }),
    tuesday: z.object({ start: z.string(), end: z.string() }),
    wednesday: z.object({ start: z.string(), end: z.string() }),
    thursday: z.object({ start: z.string(), end: z.string() }),
    friday: z.object({ start: z.string(), end: z.string() }),
    saturday: z.object({ start: z.string(), end: z.string() }),
    sunday: z.object({ start: z.string(), end: z.string() }),
  }),
  concurrentCallLimit: z.number(),
  isSuperAdmin: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/* User Schemas */
const zUser = z.object({
  id: z.string(),
  clerkId: z.string(),
  orgId: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(["admin", "member", "superadmin"]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/* Patient Schemas */
const zPatient = z.object({
  id: z.string(),
  patientHash: z.string(),
  secondaryHash: z.string(),
  normalizedPhone: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  dob: z.date(),
  isMinor: z.boolean(),
  primaryPhone: z.string(),
  secondaryPhone: z.string(),
  externalIds: z.record(z.string(), z.string()),
  metadata: z.record(z.string(), z.any()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/* Organization Patient Schemas */
const zOrganizationPatient = z.object({
  orgId: z.string(),
  patientId: z.string(),
  emrIdInOrg: z.string(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/* Campaign Template Schemas */

/* Call Schemas */
const zCallStatus = z.enum([
  "pending",
  "in-progress",
  "completed",
  "failed",
  "voicemail",
  "no-answer",
]);
const zCallDirection = z.enum(["inbound", "outbound"]);
const zCall = z.object({
  id: z.string(),
  orgId: z.string(),
  runId: z.string(),
  rowId: z.string(),
  agentId: z.string(),
  patientId: z.string(),
  campaignId: z.string(),
  retellCallId: z.string(),
  recordingUrl: z.string(),
  toNumber: z.string(),
  fromNumber: z.string(),
  batchId: z.string(),
  retryCount: z.number(),
  nextRetryTime: z.date(),
  callMetrics: z.record(z.string(), z.any()),
  metadata: z.record(z.string(), z.any()),
  analysis: z.record(z.string(), z.any()),
  transcript: z.string(),
  startTime: z.date(),
  endTime: z.date(),
  duration: z.number(),
  error: z.string(),
  relatedOutboundCallId: z.string(),
  status: zCallStatus,
  direction: zCallDirection,
  createdAt: z.date(),
  updatedAt: z.date(),
});
/* Row Schemas */
const zRowStatus = z.enum([
  "pending",
  "calling",
  "completed",
  "failed",
  "skipped",
]);
const zRow = z.object({
  id: z.string(),
  orgId: z.string(),
  runId: z.string(),
  patientId: z.string(),
  campaignId: z.string(),
  variables: z.record(z.string(), z.any()),
  processedVariables: z.record(z.string(), z.any()),
  analysis: z.record(z.string(), z.any()),
  status: zRowStatus,
  error: z.string(),
  retellCallId: z.string(),
  sortIndex: z.number(),
  priority: z.number(),
  batchEligible: z.boolean(),
  retryCount: z.number(),
  callAttempts: z.number(),
  metadata: z.record(z.string(), z.any()),
  createdAt: z.date(),
  updatedAt: z.date(),
});
/* Run Schemas */
const zRunStatus = z.enum([
  "draft",
  "processing",
  "ready",
  "running",
  "paused",
  "completed",
  "failed",
  "scheduled",
]);
const zRunMetadata = z.object({
  rows: z.object({
    total: z.number(),
    invalid: z.number(),
  }),
  calls: z.object({
    total: z.number(),
    completed: z.number(),
    failed: z.number(),
    calling: z.number(),
    pending: z.number(),
    skipped: z.number(),
    voicemail: z.number(),
    connected: z.number(),
    converted: z.number(),
  }),
  run: z.object({
    error: z.string(),
    startTime: z.date(),
    endTime: z.date(),
    lastPausedAt: z.date(),
    scheduledTime: z.date(),
    duration: z.number(),
    batchSize: z.number(),
    callsPerMinute: z.number(),
    respectPatientTimezone: z.boolean(),
    callStartHour: z.number(),
    callEndHour: z.number(),
    maxRetries: z.number(),
    pausedOutsideHours: z.boolean(),
    lastCallTime: z.date(),
  }),
});
const zRun = z.object({
  id: z.string(),
  orgId: z.string(),
  campaignId: z.string(),
  name: z.string(),
  customPrompt: z.string(),
  customVoicemailMessage: z.string(),
  variationNotes: z.string(),
  naturalLanguageInput: z.string(),
  promptVersion: z.number(),
  aiGenerated: z.boolean(),
  status: zRunStatus,
  metadata: zRunMetadata,
  rawFileUrl: z.string(),
  processedFileUrl: z.string(),
  scheduledAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
/* Campaign Request Schemas */
const zCampaignRequestStatus = z.enum([
  "pending",
  "approved",
  "rejected",
  "completed",
]);
const zCampaignRequest = z.object({
  id: z.string(),
  orgId: z.string(),
  requestedBy: z.string(),
  name: z.string(),
  direction: zCallDirection,
  description: z.string(),
  mainGoal: z.string(),
  desiredAnalysis: z.array(z.string()),
  exampleSheets: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      fileType: z.string(),
    }),
  ),
  status: zCampaignRequestStatus,
  adminNotes: z.string(),
  resultingCampaignId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
/* Agent Variation Schemas */
const zAgentVariation = z.object({
  id: z.string(),
  orgId: z.string(),
  campaignId: z.string(),
  userInput: z.string(),
  originalBasePrompt: z.string(),
  originalVoicemailMessage: z.string(),
  customizedPrompt: z.string(),
  customizedVoicemailMessage: z.string(),
  suggestedRunName: z.string(),
  changeDescription: z.string(),
  userId: z.string(),
  createdAt: z.date(),
});
/* Campaign Template Schemas */
const zCampaignTemplate = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  description: z.string(),
  agentId: z.string(),
  llmId: z.string(),
  basePrompt: z.string(),
  voicemailMessage: z.string(),
  postCallWebhookUrl: z.string(),
  inboundWebhookUrl: z.string(),
  variablesConfig: z.object({
    patient: z.object({
      fields: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          possibleColumns: z.array(z.string()),
          transform: z.enum([
            "text",
            "short_date",
            "long_date",
            "time",
            "phone",
            "provider",
          ]),
          required: z.boolean(),
          description: z.string(),
        }),
      ),
      validation: z.object({
        requireValidPhone: z.boolean(),
        requireValidDOB: z.boolean(),
        requireName: z.boolean(),
      }),
    }),
    campaign: z.object({
      fields: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          possibleColumns: z.array(z.string()),
          transform: z.enum([
            "text",
            "short_date",
            "long_date",
            "time",
            "phone",
            "provider",
          ]),
          required: z.boolean(),
          description: z.string(),
        }),
      ),
      validation: z.object({
        requireValidPhone: z.boolean(),
        requireValidDOB: z.boolean(),
        requireName: z.boolean(),
      }),
    }),
  }),
  analysisConfig: z.object({
    standard: z.object({
      fields: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          type: z.enum(["boolean", "string", "date", "enum"]),
          options: z.array(z.string()),
          required: z.boolean(),
          description: z.string(),
        }),
      ),
    }),
    campaign: z.object({
      fields: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          type: z.enum(["boolean", "string", "date", "enum"]),
          options: z.array(z.string()),
          required: z.boolean(),
          description: z.string(),
          isMainKPI: z.boolean(),
        }),
      ),
    }),
  }),
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
/* Campaign Schemas */
const zCampaignStatus = z.enum([
  "draft",
  "processing",
  "ready",
  "running",
  "paused",
  "completed",
  "failed",
  "scheduled",
]);
const zCampaign = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  templateId: z.string(),
  direction: zCallDirection,
  isActive: z.boolean(),
  isDefaultInbound: z.boolean(),
  metadata: z.record(z.string(), z.any()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/* Campaign With Template Schemas */
const zCampaignWithTemplate = z.object({
  campaign: zCampaign,
  template: zCampaignTemplate,
});

export {
  zAgentVariation,
  zCall,
  zCallDirection,
  zCallStatus,
  zCampaign,
  zCampaignRequest,
  zCampaignRequestStatus,
  zCampaignStatus,
  zCampaignTemplate,
  zCampaignWithTemplate,
  zOrganization,
  zOrganizationPatient,
  zPatient,
  zRow,
  zRowStatus,
  zRun,
  zRunMetadata,
  zUser,
};
