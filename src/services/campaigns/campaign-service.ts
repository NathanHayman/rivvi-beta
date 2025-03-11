// src/services/campaigns/campaigns-service.ts
import {
  createError,
  createSuccess,
  ServiceResult,
} from "@/lib/service-result";
import { db } from "@/server/db";
import { calls, campaigns, campaignTemplates, runs } from "@/server/db/schema";
import { ZCampaign, ZCampaignWithTemplate } from "@/types/zod";
import { and, count, eq, sql } from "drizzle-orm";

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

      // Get run and call counts for this campaign
      const [runStats] = await db
        .select({ count: count() })
        .from(runs)
        .where(and(eq(runs.campaignId, id), eq(runs.orgId, orgId)));

      const [callStats] = await db
        .select({ count: count() })
        .from(calls)
        .where(and(eq(calls.campaignId, id), eq(calls.orgId, orgId)));

      // Return combined data with counts
      return createSuccess({
        campaign: {
          ...campaign,
          runCount: Number(runStats?.count || 0),
          callCount: Number(callStats?.count || 0),
        },
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
      // Get all campaigns for the organization
      const campaignsData = await db.query.campaigns.findMany({
        where: eq(campaigns.orgId, orgId),
      });

      // If no campaigns, return empty array
      if (campaignsData.length === 0) {
        return createSuccess([]);
      }

      // Get run and call counts using raw SQL for more reliable results
      const enrichedCampaigns = await Promise.all(
        campaignsData.map(async (campaign) => {
          // Get run count for this campaign
          const [runStats] = await db
            .select({ count: sql`COUNT(*)` })
            .from(runs)
            .where(
              and(eq(runs.campaignId, campaign.id), eq(runs.orgId, orgId)),
            );

          // Get call count for this campaign
          const [callStats] = await db
            .select({ count: sql`COUNT(*)` })
            .from(calls)
            .where(
              and(eq(calls.campaignId, campaign.id), eq(calls.orgId, orgId)),
            );

          // Return campaign with counts
          return {
            ...campaign,
            runCount: Number(runStats?.count || 0),
            callCount: Number(callStats?.count || 0),
          };
        }),
      );

      return createSuccess(enrichedCampaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      return createError("INTERNAL_ERROR", "Failed to fetch campaigns", error);
    }
  },
};
