// src/services/calls/calls-service.ts
import { retell } from "@/lib/retell/retell-client";
import {
  ServiceResult,
  createError,
  createSuccess,
} from "@/lib/service-result";
import { db } from "@/server/db";
import {
  calls,
  campaignTemplates,
  campaigns,
  organizations,
  patients,
  rows,
  runs,
} from "@/server/db/schema";
import { CallWithRelations, GetCallsOptions } from "@/types/api/calls";
import { and, count, desc, eq, sql } from "drizzle-orm";

export const callService = {
  async getAll(options: GetCallsOptions): Promise<
    ServiceResult<{
      calls: CallWithRelations[];
      totalCount: number;
      hasMore: boolean;
    }>
  > {
    try {
      const {
        limit = 50,
        offset = 0,
        patientId,
        runId,
        status,
        direction,
        orgId,
      } = options;

      // Build base query conditions
      let conditions = eq(calls.orgId, orgId);

      // Add additional filters if provided
      if (patientId) {
        conditions = and(conditions, eq(calls.patientId, patientId));
      }

      if (runId) {
        conditions = and(conditions, eq(calls.runId, runId));
      }

      if (status) {
        conditions = and(conditions, eq(calls.status, status));
      }

      if (direction) {
        conditions = and(conditions, eq(calls.direction, direction));
      }

      // Query for calls
      const allCalls = await db
        .select()
        .from(calls)
        .where(conditions)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(calls.createdAt));

      // Get total count
      const [{ value: totalCount }] = await db
        .select({ value: count() })
        .from(calls)
        .where(conditions);

      // Efficient batch loading of related entities
      const callsWithRelations = await this.loadRelations(allCalls);

      return createSuccess({
        calls: callsWithRelations,
        totalCount: Number(totalCount),
        hasMore: offset + limit < Number(totalCount),
      });
    } catch (error) {
      console.error("Error fetching calls:", error);
      return createError("INTERNAL_ERROR", "Failed to fetch calls", error);
    }
  },

  async getById(
    id: string,
    orgId: string,
  ): Promise<ServiceResult<CallWithRelations>> {
    try {
      // Get call with organization check
      const [call] = await db
        .select()
        .from(calls)
        .where(and(eq(calls.id, id), eq(calls.orgId, orgId)));

      if (!call) {
        return createError("NOT_FOUND", "Call not found");
      }

      // Get all related data in parallel
      const [patient, campaign, run, row] = await Promise.all([
        call.patientId
          ? db.query.patients.findFirst({
              where: eq(patients.id, call.patientId),
            })
          : null,

        call.campaignId
          ? db.query.campaigns.findFirst({
              where: eq(campaigns.id, call.campaignId),
              with: {
                template: true,
              },
            })
          : null,

        call.runId
          ? db.query.runs.findFirst({
              where: eq(runs.id, call.runId),
            })
          : null,

        call.rowId
          ? db.query.rows.findFirst({
              where: eq(rows.id, call.rowId),
            })
          : null,
      ]);

      return createSuccess({
        ...call,
        patient,
        campaign: campaign
          ? {
              ...campaign,
              template: campaign.template,
              config: campaign.template
                ? {
                    analysis: campaign.template.analysisConfig,
                    variables: campaign.template.variablesConfig,
                    basePrompt: campaign.template.basePrompt,
                    voicemailMessage: campaign.template.voicemailMessage,
                  }
                : undefined,
            }
          : null,
        run,
        row,
      });
    } catch (error) {
      console.error("Error fetching call:", error);
      return createError("INTERNAL_ERROR", "Failed to fetch call", error);
    }
  },

  async getTranscript(
    callId: string,
    orgId: string,
  ): Promise<
    ServiceResult<{
      transcript: string | null;
      message?: string;
    }>
  > {
    try {
      // Get the call
      const call = await db.query.calls.findFirst({
        where: and(eq(calls.id, callId), eq(calls.orgId, orgId)),
      });

      if (!call) {
        return createError("NOT_FOUND", "Call not found");
      }

      // If we already have a transcript, return it
      if (call.transcript) {
        return createSuccess({ transcript: call.transcript });
      }

      // If no retell call ID, we can't fetch a transcript
      if (!call.retellCallId) {
        return createSuccess({
          transcript: null,
          message: "No transcript available for this call",
        });
      }

      try {
        // Fetch transcript from Retell
        const retellResponse = await retell.call.retrieve(call.retellCallId);

        if (retellResponse.transcript) {
          // Store transcript for future requests
          await db
            .update(calls)
            .set({ transcript: retellResponse.transcript })
            .where(eq(calls.id, callId));

          return createSuccess({ transcript: retellResponse.transcript });
        }

        return createSuccess({
          transcript: null,
          message: "Transcript not available yet",
        });
      } catch (error) {
        console.error("Error fetching transcript from Retell:", error);
        return createError(
          "INTERNAL_ERROR",
          "Failed to fetch transcript from Retell",
          error,
        );
      }
    } catch (error) {
      console.error("Error fetching transcript:", error);
      return createError("INTERNAL_ERROR", "Failed to fetch transcript", error);
    }
  },

  async getPatientCalls(
    patientId: string,
    orgId: string,
    limit: number,
  ): Promise<ServiceResult<CallWithRelations[]>> {
    try {
      const recentCalls = await db
        .select()
        .from(calls)
        .where(and(eq(calls.patientId, patientId), eq(calls.orgId, orgId)))
        .limit(limit)
        .orderBy(desc(calls.createdAt));

      // Load relations for these calls
      const callsWithRelations = await this.loadRelations(recentCalls);

      return createSuccess(callsWithRelations);
    } catch (error) {
      console.error("Error getting patient calls:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to get patient calls",
        error,
      );
    }
  },

  async createManualCall(data: {
    patientId: string;
    orgId: string;
    campaignId?: string;
    agentId: string;
    variables?: Record<string, any>;
  }): Promise<ServiceResult<typeof calls.$inferSelect>> {
    try {
      const { patientId, orgId, campaignId, agentId, variables = {} } = data;

      // Get patient
      const patient = await db.query.patients.findFirst({
        where: eq(patients.id, patientId),
      });

      if (!patient) {
        return createError("NOT_FOUND", "Patient not found");
      }

      // Get organization
      const organization = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
      });

      if (!organization) {
        return createError("NOT_FOUND", "Organization not found");
      }

      // Create call record
      const [call] = await db
        .insert(calls)
        .values({
          orgId,
          patientId,
          campaignId,
          agentId,
          direction: "outbound",
          status: "pending",
          isManualCall: true,
          variables,
        } as typeof calls.$inferInsert)
        .returning();

      if (!call) {
        return createError("INTERNAL_ERROR", "Failed to create call record");
      }

      try {
        // Create call in Retell
        const retellCall = await retell.call.create({
          toNumber: patient.primaryPhone,
          fromNumber: organization.phone,
          agentId: agentId,
          variables: {
            ...variables,
            first_name: patient.firstName,
            last_name: patient.lastName,
            phone: patient.primaryPhone,
            is_manual_call: "true",
          },
          metadata: {
            callId: call.id,
            orgId,
            patientId,
            campaignId,
            isManualCall: true,
          },
        });

        // Update call with Retell ID
        await db
          .update(calls)
          .set({ retellCallId: retellCall.call_id })
          .where(eq(calls.id, call.id));

        return createSuccess(call);
      } catch (error) {
        // Delete the call record if Retell call creation fails
        await db.delete(calls).where(eq(calls.id, call.id));

        console.error("Error creating call in Retell:", error);
        return createError(
          "INTERNAL_ERROR",
          "Failed to create call in Retell",
          error,
        );
      }
    } catch (error) {
      console.error("Error creating manual call:", error);
      return createError("INTERNAL_ERROR", "Failed to create call", error);
    }
  },

  // Helper method to efficiently load related entities for calls
  async loadRelations(
    callsList: Array<typeof calls.$inferSelect>,
  ): Promise<CallWithRelations[]> {
    if (!callsList.length) return [];

    // Extract IDs for batch loading
    const patientIds = callsList
      .map((c) => c.patientId)
      .filter(Boolean) as string[];

    const campaignIds = callsList
      .map((c) => c.campaignId)
      .filter(Boolean) as string[];

    const runIds = callsList.map((c) => c.runId).filter(Boolean) as string[];

    // Batch load all relations in parallel
    const [patientsData, campaignsData, runsData] = await Promise.all([
      patientIds.length
        ? db
            .select()
            .from(patients)
            .where(sql`${patients.id} IN (${patientIds.join(",")})`)
        : [],

      campaignIds.length
        ? db
            .select({
              campaign: campaigns,
              template: campaignTemplates,
            })
            .from(campaigns)
            .leftJoin(
              campaignTemplates,
              eq(campaigns.templateId, campaignTemplates.id),
            )
            .where(sql`${campaigns.id} IN (${campaignIds.join(",")})`)
        : [],

      runIds.length
        ? db
            .select()
            .from(runs)
            .where(sql`${runs.id} IN (${runIds.join(",")})`)
        : [],
    ]);

    // Create maps for quick lookups
    const patientMap = new Map(patientsData.map((p) => [p.id, p]));

    const campaignMap = new Map(
      campaignsData.map(({ campaign, template }) => [
        campaign.id,
        {
          ...campaign,
          template,
          config: template
            ? {
                analysis: template.analysisConfig,
                variables: template.variablesConfig,
                basePrompt: template.basePrompt,
                voicemailMessage: template.voicemailMessage,
              }
            : undefined,
        },
      ]),
    );

    const runMap = new Map(runsData.map((r) => [r.id, r]));

    // Combine data
    return callsList.map((call) => ({
      ...call,
      patient: call.patientId ? patientMap.get(call.patientId) || null : null,
      campaign: call.campaignId
        ? campaignMap.get(call.campaignId) || null
        : null,
      run: call.runId ? runMap.get(call.runId) || null : null,
    }));
  },
};
