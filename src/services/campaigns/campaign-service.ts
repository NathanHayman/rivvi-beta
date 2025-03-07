// src/services/campaigns/campaigns-service.ts
import {
  createError,
  createSuccess,
  ServiceResult,
} from "@/lib/service-result";
import { db } from "@/server/db";
import { campaigns, campaignTemplates } from "@/server/db/schema";
import { type zCampaignWithTemplate } from "@/types/zod";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export const campaignsService = {
  async getById(
    id: string,
    orgId: string,
  ): Promise<ServiceResult<z.infer<typeof zCampaignWithTemplate>>> {
    try {
      // Get campaign and check organization access
      const campaign = await db.query.campaigns.findFirst({
        where: and(eq(campaigns.id, id), eq(campaigns.orgId, orgId)),
      });

      if (!campaign) {
        return createError("NOT_FOUND", "Campaign not found");
      }

      // Get associated template
      const template = await db.query.campaignTemplates.findFirst({
        where: eq(campaignTemplates.id, campaign.templateId),
      });

      if (!template) {
        return createError("NOT_FOUND", "Campaign template not found");
      }

      // Return combined data
      return createSuccess({
        ...campaign,
        template: {
          ...template,
          config: {
            basePrompt: template.basePrompt,
            voicemailMessage: template.voicemailMessage,
            variables: template.variablesConfig,
            analysis: template.analysisConfig,
          },
        },
      });
    } catch (error) {
      console.error("Error fetching campaign:", error);
      return createError("INTERNAL_ERROR", "Failed to fetch campaign", error);
    }
  },

  // Additional methods...
};
