// src/lib/patient-service.ts
import { calls, organizationPatients, patients } from "@/server/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { createHash } from "crypto";
import { and, desc, eq, gte, ilike, like, lte, or, sql } from "drizzle-orm";

type DatabaseClient = typeof import("@/server/db").db;

type PatientInput = {
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  secondaryPhone?: string;
  emrId?: string;
  orgId?: string;
  externalIds?: Record<string, string>; // Map of system IDs (e.g., EMR IDs, insurance IDs)
  metadata?: Record<string, unknown>; // Additional patient data
};

type PatientResult = {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  primaryPhone: string;
  patientHash: string;
  isNewPatient: boolean;
  externalIds?: Record<string, string>;
  metadata?: Record<string, unknown>;
};

/**
 * Generate a hash for patient identification
 */
export function generatePatientHash(phone: string, dob: string): string {
  const normalizedPhone = String(phone).replace(/\D/g, "");
  const normalizedDob = String(dob).replace(/\D/g, "");

  const hash = createHash("sha256");
  hash.update(`${normalizedPhone}-${normalizedDob}`);
  return hash.digest("hex");
}

export class PatientService {
  private db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  /**
   * Search patients by multiple criteria
   * Allows advanced search across various patient fields with organization context
   */
  async searchPatients(params: {
    query?: string;
    phone?: string;
    emrId?: string;
    firstName?: string;
    lastName?: string;
    orgId?: string;
    limit?: number;
    offset?: number;
    includeInactive?: boolean;
    withRecentCalls?: boolean;
  }): Promise<{
    patients: (typeof patients.$inferSelect)[];
    total: number;
  }> {
    try {
      const {
        query,
        phone,
        emrId,
        firstName,
        lastName,
        orgId,
        limit = 50,
        offset = 0,
        includeInactive = false,
        withRecentCalls = false,
      } = params;

      // Build query conditions
      const conditions = [];

      // Global search query
      if (query) {
        const searchPattern = `%${query.toLowerCase()}%`;
        conditions.push(
          or(
            ilike(patients.firstName, searchPattern),
            ilike(patients.lastName, searchPattern),
            ilike(patients.primaryPhone, searchPattern),
            ilike(patients.secondaryPhone, searchPattern),
          ),
        );
      }

      // Specific field filters
      if (phone) {
        const cleanPhone = phone.replace(/\D/g, "");
        conditions.push(
          or(
            ilike(patients.primaryPhone, `%${cleanPhone}%`),
            ilike(patients.secondaryPhone, `%${cleanPhone}%`),
          ),
        );
      }

      if (firstName) {
        conditions.push(ilike(patients.firstName, `%${firstName}%`));
      }

      if (lastName) {
        conditions.push(ilike(patients.lastName, `%${lastName}%`));
      }

      // Base query for patients
      const baseQuery = this.db.select().from(patients);

      // Organization context filtering
      let query1;
      if (orgId) {
        // Join with organization patients table
        query1 = baseQuery.innerJoin(
          organizationPatients,
          and(
            eq(organizationPatients.patientId, patients.id),
            eq(organizationPatients.orgId, orgId),
            includeInactive
              ? sql`TRUE`
              : eq(organizationPatients.isActive, true),
          ),
        );

        // EMR ID in organization context
        if (emrId) {
          conditions.push(ilike(organizationPatients.emrIdInOrg, `%${emrId}%`));
        }
      } else {
        query1 = baseQuery;
      }

      // Apply conditions if any
      const finalQuery =
        conditions.length > 0 ? query1.where(and(...conditions)) : query1;

      // Get total count
      const [countResult] = await this.db
        .select({ count: sql`COUNT(DISTINCT ${patients.id})` })
        .from(finalQuery.as("patient_count"));

      const total = Number(countResult?.count || 0);

      // Get paginated results with sorting
      let patientResults = await finalQuery
        .orderBy(desc(patients.updatedAt))
        .limit(limit)
        .offset(offset);

      // Extract just the patient data from the join result if needed
      const resultPatients = patientResults.map((row) => {
        // If result is from a join, extract just the patient part
        return "patients" in row ? row.patients : row;
      }) as (typeof patients.$inferSelect)[];

      // Optionally fetch recent calls
      if (withRecentCalls && resultPatients.length > 0) {
        const patientIds = resultPatients.map((p) => p.id);

        // Get recent calls for each patient
        const recentCalls = await this.db
          .select()
          .from(calls)
          .where(sql`${calls.patientId} IN (${patientIds.join(",")})`)
          .orderBy(desc(calls.createdAt))
          .limit(patientIds.length * 5); // Get up to 5 recent calls per patient

        // Group calls by patient
        const callsByPatient: Record<string, (typeof calls.$inferSelect)[]> =
          {};
        recentCalls.forEach((call) => {
          if (call.patientId) {
            if (!callsByPatient[call.patientId]) {
              callsByPatient[call.patientId] = [];
            }
            callsByPatient[call.patientId]?.push(call);
          }
        });

        // Attach recent calls to patients
        resultPatients.forEach((patient) => {
          (patient as any).recentCalls = callsByPatient[patient.id] || [];
        });
      }

      return {
        patients: resultPatients,
        total,
      };
    } catch (error) {
      console.error("Error in searchPatients:", error);
      return { patients: [], total: 0 };
    }
  }

  /**
   * Find or create a patient based on provided information
   * Enhanced with support for external IDs and metadata
   */
  async findOrCreatePatient(
    input: PatientInput,
  ): Promise<PatientResult | null> {
    const {
      firstName,
      lastName,
      dob,
      phone,
      secondaryPhone,
      emrId,
      orgId,
      externalIds,
      metadata,
    } = input;

    try {
      // Generate a hash for deduplication
      const patientHash = generatePatientHash(phone, dob);

      // Check if patient already exists
      const existingPatients = await this.db
        .select()
        .from(patients)
        .where(eq(patients.patientHash, patientHash));

      let patient;
      let isNewPatient = false;

      if (existingPatients.length > 0) {
        // Patient exists, use the first match
        patient = existingPatients[0];

        // Update patient with new information
        const updates: Record<string, unknown> = {
          updatedAt: new Date(),
        };

        if (firstName && lastName) {
          updates.firstName = firstName;
          updates.lastName = lastName;
        }

        if (secondaryPhone) {
          updates.secondaryPhone = secondaryPhone;
        }

        // Handle external IDs and metadata as JSON data
        if (externalIds && Object.keys(externalIds).length > 0) {
          updates.externalIds = {
            ...(patient?.externalIds || {}),
            ...externalIds,
          };
        }

        if (metadata && Object.keys(metadata).length > 0) {
          updates.metadata = {
            ...(patient?.metadata || {}),
            ...metadata,
          };
        }

        // Only update if we have changes to make
        if (Object.keys(updates).length > 1) {
          await this.db
            .update(patients)
            .set(updates)
            .where(eq(patients.id, patient?.id || ""));

          // Refresh patient data
          [patient] = await this.db
            .select()
            .from(patients)
            .where(eq(patients.id, patient?.id || ""));
        }
      } else {
        // Create new patient
        const dobDate = new Date(dob);
        const isMinor =
          dobDate > new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000);

        const [newPatient] = await this.db
          .insert(patients)
          .values({
            id: createId(),
            patientHash,
            firstName,
            lastName,
            dob: dobDate.toISOString(),
            isMinor,
            primaryPhone: phone,
            secondaryPhone: secondaryPhone,
            externalIds: externalIds || {},
            metadata: metadata || {},
          })
          .returning();

        patient = newPatient;
        isNewPatient = true;
      }

      // If orgId is provided, link patient to organization
      if (orgId && patient) {
        // Check if link already exists
        const existingLinks = await this.db
          .select()
          .from(organizationPatients)
          .where(
            and(
              eq(organizationPatients.patientId, patient.id),
              eq(organizationPatients.orgId, orgId),
            ),
          );

        if (existingLinks.length === 0) {
          // Create link
          await this.db.insert(organizationPatients).values({
            orgId,
            patientId: patient.id,
            emrIdInOrg: emrId,
            isActive: true,
          });
        } else if (emrId || externalIds) {
          // Update organization patient link with new data
          const updates: Record<string, unknown> = {
            isActive: true,
            updatedAt: new Date(),
          };

          if (emrId) {
            updates.emrIdInOrg = emrId;
          }

          await this.db
            .update(organizationPatients)
            .set(updates)
            .where(
              and(
                eq(organizationPatients.patientId, patient.id),
                eq(organizationPatients.orgId, orgId),
              ),
            );
        }
      }

      // Return patient with additional metadata
      return {
        id: patient?.id || "",
        firstName: patient?.firstName || "",
        lastName: patient?.lastName || "",
        dob: patient?.dob.toString() || "",
        primaryPhone: patient?.primaryPhone || "",
        patientHash: patient?.patientHash || "",
        isNewPatient,
        externalIds: patient?.externalIds as Record<string, string>,
        metadata: patient?.metadata as Record<string, unknown>,
      };
    } catch (error) {
      console.error("Error in findOrCreatePatient:", error);
      return null;
    }
  }

  /**
   * Find a patient by phone number
   * Can be organization-specific to handle cases where the same phone number
   * might exist across multiple organizations
   */
  async findPatientByPhone(
    phone: string,
    orgId?: string,
  ): Promise<typeof patients.$inferSelect | null> {
    try {
      // Clean phone input
      const cleanPhone = phone.replace(/\D/g, "");

      // Format options for different phone patterns to search
      const phonePatterns = [
        cleanPhone, // Raw digits
        `+1${cleanPhone}`, // +1 format
        `(${cleanPhone.substring(0, 3)}) ${cleanPhone.substring(3, 6)}-${cleanPhone.substring(6)}`, // (XXX) XXX-XXXX
      ];

      // Build query to match multiple phone formats
      const phoneConditions = phonePatterns.map((p) =>
        or(eq(patients.primaryPhone, p), eq(patients.secondaryPhone, p)),
      );

      // Find patients with matching any phone format
      const matchingPatients = await this.db
        .select()
        .from(patients)
        .where(or(...phoneConditions));

      if (matchingPatients.length === 0) {
        return null;
      }

      // If we have an orgId, prioritize patients linked to that org
      if (orgId && matchingPatients.length > 0) {
        // First try to find an exact match within this organization
        for (const patient of matchingPatients) {
          const links = await this.db
            .select()
            .from(organizationPatients)
            .where(
              and(
                eq(organizationPatients.patientId, patient.id),
                eq(organizationPatients.orgId, orgId),
                eq(organizationPatients.isActive, true),
              ),
            );

          if (links.length > 0) {
            return patient;
          }
        }
      }

      // Default to first match if no organization-specific match is found
      return matchingPatients[0] || null;
    } catch (error) {
      console.error("Error in findPatientByPhone:", error);
      return null;
    }
  }

  /**
   * Find a patient by ID
   */
  async findPatientById(
    id: string,
  ): Promise<typeof patients.$inferSelect | null> {
    try {
      const [patient] = await this.db
        .select()
        .from(patients)
        .where(eq(patients.id, id));

      return patient || null;
    } catch (error) {
      console.error("Error in findPatientById:", error);
      return null;
    }
  }

  /**
   * Find patients by name with optional organization context
   */
  async findPatientsByName(
    firstName: string,
    lastName: string,
    orgId?: string,
  ): Promise<(typeof patients.$inferSelect)[]> {
    try {
      const firstNamePattern = `%${firstName.toLowerCase()}%`;
      const lastNamePattern = `%${lastName.toLowerCase()}%`;

      // Find patients by name pattern
      let matchingPatients = await this.db
        .select()
        .from(patients)
        .where(
          and(
            like(patients.firstName, firstNamePattern),
            like(patients.lastName, lastNamePattern),
          ),
        );

      // If orgId provided, filter to only include patients in that organization
      if (orgId && matchingPatients.length > 0) {
        const patientIds = matchingPatients.map((p) => p.id);

        // Get organization links
        const orgLinks = await this.db
          .select()
          .from(organizationPatients)
          .where(
            and(
              eq(organizationPatients.orgId, orgId),
              eq(organizationPatients.isActive, true),
            ),
          );

        const orgPatientIds = new Set(orgLinks.map((link) => link.patientId));

        // Filter patients to only those with organization links
        matchingPatients = matchingPatients.filter((p) =>
          orgPatientIds.has(p.id),
        );
      }

      return matchingPatients;
    } catch (error) {
      console.error("Error in findPatientsByName:", error);
      return [];
    }
  }

  /**
   * Bulk insert patients with organization links
   * Used for efficient processing of batched patient data
   */
  async bulkInsertPatients(
    patientData: {
      firstName: string;
      lastName: string;
      dob: string;
      phone: string;
      secondaryPhone?: string;
      patientHash: string;
      externalIds?: Record<string, string>;
      metadata?: Record<string, unknown>;
    }[],
    orgId: string,
  ): Promise<string[]> {
    try {
      // Get existing patients with these hashes to avoid duplicates
      const patientHashes = patientData.map((p) => p.patientHash);
      const existingPatients = await this.db
        .select()
        .from(patients)
        .where(sql`${patients.patientHash} IN (${patientHashes.join(",")})`);

      const existingHashes = new Set(
        existingPatients.map((p) => p.patientHash),
      );

      // Prepare to insert new patients
      const newPatients = patientData
        .filter((p) => !existingHashes.has(p.patientHash))
        .map((p) => {
          const dobDate = new Date(p.dob);
          const isMinor =
            dobDate > new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000);

          return {
            id: createId(),
            patientHash: p.patientHash,
            firstName: p.firstName,
            lastName: p.lastName,
            dob: dobDate.toISOString(),
            isMinor,
            primaryPhone: p.phone,
            secondaryPhone: p.secondaryPhone || null,
            externalIds: p.externalIds || {},
            metadata: p.metadata || {},
          };
        });

      // Insert new patients if any
      let insertedPatients: (typeof patients.$inferSelect)[] = [];
      if (newPatients.length > 0) {
        insertedPatients = await this.db
          .insert(patients)
          .values(newPatients)
          .returning();
      }

      // Combine existing and newly inserted patients
      const allPatients = [...existingPatients, ...insertedPatients];

      // Create organization links for all patients
      const existingLinks = await this.db
        .select()
        .from(organizationPatients)
        .where(
          and(
            eq(organizationPatients.orgId, orgId),
            sql`${organizationPatients.patientId} IN (${allPatients.map((p) => `'${p.id}'`).join(",")})`,
          ),
        );

      const existingLinkPatientIds = new Set(
        existingLinks.map((link) => link.patientId),
      );

      // Create new links for patients not already linked
      const newLinks = allPatients
        .filter((p) => !existingLinkPatientIds.has(p.id))
        .map((p) => ({
          orgId,
          patientId: p.id,
          isActive: true,
        }));

      if (newLinks.length > 0) {
        await this.db.insert(organizationPatients).values(newLinks);
      }

      // Return all patient IDs
      return allPatients.map((p) => p.id);
    } catch (error) {
      console.error("Error in bulkInsertPatients:", error);
      return [];
    }
  }

  /**
   * Get call history for a specific patient
   * Useful for displaying communication history and call outcomes
   */
  async getPatientCallHistory(params: {
    patientId: string;
    orgId?: string;
    limit?: number;
    offset?: number;
    direction?: "inbound" | "outbound" | "all";
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    calls: (typeof calls.$inferSelect)[];
    total: number;
  }> {
    try {
      const {
        patientId,
        orgId,
        limit = 20,
        offset = 0,
        direction = "all",
        startDate,
        endDate,
      } = params;

      // Build conditions
      const conditions = [eq(calls.patientId, patientId)];

      // Filter by organization if specified
      if (orgId) {
        conditions.push(eq(calls.orgId, orgId));
      }

      // Filter by direction if specified
      if (direction !== "all") {
        conditions.push(eq(calls.direction, direction));
      }

      // Date range filters
      if (startDate) {
        conditions.push(gte(calls.createdAt, startDate));
      }

      if (endDate) {
        conditions.push(lte(calls.createdAt, endDate));
      }

      // Get total count
      const [countResult] = await this.db
        .select({ count: sql`COUNT(*)` })
        .from(calls)
        .where(and(...conditions));

      const total = Number(countResult?.count || 0);

      // Get paginated results
      const callHistory = await this.db
        .select()
        .from(calls)
        .where(and(...conditions))
        .orderBy(desc(calls.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        calls: callHistory,
        total,
      };
    } catch (error) {
      console.error("Error in getPatientCallHistory:", error);
      return { calls: [], total: 0 };
    }
  }

  /**
   * Get patient statistics by organization
   * Useful for dashboards and analytics
   */
  async getPatientStatsByOrg(orgId: string): Promise<{
    totalPatients: number;
    newPatients30Days: number;
    patientsByMonth: { month: string; count: number }[];
    callMetrics: {
      totalCalls: number;
      reachedPatient: number;
      leftVoicemail: number;
      unableToReach: number;
    };
  }> {
    try {
      // Total patients in organization
      const [totalResult] = await this.db
        .select({ count: sql`COUNT(*)` })
        .from(organizationPatients)
        .where(
          and(
            eq(organizationPatients.orgId, orgId),
            eq(organizationPatients.isActive, true),
          ),
        );

      const totalPatients = Number(totalResult?.count || 0);

      // New patients in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [newPatientsResult] = await this.db
        .select({ count: sql`COUNT(*)` })
        .from(organizationPatients)
        .where(
          and(
            eq(organizationPatients.orgId, orgId),
            eq(organizationPatients.isActive, true),
            gte(organizationPatients.createdAt, thirtyDaysAgo),
          ),
        );

      const newPatients30Days = Number(newPatientsResult?.count || 0);

      // Patients by month (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const patientsByMonthRaw = await this.db
        .select({
          month: sql`DATE_TRUNC('month', ${organizationPatients.createdAt})`,
          count: sql`COUNT(*)`,
        })
        .from(organizationPatients)
        .where(
          and(
            eq(organizationPatients.orgId, orgId),
            eq(organizationPatients.isActive, true),
            gte(organizationPatients.createdAt, sixMonthsAgo),
          ),
        )
        .groupBy(sql`DATE_TRUNC('month', ${organizationPatients.createdAt})`)
        .orderBy(sql`DATE_TRUNC('month', ${organizationPatients.createdAt})`);

      const patientsByMonth = patientsByMonthRaw.map((row) => ({
        month: new Date(row.month as string).toISOString().substring(0, 7),
        count: Number(row.count),
      }));

      // Call metrics
      const [callMetricsRaw] = await this.db
        .select({
          totalCalls: sql`COUNT(*)`,
          reachedPatient: sql`SUM(CASE WHEN ${calls.status} = 'completed' AND ${calls.metadata}->>'patient_reached' = 'true' THEN 1 ELSE 0 END)`,
          leftVoicemail: sql`SUM(CASE WHEN ${calls.status} = 'completed' AND ${calls.metadata}->>'left_voicemail' = 'true' THEN 1 ELSE 0 END)`,
          unableToReach: sql`SUM(CASE WHEN ${calls.status} = 'completed' AND ${calls.metadata}->>'patient_reached' = 'false' AND ${calls.metadata}->>'left_voicemail' = 'false' THEN 1 ELSE 0 END)`,
        })
        .from(calls)
        .where(eq(calls.orgId, orgId));

      return {
        totalPatients,
        newPatients30Days,
        patientsByMonth,
        callMetrics: {
          totalCalls: Number(callMetricsRaw?.totalCalls || 0),
          reachedPatient: Number(callMetricsRaw?.reachedPatient || 0),
          leftVoicemail: Number(callMetricsRaw?.leftVoicemail || 0),
          unableToReach: Number(callMetricsRaw?.unableToReach || 0),
        },
      };
    } catch (error) {
      console.error("Error in getPatientStatsByOrg:", error);
      return {
        totalPatients: 0,
        newPatients30Days: 0,
        patientsByMonth: [],
        callMetrics: {
          totalCalls: 0,
          reachedPatient: 0,
          leftVoicemail: 0,
          unableToReach: 0,
        },
      };
    }
  }
}
