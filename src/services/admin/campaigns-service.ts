// src/services/admin/organizations-service.ts
import {
  getAgentComplete,
  updateAgentWebhooks,
} from "@/lib/retell/retell-client-safe";
import {
  createError,
  createSuccess,
  ServiceResult,
} from "@/lib/service-result";
import { ZCreateCampaign } from "@/lib/validation/campaigns";
import { db } from "@/server/db";
import {
  campaignRequests,
  campaigns,
  campaignTemplates,
} from "@/server/db/schema";
import { ZCampaign, ZCampaignWithTemplate } from "@/types/zod";
import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export const campaignsService = {
  async getById(id: string): Promise<ServiceResult<ZCampaignWithTemplate>> {
    try {
      const campaign = await db.query.campaigns.findFirst({
        where: eq(campaigns.id, id),
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
  async getAll(): Promise<ServiceResult<ZCampaign[]>> {
    try {
      const campaignsData = await db.query.campaigns.findMany();
      return createSuccess(campaignsData);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      return createError("INTERNAL_ERROR", "Failed to fetch campaigns", error);
    }
  },
  async delete(id: string): Promise<ServiceResult<void>> {
    try {
      await db.delete(campaigns).where(eq(campaigns.id, id));
      return createSuccess(undefined);
    } catch (error) {
      console.error("Error deleting campaign:", error);
      return createError("INTERNAL_ERROR", "Failed to delete campaign", error);
    }
  },
  async create(campaign: ZCreateCampaign): Promise<ServiceResult<ZCampaign>> {
    try {
      // Create a consistent campaignData object with all fields from campaign
      const campaignData = {
        name: campaign.name,
        description: campaign.description,
        orgId: campaign.orgId,
        agentId: campaign.agentId,
        llmId: campaign.llmId,
        direction: campaign.direction,
        basePrompt: campaign.basePrompt,
        voicemailMessage: campaign.voicemailMessage,
        variablesConfig: campaign.variablesConfig,
        analysisConfig: campaign.analysisConfig,
        configureWebhooks: campaign.configureWebhooks,
        requestId: campaign.requestId,
      };

      // Verify the Retell agent ID is valid
      let agentInfo;
      try {
        // Check if agentId exists
        if (!campaignData.agentId) {
          throw new Error("Agent ID is required");
        }

        // Ensure agent ID is properly formatted before passing to getAgentComplete
        const formattedAgentId =
          typeof campaignData.agentId === "string" &&
          campaignData.agentId.startsWith("agent_")
            ? campaignData.agentId
            : `agent_${campaignData.agentId}`;

        console.log("Verifying Retell agent ID:", formattedAgentId);
        agentInfo = await getAgentComplete(formattedAgentId);
      } catch (error) {
        console.error("Error verifying Retell agent ID:", error);
        throw new Error(
          `Failed to verify Retell agent ID: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (!agentInfo || !agentInfo.combined.agent_id) {
        throw new Error("Invalid Retell agent ID");
      }

      // Create a template with correct field structure based on the schema
      const templateData = {
        name: campaignData.name,
        description: campaignData.description,
        agentId: campaignData.agentId,
        llmId: campaignData.llmId,
        basePrompt: campaignData.basePrompt,
        voicemailMessage: campaignData.voicemailMessage,
        variablesConfig: {
          patient: {
            fields:
              campaignData.variablesConfig?.patient?.fields?.map((field) => ({
                key: field.key || "",
                label: field.label || "",
                possibleColumns: field.possibleColumns || [],
                transform: field.transform,
                required: field.required || false,
                description: field.description,
              })) || [],
            validation: {
              requireValidPhone:
                campaignData.variablesConfig?.patient?.validation
                  ?.requireValidPhone || false,
              requireValidDOB:
                campaignData.variablesConfig?.patient?.validation
                  ?.requireValidDOB || false,
              requireName:
                campaignData.variablesConfig?.patient?.validation
                  ?.requireName || false,
            },
          },
          campaign: {
            fields:
              campaignData.variablesConfig?.campaign?.fields?.map((field) => ({
                key: field.key || "",
                label: field.label || "",
                possibleColumns: field.possibleColumns || [],
                transform: field.transform,
                required: field.required || false,
                description: field.description,
              })) || [],
          },
        },
        analysisConfig: {
          standard: {
            fields:
              campaignData.analysisConfig?.standard?.fields?.map((field) => ({
                key: field.key || "",
                label: field.label || "",
                type: field.type || "string",
                options: field.options,
                required: field.required || false,
                description: field.description,
              })) || [],
          },
          campaign: {
            fields:
              campaignData.analysisConfig?.campaign?.fields?.map((field) => ({
                key: field.key || "",
                label: field.label || "",
                type: field.type || "string",
                options: field.options,
                required: field.required || false,
                description: field.description,
                isMainKPI: field.isMainKPI,
              })) || [],
          },
        },
      };
      // Insert the template
      const [template] = await db
        .insert(campaignTemplates)
        .values(templateData)
        .returning();

      // Create the campaign with correct field structure
      const campaignValues = {
        name: campaignData.name,
        orgId: campaignData.orgId,
        templateId: template.id,
        direction: campaignData.direction,
        isActive: true,
        metadata: {},
      };

      // Insert the campaign
      const [newCampaign] = await db
        .insert(campaigns)
        .values(campaignValues)
        .returning();

      // Update request status if requestId is provided
      if (campaignData.requestId) {
        await db
          .update(campaignRequests)
          .set({
            status: "completed",
            resultingCampaignId: newCampaign.id,
          } as Partial<typeof campaignRequests.$inferInsert>)
          .where(eq(campaignRequests.id, campaignData.requestId));
      }

      // Configure webhooks if requested
      if (campaignData.configureWebhooks && newCampaign?.id) {
        try {
          await updateAgentWebhooks(
            campaignData.agentId,
            campaignData.orgId,
            newCampaign.id,
            {
              setInbound: campaignData.direction === "inbound",
              setPostCall: true,
            },
          );
        } catch (error) {
          console.error("Error configuring webhooks:", error);
        }
      }

      // Refresh the campaign page
      revalidatePath(`/admin/campaigns`, "page");

      return createSuccess(newCampaign);
    } catch (error) {
      console.error("Error creating campaign:", error);
      return createError("INTERNAL_ERROR", "Failed to create campaign", error);
    }
  },
  async update(
    id: string,
    campaign: ZCampaign,
  ): Promise<ServiceResult<ZCampaign>> {
    try {
      const [updatedCampaign] = await db
        .update(campaigns)
        .set(campaign)
        .where(eq(campaigns.id, id))
        .returning();
      return createSuccess(updatedCampaign);
    } catch (error) {
      console.error("Error updating campaign:", error);
      return createError("INTERNAL_ERROR", "Failed to update campaign", error);
    }
  },
  async getAllCampaignRequests(): Promise<
    ServiceResult<{
      requests: Array<
        typeof campaignRequests.$inferSelect & {
          organization: { name: string };
          user: {
            firstName: string | null;
            lastName: string | null;
            email: string;
          } | null;
        }
      >;
      totalCount: number;
      hasMore: boolean;
    }>
  > {
    try {
      // Query to get the count first
      const countResult = await db
        .select({ count: count() })
        .from(campaignRequests);

      const totalCount = countResult[0].count;

      // First get all campaign requests
      const requests = await db.query.campaignRequests.findMany({
        orderBy: (campaignRequests, { desc }) => [
          desc(campaignRequests.createdAt),
        ],
      });

      // Then get organizations and users separately to avoid relation issues
      const requestsWithRelations = await Promise.all(
        requests.map(async (request) => {
          // Get organization
          const organization = await db.query.organizations.findFirst({
            where: (organizations, { eq }) =>
              eq(organizations.id, request.orgId),
            columns: {
              name: true,
            },
          });

          // Get user, handling case where requestedBy might be null
          let user = null;
          if (request.requestedBy) {
            user = await db.query.users.findFirst({
              where: (users, { eq }) => eq(users.id, request.requestedBy!),
              columns: {
                firstName: true,
                lastName: true,
                email: true,
              },
            });
          }

          return {
            ...request,
            organization: organization || { name: "Unknown Organization" },
            user,
          };
        }),
      );

      return createSuccess({
        requests: requestsWithRelations,
        totalCount: Number(totalCount),
        hasMore: false, // Since we're fetching all at once for admin view
      });
    } catch (error) {
      console.error("Error fetching all campaign requests for admin:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to fetch campaign requests",
        error,
      );
    }
  },
};
