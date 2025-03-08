import * as z from "zod";

/**
 * Create Patient
 */
const createPatientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().refine((val) => !isNaN(new Date(val).getTime()), {
    message: "Invalid date format",
  }),
  primaryPhone: z.string().min(10),
  secondaryPhone: z.string().optional(),
  emrIdInOrg: z.string().optional(),
  orgId: z.string(),
});

type TCreatePatient = z.infer<typeof createPatientSchema>;

/**
 * Get Patients
 */
const getPatientsSchema = z.object({
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
  search: z.string().optional(),
});

type TGetPatients = z.infer<typeof getPatientsSchema>;

/**
 * Search Patients
 */
const searchPatientsSchema = z.object({
  query: z.string().min(1),
  limit: z.number().optional().default(10),
  includeRecentCalls: z.boolean().optional().default(false),
});

type TSearchPatients = z.infer<typeof searchPatientsSchema>;

export {
  createPatientSchema,
  getPatientsSchema,
  searchPatientsSchema,
  type TCreatePatient,
  type TGetPatients,
  type TSearchPatients,
};
