// src/app/api/webhooks/retell/inbound/[orgId]/route.ts
import { db } from "@/server/db";
import {
  calls,
  organizationPatients,
  organizations,
  patients,
  rows,
  runs,
} from "@/server/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: { orgId: string } },
) {
  try {
    const { orgId } = params;

    // Parse the webhook payload
    const data = await request.json();

    // Validate the webhook has the necessary data
    if (!data.phone_number) {
      return NextResponse.json({
        is_existing_patient: "false",
        error_message: "Phone number not provided",
      });
    }

    // Normalize the phone number (remove non-digits)
    const phoneNumber = data.phone_number.replace(/\D/g, "");

    // Verify the organization exists in our database
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));

    if (!organization) {
      return NextResponse.json({
        is_existing_patient: "false",
        error_message: "Organization not found",
      });
    }

    // Find the patient by phone number
    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.primaryPhone, phoneNumber));

    if (!patient) {
      // If no match for primary phone, check secondary phone
      const [secondaryPatient] = await db
        .select()
        .from(patients)
        .where(eq(patients.secondaryPhone, phoneNumber));

      if (!secondaryPatient) {
        // No patient found with this phone number
        return NextResponse.json({
          is_existing_patient: "false",
          context: "New caller, no patient record found",
        });
      }
    }

    // We found a patient, now check if they're associated with this organization
    const patientId = patient?.id;

    if (!patientId) {
      return NextResponse.json({
        is_existing_patient: "false",
        context: "Patient record incomplete",
      });
    }

    // Check if patient is linked to this organization
    const [orgPatient] = await db
      .select()
      .from(organizationPatients)
      .where(
        and(
          eq(organizationPatients.patientId, patientId),
          eq(organizationPatients.orgId, orgId),
          eq(organizationPatients.isActive, true),
        ),
      );

    if (!orgPatient) {
      // Patient exists but not linked to this organization
      return NextResponse.json({
        is_existing_patient: "false",
        context: "Patient not associated with this organization",
      });
    }

    // Get recent call history
    const recentCalls = await db
      .select()
      .from(calls)
      .where(and(eq(calls.patientId, patientId), eq(calls.orgId, orgId)))
      .orderBy(desc(calls.createdAt))
      .limit(5);

    // Find most recent completed call
    const lastCompletedCall = recentCalls.find(
      (call) => call.status === "completed",
    );

    // Find active row for this patient
    const [activeRow] = await db
      .select({
        row: rows,
        run: runs,
      })
      .from(rows)
      .innerJoin(runs, eq(rows.runId, runs.id))
      .where(and(eq(rows.patientId, patientId), eq(rows.status, "pending")))
      .orderBy(desc(rows.createdAt))
      .limit(1);

    // Build the context object
    const context = {
      is_existing_patient: "true",

      // Patient information
      first_name: patient.firstName,
      last_name: patient.lastName,
      dob: patient.dob.toString().split("T")[0],
      phone: patient.primaryPhone,
      emr_id: orgPatient.emrIdInOrg || "",

      // Call history
      last_interaction: lastCompletedCall
        ? lastCompletedCall.endTime?.toISOString() ||
          lastCompletedCall.createdAt.toISOString()
        : "none",

      // Active campaign info
      has_pending_callback: activeRow ? "true" : "false",

      // Include any campaign-specific variables from the active row
      ...(activeRow?.row.variables || {}),

      // Include summary if available
      call_summary: lastCompletedCall?.analysis?.summary || "",
    };

    return NextResponse.json(context);
  } catch (error) {
    console.error("Error processing inbound webhook:", error);

    return NextResponse.json(
      {
        is_existing_patient: "false",
        error_message: "Internal server error",
      },
      { status: 500 },
    );
  }
}
