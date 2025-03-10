// src/lib/excel-processor.ts - Complete Fixed Version
import { db } from "@/server/db";
import { nanoid } from "nanoid";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  formatDate,
  formatPhoneNumber,
  isValidDate,
} from "../outdated/file/utils";
import { PatientService } from "../outdated/patient";

/**
 * Parse file content based on file type (Excel or CSV)
 */
export function parseFileContent(
  fileContent: string | ArrayBuffer,
  fileName: string,
): { headers: string[]; rows: Record<string, unknown>[] } {
  try {
    // Detect file type
    const isCSV = fileName.toLowerCase().endsWith(".csv");

    // Get content as text if it's a base64 string
    let contentToProcess = fileContent;
    if (typeof fileContent === "string" && fileContent.startsWith("data:")) {
      const base64Content = fileContent.split(",")[1];
      if (!base64Content) {
        throw new Error("Invalid base64 content");
      }

      if (isCSV) {
        contentToProcess = atob(base64Content);
      } else {
        // Keep as base64 for Excel
        contentToProcess = base64Content;
      }
    }

    if (isCSV) {
      // Parse CSV with enhanced options
      let csvText =
        typeof contentToProcess === "string"
          ? contentToProcess
          : new TextDecoder().decode(contentToProcess);

      const parseOptions = {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
        transform: (value: string) => value.trim(),
        dynamicTyping: true,
        delimitersToGuess: [",", "\t", "|", ";"],
        complete: (results: Papa.ParseResult<Record<string, unknown>>) => {
          data = results.data;
          errors = results.errors;
        },
      };

      let data: Record<string, unknown>[] = [];
      let errors: Papa.ParseError[] = [];

      Papa.parse<Record<string, unknown>>(csvText, parseOptions);

      if (errors.length > 0) {
        console.error("CSV parsing errors:", errors);
        throw new Error(
          `CSV parsing error: ${errors[0]?.message || "Unknown error"}`,
        );
      }

      // Alert if no data
      if (!data.length) {
        throw new Error("No data found in CSV file");
      }

      return {
        headers: Object.keys(data[0] || {}),
        rows: data as Record<string, unknown>[],
      };
    } else {
      // Parse Excel with enhanced options
      let workbook;
      if (typeof contentToProcess === "string") {
        workbook = XLSX.read(contentToProcess, { type: "base64" });
      } else {
        workbook = XLSX.read(contentToProcess, {
          cellDates: true, // Keep dates as dates
          cellNF: true, // Keep number formatting
          cellStyles: true, // Keep cell styling
        });
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName ?? ""];
      if (!worksheet) {
        throw new Error("No worksheet found in the uploaded file");
      }

      // Use header:1 to get headers separately, then process actual rows
      const rawHeaders = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
      })[0] as string[];
      const cleanHeaders = rawHeaders.map((h) => h.trim()); // Clean headers

      // Get all rows with properly formatted headers
      const data = XLSX.utils.sheet_to_json(worksheet, {
        raw: false, // Convert everything to strings
        defval: "", // Default empty cells to empty string
        header: cleanHeaders, // Use clean headers
      });

      // Alert if no data
      if (!data.length) {
        throw new Error("No data found in Excel file");
      }

      return {
        headers: cleanHeaders,
        rows: data as Record<string, unknown>[],
      };
    }
  } catch (error) {
    console.error("File parsing error:", error);
    throw new Error(`Failed to parse file: ${(error as Error).message}`);
  }
}

/**
 * Find a matching column in the row data based on possible column names
 * Improved with more deterministic matching logic
 */
function findMatchingColumn(
  headers: string[],
  possibleColumns: string[],
): string | null {
  if (!headers.length || !possibleColumns.length) {
    return null;
  }

  // Normalize all headers (lowercase, remove spaces, special chars)
  const normalizedHeaders = headers.map((h) => ({
    original: h,
    normalized: h.toLowerCase().replace(/[^a-z0-9]/g, ""),
  }));

  // Try exact match first (case insensitive)
  for (const column of possibleColumns) {
    const normalizedColumn = column.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Check for exact match
    const exactMatch = normalizedHeaders.find(
      (h) =>
        h.normalized === normalizedColumn ||
        h.original.toLowerCase() === column.toLowerCase(),
    );

    if (exactMatch) {
      return exactMatch.original;
    }
  }

  // Try key word matching for more reliable partial matches
  for (const column of possibleColumns) {
    const columnWords = column.toLowerCase().split(/\s+/);

    for (const header of normalizedHeaders) {
      // Check if header contains all words in the column name
      if (
        columnWords.every(
          (word) => word.length > 2 && header.normalized.includes(word),
        )
      ) {
        return header.original;
      }
    }
  }

  // Try contains matching as last resort
  for (const column of possibleColumns) {
    const normalizedColumn = column.toLowerCase().replace(/[^a-z0-9]/g, "");

    for (const header of normalizedHeaders) {
      if (
        header.normalized.includes(normalizedColumn) &&
        normalizedColumn.length > 3
      ) {
        return header.original;
      }
    }
  }

  return null;
}

/**
 * Transform field value based on the specified transform type
 * Enhanced with better error handling and format support
 */
export function transformValue(value: unknown, transform?: string): unknown {
  // Handle null/undefined/empty values consistently
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  // Ensure we're working with a string for consistency
  const stringValue = String(value).trim();
  if (!stringValue) {
    return null;
  }

  try {
    switch (transform) {
      case "short_date":
        return formatShortDate(stringValue);
      case "long_date":
        return formatLongDate(stringValue);
      case "phone":
        return formatPhoneNumber(stringValue);
      case "time":
        return formatTimeValue(stringValue);
      case "provider":
        return formatProviderName(stringValue);
      case "text":
      default:
        return stringValue;
    }
  } catch (error) {
    console.warn(
      `Transform error for "${stringValue}" with transform "${transform}":`,
      error,
    );
    // Return original value if transformation fails
    return stringValue;
  }
}

/**
 * Enhanced date formatting with better format detection for birth dates
 * Fixed to properly handle 2-digit years in birth dates
 */
function formatShortDate(dateString: string): string {
  try {
    // Debugging log
    console.log(`Processing date: ${dateString}`);

    // Handle Excel date (number of days since 1/1/1900)
    if (!isNaN(Number(dateString))) {
      const excelDate = Number(dateString);
      if (excelDate > 1000) {
        // Likely a date if over 1000
        const date = new Date(Date.UTC(1900, 0, excelDate - 1));
        console.log(
          `Interpreted Excel date ${excelDate} as ${date.toISOString()}`,
        );
        return formatDate(date.toISOString());
      }
    }

    // For birth dates, we need a more aggressive threshold for 2-digit years
    // Most birth dates with 2-digit years should be interpreted as 19xx
    // since we're dealing with patient data

    // Try MM/DD/YY format first (US format)
    const mmddyyMatch = dateString.match(
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2})$/,
    );
    if (mmddyyMatch) {
      const [_, month, day, yearStr] = mmddyyMatch;
      let year = parseInt(yearStr);

      // For birth dates, assume any 2-digit year is 19xx unless it's > 23 (current year)
      // This handles most birth dates correctly
      const currentYear = new Date().getFullYear();
      const currentCentury = Math.floor(currentYear / 100) * 100;
      const twoDigitCurrentYear = currentYear % 100;

      // If year is a 2-digit number
      if (year < 100) {
        // If year is greater than current 2-digit year, it's likely from previous century
        // Otherwise, check if it's a reasonable birth year (under 110 years old)
        // For example: In 2025, "46" would be 1946, but "23" could be 2023 (recent birth)
        if (year > twoDigitCurrentYear) {
          // Definitely in the past (e.g., 46 in 2025 = 1946)
          year += currentCentury - 100;
          console.log(
            `Interpreted 2-digit year ${yearStr} as ${year} (previous century)`,
          );
        } else if (year < 30) {
          // Could be recent (within last 30 years) or distant past
          // For birth dates, check if this would make a person over 80 years old
          const possibleBirthYear = currentCentury + year;
          const age = currentYear - possibleBirthYear;

          if (age > 80) {
            // More likely a birth from previous century
            year += currentCentury - 100;
            console.log(
              `Interpreted 2-digit year ${yearStr} as ${year} (age > 80)`,
            );
          } else {
            year += currentCentury;
            console.log(
              `Interpreted 2-digit year ${yearStr} as ${year} (current century)`,
            );
          }
        } else {
          // Year is between 30-99, almost certainly previous century for birth dates
          year += currentCentury - 100;
          console.log(
            `Interpreted 2-digit year ${yearStr} as ${year} (previous century default)`,
          );
        }
      }

      // Validate the date
      const parsedDate = new Date(year, parseInt(month) - 1, parseInt(day));
      if (
        parsedDate.getFullYear() === year &&
        parsedDate.getMonth() === parseInt(month) - 1 &&
        parsedDate.getDate() === parseInt(day)
      ) {
        // Additional validation for birth dates - shouldn't be in the future
        if (parsedDate > new Date()) {
          console.warn(
            `Warning: Birth date ${dateString} parsed as future date ${year}-${month}-${day}`,
          );

          // If in the future, shift back by 100 years
          year -= 100;
          console.log(`Corrected future date to ${year}-${month}-${day}`);
        }

        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
    }

    // Try various other date formats
    const formatsToTry = [
      // Try DD/MM/YY format (European format)
      () => {
        const match = dateString.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2})$/);
        if (match) {
          const [_, day, month, yearStr] = match;
          let year = parseInt(yearStr);

          // Same 2-digit year logic as above
          const currentYear = new Date().getFullYear();
          const currentCentury = Math.floor(currentYear / 100) * 100;

          if (year < 100) {
            // For 2-digit years in birth dates, default to 19xx
            year += currentCentury - 100;
          }

          const parsedDate = new Date(year, parseInt(month) - 1, parseInt(day));
          if (
            parsedDate.getFullYear() === year &&
            parsedDate.getMonth() === parseInt(month) - 1 &&
            parsedDate.getDate() === parseInt(day)
          ) {
            // Check if date is in the future
            if (parsedDate > new Date()) {
              year -= 100; // Shift back by 100 years
            }

            return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
          }
          return null;
        }
        return null;
      },

      // Try MM/DD/YYYY format (US format with 4-digit year)
      () => {
        const match = dateString.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
        if (match) {
          const [_, month, day, yearStr] = match;
          const year = parseInt(yearStr);

          const parsedDate = new Date(year, parseInt(month) - 1, parseInt(day));
          if (
            parsedDate.getFullYear() === year &&
            parsedDate.getMonth() === parseInt(month) - 1 &&
            parsedDate.getDate() === parseInt(day)
          ) {
            return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
          }
          return null;
        }
        return null;
      },

      // Finally, try standard date parsing
      () => {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
          // Check if standard parsing produced a future date for a birth date
          if (date > new Date()) {
            console.warn(
              `Warning: Birth date ${dateString} parsed as future date ${date.toISOString()}`,
            );
            // For birth dates in the future, assume it's a century off
            date.setFullYear(date.getFullYear() - 100);
            console.log(`Corrected to ${date.toISOString()}`);
          }
          return formatDate(date.toISOString());
        }
        return null;
      },
    ];

    // Try each format until one works
    for (const formatFn of formatsToTry) {
      const result = formatFn();
      if (result) {
        console.log(`Successfully parsed date ${dateString} as ${result}`);
        return result;
      }
    }

    // If all else fails, return original
    console.warn(`Failed to parse date: ${dateString}, returning as-is`);
    return dateString;
  } catch (error) {
    console.error("Date parsing error:", error, dateString);
    return dateString;
  }
}

/**
 * Format a date for long date display (e.g., Tuesday, March 10, 2025)
 */
function formatLongDate(dateString: string): string {
  try {
    // Handle Excel date (number of days since 1/1/1900)
    if (!isNaN(Number(dateString))) {
      const excelDate = Number(dateString);
      const date = new Date(Date.UTC(1900, 0, excelDate - 1));
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    // Format as full date
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    return dateString;
  } catch (error) {
    return dateString;
  }
}

/**
 * Format a time value (handles various time formats)
 */
function formatTimeValue(timeString: string): string {
  try {
    // If it's a number, treat as Excel time (fraction of day)
    if (!isNaN(Number(timeString))) {
      const timeValue = Number(timeString);
      if (timeValue >= 0 && timeValue < 1) {
        const totalMinutes = Math.round(timeValue * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      }
    }

    // Handle various time formats with regex
    const formats = [
      // hh:mm:ss
      /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
      // hh:mm AM/PM
      /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|AM|PM)$/,
      // h AM/PM
      /^(\d{1,2})\s*(am|pm|AM|PM)$/,
    ];

    for (const regex of formats) {
      const match = timeString.match(regex);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2] ? parseInt(match[2], 10) : 0;
        const ampm = match[4]?.toLowerCase();

        // Adjust hours for AM/PM if present
        if (ampm === "pm" && hours < 12) {
          hours += 12;
        } else if (ampm === "am" && hours === 12) {
          hours = 0;
        }

        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      }
    }

    // Return original if no format matches
    return timeString;
  } catch (error) {
    return timeString;
  }
}

/**
 * Format provider name with proper capitalization
 */
function formatProviderName(providerName: string): string {
  try {
    // Normalize provider name format (capitalize properly)
    return providerName
      .split(" ")
      .map((word) => {
        // Handle common prefixes like "Dr." or suffixes like "MD"
        if (word.toUpperCase() === word && word.length <= 3) {
          return word.toUpperCase(); // Keep abbreviations uppercase
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(" ");
  } catch (error) {
    return providerName;
  }
}

/**
 * Process Excel or CSV file content according to campaign configuration
 * Enhanced with better deduplication, validation and error reporting
 */
export async function processExcelFile(
  fileContent: string | ArrayBuffer,
  fileName: string,
  config: any,
  orgId: string,
): Promise<any> {
  console.log("Processing file with enhanced processor");
  console.log("Config received:", JSON.stringify(config, null, 2));

  // Deep clone the config to avoid mutation issues
  let clonedConfig;
  try {
    clonedConfig = JSON.parse(JSON.stringify(config));
  } catch (e) {
    console.error("Failed to clone config:", e);
    clonedConfig = {};
  }

  // Default empty config structure if not properly defined
  const processConfig = {
    variables: {
      patient: {
        fields: Array.isArray(clonedConfig?.variables?.patient?.fields)
          ? clonedConfig.variables.patient.fields.filter(
              (f: any) => f && typeof f === "object",
            )
          : [],
        validation: clonedConfig?.variables?.patient?.validation || {
          requireValidPhone: false,
          requireValidDOB: false,
          requireName: false,
        },
      },
      campaign: {
        fields: Array.isArray(clonedConfig?.variables?.campaign?.fields)
          ? clonedConfig.variables.campaign.fields.filter(
              (f: any) => f && typeof f === "object",
            )
          : [],
      },
    },
  };

  // Ensure every field has the required properties
  processConfig.variables.patient.fields =
    processConfig.variables.patient.fields.map((field: any) => ({
      key: field.key || `field_${Math.random().toString(36).substring(2, 9)}`,
      label: field.label || field.key || "Unnamed Field",
      possibleColumns: Array.isArray(field.possibleColumns)
        ? field.possibleColumns
        : [field.key || ""],
      required: !!field.required,
      transform: field.transform || "text",
      ...(field.referencedTable && typeof field.referencedTable === "string"
        ? { referencedTable: field.referencedTable }
        : {}),
    }));

  processConfig.variables.campaign.fields =
    processConfig.variables.campaign.fields.map((field: any) => ({
      key: field.key || `field_${Math.random().toString(36).substring(2, 9)}`,
      label: field.label || field.key || "Unnamed Field",
      possibleColumns: Array.isArray(field.possibleColumns)
        ? field.possibleColumns
        : [field.key || ""],
      required: !!field.required,
      transform: field.transform || "text",
      ...(field.referencedTable && typeof field.referencedTable === "string"
        ? { referencedTable: field.referencedTable }
        : {}),
    }));

  console.log(
    "Sanitized processConfig:",
    JSON.stringify(processConfig, null, 2),
  );

  const patientService = new PatientService(db);
  const result = {
    validRows: [],
    invalidRows: [],
    stats: {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      uniquePatients: 0,
      duplicatePatients: 0,
      newPatients: 0,
      existingPatients: 0,
    },
    columnMappings: {},
    matchedColumns: [],
    unmatchedColumns: [],
    sampleRows: [],
    errors: [],
    rawFileUrl: "",
    processedFileUrl: "",
  };

  try {
    // Parse the file
    const { headers, rows } = parseFileContent(fileContent, fileName);
    result.stats.totalRows = rows.length;

    console.log(
      `Parsed ${rows.length} rows with headers: ${headers.join(", ")}`,
    );

    if (rows.length === 0) {
      throw new Error("No data found in the uploaded file");
    }

    // Validate that required config sections exist with better error handling
    if (
      (!processConfig.variables?.patient?.fields ||
        processConfig.variables.patient.fields.length === 0) &&
      (!processConfig.variables?.campaign?.fields ||
        processConfig.variables.campaign.fields.length === 0)
    ) {
      // If configuration is empty, use auto-mapping for all headers
      console.log("Missing config, attempting auto-mapping for all columns");

      // Auto-create field mappings for all headers
      processConfig.variables.patient.fields = [
        // Essential patient fields
        {
          key: "firstName",
          label: "First Name",
          possibleColumns: ["first name", "firstname", "first"],
          required: true,
          transform: "text",
        },
        {
          key: "lastName",
          label: "Last Name",
          possibleColumns: ["last name", "lastname", "last"],
          required: true,
          transform: "text",
        },
        {
          key: "dob",
          label: "Date of Birth",
          possibleColumns: ["dob", "date of birth", "birth date"],
          required: true,
          transform: "short_date",
        },
        {
          key: "primaryPhone",
          label: "Phone Number",
          possibleColumns: [
            "phone",
            "phone number",
            "primaryphone",
            "primary phone",
            "mobile",
            "cell",
          ],
          required: true,
          transform: "phone",
        },
      ];

      // Treat all remaining columns as campaign variables
      const essentialFields = [
        "first name",
        "firstname",
        "first",
        "last name",
        "lastname",
        "last",
        "dob",
        "date of birth",
        "birth date",
        "phone",
        "phone number",
        "primaryphone",
        "primary phone",
        "mobile",
        "cell",
      ];

      processConfig.variables.campaign.fields = headers
        .filter(
          (header) =>
            !essentialFields.some((ef) => header.toLowerCase().includes(ef)),
        )
        .map((header) => ({
          key: header.toLowerCase().replace(/[^a-z0-9]/g, "_"),
          label: header,
          possibleColumns: [header],
          required: false,
          transform: "text",
        }));

      console.log(
        "Auto-generated field mappings:",
        JSON.stringify(
          {
            patient: processConfig.variables.patient.fields,
            campaign: processConfig.variables.campaign.fields,
          },
          null,
          2,
        ),
      );
    }

    // Track all columns for reporting
    const allColumns = new Set(headers);
    const matchedColumns = new Set<string>();

    // Track column mappings for all fields
    const allColumnMappings: Record<string, string> = {};

    // Track unique patients for deduplication
    const patientHashes = new Map<string, number>();
    const patientIds = new Map<string, string>();

    // Store sample rows for preview
    const sampleValidRows: any[] = [];
    const sampleInvalidRows: any[] = [];

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      try {
        // Extract patient data with better logging
        console.log(`Extracting patient data for row ${i + 1}`);

        const {
          extractedData: patientData,
          columnMappings: patientColumnMappings,
          missingRequired: missingPatientFields,
        } = extractFields(row, headers, processConfig.variables.patient.fields);

        console.log(`Patient data extracted:`, JSON.stringify(patientData));
        console.log(
          `Patient column mappings:`,
          JSON.stringify(patientColumnMappings),
        );

        // Track matched columns
        Object.values(patientColumnMappings).forEach((col) =>
          matchedColumns.add(col),
        );

        // Merge column mappings
        Object.assign(allColumnMappings, patientColumnMappings);

        // Check for missing required patient fields
        if (missingPatientFields.length > 0) {
          throw new Error(
            `Missing required patient fields: ${missingPatientFields.join(", ")}`,
          );
        }

        // Validate patient data
        const validationError = validatePatientData(
          patientData,
          processConfig.variables.patient.validation,
        );
        if (validationError) {
          throw new Error(validationError);
        }

        // Extract campaign data
        console.log(`Extracting campaign data for row ${i + 1}`);

        const {
          extractedData: campaignData,
          columnMappings: campaignColumnMappings,
          missingRequired: missingCampaignFields,
        } = extractFields(
          row,
          headers,
          processConfig.variables.campaign.fields,
        );

        console.log(`Campaign data extracted:`, JSON.stringify(campaignData));
        console.log(
          `Campaign column mappings:`,
          JSON.stringify(campaignColumnMappings),
        );

        // Track matched columns
        Object.values(campaignColumnMappings).forEach((col) =>
          matchedColumns.add(col),
        );

        // Merge column mappings
        Object.assign(allColumnMappings, campaignColumnMappings);

        // Check for missing required campaign fields
        if (missingCampaignFields.length > 0) {
          throw new Error(
            `Missing required campaign fields: ${missingCampaignFields.join(", ")}`,
          );
        }

        // Generate patient hash for deduplication with improved phone handling
        let patientHash: string | null = null;
        let patientId: string | null = null;
        let isNewPatient = true;

        // Make sure we have minimum required patient data
        if (
          patientData.firstName &&
          patientData.lastName &&
          (patientData.primaryPhone ||
            patientData.phone ||
            patientData.phoneNumber) &&
          patientData.dob
        ) {
          // Make sure we have a phone number in a standard field
          const phoneToUse =
            patientData.primaryPhone ||
            patientData.phone ||
            patientData.phoneNumber;

          if (!phoneToUse) {
            throw new Error("No valid phone number found for patient");
          }

          // Generate primary hash
          patientHash = patientService.generatePatientHash(
            String(patientData.firstName),
            String(patientData.lastName),
            String(patientData.dob),
            String(phoneToUse),
          );

          console.log(
            `Generated patient hash: ${patientHash} for row ${i + 1}`,
          );

          // Check if this patient has been seen before in this file
          if (patientHashes.has(patientHash)) {
            result.stats.duplicatePatients++;
            const originalRowIndex = patientHashes.get(patientHash);
            console.log(
              `Duplicate patient found in rows ${originalRowIndex} and ${i + 2}`,
            );

            // Use existing patient ID if available
            patientId = patientIds.get(patientHash) || null;
            isNewPatient = false;
          } else {
            patientHashes.set(patientHash, i + 2); // Store 1-based row index for reporting
            result.stats.uniquePatients++;

            // Find or create patient record
            try {
              const patient = await patientService.findOrCreatePatient({
                firstName: String(patientData.firstName),
                lastName: String(patientData.lastName),
                dob: String(patientData.dob),
                phone: String(phoneToUse),
                emrId:
                  patientData.emrId || patientData.patientNumber
                    ? String(patientData.emrId || patientData.patientNumber)
                    : undefined,
                orgId,
              });

              if (patient) {
                patientId = patient.id;
                patientIds.set(patientHash, patientId);
                isNewPatient = patient.isNewPatient;

                // Update stats
                if (isNewPatient) {
                  result.stats.newPatients++;
                } else {
                  result.stats.existingPatients++;
                }

                console.log(
                  `Patient ID: ${patientId}, isNewPatient: ${isNewPatient}`,
                );
              }
            } catch (error) {
              console.error("Error finding/creating patient:", error);
              throw new Error(
                `Patient record error: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }
        } else {
          // Log which fields are missing
          const missingFields = [];
          if (!patientData.firstName) missingFields.push("firstName");
          if (!patientData.lastName) missingFields.push("lastName");
          if (!patientData.dob) missingFields.push("dob");
          if (
            !(
              patientData.primaryPhone ||
              patientData.phone ||
              patientData.phoneNumber
            )
          ) {
            missingFields.push("phone number");
          }

          console.warn(
            `Missing patient data for row ${i + 1}: ${missingFields.join(", ")}`,
          );
        }

        // Create a structured valid row
        const processedRow = {
          id: nanoid(),
          isValid: true,
          patientId,
          patientHash,
          patientData,
          campaignData,
          isNewPatient,
          validationErrors: [],
        };

        // Add to valid rows with properly structured data
        result.validRows.push({
          patientId,
          patientHash,
          variables: {
            ...patientData, // Patient data
            ...campaignData, // Campaign data
          },
        });

        // Add to sample rows for preview (up to 5)
        if (sampleValidRows.length < 5) {
          sampleValidRows.push(processedRow);
        }

        result.stats.validRows++;
      } catch (error) {
        // Handle row processing errors
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`Error processing row ${i + 1}:`, errorMessage);

        // Add to invalid rows with detailed context
        const invalidRow = {
          id: nanoid(),
          index: i + 2, // +2 for 1-based index and header row
          isValid: false,
          rawData: row,
          error: errorMessage,
          validationErrors: [errorMessage],
          patientData: {}, // Default empty objects
          campaignData: {},
        };

        // Try to extract partial data even if validation failed
        try {
          // Get whatever patient data we can
          const { extractedData: partialPatientData } = extractFields(
            row,
            headers,
            processConfig.variables.patient.fields,
            false, // Don't require fields for invalid rows
          );

          // Get whatever campaign data we can
          const { extractedData: partialCampaignData } = extractFields(
            row,
            headers,
            processConfig.variables.campaign.fields,
            false, // Don't require fields for invalid rows
          );

          // Add partial data to the invalid row
          invalidRow.patientData = partialPatientData;
          invalidRow.campaignData = partialCampaignData;
        } catch (e) {
          // Ignore extraction errors for invalid rows
          console.warn(
            `Couldn't extract partial data for invalid row ${i + 1}:`,
            e,
          );
        }

        result.invalidRows.push(invalidRow);

        // Add to sample invalid rows for preview (up to 5)
        if (sampleInvalidRows.length < 5) {
          sampleInvalidRows.push(invalidRow);
        }

        result.stats.invalidRows++;
      }
    }

    // Add all sample rows
    result.sampleRows = [...sampleValidRows, ...sampleInvalidRows];

    // Store overall column mappings
    result.columnMappings = allColumnMappings;

    // Calculate unmatched columns
    result.matchedColumns = Array.from(matchedColumns);
    result.unmatchedColumns = Array.from(allColumns).filter(
      (col) => !matchedColumns.has(col),
    );

    // Collect general errors and warnings
    if (result.validRows.length === 0 && rows.length > 0) {
      result.errors.push("No valid rows could be processed from the file");
    }

    if (result.unmatchedColumns.length > 0) {
      console.warn(`Unmatched columns: ${result.unmatchedColumns.join(", ")}`);
      result.errors.push(
        `${result.unmatchedColumns.length} columns were not mapped: ${result.unmatchedColumns.join(", ")}`,
      );
    }

    console.log("File processing complete with stats:", {
      totalRows: result.stats.totalRows,
      validRows: result.stats.validRows,
      invalidRows: result.stats.invalidRows,
      uniquePatients: result.stats.uniquePatients,
      duplicatePatients: result.stats.duplicatePatients,
    });

    // Generate file IDs for storage references
    const fileId = nanoid();
    result.rawFileUrl = `/uploads/${fileId}_raw.${fileName.split(".").pop()}`;
    result.processedFileUrl = `/uploads/${fileId}_processed.xlsx`;
  } catch (error) {
    console.error("File processing error:", error);
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

/**
 * Extract field values from a row with improved error handling
 */
function extractFields(
  row: Record<string, unknown>,
  headers: string[],
  fields: Array<any>,
  enforceRequired = true,
): {
  extractedData: Record<string, unknown>;
  columnMappings: Record<string, string>;
  missingRequired: string[];
} {
  const extractedData: Record<string, unknown> = {};
  const columnMappings: Record<string, string> = {};
  const missingRequired: string[] = [];

  // Safety check for fields
  if (!Array.isArray(fields)) {
    console.warn("Fields is not an array:", fields);
    return { extractedData, columnMappings, missingRequired };
  }

  // Process each field with careful error handling
  for (let i = 0; i < fields.length; i++) {
    try {
      const field = fields[i];

      // Skip if field is not properly defined
      if (!field || typeof field !== "object") {
        console.warn(`Skipping invalid field at index ${i}:`, field);
        continue;
      }

      // Skip if key or possibleColumns are missing
      if (!field.key || !Array.isArray(field.possibleColumns)) {
        console.warn(
          `Skipping field with missing key or possibleColumns at index ${i}:`,
          field,
        );
        continue;
      }

      // Find matching column safely
      const columnName = findMatchingColumn(headers, field.possibleColumns);

      if (columnName) {
        // Record the column mapping
        columnMappings[field.key] = columnName;

        // Get the raw value from the row
        const rawValue = row[columnName];

        // Safe handling of referenced table lookup
        const hasReferencedTable =
          field !== null &&
          field !== undefined &&
          "referencedTable" in field &&
          field.referencedTable !== null &&
          field.referencedTable !== undefined &&
          typeof field.referencedTable === "string";

        if (hasReferencedTable) {
          // Store raw value for referenced table lookups
          extractedData[field.key] = rawValue;
          console.log(`Stored raw value for referenced field ${field.key}`);
        } else {
          // Normal field transformation with error handling
          try {
            extractedData[field.key] = transformValue(
              rawValue,
              field.transform,
            );
          } catch (transformError) {
            console.error(
              `Error transforming value for field ${field.key}:`,
              transformError,
            );
            // Store raw value as fallback
            extractedData[field.key] = rawValue;
          }
        }
      } else if (field.required === true && enforceRequired) {
        // Track missing required fields
        missingRequired.push(field.label || field.key);
      }
    } catch (fieldError) {
      // Catch any errors during field processing to prevent complete failure
      console.error(`Error processing field at index ${i}:`, fieldError);
    }
  }

  return { extractedData, columnMappings, missingRequired };
}

/**
 * Validate a patient record against the configuration
 * Enhanced with more detailed validation
 */
function validatePatientData(
  patientData: Record<string, unknown>,
  validation: {
    requireValidPhone: boolean;
    requireValidDOB: boolean;
    requireName: boolean;
  },
): string | null {
  // Default validation to false if not explicitly set
  const validationRules = {
    requireValidPhone: validation?.requireValidPhone === true,
    requireValidDOB: validation?.requireValidDOB === true,
    requireName: validation?.requireName === true,
  };

  console.log(
    "Validating patient data with rules:",
    JSON.stringify(validationRules),
  );
  console.log("Patient data to validate:", JSON.stringify(patientData));

  const errors = [];

  // Check for required phone with more lenient validation
  if (validationRules.requireValidPhone) {
    const phone =
      patientData.primaryPhone || patientData.phoneNumber || patientData.phone;

    if (!phone) {
      errors.push("Valid phone number is required");
    } else {
      // Basic phone validation - should have at least 7 digits (more lenient)
      const digitsOnly = String(phone).replace(/\D/g, "");
      if (digitsOnly.length < 7) {
        errors.push(
          `Phone number ${phone} does not appear to be valid (needs at least 7 digits)`,
        );
      }
    }
  }

  // Check for valid DOB with more lenient validation
  if (validationRules.requireValidDOB) {
    if (!patientData.dob) {
      errors.push("Date of birth is required");
    } else {
      try {
        // More lenient date validation
        const dateString = String(patientData.dob);
        const isValid = isValidDate(dateString);

        if (!isValid) {
          // Try to parse as a number (Excel date)
          const numValue = parseFloat(dateString);
          if (!isNaN(numValue) && numValue > 1000) {
            // Likely an Excel date, consider it valid
            console.log(`Accepting Excel date format: ${dateString}`);
          } else {
            errors.push(
              `Date of birth "${patientData.dob}" is not a valid date`,
            );
          }
        }
      } catch (e) {
        console.warn(`Date validation error for "${patientData.dob}":`, e);
        errors.push(`Date of birth "${patientData.dob}" validation error`);
      }
    }
  }

  // Check for name with more lenient validation
  if (validationRules.requireName) {
    if (
      (!patientData.firstName || String(patientData.firstName).trim() === "") &&
      (!patientData.lastName || String(patientData.lastName).trim() === "")
    ) {
      errors.push("At least one name field (first or last name) is required");
    }
  }

  if (errors.length > 0) {
    return errors.join("; ");
  }

  return null;
}

/**
 * Extract unique patients from processed rows
 * Enhanced with better duplication handling
 */
export function extractUniquePatients(
  processedRows: {
    patientId: string | null;
    patientHash: string | null;
    variables: Record<string, unknown>;
  }[],
): Record<string, Record<string, unknown>> {
  const uniquePatients: Record<string, Record<string, unknown>> = {};
  const uniqueIds = new Set<string>();

  processedRows.forEach((row) => {
    // First prioritize actual patient IDs (which come from database lookups)
    if (row.patientId && !uniqueIds.has(row.patientId)) {
      uniqueIds.add(row.patientId);
      uniquePatients[row.patientId] = row.variables;
    }
    // Fall back to hash-based deduplication
    else if (
      row.patientHash &&
      !Object.keys(uniquePatients).includes(row.patientHash)
    ) {
      // Only add if we don't already have this patient by ID
      if (!row.patientId || !uniqueIds.has(row.patientId)) {
        uniquePatients[row.patientHash] = row.variables;
      }
    }
  });

  return uniquePatients;
}
