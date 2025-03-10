// src/services/campaigns/campaign-request-service.ts
import {
  createError,
  createSuccess,
  ServiceResult,
} from "@/lib/service-result";
import {
  createCampaignRequestSchema,
  type ZCreateCampaignRequest,
  type ZProcessCampaignRequest,
} from "@/lib/validation/campaigns";
import { db } from "@/server/db";
import { campaignRequests, organizations, users } from "@/server/db/schema";
import { TCampaignRequest } from "@/types/db";
import { and, count, desc, eq, sql } from "drizzle-orm";

export const campaignRequestService = {
  async create(
    data: ZCreateCampaignRequest,
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

  async getById(id: string): Promise<ServiceResult<TCampaignRequest>> {
    try {
      if (!id) {
        return createError("BAD_REQUEST", "Campaign request ID is required");
      }

      const query = db
        .select({
          request: campaignRequests,
          user: users,
          organization: organizations,
        })
        .from(campaignRequests)
        .leftJoin(users, eq(campaignRequests.requestedBy, users.id))
        .leftJoin(organizations, eq(campaignRequests.orgId, organizations.id))
        .where(eq(campaignRequests.id, id))
        .limit(1);

      const result = await query;

      if (!result.length) {
        return createError("NOT_FOUND", "Campaign request not found");
      }

      const { request, user, organization } = result[0];

      return createSuccess({
        ...request,
        user: {
          firstName: user?.firstName || null,
          lastName: user?.lastName || null,
          email: user?.email || "",
        },
        organization: {
          name: organization?.name || "",
        },
      });
    } catch (error) {
      console.error("Error fetching campaign request by ID:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to fetch campaign request",
        error,
      );
    }
  },

  async process(
    data: ZProcessCampaignRequest,
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
