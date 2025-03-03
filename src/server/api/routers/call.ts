// src/server/api/routers/call.ts
import { retell } from "@/lib/retell-client";
import { createTRPCRouter, orgProcedure } from "@/server/api/trpc";
import { calls, campaigns, patients, rows, runs } from "@/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, SQL, sql } from "drizzle-orm";
import { z } from "zod";

export const callRouter = createTRPCRouter({
  // Get all calls for the current organization
  getAll: orgProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
        patientId: z.string().uuid().optional(),
        runId: z.string().uuid().optional(),
        status: z
          .enum([
            "pending",
            "in-progress",
            "completed",
            "failed",
            "voicemail",
            "no-answer",
          ])
          .optional(),
        direction: z.enum(["inbound", "outbound"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset, patientId, runId, status, direction } = input;
      const orgId = ctx.auth.orgId;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      // Build base query conditions
      let conditions = eq(calls.orgId, orgId);

      // Add additional filters if provided
      if (patientId) {
        conditions = and(
          conditions,
          eq(calls.patientId, patientId),
        ) as SQL<unknown>;
      }

      if (runId) {
        conditions = and(conditions, eq(calls.runId, runId)) as SQL<unknown>;
      }

      if (status) {
        conditions = and(conditions, eq(calls.status, status)) as SQL<unknown>;
      }

      if (direction) {
        conditions = and(
          conditions,
          eq(calls.direction, direction),
        ) as SQL<unknown>;
      }

      // Query for calls
      const allCalls = await ctx.db
        .select()
        .from(calls)
        .where(conditions)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(calls.createdAt));

      // Get total count
      const totalCount = await ctx.db
        .select({ count: sql`count(*)` })
        .from(calls)
        .where(conditions)
        .then((res) => Number(res[0]?.count || 0));

      // If we have calls with patient IDs, get the patient info
      const patientIds = allCalls
        .map((call) => call.patientId)
        .filter((id): id is string => !!id);

      const patientMap: Record<string, typeof patients.$inferSelect> = {};

      if (patientIds.length > 0) {
        const patientsData = await ctx.db
          .select()
          .from(patients)
          .where(sql`${patients.id} IN ${patientIds}`);

        patientsData.forEach((patient) => {
          patientMap[patient.id] = patient;
        });
      }

      // If we have calls with campaign IDs, get the campaign info
      const campaignIds = allCalls
        .map((call) => call.campaignId)
        .filter((id): id is string => !!id);

      const campaignMap: Record<string, typeof campaigns.$inferSelect> = {};

      if (campaignIds.length > 0) {
        const campaignsData = await ctx.db
          .select()
          .from(campaigns)
          .where(sql`${campaigns.id} IN ${campaignIds}`);

        campaignsData.forEach((campaign) => {
          campaignMap[campaign.id] = campaign;
        });
      }

      // Return calls with patient and campaign info
      const callsWithInfo = allCalls.map((call) => ({
        ...call,
        patient: call.patientId ? patientMap[call.patientId] : null,
        campaign: call.campaignId ? campaignMap[call.campaignId] : null,
      }));

      return {
        calls: callsWithInfo,
        totalCount,
        hasMore: offset + limit < totalCount,
      };
    }),

  // Get a call by ID
  getById: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.auth.orgId;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      const [call] = await ctx.db
        .select()
        .from(calls)
        .where(and(eq(calls.id, input.id), eq(calls.orgId, orgId)));

      if (!call) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Call not found",
        });
      }

      // Get patient info if available
      let patient = null;
      if (call.patientId) {
        const [patientData] = await ctx.db
          .select()
          .from(patients)
          .where(eq(patients.id, call.patientId));

        patient = patientData;
      }

      // Get row info if available
      let row = null;
      if (call.rowId) {
        const [rowData] = await ctx.db
          .select()
          .from(rows)
          .where(eq(rows.id, call.rowId));

        row = rowData;
      }

      // Get run info if available
      let run = null;
      if (call.runId) {
        const [runData] = await ctx.db
          .select()
          .from(runs)
          .where(eq(runs.id, call.runId));

        run = runData;
      }

      return {
        ...call,
        patient,
        row,
        run,
      };
    }),

  // Create a manual call
  createManualCall: orgProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        campaignId: z.string().uuid().optional(),
        agentId: z.string(),
        variables: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { patientId, campaignId, agentId, variables } = input;
      const orgId = ctx.auth.orgId;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      // Get patient data
      const [patient] = await ctx.db
        .select()
        .from(patients)
        .where(eq(patients.id, patientId));

      if (!patient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Patient not found",
        });
      }

      // Get organization phone number
      const orgPhone = ctx.organization.phone;
      if (!orgPhone) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization does not have a phone number configured",
        });
      }

      try {
        // Create call in Retell
        const retellCall = await retell.call.createPhoneCall({
          to_number: patient.primaryPhone,
          from_number: orgPhone,
          override_agent_id: agentId,
          retell_llm_dynamic_variables: {
            ...variables,
            first_name: patient.firstName,
            last_name: patient.lastName,
            phone: patient.primaryPhone,
            is_manual_call: "true",
          },
          metadata: {
            orgId,
            patientId,
            campaignId,
            isManualCall: true,
          },
        });

        if (!retellCall.call_id) {
          throw new Error("No call ID returned from Retell");
        }

        // Create call record
        const [call] = await ctx.db
          .insert(calls)
          .values({
            orgId,
            patientId,
            agentId,
            direction: "outbound",
            status: "pending",
            retellCallId: retellCall.call_id,
            toNumber: patient.primaryPhone,
            fromNumber: orgPhone,
            metadata: {
              isManualCall: true,
              variables,
              campaignId,
            },
          })
          .returning();

        return call;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create call",
          cause: error,
        });
      }
    }),

  // Get recent calls for a patient
  getPatientCalls: orgProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        limit: z.number().min(1).max(20).optional().default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { patientId, limit } = input;
      const orgId = ctx.auth.orgId;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      const recentCalls = await ctx.db
        .select()
        .from(calls)
        .where(and(eq(calls.patientId, patientId), eq(calls.orgId, orgId)))
        .limit(limit)
        .orderBy(desc(calls.createdAt));

      return recentCalls;
    }),

  // Get call transcript
  getTranscript: orgProcedure
    .input(z.object({ callId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { callId } = input;
      const orgId = ctx.auth.orgId;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      const [call] = await ctx.db
        .select()
        .from(calls)
        .where(and(eq(calls.id, callId), eq(calls.orgId, orgId)));

      if (!call) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Call not found",
        });
      }

      if (call.transcript) {
        return { transcript: call.transcript };
      }

      // If transcript is not stored locally, try to fetch from Retell
      try {
        const retellResponse = await retell.call.retrieve(call.retellCallId);

        if (retellResponse.transcript) {
          // Store transcript for future requests
          await ctx.db
            .update(calls)
            .set({ transcript: retellResponse.transcript })
            .where(eq(calls.id, callId));

          return { transcript: retellResponse.transcript };
        }

        return { transcript: null, message: "Transcript not available yet" };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch transcript from Retell",
          cause: error,
        });
      }
    }),
});
