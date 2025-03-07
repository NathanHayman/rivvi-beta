// src/services/campaigns/campaign-request-service.ts
import {
  createError,
  createSuccess,
  ServiceResult,
} from "@/lib/service-result";
import {
  createCampaignRequestSchema,
  TProcessCampaignRequest,
  type TCreateCampaignRequest,
} from "@/lib/validation/campaigns";
import { db } from "@/server/db";
import { campaignRequests } from "@/server/db/schema";
import { TCampaignRequest } from "@/types/db";
import { and, count, desc, eq, sql } from "drizzle-orm";

export const campaignRequestService = {
  async create(
    data: TCreateCampaignRequest,
  ): Promise<ServiceResult<TCampaignRequest>> {
    try {
      const validated = createCampaignRequestSchema.parse(data);

      const [request] = await db
        .insert(campaignRequests)
        .values({
          name: validated.name,
          description: validated.description,
          mainGoal: validated.mainGoal,
          desiredAnalysis: validated.desiredAnalysis,
          exampleSheets: validated.exampleSheets,
          status: "pending",
          requestedBy: validated.requestedBy,
          direction: validated.direction,
          orgId: validated.orgId,
        } as typeof campaignRequests.$inferInsert)
        .returning();

      if (!request) {
        return createError(
          "INTERNAL_ERROR",
          "Failed to create campaign request",
        );
      }

      return createSuccess(request);
    } catch (error) {
      console.error("Error creating campaign request:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to create campaign request",
        error,
      );
    }
  },

  async getAll(options: {
    orgId?: string;
    status?: "all" | "pending" | "approved" | "rejected" | "completed";
    limit?: number;
    offset?: number;
  }): Promise<
    ServiceResult<{
      requests: Array<typeof campaignRequests.$inferSelect>;
      totalCount: number;
      hasMore: boolean;
    }>
  > {
    try {
      const { orgId, status, limit = 50, offset = 0 } = options;

      // Build conditions
      let conditions = sql`1=1`;

      if (orgId) {
        conditions = eq(campaignRequests.orgId, orgId);
      }

      if (status) {
        conditions =
          status === "all"
            ? conditions
            : and(conditions, eq(campaignRequests.status, status));
      }

      // Get requests with pagination
      const requests = await db
        .select()
        .from(campaignRequests)
        .where(conditions)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(campaignRequests.createdAt));

      // Get total count
      const [{ value: totalCount }] = await db
        .select({ value: count() })
        .from(campaignRequests)
        .where(conditions);

      return createSuccess({
        requests,
        totalCount: Number(totalCount),
        hasMore: offset + limit < Number(totalCount),
      });
    } catch (error) {
      console.error("Error fetching campaign requests:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to fetch campaign requests",
        error,
      );
    }
  },

  async process(
    data: TProcessCampaignRequest,
  ): Promise<ServiceResult<TCampaignRequest>> {
    try {
      const { requestId, status, adminNotes, resultingCampaignId } = data;

      // Update the request
      const [updatedRequest] = await db
        .update(campaignRequests)
        .set({
          status,
          adminNotes,
          resultingCampaignId,
          updatedAt: new Date(),
        } as Partial<typeof campaignRequests.$inferInsert>)
        .where(and(eq(campaignRequests.id, requestId)))
        .returning();

      if (!updatedRequest) {
        return createError("NOT_FOUND", "Campaign request not found");
      }

      return createSuccess(updatedRequest);
    } catch (error) {
      console.error("Error processing campaign request:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to process campaign request",
        error,
      );
    }
  },
};
