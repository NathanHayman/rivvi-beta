import { db } from "@/server/db";
import { organizations } from "@/server/db/schema";
import { toZonedTime } from "date-fns-tz";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Get organization ID from query parameters
    const searchParams = request.nextUrl.searchParams;
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required parameter: orgId",
        },
        { status: 400 },
      );
    }

    // Get organization details
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));

    if (!org) {
      return NextResponse.json(
        {
          success: false,
          message: `Organization with ID ${orgId} not found`,
        },
        { status: 404 },
      );
    }

    // Check if organization has timezone and office hours
    if (!org.timezone || !org.officeHours) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Organization does not have timezone or office hours configured",
          org: {
            id: org.id,
            name: org.name,
            timezone: org.timezone,
            hasOfficeHours: !!org.officeHours,
          },
        },
        { status: 200 },
      );
    }

    // Convert current time to organization's timezone
    const now = new Date();
    const zonedNow = toZonedTime(now, org.timezone);

    // Get day of week (0 = Sunday, 6 = Saturday)
    const dayOfWeek = zonedNow.getDay();
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const dayName = dayNames[dayOfWeek];

    // Get current time as hours and minutes
    const hours = zonedNow.getHours();
    const minutes = zonedNow.getMinutes();
    const currentTime = hours * 60 + minutes; // Convert to minutes since midnight

    // Get the hours configuration for the current day
    const officeHours = org.officeHours as Record<
      string,
      { start: string; end: string }
    >;
    const dayConfig = officeHours[dayName];

    let isWithinHours = false;
    let startTime = 0;
    let endTime = 0;
    let reason = "No hours configured for this day";

    if (dayConfig) {
      // Parse start and end times
      const [startHours, startMinutes] = dayConfig.start.split(":").map(Number);
      const [endHours, endMinutes] = dayConfig.end.split(":").map(Number);

      startTime = startHours * 60 + (startMinutes || 0);
      endTime = endHours * 60 + (endMinutes || 0);

      // Special case: if start and end are both 0:00, assume not operating
      if (startTime === 0 && endTime === 0) {
        isWithinHours = false;
        reason = "Hours set to 00:00-00:00, treating as not operating";
      }
      // Special case: if start and end are both 00:00-23:59, assume 24 hour operation
      else if (startTime === 0 && endTime === 23 * 60 + 59) {
        isWithinHours = true;
        reason = "Hours set to 00:00-23:59, treating as 24-hour operation";
      }
      // Check if current time is within office hours
      else {
        isWithinHours = currentTime >= startTime && currentTime <= endTime;
        reason = isWithinHours
          ? "Current time is within configured office hours"
          : "Current time is outside configured office hours";
      }
    }

    // Return debug information
    return NextResponse.json({
      success: true,
      message: "Office hours check completed",
      isWithinHours,
      organization: {
        id: org.id,
        name: org.name,
        timezone: org.timezone,
      },
      timeInfo: {
        serverTime: now.toISOString(),
        organizationTime: zonedNow.toISOString(),
        day: dayName,
        hour: hours,
        minute: minutes,
        currentTimeInMinutes: currentTime,
      },
      officeHours: {
        configuration: officeHours,
        today: dayConfig,
        startTimeMinutes: startTime,
        endTimeMinutes: endTime,
        formattedRange: dayConfig
          ? `${dayConfig.start} - ${dayConfig.end}`
          : "Not configured",
      },
      result: {
        isWithinHours,
        reason,
      },
    });
  } catch (error) {
    console.error("Error checking office hours:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to check office hours",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
