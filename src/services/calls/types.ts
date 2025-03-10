// src/types/calls.ts
import { CallDirection, CallStatus } from "@/server/db/schema";

/**
 * Base Call type derived directly from database schema
 */
export type Call = {
  id: string;
  orgId: string;
  runId?: string | null;
  campaignId?: string | null;
  rowId?: string | null;
  patientId?: string | null;
  agentId: string;
  direction: CallDirection;
  status: CallStatus;
  retellCallId?: string | null;
  recordingUrl?: string | null;
  toNumber: string;
  fromNumber: string;
  batchId?: string | null;
  retryCount?: number | null;
  nextRetryTime?: string | null;
  callMetrics?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  analysis?: Record<string, any> | null;
  transcript?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  duration?: number | null;
  error?: string | null;
  relatedOutboundCallId?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

/**
 * Patient information for call relations
 */
export type CallPatient = {
  id: string;
  firstName: string;
  lastName: string;
  primaryPhone: string;
  dob?: string;
  isMinor?: boolean;
};

/**
 * Campaign information for call relations
 */
export type CallCampaign = {
  id: string;
  name: string;
  direction: CallDirection;
  config?: {
    basePrompt: string;
    voicemailMessage?: string;
    variables: any;
    analysis: any;
  };
  template?: any;
};

/**
 * Run information for call relations
 */
export type CallRun = {
  id: string;
  name: string;
  status: string;
};

/**
 * Call with all its related entities
 */
export type CallWithRelations = Call & {
  patient?: CallPatient | null;
  campaign?: CallCampaign | null;
  run?: CallRun | null;
  row?: any | null;
};

/**
 * Call insights extracted from transcript and analysis
 */
export type CallInsights = {
  sentiment: "positive" | "negative" | "neutral";
  followUpNeeded: boolean;
  followUpReason?: string;
  patientReached: boolean;
  voicemailLeft: boolean;
};

/**
 * Options for fetching calls
 */
export type GetCallsOptions = {
  limit?: number;
  offset?: number;
  patientId?: string;
  runId?: string;
  status?: string;
  direction?: string;
  orgId: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  campaignId?: string;
};

/**
 * Response type for get calls endpoint
 */
export type CallsResponse = {
  calls: CallWithRelations[];
  totalCount: number;
  hasMore: boolean;
};

/**
 * Input type for creating a manual call
 */
export type CreateManualCallInput = {
  patientId: string;
  campaignId?: string;
  agentId: string;
  variables?: Record<string, any>;
};

/**
 * Create corresponding Zod schemas for validation
 */
import { z } from "zod";

export const getCallsSchema = z.object({
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
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
  search: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  campaignId: z.string().uuid().optional(),
});

export const createManualCallSchema = z.object({
  patientId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  agentId: z.string(),
  variables: z.record(z.string(), z.any()).optional(),
});

export type TGetCalls = z.infer<typeof getCallsSchema>;
export type TCreateManualCall = z.infer<typeof createManualCallSchema>;
