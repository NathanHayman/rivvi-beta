import { patientService } from "@/services/patients";
import { nanoid } from "nanoid";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { formatDate, formatPhoneNumber, isValidDate } from "./utils/formatting";

/**
 * Creates a safe field object with proper defaults and careful property access
 */
function createSafeField(field: any): any {
  // Create a default safe field with all required properties
  const safeField: any = {
    key: "unknown",
    label: "Unnamed Field",
    possibleColumns: [],
    required: false,
    transform: "text",
    referencedTable: undefined, // Explicitly set undefined as default
    defaultValue: undefined, // Add explicit default value property
  };

  try {
    // Only proceed if field is a valid object
    if (!field || typeof field !== "object") {
      return safeField;
    }

    // Safe property access
    if (typeof field.key === "string") {
      safeField.key = field.key;
    }

    if (typeof field.label === "string") {
      safeField.label = field.label;
    }

    if (Array.isArray(field.possibleColumns)) {
      safeField.possibleColumns = [...field.possibleColumns];
    }

    safeField.required = !!field.required;

    if (typeof field.transform === "string") {
      safeField.transform = field.transform;
    }

    // Handle default value if present (can be any type)
    if (field.defaultValue !== undefined) {
      safeField.defaultValue = field.defaultValue;
    }

    // Handle referenced table
    if (
      Object.prototype.hasOwnProperty.call(field, "referencedTable") &&
      typeof field.referencedTable === "string"
    ) {
      safeField.referencedTable = field.referencedTable;
    }

    return safeField;
  } catch (error) {
    console.error("Error creating safe field:", error);
    return safeField;
  }
}

/**
 * Generate a consistent patient hash from patient data
 */
function generatePatientHash(
  patientData: Record<string, unknown>,
): string | null {
  // Make sure we have minimum required patient data
  if (!patientData) return null;

  try {
    // Make sure we have a phone number in a standard field
    const phoneToUse =
      patientData.primaryPhone || patientData.phone || patientData.phoneNumber;

    if (
      patientData.firstName &&
      patientData.lastName &&
      phoneToUse &&
      patientData.dob
    ) {
      // Generate primary hash
      return patientService.generatePatientHash(
        String(patientData.firstName),
        String(patientData.lastName),
        String(patientData.dob),
        String(phoneToUse),
      );
    } else if (patientData.lastName && phoneToUse && patientData.dob) {
      // Generate secondary hash if missing first name
      return patientService.generateSecondaryHash(
        String(patientData.lastName),
        String(patientData.dob),
        String(phoneToUse),
      );
    }
  } catch (error) {
    console.error("Error generating patient hash:", error);
  }

  return null;
}

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
      const parseResult = Papa.parse(contentToProcess as string, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => {
          // Clean up header name
          return header.trim();
        },
      });

      // Alert if no data or parse errors
      if (parseResult.errors && parseResult.errors.length > 0) {
        console.error("CSV parse errors:", parseResult.errors);
        if (parseResult.errors.some((e) => e.type === "Delimiter")) {
          throw new Error(
            "CSV parse error: Could not detect delimiter. Please ensure your CSV is properly formatted.",
          );
        }
        throw new Error(
          `CSV parse error: ${parseResult.errors[0].message}. Row: ${parseResult.errors[0].row}`,
        );
      }

      if (!parseResult.data || parseResult.data.length === 0) {
        throw new Error("No data found in CSV file");
      }

      // Get headers from Papa.parse
      const headers = parseResult.meta.fields?.map((h) => h.trim()) || [];

      return {
        headers,
        rows: parseResult.data as Record<string, unknown>[],
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
    console.log("Missing headers or possibleColumns", {
      headersPresent: !!headers.length,
      possibleColumnsPresent: !!possibleColumns.length,
      headersLength: headers.length,
      possibleColumnsLength: possibleColumns.length,
    });
    return null;
  }

  // Debug logging for matching attempts
  console.log("Finding matching column with inputs:", {
    headers,
    possibleColumns,
  });

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
      console.log(`Found exact match: ${exactMatch.original} for ${column}`);
      return exactMatch.original;
    }
  }

  // Try key word matching for more reliable partial matches
  for (const column of possibleColumns) {
    const columnWords = column.toLowerCase().split(/\s+/);

    for (const header of normalizedHeaders) {
      // More lenient matching: if header contains ANY word in the column name that's more than 2 chars
      const anyWordMatch = columnWords.some(
        (word) => word.length > 2 && header.normalized.includes(word),
      );

      if (anyWordMatch) {
        console.log(`Found word match: ${header.original} for ${column}`);
        return header.original;
      }
    }
  }

  // Try contains matching as last resort - even more lenient now
  for (const column of possibleColumns) {
    const normalizedColumn = column.toLowerCase().replace(/[^a-z0-9]/g, "");

    for (const header of normalizedHeaders) {
      // More lenient now - match if there's any reasonable overlap
      if (
        header.normalized.includes(normalizedColumn) ||
        normalizedColumn.includes(header.normalized)
      ) {
        console.log(`Found contains match: ${header.original} for ${column}`);
        return header.original;
      }
    }
  }

  // Extra lenient last resort matching - try single word matches from possible columns
  for (const column of possibleColumns) {
    const columnWords = column.toLowerCase().split(/\s+/);

    // Try single words that might be distinctive identifiers
    for (const word of columnWords) {
      if (word.length >= 3) {
        // Only use words that are at least 3 characters
        for (const header of normalizedHeaders) {
          if (header.normalized.includes(word)) {
            console.log(
              `Found last resort word match: ${header.original} for word "${word}" from "${column}"`,
            );
            return header.original;
          }
        }
      }
    }
  }

  console.log(
    `No match found for possible columns: ${possibleColumns.join(", ")}`,
  );
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
      case "number":
        // Convert to number type with fallback
        const num = Number(stringValue);
        return isNaN(num) ? stringValue : num;
      case "boolean":
        // Convert to boolean based on common true/false values
        const lowerValue = stringValue.toLowerCase();
        if (["true", "yes", "y", "1"].includes(lowerValue)) return true;
        if (["false", "no", "n", "0"].includes(lowerValue)) return false;
        return Boolean(stringValue);
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
  try {
    console.log("Config received:", JSON.stringify(config, null, 2));

    // Ensure config has safe defaults
    if (!config) {
      config = {
        variables: {
          patient: {
            fields: [],
            validation: {
              requireValidPhone: false,
              requireValidDOB: false,
              requireName: false,
            },
          },
          campaign: { fields: [] },
        },
      };
    }

    // Check if the config has patient/campaign at top level instead of inside variables
    if (config.patient || config.campaign) {
      // If variables exists but is empty, we should use the top-level fields
      const hasEmptyVariables =
        config.variables &&
        !config.variables.patient?.fields?.length &&
        !config.variables.campaign?.fields?.length;

      // If variables doesn't exist or is empty, use the top-level structure
      if (!config.variables || hasEmptyVariables) {
        console.log(
          "Excel processor: Found top-level patient/campaign structure, restructuring config",
        );

        // Create or update the variables object
        config.variables = {
          patient: config.patient || {
            fields: [],
            validation: {
              requireValidPhone: false,
              requireValidDOB: false,
              requireName: false,
            },
          },
          campaign: config.campaign || { fields: [] },
        };

        // Remove the top-level properties to avoid duplication
        delete config.patient;
        delete config.campaign;
      }
    }

    // Ensure config.variables exists
    if (!config.variables) {
      config.variables = {
        patient: {
          fields: [],
          validation: {
            requireValidPhone: false,
            requireValidDOB: false,
            requireName: false,
          },
        },
        campaign: { fields: [] },
      };
    }

    // Ensure patient section exists
    if (!config.variables.patient) {
      config.variables.patient = {
        fields: [],
        validation: {
          requireValidPhone: false,
          requireValidDOB: false,
          requireName: false,
        },
      };
    }

    // Ensure campaign section exists
    if (!config.variables.campaign) {
      config.variables.campaign = { fields: [] };
    }

    // Sanitize all fields to prevent undefined property access issues
    if (Array.isArray(config.variables.patient.fields)) {
      config.variables.patient.fields =
        config.variables.patient.fields.map(createSafeField);
    } else {
      config.variables.patient.fields = [];
    }

    if (Array.isArray(config.variables.campaign.fields)) {
      config.variables.campaign.fields =
        config.variables.campaign.fields.map(createSafeField);
    } else {
      config.variables.campaign.fields = [];
    }

    // Default empty config structure if not properly defined
    const processConfig = {
      variables: {
        patient: {
          fields: (config.variables?.patient?.fields || [])
            .filter((f: any) => f && typeof f === "object")
            .map((f: any) => {
              try {
                return createSafeField(f);
              } catch (error) {
                console.error("Error creating safe field:", error);
                // Return a default safe field if error occurs
                return {
                  key: "unknown_field",
                  label: "Unnamed Field",
                  possibleColumns: [],
                  required: false,
                  transform: "text",
                  referencedTable: undefined,
                };
              }
            }),
          validation: config.variables?.patient?.validation || {
            requireValidPhone: false,
            requireValidDOB: false,
            requireName: false,
          },
        },
        campaign: {
          fields: (config.variables?.campaign?.fields || [])
            .filter((f: any) => f && typeof f === "object")
            .map((f: any) => {
              try {
                return createSafeField(f);
              } catch (error) {
                console.error("Error creating safe field:", error);
                // Return a default safe field if error occurs
                return {
                  key: "unknown_field",
                  label: "Unnamed Field",
                  possibleColumns: [],
                  required: false,
                  transform: "text",
                  referencedTable: undefined,
                };
              }
            }),
        },
      },
    };

    console.log(
      "Sanitized processConfig:",
      JSON.stringify(processConfig, null, 2),
    );

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
      parsedData: { rows: [], headers: [] },
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

        // Generate campaign fields from remaining headers
        processConfig.variables.campaign.fields = headers
          .filter(
            (header) =>
              ![
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
              ].some((col) => col.toLowerCase() === header.toLowerCase()),
          )
          .map((header) => ({
            key: header.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase(),
            label: header,
            possibleColumns: [header],
            required: false,
            transform: "text",
          }));
      }

      // Create a list of all allowed field keys from the configuration
      const allowedPatientKeys = processConfig.variables.patient.fields.map(
        (field) => field.key,
      );
      const allowedCampaignKeys = processConfig.variables.campaign.fields.map(
        (field) => field.key,
      );
      const allAllowedKeys = [...allowedPatientKeys, ...allowedCampaignKeys];

      console.log("Allowed field keys:", allAllowedKeys);

      // Get mappable columns from config
      const allPossibleColumns = [
        ...(processConfig.variables.patient?.fields || []),
        ...(processConfig.variables.campaign?.fields || []),
      ].flatMap((field) => field.possibleColumns || []);

      // Extract unique possible column values for matching
      const uniquePossibleColumns = new Set(
        allPossibleColumns.map((col) => col.toLowerCase()),
      );

      console.log(
        "All possible columns from config:",
        Array.from(uniquePossibleColumns),
      );

      // Track column usage for reporting
      const allColumns = new Set(headers);
      const matchedColumns = new Set<string>();
      const allColumnMappings: Record<string, string> = {};

      // Sample rows for preview
      const sampleValidRows: any[] = [];
      const sampleInvalidRows: any[] = [];

      // Track unique patients to avoid duplicates
      const uniquePatients: Record<string, any> = {};

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
          } = extractFields(
            row,
            headers,
            processConfig.variables.patient.fields,
          );

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

          // Track matched columns from campaign fields
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

          // Generate patient hash for deduplication
          let patientHash: string | null = null;
          const patientId: string | null = null;
          const isNewPatient = true;

          // Try to create a hash if we have enough patient information
          if (
            patientData.primaryPhone ||
            (patientData.firstName && patientData.lastName && patientData.dob)
          ) {
            try {
              // Create a consistent patient hash for deduplication
              patientHash = generatePatientHash(patientData);

              if (patientHash) {
                // Check if this patient was already in this file
                if (uniquePatients[patientHash]) {
                  result.stats.duplicatePatients++;
                  throw new Error(
                    `Duplicate patient in file: ${patientData.firstName} ${patientData.lastName}`,
                  );
                }

                // For this example, we'll just mark all patients as new since we don't have a findByHash method
                // In a real implementation, you would check if the patient exists in the database
                result.stats.newPatients++;

                // Add to unique patients in this file
                uniquePatients[patientHash] = {
                  patientData,
                  campaignData,
                };
                result.stats.uniquePatients++;
              }
            } catch (hashError) {
              console.error("Error generating patient hash:", hashError);
              // Continue processing even if hashing fails
            }
          }

          // Add to valid rows with properly structured data
          // IMPORTANT: Only include variables from the defined fields in the config
          const combinedVariables = {
            ...patientData, // Patient data from defined fields
            ...campaignData, // Campaign data from defined fields
          };

          // Add campaign field defaults if any are missing
          processConfig.variables.campaign.fields.forEach((field) => {
            if (
              combinedVariables[field.key] === undefined &&
              field.defaultValue !== undefined
            ) {
              combinedVariables[field.key] = field.defaultValue;
              console.log(
                `Added default value for campaign field ${field.key}: ${field.defaultValue}`,
              );
            }
          });

          // Create a structured valid row with ONLY the fields defined in the configuration
          const processedRow = {
            id: nanoid(),
            isValid: true,
            patientId,
            patientHash,
            patientData,
            campaignData,
            isNewPatient,
            validationErrors: [],
            variables: combinedVariables,
          };

          result.validRows.push({
            patientId,
            patientHash,
            variables: combinedVariables,
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

      // Only show warnings for columns we might care about (in the possible columns list)
      result.unmatchedColumns = Array.from(allColumns).filter((col) => {
        // If not in matched columns and is in the possible columns list, highlight it
        const isUnmatched = !matchedColumns.has(col);
        const isPossible = Array.from(uniquePossibleColumns).some(
          (possibleCol) =>
            col.toLowerCase().includes(possibleCol.toLowerCase()) ||
            possibleCol.toLowerCase().includes(col.toLowerCase()),
        );

        return isUnmatched && isPossible;
      });

      // Collect general errors and warnings
      if (result.validRows.length === 0 && rows.length > 0) {
        result.errors.push("No valid rows could be processed from the file");
      }

      if (result.unmatchedColumns.length > 0) {
        console.warn(
          `Unmatched columns that might be important: ${result.unmatchedColumns.join(", ")}`,
        );
        result.errors.push(
          `${result.unmatchedColumns.length} columns might match your configuration but weren't used: ${result.unmatchedColumns.join(", ")}`,
        );
      }

      // Collect processing results
      result.stats.validRows = result.validRows.length;
      result.stats.invalidRows = result.invalidRows.length;

      // Extract unique patients by hash
      const uniquePatientsMap = extractUniquePatients(
        result.validRows.map((row) => ({
          patientId: row.patientId || null,
          patientHash: row.patientHash || null,
          variables: row.variables || {},
        })),
      );

      result.stats.uniquePatients = Object.keys(uniquePatientsMap).length;
      result.stats.duplicatePatients =
        result.stats.validRows - result.stats.uniquePatients;

      // Add sample rows for review
      if (result.validRows.length > 0) {
        result.sampleRows = result.validRows.slice(0, 5).map((row) => ({
          ...row,
          variables: { ...row.variables },
        }));
      }

      // Log summary
      console.log(`File processing complete with stats:`, {
        totalRows: result.stats.totalRows,
        validRows: result.stats.validRows,
        invalidRows: result.stats.invalidRows,
        uniquePatients: result.stats.uniquePatients,
        duplicatePatients: result.stats.duplicatePatients,
        matchedColumnsCount: (result.matchedColumns || []).length,
      });

      // Make sure matchedColumns is always set explicitly
      if (!result.matchedColumns || !Array.isArray(result.matchedColumns)) {
        result.matchedColumns = [];

        // Try to extract matched columns from columnMappings if available
        if (
          result.columnMappings &&
          typeof result.columnMappings === "object"
        ) {
          const uniqueColumns = new Set<string>();
          Object.values(result.columnMappings).forEach((col) => {
            if (typeof col === "string") uniqueColumns.add(col);
          });
          result.matchedColumns = Array.from(uniqueColumns);
        }
      }

      // Log column mapping information
      console.log("Column matching results:", {
        matchedColumnsCount: result.matchedColumns.length,
        matchedColumns: result.matchedColumns,
        hasColumnMappings:
          !!result.columnMappings &&
          Object.keys(result.columnMappings || {}).length > 0,
      });

      // Add parsedData property to align with what validateData function expects
      result.parsedData = {
        rows: result.validRows.map((row) => ({
          patientId: row.patientId || null,
          patientHash: row.patientHash || null,
          variables: row.variables || {},
        })),
        headers: result.matchedColumns || [],
      };

      // Explicitly check that parsedData.rows is populated when there are valid rows
      if (
        result.stats.validRows > 0 &&
        (!result.parsedData.rows || result.parsedData.rows.length === 0)
      ) {
        console.warn(
          "Stats show valid rows but parsedData.rows is empty, fixing...",
        );
        // Force parsedData.rows to have at least one entry if validRows count is positive
        if (result.validRows.length > 0) {
          result.parsedData.rows = result.validRows.map((row) => ({
            patientId: row.patientId || null,
            patientHash: row.patientHash || null,
            variables: row.variables || {},
          }));
        }
      }

      // Generate file IDs for storage references
      const fileId = nanoid();
      result.rawFileUrl = `/uploads/${fileId}_raw.${fileName.split(".").pop()}`;
      result.processedFileUrl = `/uploads/${fileId}_processed.xlsx`;
    } catch (error) {
      console.error("File processing error:", error);
      result.errors.push(
        error instanceof Error ? error.message : String(error),
      );
    }

    // Return detailed results
    return {
      ...result,
      error: null, // Explicitly set error to null on success
    };
  } catch (error) {
    console.error("Excel processor error:", error);
    return {
      error: {
        message:
          error instanceof Error
            ? error.message
            : "Unknown error processing Excel file",
        details: {
          fileName,
          errorType: error instanceof Error ? error.name : typeof error,
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
    };
  }
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
  let missingRequired: string[] = [];

  // Safety check for fields
  if (!Array.isArray(fields)) {
    console.warn("Fields is not an array:", fields);
    return { extractedData, columnMappings, missingRequired };
  }

  console.log(
    `Extracting fields from row with ${Object.keys(row).length} columns against ${fields.length} field definitions`,
  );

  // First pass - just collect what fields we can find
  for (let i = 0; i < fields.length; i++) {
    try {
      // Create a safe field object to prevent any undefined property access
      const originalField = fields[i];

      // Skip if original field is not an object
      if (!originalField || typeof originalField !== "object") {
        console.warn(`Skipping invalid field at index ${i}`);
        continue;
      }

      // Create a safe field object with explicit undefined for referencedTable if missing
      const field = createSafeField(originalField);

      console.log(
        `Looking for field "${field.key}" with possible columns:`,
        field.possibleColumns,
      );

      // Find matching column in headers for this field
      const matchingColumn = findMatchingColumn(headers, field.possibleColumns);

      if (matchingColumn) {
        // Get raw value from the matched column
        const rawValue = row[matchingColumn];

        // Apply transformation to convert the value to appropriate format
        const processedValue = transformValue(rawValue, field.transform);

        console.log(
          `Field "${field.key}" matched to column "${matchingColumn}". Raw value: "${rawValue}", Processed value: "${processedValue}"`,
        );

        // Store the processed value
        extractedData[field.key] = processedValue;

        // Store column mapping for reference
        columnMappings[field.key] = matchingColumn;
      } else if (field.required && enforceRequired) {
        // Track missing required fields
        missingRequired.push(field.key);
        console.warn(
          `Missing required field "${field.key}". Possible columns: ${field.possibleColumns.join(", ")}`,
        );
      } else {
        console.log(
          `Could not find match for field "${field.key}" (not required)`,
        );
      }
    } catch (err) {
      console.warn(`Error processing field at index ${i}:`, err);
    }
  }

  // Special handling for minimal data - if we have too few fields matched
  // but we have headers that look like they might contain patient data,
  // try to match them to common field names
  if (Object.keys(extractedData).length < 2) {
    console.log(
      "Very few fields matched, attempting fallback matching for basic fields",
    );

    // Try to find basic patient info in any form
    for (const header of headers) {
      const headerLower = header.toLowerCase();

      // Extract firstName if not already present
      if (
        !extractedData.firstName &&
        (headerLower.includes("first") || headerLower.includes("fname"))
      ) {
        const rawValue = row[header];
        extractedData.firstName = transformValue(rawValue, "text");
        columnMappings.firstName = header;
        console.log(`Fallback match: Using "${header}" for firstName`);
      }

      // Extract lastName if not already present
      if (
        !extractedData.lastName &&
        (headerLower.includes("last") || headerLower.includes("lname"))
      ) {
        const rawValue = row[header];
        extractedData.lastName = transformValue(rawValue, "text");
        columnMappings.lastName = header;
        console.log(`Fallback match: Using "${header}" for lastName`);
      }

      // Extract phone if not already present
      if (
        !extractedData.primaryPhone &&
        (headerLower.includes("phone") ||
          headerLower.includes("mobile") ||
          headerLower.includes("cell"))
      ) {
        const rawValue = row[header];
        extractedData.primaryPhone = transformValue(rawValue, "phone");
        columnMappings.primaryPhone = header;
        console.log(`Fallback match: Using "${header}" for primaryPhone`);
      }

      // Extract DOB if not already present
      if (
        !extractedData.dob &&
        (headerLower.includes("dob") ||
          headerLower.includes("birth") ||
          headerLower.includes("birthdate"))
      ) {
        const rawValue = row[header];
        extractedData.dob = transformValue(rawValue, "short_date");
        columnMappings.dob = header;
        console.log(`Fallback match: Using "${header}" for dob`);
      }
    }
  }

  // Clear required fields list if we found matches in the fallback process
  if (
    extractedData.firstName &&
    extractedData.lastName &&
    missingRequired.includes("firstName")
  ) {
    console.log(
      "Clearing some missing required fields because fallback matching found them",
    );
    missingRequired = missingRequired.filter(
      (field) =>
        field !== "firstName" &&
        field !== "lastName" &&
        field !== "primaryPhone" &&
        field !== "dob",
    );
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

  // More lenient phone validation
  if (validationRules.requireValidPhone) {
    const phone =
      patientData.primaryPhone || patientData.phoneNumber || patientData.phone;

    if (!phone) {
      // Instead of error, log a warning but accept it anyway if we have other patient identifiers
      if (patientData.firstName && patientData.lastName) {
        console.warn("Phone number missing but accepting row with name data");
      } else {
        errors.push("Valid phone number is required");
      }
    } else {
      // Super lenient phone validation - just need some digits
      const digitsOnly = String(phone).replace(/\D/g, "");
      if (digitsOnly.length < 5) {
        errors.push(
          `Phone number ${phone} does not appear to be valid (needs at least 5 digits)`,
        );
      }
    }
  }

  // More lenient DOB validation
  if (validationRules.requireValidDOB) {
    if (!patientData.dob) {
      // Instead of error, log a warning but accept it anyway if we have other patient identifiers
      if (
        patientData.primaryPhone ||
        (patientData.firstName && patientData.lastName)
      ) {
        console.warn(
          "DOB missing but accepting row with other identifier data",
        );
      } else {
        errors.push("Date of birth is required");
      }
    } else {
      try {
        // Super lenient date validation - almost any format is accepted
        const dateString = String(patientData.dob);
        const isValid = isValidDate(dateString);

        if (!isValid) {
          // Try to parse as a number (Excel date)
          const numValue = parseFloat(dateString);
          if (!isNaN(numValue)) {
            // Accept any numeric value
            console.log(`Accepting numeric date format: ${dateString}`);
          } else if (dateString.length >= 4) {
            // Accept any string with at least 4 characters that might represent a date
            console.log(`Accepting date-like string: ${dateString}`);
          } else {
            errors.push(
              `Date of birth "${patientData.dob}" does not look like a valid date`,
            );
          }
        }
      } catch (e) {
        console.warn(`Date validation error for "${patientData.dob}":`, e);
        // Accept it anyway for now
        console.log("Accepting value despite date validation error");
      }
    }
  }

  // Much more lenient name validation
  if (validationRules.requireName) {
    // If we have phone, we'll be lenient about names
    if (
      patientData.primaryPhone ||
      patientData.phoneNumber ||
      patientData.phone
    ) {
      if (!patientData.firstName && !patientData.lastName) {
        console.warn("Name fields missing but accepting row with phone data");
      }
    }
    // Otherwise require at least one name field
    else if (
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
    // Ensure we preserve the patientId in the variables
    if (row.patientId) {
      row.variables.patientId = row.patientId;
    }

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
