import * as z from "zod";

/**
 * Create Manual Call
 */
const createManualCallSchema = z.object({
  agentId: z.string(),
  patientId: z.string(),
  campaignId: z.string().optional(),
  variables: z.record(z.any()).optional(),
});
type TCreateManualCall = z.infer<typeof createManualCallSchema>;

/**
 * Get Calls
 */
const getCallsSchema = z.object({
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
  patientId: z.string().uuid().optional(),
  runId: z.string().uuid().optional(),
  status: z.string().optional(),
  direction: z.string().optional(),
  search: z.string().optional(),
  startDate: z.preprocess((val) => {
    // If it's already a string, return it
    if (typeof val === "string") return val;
    // If it's a Date, convert to ISO string
    if (val instanceof Date) return val.toISOString();
    // Otherwise return undefined
    return undefined;
  }, z.string().optional()),
  endDate: z.preprocess((val) => {
    // If it's already a string, return it
    if (typeof val === "string") return val;
    // If it's a Date, convert to ISO string
    if (val instanceof Date) return val.toISOString();
    // Otherwise return undefined
    return undefined;
  }, z.string().optional()),
  campaignId: z.string().optional(),
});
type TGetCalls = z.infer<typeof getCallsSchema>;

export {
  createManualCallSchema,
  getCallsSchema,
  type TCreateManualCall,
  type TGetCalls,
};
