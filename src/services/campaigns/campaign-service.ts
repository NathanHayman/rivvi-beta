// src/services/campaigns/campaigns-service.ts
import {
  createError,
  createSuccess,
  ServiceResult,
} from "@/lib/service-result";
import { db } from "@/server/db";
import { campaigns, campaignTemplates } from "@/server/db/schema";
import { ZCampaign, ZCampaignWithTemplate } from "@/types/zod";
import { and, eq } from "drizzle-orm";

export const campaignsService = {
  async getById(
    id: string,
    orgId: string,
  ): Promise<ServiceResult<ZCampaignWithTemplate>> {
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
        campaign,
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

  async getAllByOrgId(orgId: string): Promise<ServiceResult<ZCampaign[]>> {
    try {
      const campaignsData = await db.query.campaigns.findMany({
        where: eq(campaigns.orgId, orgId),
      });

      return createSuccess(campaignsData);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      return createError("INTERNAL_ERROR", "Failed to fetch campaigns", error);
    }
  },
};
