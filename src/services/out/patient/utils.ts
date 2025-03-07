// src/lib/patient/patient-service.ts - Improved patient deduplication
import {
  calls,
  campaigns,
  organizationPatients,
  patients,
} from "@/server/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { createHash } from "crypto";
import { and, asc, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";

type DatabaseClient = typeof import("@/server/db").db;

type PatientInput = {
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  secondaryPhone?: string;
  emrId?: string;
  orgId?: string;
  externalIds?: Record<string, string>;
  metadata?: Record<string, unknown>;
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

export function isMinor(dob: string): boolean {
  const dobDate = new Date(dob);
  const today = new Date();
  const age = today.getFullYear() - dobDate.getFullYear();
  return age < 18;
}
export class PatientService {
  private db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  /**
   * Generate an enhanced hash for patient identification and deduplication
   * Uses multiple patient attributes for more reliable matching
   */
  generatePatientHash(
    firstName: string,
    lastName: string,
    dob: string,
    phone: string,
  ): string {
    // Normalize all inputs to improve match rates
    const normalizedPhone = String(phone).replace(/\D/g, "").substring(0, 10);
    const normalizedDob = String(dob).replace(/\D/g, "");

    // Normalize name components (lowercase, trim whitespace)
    const normalizedFirstName = String(firstName).toLowerCase().trim();

    const normalizedLastName = String(lastName).toLowerCase().trim();

    // Log the normalized inputs for debugging
    console.log("Normalizing patient data for hash generation:");
    console.log(`- Phone: ${phone} → ${normalizedPhone}`);
    console.log(`- DOB: ${dob} → ${normalizedDob}`);
    console.log(`- First Name: ${firstName} → ${normalizedFirstName}`);
    console.log(`- Last Name: ${lastName} → ${normalizedLastName}`);

    // Create composite hash with all components
    const hash = createHash("sha256");
    const hashInput = `${normalizedPhone}-${normalizedDob}-${normalizedFirstName.substring(0, 3)}-${normalizedLastName}`;

    console.log(`Hash input: ${hashInput}`);
    hash.update(hashInput);

    const generatedHash = hash.digest("hex");
    console.log(`Generated hash: ${generatedHash}`);

    return generatedHash;
  }

  /**
   * Secondary hash for fuzzy matching when primary hash fails
   */
  generateSecondaryPatientHash(
    lastName: string,
    dob: string,
    phone: string,
  ): string {
    // Normalize inputs
    const normalizedPhone = String(phone).replace(/\D/g, "").slice(-4); // Last 4 digits
    const normalizedDob = String(dob).replace(/\D/g, "");
    const normalizedLastName = String(lastName).toLowerCase().trim();

    const hash = createHash("sha256");
    hash.update(`${normalizedLastName}-${normalizedDob}-${normalizedPhone}`);
    return hash.digest("hex");
  }

  /**
   * Find or create a patient with improved deduplication
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
      console.log(
        `Finding or creating patient: ${firstName} ${lastName}, DOB: ${dob}, Phone: ${phone}`,
      );

      // Generate a hash for deduplication
      const patientHash = this.generatePatientHash(
        firstName,
        lastName,
        dob,
        phone,
      );

      // Also generate a secondary hash using just lastName, DOB, and last 4 of phone
      const secondaryHash = this.generateSecondaryPatientHash(
        lastName,
        dob,
        phone,
      );

      console.log(`Primary hash: ${patientHash}`);
      console.log(`Secondary hash: ${secondaryHash}`);

      // Check if patient exists by primary hash
      let existingPatients = await this.db
        .select()
        .from(patients)
        .where(eq(patients.patientHash, patientHash));

      // If not found by primary hash, try secondary hash
      if (existingPatients.length === 0) {
        console.log(
          `Patient not found by primary hash, trying fallback methods`,
        );

        // Try by phone + last name
        const normalizedPhone = phone.replace(/\D/g, "");

        existingPatients = await this.db
          .select()
          .from(patients)
          .where(
            and(
              or(
                eq(
                  sql`REPLACE(${patients.primaryPhone}, '-', '')`,
                  normalizedPhone,
                ),
                eq(
                  sql`REPLACE(${patients.secondaryPhone}, '-', '')`,
                  normalizedPhone,
                ),
              ),
              ilike(patients.lastName, lastName.trim()),
            ),
          );

        console.log(
          `Found ${existingPatients.length} patients by phone + last name`,
        );
      }

      let patient;
      let isNewPatient = false;

      if (existingPatients.length > 0) {
        // Patient exists - use the first match
        patient = existingPatients[0];
        console.log(`Using existing patient: ${patient.id}`);

        // Update patient with new information
        const updates: Record<string, unknown> = {
          updatedAt: new Date(),
        };

        // Only update name if better data is available
        if (
          firstName &&
          lastName &&
          (patient.firstName !== firstName || patient.lastName !== lastName)
        ) {
          updates.firstName = firstName;
          updates.lastName = lastName;
          console.log(`Updating patient name to: ${firstName} ${lastName}`);
        }

        // Update phone if provided
        if (phone && phone !== patient.primaryPhone) {
          // If the current phone doesn't match, but it's valid, move it to secondary
          if (patient.primaryPhone && patient.primaryPhone.length >= 10) {
            updates.secondaryPhone = patient.primaryPhone;
          }
          updates.primaryPhone = phone;
          console.log(`Updating patient phone to: ${phone}`);
        }

        if (secondaryPhone && !patient.secondaryPhone) {
          updates.secondaryPhone = secondaryPhone;
          console.log(`Adding secondary phone: ${secondaryPhone}`);
        }

        // Handle external IDs and metadata
        if (externalIds && Object.keys(externalIds).length > 0) {
          updates.externalIds = {
            ...(patient?.externalIds || {}),
            ...externalIds,
          };
          console.log(`Updating external IDs`);
        }

        if (metadata && Object.keys(metadata).length > 0) {
          updates.metadata = {
            ...(patient?.metadata || {}),
            ...metadata,
          };
          console.log(`Updating metadata`);
        }

        // Only update if we have changes to make
        if (Object.keys(updates).length > 1) {
          console.log(`Updating patient ${patient.id} with:`, updates);

          await this.db
            .update(patients)
            .set(updates)
            .where(eq(patients.id, patient.id));

          // Refresh patient data
          [patient] = await this.db
            .select()
            .from(patients)
            .where(eq(patients.id, patient.id));
        }
      } else {
        // Create new patient
        console.log(`Creating new patient`);

        // Check if the DOB is valid
        const dobDate = new Date(dob);
        const validDate = !isNaN(dobDate.getTime());

        if (!validDate) {
          console.error(`Invalid date format for DOB: ${dob}`);
          throw new Error(`Invalid date format for DOB: ${dob}`);
        }

        const isMinor =
          dobDate > new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000);

        const [newPatient] = await this.db
          .insert(patients)
          .values({
            patientHash,
            firstName,
            lastName,
            dob: dobDate.toISOString(),
            isMinor,
            primaryPhone: phone,
            secondaryPhone: secondaryPhone,
            externalIds: externalIds || {},
            metadata: metadata || {},
          } as typeof patients.$inferInsert)
          .returning();

        patient = newPatient;
        isNewPatient = true;
        console.log(`Created new patient with ID: ${patient.id}`);
      }

      // If orgId is provided, link patient to organization
      if (orgId && patient) {
        console.log(
          `Checking organization link for patient ${patient.id} to org ${orgId}`,
        );

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
          console.log(`Creating org-patient link`);

          await this.db.insert(organizationPatients).values({
            orgId,
            patientId: patient.id,
            emrIdInOrg: emrId,
            isActive: true,
          } as typeof organizationPatients.$inferInsert);
        } else if (emrId || externalIds) {
          // Update organization patient link with new data
          console.log(`Updating existing org-patient link`);

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
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        dob: patient.dob.toString(),
        primaryPhone: patient.primaryPhone,
        patientHash: patient.patientHash,
        isNewPatient,
        externalIds: patient?.externalIds as Record<string, string>,
        metadata: patient?.metadata as Record<string, unknown>,
      };
    } catch (error) {
      console.error("Error in findOrCreatePatient:", error);
      throw error; // Re-throw to propagate the error for better diagnosis
    }
  }

  /**
   * Find a patient by phone number with improved matching
   */
  async findPatientByPhone(
    phone: string,
    orgId?: string,
  ): Promise<typeof patients.$inferSelect | null> {
    try {
      // Clean phone input
      // const cleanPhone = phone.replace(/\D/g, "");
      const cleanPhone = phone;

      console.log(
        `Finding patient by phone: ${phone} (cleaned: ${cleanPhone})`,
      );

      if (cleanPhone.length < 10) {
        console.warn(
          `Phone number too short (${cleanPhone.length} digits): ${phone}`,
        );
      }

      // Try multiple formats for more reliable matching
      const phoneConditions = [];

      // Match against raw digits
      phoneConditions.push(
        sql`REPLACE(${patients.primaryPhone}, '-', '') = ${cleanPhone}`,
      );
      phoneConditions.push(
        sql`REPLACE(${patients.secondaryPhone}, '-', '') = ${cleanPhone}`,
      );

      // Match with "+1" prefix if not present
      if (!cleanPhone.startsWith("1") && cleanPhone.length === 10) {
        phoneConditions.push(
          sql`REPLACE(${patients.primaryPhone}, '-', '') = ${"1" + cleanPhone}`,
        );
        phoneConditions.push(
          sql`REPLACE(${patients.secondaryPhone}, '-', '') = ${"1" + cleanPhone}`,
        );
      }

      // If phone has country code, also try without it
      if (cleanPhone.startsWith("1") && cleanPhone.length === 11) {
        const withoutCountryCode = cleanPhone.substring(1);
        phoneConditions.push(
          sql`REPLACE(${patients.primaryPhone}, '-', '') = ${withoutCountryCode}`,
        );
        phoneConditions.push(
          sql`REPLACE(${patients.secondaryPhone}, '-', '') = ${withoutCountryCode}`,
        );
      }

      // Find patients with matching any phone format
      const matchingPatients = await this.db
        .select()
        .from(patients)
        .where(or(...phoneConditions))
        .limit(5); // Limit to prevent huge result sets

      console.log(
        `Found ${matchingPatients.length} patients matching the phone number`,
      );

      if (matchingPatients.length === 0) {
        return null;
      }

      // If we have an orgId, prioritize patients linked to that org
      if (orgId && matchingPatients.length > 0) {
        console.log(`Checking for patients linked to org ${orgId}`);

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
            console.log(`Found patient ${patient.id} linked to org ${orgId}`);
            return patient;
          }
        }

        console.log(`No patients linked to org ${orgId}`);
      }

      // Default to first match if no organization-specific match is found
      console.log(
        `Returning first matching patient: ${matchingPatients[0]?.id}`,
      );
      return matchingPatients[0] || null;
    } catch (error) {
      console.error("Error in findPatientByPhone:", error);
      return null;
    }
  }

  /**
   * Search patients by multiple criteria with improved matching
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
    sortBy?: "name" | "dob" | "created" | "updated";
    sortOrder?: "asc" | "desc";
    minCallCount?: number;
    maxCallCount?: number;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<{
    patients: any[];
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
        sortBy = "updated",
        sortOrder = "desc",
        minCallCount,
        maxCallCount,
        fromDate,
        toDate,
      } = params;

      console.log(
        `Searching patients with query: ${query || "none"}, phone: ${phone || "none"}, orgId: ${orgId || "none"}`,
      );

      // Build SQL query conditionally based on parameters
      let patientsQuery;

      // If we need organization context
      if (orgId) {
        // Start building a query for patients with organization links
        patientsQuery = this.db
          .select({
            patient: patients,
            orgPatient: organizationPatients,
          })
          .from(patients)
          .innerJoin(
            organizationPatients,
            and(
              eq(patients.id, organizationPatients.patientId),
              eq(organizationPatients.orgId, orgId),
              includeInactive
                ? undefined
                : eq(organizationPatients.isActive, true),
            ),
          );

        // Add EMR ID filter if specified
        if (emrId) {
          patientsQuery = patientsQuery.where(
            ilike(organizationPatients.emrIdInOrg, `%${emrId}%`),
          );
        }
      } else {
        // Simple query without organization context
        patientsQuery = this.db
          .select({
            patient: patients,
          })
          .from(patients);
      }

      // Add search conditions
      const conditions = [];

      // Global text search
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

      // Phone search with normalization
      if (phone) {
        const cleanPhone = phone.replace(/\D/g, "");
        conditions.push(
          or(
            sql`REPLACE(${patients.primaryPhone}, '-', '') LIKE ${`%${cleanPhone}%`}`,
            sql`REPLACE(${patients.secondaryPhone}, '-', '') LIKE ${`%${cleanPhone}%`}`,
          ),
        );
      }

      // Name searches
      if (firstName) {
        conditions.push(ilike(patients.firstName, `%${firstName}%`));
      }

      if (lastName) {
        conditions.push(ilike(patients.lastName, `%${lastName}%`));
      }

      // Date range filters
      if (fromDate) {
        conditions.push(gte(patients.createdAt, fromDate));
      }

      if (toDate) {
        conditions.push(lte(patients.createdAt, toDate));
      }

      // Apply all conditions to the query
      if (conditions.length > 0) {
        patientsQuery = patientsQuery.where(and(...conditions));
      }

      // Apply sorting
      switch (sortBy) {
        case "name":
          if (sortOrder === "asc") {
            patientsQuery = patientsQuery.orderBy(
              asc(patients.lastName),
              asc(patients.firstName),
            );
          } else {
            patientsQuery = patientsQuery.orderBy(
              desc(patients.lastName),
              desc(patients.firstName),
            );
          }
          break;

        case "dob":
          patientsQuery = patientsQuery.orderBy(
            sortOrder === "asc" ? asc(patients.dob) : desc(patients.dob),
          );
          break;

        case "created":
          patientsQuery = patientsQuery.orderBy(
            sortOrder === "asc"
              ? asc(patients.createdAt)
              : desc(patients.createdAt),
          );
          break;

        case "updated":
        default:
          patientsQuery = patientsQuery.orderBy(
            sortOrder === "asc"
              ? asc(patients.updatedAt)
              : desc(patients.updatedAt),
          );
          break;
      }

      // Apply pagination
      patientsQuery = patientsQuery.limit(limit).offset(offset);

      // Execute the query to get patients
      const patientResults = await patientsQuery;

      // Format the results in a consistent structure
      const formattedPatients = patientResults.map((row) => {
        const patientData = row.patient;

        // Add organization data if available
        if (row.orgPatient) {
          return {
            ...patientData,
            emrIdInOrg: row.orgPatient.emrIdInOrg,
            isActive: row.orgPatient.isActive,
          };
        }

        return patientData;
      });

      // Get the total count with a separate query
      let totalCountQuery;

      if (orgId) {
        totalCountQuery = this.db
          .select({ count: sql`COUNT(DISTINCT ${patients.id})` })
          .from(patients)
          .innerJoin(
            organizationPatients,
            and(
              eq(patients.id, organizationPatients.patientId),
              eq(organizationPatients.orgId, orgId),
              includeInactive
                ? undefined
                : eq(organizationPatients.isActive, true),
            ),
          );
      } else {
        totalCountQuery = this.db
          .select({ count: sql`COUNT(*)` })
          .from(patients);
      }

      // Apply the same conditions to the count query
      if (conditions.length > 0) {
        totalCountQuery = totalCountQuery.where(and(...conditions));
      }

      const [countResult] = await totalCountQuery;
      const total = Number(countResult?.count || 0);

      // If we need to add call data, do it as a separate query
      if (withRecentCalls && formattedPatients.length > 0) {
        // Get patient IDs for the query
        const patientIds = formattedPatients.map((p) => p.id);

        // Query to get call counts
        const callCountsQuery = await this.db
          .select({
            patientId: calls.patientId,
            callCount: sql`COUNT(*)`,
            lastCallDate: sql`MAX(${calls.createdAt})`,
          })
          .from(calls)
          .where(
            and(
              sql`${calls.patientId} IN (${patientIds.join(",")})`,
              orgId ? eq(calls.orgId, orgId) : undefined,
            ),
          )
          .groupBy(calls.patientId);

        // Create a map for easy lookup
        const callDataByPatient = new Map();
        callCountsQuery.forEach((row) => {
          callDataByPatient.set(row.patientId, {
            callCount: Number(row.callCount || 0),
            lastCallDate: row.lastCallDate,
          });
        });

        // Apply call count filters if needed
        let filteredPatients = formattedPatients;

        if (minCallCount !== undefined || maxCallCount !== undefined) {
          filteredPatients = formattedPatients.filter((patient) => {
            const callData = callDataByPatient.get(patient.id) || {
              callCount: 0,
            };

            if (
              minCallCount !== undefined &&
              callData.callCount < minCallCount
            ) {
              return false;
            }

            if (
              maxCallCount !== undefined &&
              callData.callCount > maxCallCount
            ) {
              return false;
            }

            return true;
          });
        }

        // Add call data to patient records
        filteredPatients.forEach((patient) => {
          const callData = callDataByPatient.get(patient.id) || {
            callCount: 0,
            lastCallDate: null,
          };
          patient.callCount = callData.callCount;
          patient.lastCallDate = callData.lastCallDate;
        });

        // If we filtered based on call counts, adjust the total
        if (minCallCount !== undefined || maxCallCount !== undefined) {
          return {
            patients: filteredPatients,
            total: filteredPatients.length, // Simplified count for filtered results
          };
        }

        // Get recent calls for each patient
        if (withRecentCalls) {
          const recentCallsQuery = await this.db
            .select()
            .from(calls)
            .where(
              and(
                sql`${calls.patientId} IN (${patientIds.join(",")})`,
                orgId ? eq(calls.orgId, orgId) : undefined,
              ),
            )
            .orderBy(desc(calls.createdAt))
            .limit(patientIds.length * 3); // Up to 3 calls per patient

          // Group calls by patient
          const callsByPatient = {};
          recentCallsQuery.forEach((call) => {
            if (!call.patientId) return;

            if (!callsByPatient[call.patientId]) {
              callsByPatient[call.patientId] = [];
            }

            callsByPatient[call.patientId].push({
              ...call,
              patientReached:
                call.analysis?.patient_reached === true ||
                call.analysis?.patientReached === true,
              voicemailLeft:
                call.analysis?.voicemail_left === true ||
                call.analysis?.left_voicemail === true,
            });
          });

          // Add recent calls to patients
          filteredPatients.forEach((patient) => {
            patient.recentCalls = callsByPatient[patient.id] || [];
          });
        }

        return {
          patients: filteredPatients,
          total,
        };
      }

      // Return the results without call data
      return {
        patients: formattedPatients,
        total,
      };
    } catch (error) {
      console.error("Error in searchPatients:", error);
      return { patients: [], total: 0 };
    }
  }

  /**
   * Find a patient by ID with detailed information
   * @param id Patient ID
   * @param orgId Optional organization ID to check membership
   * @returns Patient details with organization context and statistics
   */
  async findPatientById(
    id: string,
    orgId?: string,
  ): Promise<{
    patient: typeof patients.$inferSelect | null;
    orgData?: typeof organizationPatients.$inferSelect | null;
    callStats?: {
      total: number;
      connected: number;
      voicemail: number;
      failed: number;
      lastCall?: typeof calls.$inferSelect | null;
    };
    isActive: boolean;
  }> {
    try {
      console.log(
        `Finding patient by ID: ${id}${orgId ? `, org: ${orgId}` : ""}`,
      );

      // Get basic patient data first
      const [patient] = await this.db
        .select()
        .from(patients)
        .where(eq(patients.id, id));

      if (!patient) {
        console.log(`Patient ${id} not found`);
        return {
          patient: null,
          isActive: false,
        };
      }

      // Prepare result object
      const result = {
        patient,
        isActive: true,
        orgData: null as typeof organizationPatients.$inferSelect | null,
        callStats: undefined as
          | undefined
          | {
              total: number;
              connected: number;
              voicemail: number;
              failed: number;
              lastCall?: typeof calls.$inferSelect | null;
            },
      };

      // Check organization membership if orgId is provided
      if (orgId) {
        const [orgMembership] = await this.db
          .select()
          .from(organizationPatients)
          .where(
            and(
              eq(organizationPatients.patientId, id),
              eq(organizationPatients.orgId, orgId),
            ),
          );

        result.orgData = orgMembership || null;
        result.isActive = orgMembership?.isActive || false;

        // Only continue if patient is active in this organization
        if (!result.isActive && !orgMembership) {
          console.log(`Patient ${id} not active or not found in org ${orgId}`);
          return result;
        }
      }

      // Get call statistics with improved analysis
      try {
        // Get call counts by status
        const [callCounts] = await this.db
          .select({
            total: sql`COUNT(*)`,
            connected: sql`SUM(CASE WHEN (${calls.analysis}->>'patient_reached')::text = 'true' OR 
                                      (${calls.analysis}->>'patientReached')::text = 'true' THEN 1 ELSE 0 END)`,
            voicemail: sql`SUM(CASE WHEN (${calls.analysis}->>'voicemail_left')::text = 'true' OR 
                                      (${calls.analysis}->>'left_voicemail')::text = 'true' OR
                                      (${calls.analysis}->>'voicemail')::text = 'true' THEN 1 ELSE 0 END)`,
            failed: sql`SUM(CASE WHEN ${calls.status} = 'failed' THEN 1 ELSE 0 END)`,
          })
          .from(calls)
          .where(
            and(
              eq(calls.patientId, id),
              orgId ? eq(calls.orgId, orgId) : sql`TRUE`,
            ),
          );

        // Get most recent call
        const [lastCall] = await this.db
          .select()
          .from(calls)
          .where(
            and(
              eq(calls.patientId, id),
              orgId ? eq(calls.orgId, orgId) : sql`TRUE`,
            ),
          )
          .orderBy(desc(calls.createdAt))
          .limit(1);

        result.callStats = {
          total: Number(callCounts?.total || 0),
          connected: Number(callCounts?.connected || 0),
          voicemail: Number(callCounts?.voicemail || 0),
          failed: Number(callCounts?.failed || 0),
          lastCall: lastCall || null,
        };
      } catch (error) {
        console.error("Error fetching call statistics:", error);
        // Continue without call stats if there's an error
      }

      return result;
    } catch (error) {
      console.error("Error in findPatientById:", error);
      throw error; // Re-throw to allow higher-level error handling
    }
  }

  /**
   * Find patients by name with improved fuzzy matching
   * @param firstName First name (can be partial)
   * @param lastName Last name (can be partial)
   * @param orgId Optional organization ID to filter by
   * @param limit Maximum number of results to return
   * @returns Array of matching patients
   */
  async findPatientsByName(
    firstName: string,
    lastName: string,
    orgId?: string,
    limit: number = 20,
  ): Promise<(typeof patients.$inferSelect)[]> {
    try {
      console.log(
        `Finding patients by name: ${firstName} ${lastName}${orgId ? `, org: ${orgId}` : ""}`,
      );

      // Normalize inputs
      const normalizedFirstName = firstName.toLowerCase().trim();
      const normalizedLastName = lastName.toLowerCase().trim();

      // Build query conditions with progressively less strict matching
      const conditions = [];

      // First priority: Exact match on both names
      if (normalizedFirstName && normalizedLastName) {
        conditions.push(
          sql`LOWER(${patients.firstName}) = ${normalizedFirstName} AND LOWER(${patients.lastName}) = ${normalizedLastName}`,
        );
      }

      // Second priority: Starts with both names
      if (normalizedFirstName && normalizedLastName) {
        conditions.push(
          sql`LOWER(${patients.firstName}) LIKE ${`${normalizedFirstName}%`} AND LOWER(${patients.lastName}) LIKE ${`${normalizedLastName}%`}`,
        );
      }

      // Third priority: Contains both names
      if (normalizedFirstName && normalizedLastName) {
        conditions.push(
          sql`LOWER(${patients.firstName}) LIKE ${`%${normalizedFirstName}%`} AND LOWER(${patients.lastName}) LIKE ${`%${normalizedLastName}%`}`,
        );
      }

      // Fourth priority: Exact match on last name, contains first name
      if (normalizedFirstName && normalizedLastName) {
        conditions.push(
          sql`LOWER(${patients.firstName}) LIKE ${`%${normalizedFirstName}%`} AND LOWER(${patients.lastName}) = ${normalizedLastName}`,
        );
      }

      // Fifth priority: Contains one name, if only one name is provided
      if (normalizedFirstName && !normalizedLastName) {
        conditions.push(
          sql`LOWER(${patients.firstName}) LIKE ${`%${normalizedFirstName}%`}`,
        );
      }

      if (!normalizedFirstName && normalizedLastName) {
        conditions.push(
          sql`LOWER(${patients.lastName}) LIKE ${`%${normalizedLastName}%`}`,
        );
      }

      // Fallback to soundex matching if standard matching doesn't yield results
      if (normalizedFirstName && normalizedLastName) {
        conditions.push(
          and(
            sql`SOUNDEX(${patients.firstName}) = SOUNDEX(${normalizedFirstName})`,
            sql`SOUNDEX(${patients.lastName}) = SOUNDEX(${normalizedLastName})`,
          ),
        );
      }

      // Combine all conditions with OR to implement priority order
      const finalCondition = or(...conditions);

      // Build base query
      let query = this.db
        .select({
          patient: patients,
          priority: sql`CASE 
          WHEN LOWER(${patients.firstName}) = ${normalizedFirstName} AND LOWER(${patients.lastName}) = ${normalizedLastName} THEN 1
          WHEN LOWER(${patients.firstName}) LIKE ${`${normalizedFirstName}%`} AND LOWER(${patients.lastName}) LIKE ${`${normalizedLastName}%`} THEN 2
          WHEN LOWER(${patients.firstName}) LIKE ${`%${normalizedFirstName}%`} AND LOWER(${patients.lastName}) LIKE ${`%${normalizedLastName}%`} THEN 3
          WHEN LOWER(${patients.firstName}) LIKE ${`%${normalizedFirstName}%`} AND LOWER(${patients.lastName}) = ${normalizedLastName} THEN 4
          WHEN LOWER(${patients.firstName}) LIKE ${`%${normalizedFirstName}%`} OR LOWER(${patients.lastName}) LIKE ${`%${normalizedLastName}%`} THEN 5
          ELSE 6
        END`,
        })
        .from(patients)
        .where(finalCondition);

      // Add organization filtering if needed
      if (orgId) {
        query = query.innerJoin(
          organizationPatients,
          and(
            eq(organizationPatients.patientId, patients.id),
            eq(organizationPatients.orgId, orgId),
            eq(organizationPatients.isActive, true),
          ),
        );
      }

      // Execute query with priority ordering and limit
      const results = await query
        .orderBy(
          asc(sql`priority`),
          asc(patients.lastName),
          asc(patients.firstName),
        )
        .limit(limit);

      // Extract and return just the patient data
      return results.map((r) => r.patient);
    } catch (error) {
      console.error("Error in findPatientsByName:", error);
      return [];
    }
  }

  /**
   * Bulk insert patients with organization links
   * Used for efficient processing of batched patient data
   * @param patientData Array of patient data objects
   * @param orgId Organization ID for linking
   * @returns Array of created/updated patient IDs
   */
  async bulkInsertPatients(
    patientData: {
      firstName: string;
      lastName: string;
      dob: string;
      phone: string;
      secondaryPhone?: string;
      patientHash?: string;
      emrId?: string;
      externalIds?: Record<string, string>;
      metadata?: Record<string, unknown>;
    }[],
    orgId: string,
  ): Promise<{
    patientIds: string[];
    newCount: number;
    updatedCount: number;
    errors: string[];
  }> {
    const result = {
      patientIds: [] as string[],
      newCount: 0,
      updatedCount: 0,
      errors: [] as string[],
    };

    if (!patientData.length) {
      return result;
    }

    try {
      console.log(
        `Bulk inserting ${patientData.length} patients for org ${orgId}`,
      );

      // Generate hashes for all patients
      const patientsWithHashes = patientData.map((patient) => {
        const hash =
          patient.patientHash ||
          this.generatePatientHash(
            patient.firstName,
            patient.lastName,
            patient.dob,
            patient.phone,
          );

        return {
          ...patient,
          patientHash: hash,
        };
      });

      // Get all patient hashes to check for existing patients
      const patientHashes = patientsWithHashes.map((p) => p.patientHash);

      // Fetch existing patients by hashes in one query
      const existingPatients = await this.db
        .select()
        .from(patients)
        .where(sql`${patients.patientHash} IN (${patientHashes.join(",")})`);

      // Create maps for quick lookups
      const existingPatientsByHash = new Map(
        existingPatients.map((p) => [p.patientHash, p]),
      );

      // Separate patients into new and existing
      const newPatients = [];
      const patientsToUpdate = [];

      for (const patientWithHash of patientsWithHashes) {
        const existingPatient = existingPatientsByHash.get(
          patientWithHash.patientHash,
        );

        if (existingPatient) {
          // Patient exists - add for update
          patientsToUpdate.push({
            existingPatient,
            newData: patientWithHash,
          });
        } else {
          // New patient - add for creation
          newPatients.push(patientWithHash);
        }
      }

      console.log(
        `Found ${patientsToUpdate.length} existing patients and ${newPatients.length} new patients`,
      );

      // Process new patients in batches for better performance
      if (newPatients.length > 0) {
        // Prepare data for bulk insert
        const newPatientsFormatted = newPatients.map((p) => {
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
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        });

        // Insert in batches of 100 to avoid potential DB limits
        const batchSize = 100;
        for (let i = 0; i < newPatientsFormatted.length; i += batchSize) {
          const batch = newPatientsFormatted.slice(i, i + batchSize);

          try {
            const insertedPatients = await this.db
              .insert(patients)
              .values(batch)
              .returning();

            result.patientIds.push(...insertedPatients.map((p) => p.id));
            result.newCount += insertedPatients.length;
          } catch (error) {
            console.error(
              `Error inserting batch of patients (${i}-${i + batch.length}):`,
              error,
            );
            result.errors.push(
              `Failed to insert batch ${i}-${i + batch.length}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }

      // Update existing patients when needed
      for (const { existingPatient, newData } of patientsToUpdate) {
        try {
          // Only update fields that have meaningful changes
          const updates: Record<string, unknown> = {
            updatedAt: new Date(),
          };

          // Update name if provided and different
          if (
            newData.firstName &&
            existingPatient.firstName !== newData.firstName
          ) {
            updates.firstName = newData.firstName;
          }

          if (
            newData.lastName &&
            existingPatient.lastName !== newData.lastName
          ) {
            updates.lastName = newData.lastName;
          }

          // Update phones if provided and different
          if (newData.phone && existingPatient.primaryPhone !== newData.phone) {
            // If current primary is different, maybe move it to secondary
            if (existingPatient.primaryPhone) {
              updates.secondaryPhone = existingPatient.primaryPhone;
            }
            updates.primaryPhone = newData.phone;
          }

          if (
            newData.secondaryPhone &&
            existingPatient.secondaryPhone !== newData.secondaryPhone
          ) {
            updates.secondaryPhone = newData.secondaryPhone;
          }

          // Merge external IDs and metadata
          if (
            newData.externalIds &&
            Object.keys(newData.externalIds).length > 0
          ) {
            updates.externalIds = {
              ...(existingPatient?.externalIds || {}),
              ...newData.externalIds,
            };
          }

          if (newData.metadata && Object.keys(newData.metadata).length > 0) {
            updates.metadata = {
              ...(existingPatient?.metadata || {}),
              ...newData.metadata,
            };
          }

          // Only update if we have changes to make
          if (Object.keys(updates).length > 1) {
            await this.db
              .update(patients)
              .set(updates)
              .where(eq(patients.id, existingPatient.id));

            result.updatedCount++;
          }

          // Always include the patient ID in the result
          result.patientIds.push(existingPatient.id);
        } catch (error) {
          console.error(`Error updating patient ${existingPatient.id}:`, error);
          result.errors.push(
            `Failed to update patient ${existingPatient.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      // Create organization links for all patients
      if (result.patientIds.length > 0) {
        try {
          // Get existing links to avoid duplicates
          const existingLinks = await this.db
            .select()
            .from(organizationPatients)
            .where(
              and(
                eq(organizationPatients.orgId, orgId),
                sql`${organizationPatients.patientId} IN (${result.patientIds.map((id) => `'${id}'`).join(",")})`,
              ),
            );

          const existingLinkPatientIds = new Set(
            existingLinks.map((link) => link.patientId),
          );

          // Create new links for patients not already linked
          const newLinks = result.patientIds
            .filter((id) => !existingLinkPatientIds.has(id))
            .map((patientId) => {
              // Find the original patient data to get EMR ID if available
              const originalData = patientData.find(
                (p) =>
                  existingPatientsByHash.get(p.patientHash)?.id === patientId,
              );

              return {
                orgId,
                patientId,
                emrIdInOrg: originalData?.emrId || null,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
            });

          if (newLinks.length > 0) {
            // Insert organization links in batches
            const linkBatchSize = 100;
            for (let i = 0; i < newLinks.length; i += linkBatchSize) {
              const batch = newLinks.slice(i, i + linkBatchSize);
              await this.db.insert(organizationPatients).values(batch);
            }

            console.log(`Created ${newLinks.length} new organization links`);
          }

          // Update existing links to ensure they're active and have EMR IDs
          for (const link of existingLinks) {
            // Find the original patient data to get EMR ID if available
            const originalData = patientData.find(
              (p) =>
                existingPatientsByHash.get(p.patientHash)?.id ===
                link.patientId,
            );

            if (originalData?.emrId && originalData.emrId !== link.emrIdInOrg) {
              await this.db
                .update(organizationPatients)
                .set({
                  emrIdInOrg: originalData.emrId,
                  isActive: true,
                  updatedAt: new Date(),
                } as any)
                .where(
                  and(
                    eq(organizationPatients.patientId, link.patientId),
                    eq(organizationPatients.orgId, orgId),
                  ),
                );
            } else if (!link.isActive) {
              // Reactivate the link if it was inactive
              await this.db
                .update(organizationPatients)
                .set({
                  isActive: true,
                  updatedAt: new Date(),
                } as any)
                .where(
                  and(
                    eq(organizationPatients.patientId, link.patientId),
                    eq(organizationPatients.orgId, orgId),
                  ),
                );
            }
          }
        } catch (error) {
          console.error("Error creating organization links:", error);
          result.errors.push(
            `Failed to create organization links: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      console.log(
        `Bulk insert complete. New: ${result.newCount}, Updated: ${result.updatedCount}, Total: ${result.patientIds.length}`,
      );
      return result;
    } catch (error) {
      console.error("Error in bulkInsertPatients:", error);
      result.errors.push(
        `Global error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return result;
    }
  }

  /**
   * Get detailed call history for a patient with filtering options
   * @param params Parameters for filtering and pagination
   * @returns Paginated call history with statistics
   */
  async getPatientCallHistory(params: {
    patientId: string;
    orgId?: string;
    limit?: number;
    offset?: number;
    direction?: "inbound" | "outbound" | "all";
    startDate?: Date;
    endDate?: Date;
    status?: string;
    campaignId?: string;
    includeTranscripts?: boolean;
    includeAnalysis?: boolean;
  }): Promise<{
    calls: (typeof calls.$inferSelect & {
      campaignName?: string;
      agentName?: string;
      insights?: Record<string, any>;
    })[];
    total: number;
    stats: {
      outbound: number;
      inbound: number;
      completed: number;
      failed: number;
      voicemail: number;
      connected: number;
      totalDuration: number;
      avgDuration: number;
    };
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
        status,
        campaignId,
        includeTranscripts = false,
        includeAnalysis = true,
      } = params;

      console.log(
        `Getting call history for patient ${patientId} with filters:`,
        {
          orgId,
          direction,
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
          status,
          campaignId,
          limit,
          offset,
        },
      );

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

      // Status filter
      if (status) {
        conditions.push(
          eq(
            calls.status,
            status as
              | "completed"
              | "failed"
              | "pending"
              | "in-progress"
              | "voicemail"
              | "no-answer",
          ),
        );
      }

      // Campaign filter
      if (campaignId) {
        conditions.push(eq(calls.campaignId, campaignId));
      }

      // Get total count and summary statistics in one query
      const [stats] = await this.db
        .select({
          total: sql`COUNT(*)`,
          outbound: sql`SUM(CASE WHEN ${calls.direction} = 'outbound' THEN 1 ELSE 0 END)`,
          inbound: sql`SUM(CASE WHEN ${calls.direction} = 'inbound' THEN 1 ELSE 0 END)`,
          completed: sql`SUM(CASE WHEN ${calls.status} = 'completed' THEN 1 ELSE 0 END)`,
          failed: sql`SUM(CASE WHEN ${calls.status} = 'failed' THEN 1 ELSE 0 END)`,
          voicemail: sql`SUM(CASE WHEN ${calls.status} = 'voicemail' OR 
                                (${calls.analysis}->>'voicemail_left')::text = 'true' OR 
                                (${calls.analysis}->>'left_voicemail')::text = 'true' THEN 1 ELSE 0 END)`,
          connected: sql`SUM(CASE WHEN (${calls.analysis}->>'patient_reached')::text = 'true' OR 
                                  (${calls.analysis}->>'patientReached')::text = 'true' THEN 1 ELSE 0 END)`,
          totalDuration: sql`SUM(${calls.duration})`,
          avgDuration: sql`AVG(${calls.duration})`,
        })
        .from(calls)
        .where(and(...conditions));

      const total = Number(stats?.total || 0);

      // Select only needed fields to reduce payload size
      const selectFields = {
        // Basic call data
        id: calls.id,
        createdAt: calls.createdAt,
        updatedAt: calls.updatedAt,
        direction: calls.direction,
        status: calls.status,
        duration: calls.duration,
        retellCallId: calls.retellCallId,
        campaignId: calls.campaignId,
        recordingUrl: calls.recordingUrl,
        fromNumber: calls.fromNumber,
        toNumber: calls.toNumber,
        agentId: calls.agentId,

        // Optional fields
        ...(includeTranscripts ? { transcript: calls.transcript } : {}),
        ...(includeAnalysis ? { analysis: calls.analysis } : {}),
      };

      // Get paginated results with join to get campaign name
      const callHistory = await this.db
        .select({
          ...selectFields,
          campaignName: campaigns.name,
        })
        .from(calls)
        .leftJoin(campaigns, eq(calls.campaignId, campaigns.id))
        .where(and(...conditions))
        .orderBy(desc(calls.createdAt))
        .limit(limit)
        .offset(offset);

      // Process calls to add computed properties and extract insights
      const processedCalls = callHistory.map((call) => {
        // Extract key insights from the analysis data
        const insights = call.analysis
          ? {
              patientReached:
                call.analysis.patient_reached === true ||
                call.analysis.patientReached === true ||
                call.analysis.patient_reached === "true" ||
                call.analysis.patientReached === "true",

              voicemailLeft:
                call.analysis.voicemail_left === true ||
                call.analysis.left_voicemail === true ||
                call.analysis.voicemail_detected === true ||
                call.analysis.voicemail === true,

              sentiment:
                call.analysis.sentiment ||
                call.analysis.user_sentiment ||
                "neutral",

              followUpNeeded:
                call.analysis.needs_followup === true ||
                call.analysis.schedule_followup === true ||
                call.analysis.followup_needed === true,
            }
          : {};

        return {
          ...call,
          insights,
        };
      });

      return {
        calls: processedCalls as (typeof calls.$inferSelect & {
          campaignName?: string;
          agentName?: string;
          insights?: Record<string, any>;
        })[],
        total,
        stats: {
          outbound: Number(stats?.outbound || 0),
          inbound: Number(stats?.inbound || 0),
          completed: Number(stats?.completed || 0),
          failed: Number(stats?.failed || 0),
          voicemail: Number(stats?.voicemail || 0),
          connected: Number(stats?.connected || 0),
          totalDuration: Number(stats?.totalDuration || 0),
          avgDuration: Number(stats?.avgDuration || 0),
        },
      };
    } catch (error) {
      console.error("Error in getPatientCallHistory:", error);
      return {
        calls: [],
        total: 0,
        stats: {
          outbound: 0,
          inbound: 0,
          completed: 0,
          failed: 0,
          voicemail: 0,
          connected: 0,
          totalDuration: 0,
          avgDuration: 0,
        },
      };
    }
  }

  /**
   * Get comprehensive patient statistics by organization
   * Useful for dashboards and analytics
   * @param orgId Organization ID
   * @param timeframe Optional timeframe for filtering (e.g., '7d', '30d', '90d', 'all')
   * @returns Detailed patient statistics
   */
  async getPatientStatsByOrg(
    orgId: string,
    timeframe: "7d" | "30d" | "90d" | "all" = "30d",
  ): Promise<{
    totalPatients: number;
    newPatients: number;
    patientsByMonth: { month: string; count: number }[];
    ageDistribution: { range: string; count: number }[];
    callMetrics: {
      totalCalls: number;
      reachedPatient: number;
      leftVoicemail: number;
      unableToReach: number;
      averageDuration: number;
      callsPerPatient: number;
      conversionRate: number;
    };
    patientActivity: {
      activePatients: number; // Patients with at least one call
      inactivePatients: number;
      mostContactedPatients: {
        id: string;
        name: string;
        callCount: number;
      }[];
    };
    trends: {
      dailyCalls: { date: string; inbound: number; outbound: number }[];
      callOutcomes: {
        date: string;
        connected: number;
        voicemail: number;
        failed: number;
      }[];
    };
  }> {
    try {
      console.log(
        `Getting patient statistics for org ${orgId} with timeframe ${timeframe}`,
      );

      // Calculate date range based on timeframe
      const now = new Date();
      let startDate: Date | null = null;

      switch (timeframe) {
        case "7d":
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "30d":
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 30);
          break;
        case "90d":
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 90);
          break;
        case "all":
        default:
          startDate = null;
      }

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

      // New patients in the selected timeframe
      const newPatientsConditions = [
        eq(organizationPatients.orgId, orgId),
        eq(organizationPatients.isActive, true),
      ];

      if (startDate) {
        newPatientsConditions.push(
          gte(organizationPatients.createdAt, startDate),
        );
      }

      const [newPatientsResult] = await this.db
        .select({ count: sql`COUNT(*)` })
        .from(organizationPatients)
        .where(and(...newPatientsConditions));

      const newPatients = Number(newPatientsResult?.count || 0);

      // Patients by month (up to 12 months)
      const twelvemonthsAgo = new Date();
      twelvemonthsAgo.setMonth(twelvemonthsAgo.getMonth() - 12);

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
            gte(organizationPatients.createdAt, twelvemonthsAgo),
          ),
        )
        .groupBy(sql`DATE_TRUNC('month', ${organizationPatients.createdAt})`)
        .orderBy(sql`DATE_TRUNC('month', ${organizationPatients.createdAt})`);

      const patientsByMonth = patientsByMonthRaw.map((row) => ({
        month: new Date(row.month as string).toISOString().substring(0, 7),
        count: Number(row.count),
      }));

      // Age distribution
      const ageDistribution = await this.db
        .select({
          range: sql`
          CASE 
            WHEN ${patients.isMinor} = true THEN 'Under 18'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 30 THEN '18-29'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 45 THEN '30-44'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 60 THEN '45-59'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 75 THEN '60-74'
            ELSE '75+'
          END
        `,
          count: sql`COUNT(*)`,
        })
        .from(patients)
        .innerJoin(
          organizationPatients,
          and(
            eq(patients.id, organizationPatients.patientId),
            eq(organizationPatients.orgId, orgId),
            eq(organizationPatients.isActive, true),
          ),
        ).groupBy(sql`
        CASE 
          WHEN ${patients.isMinor} = true THEN 'Under 18'
          WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 30 THEN '18-29'
          WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 45 THEN '30-44'
          WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 60 THEN '45-59'
          WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 75 THEN '60-74'
          ELSE '75+'
        END
      `).orderBy(sql`
        CASE 
          WHEN CASE 
            WHEN ${patients.isMinor} = true THEN 'Under 18'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 30 THEN '18-29'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 45 THEN '30-44'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 60 THEN '45-59'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 75 THEN '60-74'
            ELSE '75+'
          END = 'Under 18' THEN 1
          WHEN CASE 
            WHEN ${patients.isMinor} = true THEN 'Under 18'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 30 THEN '18-29'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 45 THEN '30-44'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 60 THEN '45-59'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 75 THEN '60-74'
            ELSE '75+'
          END = '18-29' THEN 2
          WHEN CASE 
            WHEN ${patients.isMinor} = true THEN 'Under 18'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 30 THEN '18-29'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 45 THEN '30-44'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 60 THEN '45-59'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 75 THEN '60-74'
            ELSE '75+'
          END = '30-44' THEN 3
          WHEN CASE 
            WHEN ${patients.isMinor} = true THEN 'Under 18'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 30 THEN '18-29'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 45 THEN '30-44'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 60 THEN '45-59'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 75 THEN '60-74'
            ELSE '75+'
          END = '45-59' THEN 4
          WHEN CASE 
            WHEN ${patients.isMinor} = true THEN 'Under 18'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 30 THEN '18-29'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 45 THEN '30-44'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 60 THEN '45-59'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), ${patients.dob})) < 75 THEN '60-74'
            ELSE '75+'
          END = '60-74' THEN 5
          ELSE 6
        END
      `);

      // Call metrics
      const callConditions = [eq(calls.orgId, orgId)];
      if (startDate) {
        callConditions.push(gte(calls.createdAt, startDate));
      }

      const [callMetrics] = await this.db
        .select({
          totalCalls: sql`COUNT(*)`,
          reachedPatient: sql`SUM(CASE WHEN (${calls.analysis}->>'patient_reached')::text = 'true' OR 
                                        (${calls.analysis}->>'patientReached')::text = 'true' THEN 1 ELSE 0 END)`,
          leftVoicemail: sql`SUM(CASE WHEN (${calls.analysis}->>'voicemail_left')::text = 'true' OR 
                                       (${calls.analysis}->>'left_voicemail')::text = 'true' OR
                                       (${calls.analysis}->>'voicemail')::text = 'true' THEN 1 ELSE 0 END)`,
          unableToReach: sql`SUM(CASE WHEN ${calls.status} = 'completed' AND 
                                      NOT((${calls.analysis}->>'patient_reached')::text = 'true' OR 
                                         (${calls.analysis}->>'patientReached')::text = 'true') AND
                                      NOT((${calls.analysis}->>'voicemail_left')::text = 'true' OR 
                                         (${calls.analysis}->>'left_voicemail')::text = 'true' OR
                                         (${calls.analysis}->>'voicemail')::text = 'true')
                                      THEN 1 ELSE 0 END)`,
          averageDuration: sql`AVG(${calls.duration})`,
          converted: sql`SUM(CASE WHEN (${calls.analysis}->>'appointment_confirmed')::text = 'true' OR 
                                     (${calls.analysis}->>'appointmentConfirmed')::text = 'true' OR
                                     (${calls.analysis}->>'converted')::text = 'true' OR
                                     (${calls.analysis}->>'conversion')::text = 'true'
                                     THEN 1 ELSE 0 END)`,
          uniquePatients: sql`COUNT(DISTINCT ${calls.patientId})`,
        })
        .from(calls)
        .where(and(...callConditions));

      // Patient activity
      const activeConditions = [eq(calls.orgId, orgId)];
      if (startDate) {
        activeConditions.push(gte(calls.createdAt, startDate));
      }

      const [patientActivity] = await this.db
        .select({
          activePatients: sql`COUNT(DISTINCT ${calls.patientId})`,
        })
        .from(calls)
        .where(and(...activeConditions));

      // Most contacted patients
      const mostContactedPatients = await this.db
        .select({
          id: patients.id,
          firstName: patients.firstName,
          lastName: patients.lastName,
          callCount: sql`COUNT(*)`,
        })
        .from(calls)
        .innerJoin(patients, eq(calls.patientId, patients.id))
        .where(and(...callConditions))
        .groupBy(patients.id, patients.firstName, patients.lastName)
        .orderBy(sql`COUNT(*)`, sql`desc`)
        .limit(5);

      // Call trends over time by day
      const dailyCallsConditions = [eq(calls.orgId, orgId)];
      if (startDate) {
        dailyCallsConditions.push(gte(calls.createdAt, startDate));
      }

      const dailyCalls = await this.db
        .select({
          date: sql`DATE_TRUNC('day', ${calls.createdAt})`,
          inbound: sql`SUM(CASE WHEN ${calls.direction} = 'inbound' THEN 1 ELSE 0 END)`,
          outbound: sql`SUM(CASE WHEN ${calls.direction} = 'outbound' THEN 1 ELSE 0 END)`,
        })
        .from(calls)
        .where(and(...dailyCallsConditions))
        .groupBy(sql`DATE_TRUNC('day', ${calls.createdAt})`)
        .orderBy(sql`DATE_TRUNC('day', ${calls.createdAt})`);

      // Call outcomes over time
      const callOutcomes = await this.db
        .select({
          date: sql`DATE_TRUNC('day', ${calls.createdAt})`,
          connected: sql`SUM(CASE WHEN (${calls.analysis}->>'patient_reached')::text = 'true' OR 
                                     (${calls.analysis}->>'patientReached')::text = 'true' THEN 1 ELSE 0 END)`,
          voicemail: sql`SUM(CASE WHEN (${calls.analysis}->>'voicemail_left')::text = 'true' OR 
                                    (${calls.analysis}->>'left_voicemail')::text = 'true' OR
                                    (${calls.analysis}->>'voicemail')::text = 'true' THEN 1 ELSE 0 END)`,
          failed: sql`SUM(CASE WHEN ${calls.status} = 'failed' THEN 1 ELSE 0 END)`,
        })
        .from(calls)
        .where(and(...dailyCallsConditions))
        .groupBy(sql`DATE_TRUNC('day', ${calls.createdAt})`)
        .orderBy(sql`DATE_TRUNC('day', ${calls.createdAt})`);

      // Calculate derived metrics
      const totalCallCount = Number(callMetrics?.totalCalls || 0);
      const uniquePatientsCount = Number(callMetrics?.uniquePatients || 0);
      const callsPerPatient =
        uniquePatientsCount > 0 ? totalCallCount / uniquePatientsCount : 0;

      const convertedCount = Number(callMetrics?.converted || 0);
      const reachedCount = Number(callMetrics?.reachedPatient || 0);
      const conversionRate =
        reachedCount > 0 ? (convertedCount / reachedCount) * 100 : 0;

      return {
        totalPatients,
        newPatients,
        patientsByMonth,
        ageDistribution: ageDistribution.map((row) => ({
          range: row.range as string,
          count: Number(row.count),
        })),
        callMetrics: {
          totalCalls: Number(callMetrics?.totalCalls || 0),
          reachedPatient: Number(callMetrics?.reachedPatient || 0),
          leftVoicemail: Number(callMetrics?.leftVoicemail || 0),
          unableToReach: Number(callMetrics?.unableToReach || 0),
          averageDuration: Number(callMetrics?.averageDuration || 0),
          callsPerPatient,
          conversionRate,
        },
        patientActivity: {
          activePatients: Number(patientActivity?.activePatients || 0),
          inactivePatients:
            totalPatients - Number(patientActivity?.activePatients || 0),
          mostContactedPatients: mostContactedPatients.map((patient) => ({
            id: patient.id,
            name: `${patient.firstName} ${patient.lastName}`,
            callCount: Number(patient.callCount),
          })),
        },
        trends: {
          dailyCalls: dailyCalls.map((day) => ({
            date: new Date(day.date as string).toISOString().split("T")[0],
            inbound: Number(day.inbound || 0),
            outbound: Number(day.outbound || 0),
          })),
          callOutcomes: callOutcomes.map((day) => ({
            date: new Date(day.date as string).toISOString().split("T")[0],
            connected: Number(day.connected || 0),
            voicemail: Number(day.voicemail || 0),
            failed: Number(day.failed || 0),
          })),
        },
      };
    } catch (error) {
      console.error("Error in getPatientStatsByOrg:", error);
      return {
        totalPatients: 0,
        newPatients: 0,
        patientsByMonth: [],
        ageDistribution: [],
        callMetrics: {
          totalCalls: 0,
          reachedPatient: 0,
          leftVoicemail: 0,
          unableToReach: 0,
          averageDuration: 0,
          callsPerPatient: 0,
          conversionRate: 0,
        },
        patientActivity: {
          activePatients: 0,
          inactivePatients: 0,
          mostContactedPatients: [],
        },
        trends: {
          dailyCalls: [],
          callOutcomes: [],
        },
      };
    }
  }
}
