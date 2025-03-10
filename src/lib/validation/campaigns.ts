// src/lib/validation/campaigns.ts
import { z } from "zod";

/**
 * Create Campaign
 */
const createCampaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  orgId: z.string().uuid(),
  agentId: z.string().min(1),
  llmId: z.string().min(1),
  direction: z.enum(["inbound", "outbound"]),
  basePrompt: z.string().min(1),
  voicemailMessage: z.string().optional(),
  variablesConfig: z.object({
    patient: z.object({
      fields: z.array(
        z.object({
          key: z.string().min(1),
          label: z.string().min(1),
          possibleColumns: z.array(z.string()),
          transform: z
            .enum([
              "text",
              "short_date",
              "long_date",
              "time",
              "phone",
              "provider",
            ])
            .optional(),
          required: z.boolean().default(true),
          description: z.string().optional(),
        }),
      ),
      validation: z.object({
        requireValidPhone: z.boolean().default(true),
        requireValidDOB: z.boolean().default(true),
        requireName: z.boolean().default(true),
      }),
    }),
    campaign: z.object({
      fields: z.array(
        z.object({
          key: z.string().min(1),
          label: z.string().min(1),
          possibleColumns: z.array(z.string()),
          transform: z
            .enum([
              "text",
              "short_date",
              "long_date",
              "time",
              "phone",
              "provider",
            ])
            .optional(),
          required: z.boolean().default(false),
          description: z.string().optional(),
        }),
      ),
    }),
  }),
  analysisConfig: z.object({
    standard: z.object({
      fields: z.array(
        z.object({
          key: z.string().min(1),
          label: z.string().min(1),
          type: z.enum(["boolean", "string", "date", "enum"]),
          options: z.array(z.string()).optional(),
          required: z.boolean().default(true),
          description: z.string().optional(),
        }),
      ),
    }),
    campaign: z.object({
      fields: z.array(
        z.object({
          key: z.string().min(1),
          label: z.string().min(1),
          type: z.enum(["boolean", "string", "date", "enum"]),
          options: z.array(z.string()).optional(),
          required: z.boolean().default(false),
          description: z.string().optional(),
          isMainKPI: z.boolean().default(false),
        }),
      ),
    }),
  }),
  requestId: z.string().uuid().optional(),
  configureWebhooks: z.boolean().default(true),
});
type ZCreateCampaign = z.infer<typeof createCampaignSchema>;
/**
 * Update Campaign
 */
const updateCampaignSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  basePrompt: z.string().min(1).optional(),
  voicemailMessage: z.string().optional(),
  variablesConfig: z.record(z.any()).optional(),
  analysisConfig: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});
type ZUpdateCampaign = z.infer<typeof updateCampaignSchema>;

/**
 * Create Campaign Request
 */
const createCampaignRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  mainGoal: z.string().min(1).optional(),
  desiredAnalysis: z.array(z.string()).optional(),
  orgId: z.string().uuid(),
  direction: z.enum(["inbound", "outbound"]),
  requestedBy: z.string(),
  exampleSheets: z
    .array(
      z.object({
        name: z.string(),
        url: z.string(),
        fileType: z.string(),
      }),
    )
    .optional(),
});
type ZCreateCampaignRequest = z.infer<typeof createCampaignRequestSchema>;

/**
 * Process Campaign Request
 */
const processCampaignRequestSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["approved", "rejected", "completed", "in_progress"]),
  adminNotes: z.string().optional(),
  resultingCampaignId: z.string().uuid().optional(),
});
type ZProcessCampaignRequest = z.infer<typeof processCampaignRequestSchema>;
/**
 * Get Campaign
 */
const getCampaignSchema = z.object({
  id: z.string().uuid(),
});
type ZGetCampaign = z.infer<typeof getCampaignSchema>;

export {
  createCampaignRequestSchema,
  createCampaignSchema,
  getCampaignSchema,
  processCampaignRequestSchema,
  updateCampaignSchema,
  type ZCreateCampaign,
  type ZCreateCampaignRequest,
  type ZGetCampaign,
  type ZProcessCampaignRequest,
  type ZUpdateCampaign,
};
