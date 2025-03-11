// src/services/patients/patient-service.ts

import {
  ServiceResult,
  createError,
  createSuccess,
} from "@/lib/service-result";
import { db } from "@/server/db";
import { calls, organizationPatients, patients } from "@/server/db/schema";
import { createHash } from "crypto";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";

/**
 * Determine if a given date of birth makes the patient a minor (under 18)
 */
export function isMinor(dob: string): boolean {
  try {
    const dobDate = new Date(dob);
    const today = new Date();
    const age = today.getFullYear() - dobDate.getFullYear();

    // Check if birthday has occurred this year
    const hasBirthdayOccurred =
      today.getMonth() > dobDate.getMonth() ||
      (today.getMonth() === dobDate.getMonth() &&
        today.getDate() >= dobDate.getDate());

    // Adjust age if birthday hasn't occurred yet
    return hasBirthdayOccurred ? age < 18 : age - 1 < 18;
  } catch {
    // Default to false if date can't be parsed
    return false;
  }
}

export const patientService = {
  /**
   * Generate hash for patient deduplication
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

    // Create composite hash with all components
    const hash = createHash("sha256");
    const hashInput = `${normalizedPhone}-${normalizedDob}-${normalizedFirstName.substring(0, 3)}-${normalizedLastName}`;

    hash.update(hashInput);
    return hash.digest("hex");
  },

  /**
   * Generate secondary hash for fuzzy matching when primary hash fails
   */
  generateSecondaryHash(lastName: string, dob: string, phone: string): string {
    // Normalize inputs
    const normalizedPhone = String(phone).replace(/\D/g, "").slice(-4); // Last 4 digits
    const normalizedDob = String(dob).replace(/\D/g, "");
    const normalizedLastName = String(lastName).toLowerCase().trim();

    const hash = createHash("sha256");
    hash.update(`${normalizedLastName}-${normalizedDob}-${normalizedPhone}`);
    return hash.digest("hex");
  },

  /**
   * Find a patient by ID
   */
  async getById(id: string, orgId: string): Promise<ServiceResult<any>> {
    try {
      // Get patient with organization check
      const [patient] = await db
        .select()
        .from(patients)
        .where(eq(patients.id, id));

      if (!patient) {
        return createError("NOT_FOUND", "Patient not found");
      }

      // Check organization membership
      const [orgPatient] = await db
        .select()
        .from(organizationPatients)
        .where(
          and(
            eq(organizationPatients.patientId, id),
            eq(organizationPatients.orgId, orgId),
          ),
        );

      // Get call count for this patient
      const [callCount] = await db
        .select({ count: sql`COUNT(*)` })
        .from(calls)
        .where(and(eq(calls.patientId, id), eq(calls.orgId, orgId)));

      // Get the most recent call for this patient
      const lastCall = await db
        .select()
        .from(calls)
        .where(and(eq(calls.patientId, id), eq(calls.orgId, orgId)))
        .orderBy(sql`${calls.createdAt} DESC`)
        .limit(1)
        .then((results) => results[0] || null);

      // Format dates for JSON response
      const formattedPatient = {
        ...patient,
        dob: patient.dob?.toString()?.split("T")[0],
        createdAt: patient.createdAt.toString(),
        updatedAt: patient.updatedAt?.toString(),
        callCount: Number(callCount?.count || 0),
        lastCall: lastCall
          ? {
              ...lastCall,
              createdAt: lastCall.createdAt.toString(),
            }
          : null,
      };

      return createSuccess({
        ...formattedPatient,
        emrIdInOrg: orgPatient?.emrIdInOrg,
        isActive: orgPatient?.isActive,
      });
    } catch (error) {
      console.error("Error fetching patient:", error);
      return createError("INTERNAL_ERROR", "Failed to fetch patient", error);
    }
  },

  /**
   * Find patient by phone number with improved matching
   */
  async findByPhone(phone: string, orgId?: string): Promise<any> {
    try {
      // Clean phone input
      const cleanPhone = phone.replace(/\D/g, "");

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
      const matchingPatients = await db
        .select()
        .from(patients)
        .where(or(...phoneConditions))
        .limit(5); // Limit to prevent huge result sets

      if (matchingPatients.length === 0) {
        return null;
      }

      // If we have an orgId, prioritize patients linked to that org
      if (orgId && matchingPatients.length > 0) {
        // Try to find an exact match within this organization
        for (const patient of matchingPatients) {
          const links = await db
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
            // Format dates for consistent return
            return {
              ...patient,
              dob: patient.dob?.toString()?.split("T")[0],
              createdAt: patient.createdAt.toString(),
              updatedAt: patient.updatedAt?.toString(),
              emrIdInOrg: links[0].emrIdInOrg,
            };
          }
        }
      }

      // Default to first match if no organization-specific match is found
      const firstMatch = matchingPatients[0];
      return firstMatch
        ? {
            ...firstMatch,
            dob: firstMatch.dob?.toString()?.split("T")[0],
            createdAt: firstMatch.createdAt.toString(),
            updatedAt: firstMatch.updatedAt?.toString(),
          }
        : null;
    } catch (error) {
      console.error("Error in findByPhone:", error);
      return null;
    }
  },

  /**
   * Find or create a patient with robust deduplication
   */
  async findOrCreate(input: {
    firstName: string;
    lastName: string;
    dob: string;
    phone: string;
    secondaryPhone?: string;
    emrId?: string;
    orgId?: string;
    externalIds?: Record<string, string>;
    metadata?: Record<string, unknown>;
  }): Promise<ServiceResult<typeof patients.$inferSelect>> {
    try {
      const {
        firstName,
        lastName,
        dob,
        phone: inputPhone,
        secondaryPhone,
        emrId,
        orgId,
        externalIds,
        metadata,
      } = input;

      // Cleanup and validation
      if (!firstName || !lastName || !inputPhone) {
        return createError(
          "VALIDATION_ERROR",
          "Missing required patient information",
        );
      }

      const phone = inputPhone.replace(/\D/g, "");

      // Generate primary hash for deduplication
      const patientHash = this.generatePatientHash(
        firstName,
        lastName,
        dob,
        phone,
      );

      // Generate secondary hash for fallback matching
      const secondaryHash = this.generateSecondaryHash(lastName, dob, phone);

      // Check if patient exists with all possible matches
      const existingPatients = await db
        .select()
        .from(patients)
        .where(
          or(
            eq(patients.patientHash, patientHash),
            eq(patients.secondaryHash, secondaryHash),
            and(
              eq(sql`REPLACE(${patients.primaryPhone}, '-', '')`, phone),
              ilike(patients.lastName, lastName),
            ),
          ),
        );

      let patient;
      let isNewPatient = false;

      if (existingPatients.length > 0) {
        // Use the first match
        patient = existingPatients[0];

        // Update with new information if needed
        const updates = {
          updatedAt: new Date(),
        } as Partial<typeof patients.$inferInsert> & {
          secondaryPhone?: string;
          externalIds?: Record<string, string>;
          metadata?: Record<string, unknown>;
        };

        // Update data conditionally
        if (
          firstName &&
          lastName &&
          (patient.firstName !== firstName || patient.lastName !== lastName)
        ) {
          updates.firstName = firstName;
          updates.lastName = lastName;
        }

        if (phone && phone !== patient.primaryPhone) {
          // Move current primary to secondary if needed
          if (patient.primaryPhone && !patient.secondaryPhone) {
            (updates as any).secondaryPhone = patient.primaryPhone;
          }
          updates.primaryPhone = phone;
        }

        if (secondaryPhone && !patient.secondaryPhone) {
          (updates as any).secondaryPhone = secondaryPhone;
        }

        // Handle external IDs and metadata
        if (externalIds && Object.keys(externalIds).length > 0) {
          (updates as any).externalIds = {
            ...(patient.externalIds || {}),
            ...externalIds,
          };
        }

        if (metadata && Object.keys(metadata).length > 0) {
          (updates as any).metadata = {
            ...(patient.metadata || {}),
            ...metadata,
          };
        }

        // Only update if there are changes to make
        if (Object.keys(updates).length > 1) {
          await db
            .update(patients)
            .set(updates)
            .where(eq(patients.id, patient.id));

          // Refresh patient data
          [patient] = await db
            .select()
            .from(patients)
            .where(eq(patients.id, patient.id));
        }
      } else {
        // Create new patient
        // Parse DOB and check if minor
        const dobDate = new Date(dob);
        const minor = isMinor(dob);

        const [newPatient] = await db
          .insert(patients)
          .values({
            patientHash,
            secondaryHash,
            normalizedPhone: phone,
            firstName,
            lastName,
            dob: dobDate.toISOString().split("T")[0],
            isMinor: minor,
            primaryPhone: phone,
            secondaryPhone: secondaryPhone,
            externalIds: externalIds || {},
            metadata: metadata || {},
          } as any)
          .returning();

        patient = newPatient;
        isNewPatient = true;
      }

      // Link patient to organization if needed
      if (orgId && patient) {
        // Check if link already exists
        const [existingLink] = await db
          .select()
          .from(organizationPatients)
          .where(
            and(
              eq(organizationPatients.patientId, patient.id),
              eq(organizationPatients.orgId, orgId),
            ),
          );

        if (!existingLink) {
          // Create link
          await db.insert(organizationPatients).values({
            orgId,
            patientId: patient.id,
            emrIdInOrg: emrId,
            isActive: true,
            createdAt: new Date(),
          } as any);
        } else if (emrId && existingLink.emrIdInOrg !== emrId) {
          // Update EMR ID if different
          await db
            .update(organizationPatients)
            .set({
              emrIdInOrg: emrId,
              isActive: true,
              updatedAt: new Date(),
            } as any)
            .where(
              and(
                eq(organizationPatients.patientId, patient.id),
                eq(organizationPatients.orgId, orgId),
              ),
            );
        }
      }

      // Format dates for JSON
      const formattedPatient = {
        ...patient,
        dob: patient.dob?.toString()?.split("T")[0],
        createdAt: patient.createdAt.toString(),
        updatedAt: patient.updatedAt?.toString(),
        isNewPatient,
      };

      return createSuccess(formattedPatient);
    } catch (error) {
      console.error("Error in findOrCreatePatient:", error);
      return createError(
        "INTERNAL_ERROR",
        "Failed to find or create patient",
        error instanceof Error ? error : new Error("Unknown error"),
      );
    }
  },

  /**
   * Alias for findOrCreate to maintain backward compatibility
   */
  async findOrCreatePatient(input: {
    firstName: string;
    lastName: string;
    dob: string;
    phone: string;
    secondaryPhone?: string;
    emrId?: string;
    orgId?: string;
    externalIds?: Record<string, string>;
    metadata?: Record<string, unknown>;
  }) {
    return this.findOrCreate(input);
  },

  /**
   * Create a new patient
   */
  async create(data: {
    firstName: string;
    lastName: string;
    dob: string;
    primaryPhone: string;
    secondaryPhone?: string;
    emrIdInOrg?: string;
    orgId?: string;
    externalIds?: Record<string, string>;
    metadata?: Record<string, unknown>;
  }): Promise<ServiceResult<any>> {
    try {
      const {
        firstName,
        lastName,
        dob,
        primaryPhone,
        secondaryPhone,
        emrIdInOrg,
        orgId,
        externalIds,
        metadata,
      } = data;

      // Generate hashes for deduplication
      const patientHash = this.generatePatientHash(
        firstName,
        lastName,
        dob,
        primaryPhone,
      );

      const secondaryHash = this.generateSecondaryHash(
        lastName,
        dob,
        primaryPhone,
      );

      // Check if patient exists with this hash
      const [existingPatient] = await db
        .select()
        .from(patients)
        .where(eq(patients.patientHash, patientHash));

      if (existingPatient) {
        // If the patient exists and orgId is provided, ensure they're linked
        if (orgId) {
          const [existingLink] = await db
            .select()
            .from(organizationPatients)
            .where(
              and(
                eq(organizationPatients.patientId, existingPatient.id),
                eq(organizationPatients.orgId, orgId),
              ),
            );

          if (!existingLink) {
            // Create link
            await db.insert(organizationPatients).values({
              orgId,
              patientId: existingPatient.id,
              emrIdInOrg,
              isActive: true,
              createdAt: new Date(),
            } as any);
          }
        }

        // Format dates for response
        return createSuccess({
          ...existingPatient,
          dob: existingPatient.dob?.toString()?.split("T")[0],
          createdAt: existingPatient.createdAt.toString(),
          updatedAt: existingPatient.updatedAt?.toString(),
          isNewPatient: false,
        });
      }

      // Parse DOB and check if minor
      const dobDate = new Date(dob);
      const minor = isMinor(dob);

      // Create new patient
      const [newPatient] = await db
        .insert(patients)
        .values({
          patientHash,
          secondaryHash,
          normalizedPhone: primaryPhone.replace(/\D/g, ""),
          firstName,
          lastName,
          dob: dobDate.toISOString().split("T")[0],
          isMinor: minor,
          primaryPhone,
          secondaryPhone,
          externalIds: externalIds || {},
          metadata: metadata || {},
        } as any)
        .returning();

      // Link to organization if provided
      if (orgId) {
        await db.insert(organizationPatients).values({
          orgId,
          patientId: newPatient.id,
          emrIdInOrg,
          isActive: true,
          createdAt: new Date(),
        } as any);
      }

      // Format dates for response
      return createSuccess({
        ...newPatient,
        dob: newPatient.dob?.toString()?.split("T")[0],
        createdAt: newPatient.createdAt.toString(),
        updatedAt: newPatient.updatedAt?.toString(),
        isNewPatient: true,
      });
    } catch (error) {
      console.error("Error creating patient:", error);
      return createError("INTERNAL_ERROR", "Failed to create patient", error);
    }
  },

  /**
   * Search patients by multiple criteria with pagination
   */
  async getAll(options: {
    orgId: string;
    limit?: number;
    offset?: number;
    search?: string;
    inactive?: boolean;
  }): Promise<
    ServiceResult<{
      patients: any[];
      totalCount: number;
      hasMore: boolean;
    }>
  > {
    try {
      const {
        orgId,
        limit = 20,
        offset = 0,
        search,
        inactive = false,
      } = options;

      // Build query to select patients with organization join
      let patientsQuery = db
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
          ),
        );

      // Only active patients unless inactive is explicitly true
      if (!inactive) {
        patientsQuery = (patientsQuery as any).where(
          eq(organizationPatients.isActive, true),
        );
      }

      // Add search condition if provided
      if (search) {
        const searchPattern = `%${search}%`;
        patientsQuery = (patientsQuery as any).where(
          or(
            ilike(patients.firstName, searchPattern),
            ilike(patients.lastName, searchPattern),
            ilike(patients.primaryPhone, searchPattern),
            ilike(patients.secondaryPhone, searchPattern),
            ilike(organizationPatients.emrIdInOrg, searchPattern),
          ),
        );
      }

      // Run query with pagination
      const patientResults = await patientsQuery
        .limit(limit)
        .offset(offset)
        .orderBy(patients.lastName, patients.firstName);

      // Get total count
      const countQuery = db
        .select({ count: sql`COUNT(*)` })
        .from(patients)
        .innerJoin(
          organizationPatients,
          and(
            eq(patients.id, organizationPatients.patientId),
            eq(organizationPatients.orgId, orgId),
          ),
        );

      // Apply the same inactive and search filters to count query
      if (!inactive) {
        countQuery.where(eq(organizationPatients.isActive, true));
      }

      if (search) {
        const searchPattern = `%${search}%`;
        countQuery.where(
          or(
            ilike(patients.firstName, searchPattern),
            ilike(patients.lastName, searchPattern),
            ilike(patients.primaryPhone, searchPattern),
            ilike(patients.secondaryPhone, searchPattern),
            ilike(organizationPatients.emrIdInOrg, searchPattern),
          ),
        );
      }

      const [totalCountResult] = await countQuery;
      const totalCount = Number(totalCountResult?.count || 0);

      // Get the patient IDs for call count queries
      const patientIds = patientResults.map((row) => row.patient.id);

      // Get call counts for all the patients in one query
      const callCounts =
        patientIds.length > 0
          ? await db
              .select({
                patientId: calls.patientId,
                count: sql`COUNT(*)`,
              })
              .from(calls)
              .where(
                and(
                  inArray(calls.patientId, patientIds),
                  eq(calls.orgId, orgId),
                ),
              )
              .groupBy(calls.patientId)
          : [];

      // Convert to a map for easier lookup
      const callCountMap = new Map(
        callCounts.map((cc) => [cc.patientId, Number(cc.count)]),
      );

      // Format the results
      const formattedPatients = patientResults.map((row) => {
        const patientData = row.patient;

        // Format dates
        return {
          ...patientData,
          dob: patientData.dob?.toString()?.split("T")[0],
          createdAt: patientData.createdAt.toString(),
          updatedAt: patientData.updatedAt?.toString(),
          emrIdInOrg: row.orgPatient.emrIdInOrg,
          isActive: row.orgPatient.isActive,
          callCount: callCountMap.get(patientData.id) || 0,
        };
      });

      return createSuccess({
        patients: formattedPatients,
        totalCount,
        hasMore: offset + limit < totalCount,
      });
    } catch (error) {
      console.error("Error fetching patients:", error);
      return createError("INTERNAL_ERROR", "Failed to fetch patients", error);
    }
  },

  /**
   * Bulk insert or update patients from Excel/CSV imports
   */
  async bulkInsert(
    patientData: Array<{
      firstName: string;
      lastName: string;
      dob: string;
      phone: string;
      secondaryPhone?: string;
      emrId?: string;
      externalIds?: Record<string, string>;
      metadata?: Record<string, unknown>;
    }>,
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
      // Generate hashes for all patients
      const patientsWithHashes = patientData.map((patient) => {
        const hash = this.generatePatientHash(
          patient.firstName,
          patient.lastName,
          patient.dob,
          patient.phone,
        );

        const secondaryHash = this.generateSecondaryHash(
          patient.lastName,
          patient.dob,
          patient.phone,
        );

        return {
          ...patient,
          patientHash: hash,
          secondaryHash,
          normalizedPhone: patient.phone.replace(/\D/g, ""),
        };
      });

      // Get all hashes to check for existing patients
      const patientHashes = patientsWithHashes.map((p) => p.patientHash);
      const secondaryHashes = patientsWithHashes.map((p) => p.secondaryHash);
      const normalizedPhones = patientsWithHashes.map((p) => p.normalizedPhone);

      // Fetch existing patients in one query
      const existingPatients = await db
        .select()
        .from(patients)
        .where(
          or(
            sql`${patients.patientHash} IN (${patientHashes.join(",")})`,
            sql`${patients.secondaryHash} IN (${secondaryHashes.join(",")})`,
            sql`${patients.normalizedPhone} IN (${normalizedPhones.join(",")})`,
          ),
        );

      // Create maps for quick lookups
      const existingByHash = new Map(
        existingPatients.map((p) => [p.patientHash, p]),
      );

      const existingBySecondaryHash = new Map(
        existingPatients
          .filter((p) => p.secondaryHash)
          .map((p) => [p.secondaryHash, p]),
      );

      const existingByPhone = new Map(
        existingPatients
          .filter((p) => p.normalizedPhone)
          .map((p) => [p.normalizedPhone, p]),
      );

      // Process each patient
      for (const patient of patientsWithHashes) {
        try {
          // Look for existing patient by hash or secondary hash
          const existingPatient =
            existingByHash.get(patient.patientHash) ||
            existingBySecondaryHash.get(patient.secondaryHash) ||
            null;

          if (existingPatient) {
            // Update existing patient if needed
            const updates: Partial<typeof patients.$inferInsert> = {};
            let needsUpdate = false;

            // Update phone if different and not empty
            if (
              patient.phone &&
              existingPatient.primaryPhone !== patient.phone
            ) {
              if (!existingPatient.secondaryPhone) {
                (updates as any).secondaryPhone = existingPatient.primaryPhone;
              }
              updates.primaryPhone = patient.phone;
              (updates as any).normalizedPhone = patient.normalizedPhone;
              needsUpdate = true;
            }

            // Update names if available and different
            if (
              patient.firstName &&
              patient.lastName &&
              (existingPatient.firstName !== patient.firstName ||
                existingPatient.lastName !== patient.lastName)
            ) {
              updates.firstName = patient.firstName;
              updates.lastName = patient.lastName;
              needsUpdate = true;
            }

            // Add secondary phone if provided and not already set
            if (patient.secondaryPhone && !existingPatient.secondaryPhone) {
              (updates as any).secondaryPhone = patient.secondaryPhone;
              needsUpdate = true;
            }

            // Merge external IDs and metadata if provided
            if (
              patient.externalIds &&
              Object.keys(patient.externalIds).length > 0
            ) {
              (updates as any).externalIds = {
                ...(existingPatient.externalIds || {}),
                ...patient.externalIds,
              };
              needsUpdate = true;
            }

            if (patient.metadata && Object.keys(patient.metadata).length > 0) {
              (updates as any).metadata = {
                ...(existingPatient.metadata || {}),
                ...patient.metadata,
              };
              needsUpdate = true;
            }

            if (needsUpdate) {
              try {
                await db
                  .update(patients)
                  .set(updates)
                  .where(eq(patients.id, existingPatient.id));

                result.updatedCount++;
              } catch (updateError) {
                console.error(
                  `Error updating patient ${patient.firstName} ${patient.lastName}:`,
                  updateError,
                );
                result.errors.push(
                  `Failed to update patient ${patient.firstName} ${patient.lastName}: ${updateError instanceof Error ? updateError.message : String(updateError)}`,
                );
              }
            }

            // Link to organization if provided
            if (orgId && existingPatient) {
              // Check if link already exists
              const [existingLink] = await db
                .select()
                .from(organizationPatients)
                .where(
                  and(
                    eq(organizationPatients.patientId, existingPatient.id),
                    eq(organizationPatients.orgId, orgId),
                  ),
                );

              if (!existingLink) {
                // Create link
                await db.insert(organizationPatients).values({
                  orgId,
                  patientId: existingPatient.id,
                  emrIdInOrg: patient.emrId,
                  isActive: true,
                  createdAt: new Date(),
                } as any);
              } else if (
                patient.emrId &&
                existingLink.emrIdInOrg !== patient.emrId
              ) {
                // Update EMR ID if different
                await db
                  .update(organizationPatients)
                  .set({
                    emrIdInOrg: patient.emrId,
                    isActive: true,
                    updatedAt: new Date(),
                  } as any)
                  .where(
                    and(
                      eq(organizationPatients.patientId, existingPatient.id),
                      eq(organizationPatients.orgId, orgId),
                    ),
                  );
              }
            }

            result.patientIds.push(existingPatient.id);
          } else {
            // Create new patient
            try {
              // Parse DOB
              const dobDate = new Date(patient.dob);

              if (isNaN(dobDate.getTime())) {
                throw new Error(
                  `Invalid date format for ${patient.firstName} ${patient.lastName}: ${patient.dob}`,
                );
              }

              // Check if minor
              const minor = isMinor(patient.dob);

              // Insert new patient
              const [newPatient] = await db
                .insert(patients)
                .values({
                  patientHash: patient.patientHash,
                  secondaryHash: patient.secondaryHash,
                  normalizedPhone: patient.normalizedPhone,
                  firstName: patient.firstName,
                  lastName: patient.lastName,
                  dob: dobDate.toISOString().split("T")[0],
                  isMinor: minor,
                  primaryPhone: patient.phone,
                  secondaryPhone: patient.secondaryPhone,
                  externalIds: patient.externalIds || {},
                  metadata: patient.metadata || {},
                } as any)
                .returning();

              // Create organization link
              await db.insert(organizationPatients).values({
                orgId,
                patientId: newPatient.id,
                emrIdInOrg: patient.emrId,
                isActive: true,
                createdAt: new Date(),
              } as any);

              result.patientIds.push(newPatient.id);
              result.newCount++;
            } catch (insertError) {
              console.error(
                `Error creating patient ${patient.firstName} ${patient.lastName}:`,
                insertError,
              );
              result.errors.push(
                `Failed to create patient ${patient.firstName} ${patient.lastName}: ${insertError instanceof Error ? insertError.message : String(insertError)}`,
              );
            }
          }
        } catch (patientError) {
          console.error(
            `Error processing patient ${patient.firstName} ${patient.lastName}:`,
            patientError,
          );
          result.errors.push(
            `Error processing patient ${patient.firstName} ${patient.lastName}: ${patientError instanceof Error ? patientError.message : String(patientError)}`,
          );
        }
      }

      return result;
    } catch (error) {
      console.error("Error in bulkInsert:", error);
      result.errors.push(
        `Global error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return result;
    }
  },
};
