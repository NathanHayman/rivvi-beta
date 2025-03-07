import * as z from "zod";

/**
 * Get Runs
 */
const getRunsSchema = z.object({
  campaignId: z.string().uuid(),
  limit: z.number().optional().default(20),
  offset: z.number().optional().default(0),
  orgId: z.string(),
});

type TGetRuns = z.infer<typeof getRunsSchema>;

/**
 * Upload File
 */
const uploadFileSchema = z.object({
  runId: z.string().uuid(),
  fileContent: z.string(),
  fileName: z.string(),
});

type TUploadFile = z.infer<typeof uploadFileSchema>;

/**
 * Start Run
 */
const startRunSchema = z.object({
  runId: z.string().uuid(),
});

type TStartRun = z.infer<typeof startRunSchema>;

/**
 * Pause Run
 */
const pauseRunSchema = z.object({
  runId: z.string().uuid(),
});

type TPauseRun = z.infer<typeof pauseRunSchema>;

export {
  getRunsSchema,
  pauseRunSchema,
  startRunSchema,
  uploadFileSchema,
  type TGetRuns,
  type TPauseRun,
  type TStartRun,
  type TUploadFile,
};
