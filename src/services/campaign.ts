// src/services/campaign-service.ts

import { updateAgentPrompt } from "@/lib/retell-client";
import { db } from "@/server/db";
import {
  campaignRequests,
  campaigns,
  organizations,
  runs,
} from "@/server/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql, SQL } from "drizzle-orm";

export type CampaignConfig = {
  basePrompt: string;
  variables: {
    patient: {
      fields: Array<{
        key: string;
        label: string;
        possibleColumns: string[];
        transform?: "text" | "date" | "time" | "phone" | "provider";
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
        transform?: "text" | "date" | "time" | "phone" | "provider";
        required: boolean;
        description?: string;
      }>;
    };
  };
  postCall: {
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
};

export interface CreateCampaignInput {
  name: string;
  orgId: string;
  agentId: string;
  type: string;
  config: CampaignConfig;
}

export interface UpdateCampaignInput {
  id: string;
  name?: string;
  agentId?: string;
  type?: string;
  config?: CampaignConfig;
}

export interface CreateCampaignRequestInput {
  name: string;
  type: string;
  description: string;
  orgId: string;
  requestedBy: string;
}

/**
 * Get all campaigns for an organization
 */
export async function getCampaignsByOrgId(
  orgId: string,
  options: { limit?: number; offset?: number; search?: string } = {},
) {
  const { limit = 50, offset = 0, search } = options;

  try {
    // Build the query
    let query = db
      .select()
      .from(campaigns)
      .orderBy(desc(campaigns.createdAt))
      .limit(limit)
      .offset(offset);

    // Add conditions
    let whereCondition = eq(campaigns.orgId, orgId);

    // Add search condition if provided
    if (search) {
      whereCondition = and(
        whereCondition,
        sql`${campaigns.name} ILIKE ${`%${search}%`}`,
      ) as SQL<unknown>;
    }

    // Execute query with where condition
    const campaignsList = await query.where(whereCondition);

    // Get total count
    const countResult = await db
      .select({ count: sql`COUNT(*)` })
      .from(campaigns)
      .where(eq(campaigns.orgId, orgId));

    const totalCount = Number(countResult[0]?.count || 0);

    return {
      campaigns: campaignsList,
      totalCount,
      hasMore: offset + limit < totalCount,
    };
  } catch (error) {
    console.error("Error getting campaigns:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch campaigns",
    });
  }
}

/**
 * Get a campaign by ID
 */
export async function getCampaignById(id: string, orgId?: string) {
  try {
    let whereClause = eq(campaigns.id, id);

    // Add organization check if provided
    if (orgId) {
      whereClause = and(
        whereClause,
        eq(campaigns.orgId, orgId),
      ) as SQL<unknown>;
    }

    const [campaign] = await db.select().from(campaigns).where(whereClause);

    if (!campaign) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Campaign not found",
      });
    }

    return campaign;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    console.error("Error getting campaign:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch campaign",
    });
  }
}

/**
 * Create a new campaign
 */
export async function createCampaign(input: CreateCampaignInput) {
  try {
    // Verify organization exists
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, input.orgId));

    if (!organization) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      });
    }

    // Create campaign
    const [campaign] = await db
      .insert(campaigns)
      .values({
        id: createId(),
        name: input.name,
        orgId: input.orgId,
        agentId: input.agentId,
        type: input.type,
        config: input.config,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return campaign;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    console.error("Error creating campaign:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create campaign",
    });
  }
}

/**
 * Update a campaign
 */
export async function updateCampaign(input: UpdateCampaignInput) {
  try {
    const { id, ...updateData } = input;

    // Get existing campaign
    const [existingCampaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id));

    if (!existingCampaign) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Campaign not found",
      });
    }

    // Update campaign
    const [updatedCampaign] = await db
      .update(campaigns)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, id))
      .returning();

    return updatedCampaign;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    console.error("Error updating campaign:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to update campaign",
    });
  }
}

/**
 * Update an agent prompt
 */
export async function updateCampaignPrompt(agentId: string, prompt: string) {
  try {
    const result = await updateAgentPrompt(agentId, prompt);
    return result;
  } catch (error) {
    console.error("Error updating agent prompt:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to update agent prompt",
    });
  }
}

/**
 * Create a campaign request
 */
export async function createCampaignRequest(input: CreateCampaignRequestInput) {
  try {
    // Create campaign request
    const [request] = await db
      .insert(campaignRequests)
      .values({
        id: createId(),
        name: input.name,
        type: input.type,
        description: input.description,
        orgId: input.orgId,
        requestedBy: input.requestedBy,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return request;
  } catch (error) {
    console.error("Error creating campaign request:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create campaign request",
    });
  }
}

/**
 * Get campaign requests for an organization
 */
export async function getCampaignRequests(
  orgId: string,
  options: { limit?: number; offset?: number } = {},
) {
  const { limit = 50, offset = 0 } = options;

  try {
    const requests = await db
      .select()
      .from(campaignRequests)
      .where(eq(campaignRequests.orgId, orgId))
      .orderBy(desc(campaignRequests.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql`COUNT(*)` })
      .from(campaignRequests)
      .where(eq(campaignRequests.orgId, orgId));

    const totalCount = Number(countResult[0]?.count || 0);

    return {
      requests,
      totalCount,
      hasMore: offset + limit < totalCount,
    };
  } catch (error) {
    console.error("Error getting campaign requests:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch campaign requests",
    });
  }
}

/**
 * Get recent runs for a campaign
 */
export async function getRecentRunsByCampaignId(
  campaignId: string,
  limit: number = 5,
) {
  try {
    const recentRuns = await db
      .select()
      .from(runs)
      .where(eq(runs.campaignId, campaignId))
      .orderBy(desc(runs.createdAt))
      .limit(limit);

    return recentRuns;
  } catch (error) {
    console.error("Error getting recent runs:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch recent runs",
    });
  }
}
