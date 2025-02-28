// src/lib/format-utils.ts

/**
 * Format a phone number by removing all non-numeric characters
 * @param phone Phone number to format
 * @returns Formatted phone number with only digits
 */
export function formatPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Format a date string to ISO format (YYYY-MM-DD)
 * @param dateString Date string to format
 * @returns Formatted date string in ISO format
 */
export function formatDate(dateString: string): string {
  // Handle Excel serial dates
  if (/^\d+(\.\d+)?$/.test(dateString)) {
    const excelDate = parseFloat(dateString);
    // Excel dates start on January 1, 1900
    const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    return date.toISOString().split("T")[0] || "";
  }

  // Try to parse as date
  const date = new Date(dateString);

  // Check if valid date
  if (isNaN(date.getTime())) {
    // Try additional parsing for common formats
    const formats = [
      { regex: /(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/, order: [3, 1, 2] }, // MM/DD/YYYY or DD/MM/YYYY
      { regex: /(\d{2,4})[-/](\d{1,2})[-/](\d{1,2})/, order: [1, 2, 3] }, // YYYY/MM/DD
    ];

    for (const format of formats) {
      const match = dateString.match(format.regex);
      if (match) {
        const [, g1, g2, g3] = match;
        let year = parseInt(g1 || "");
        const month = parseInt(g2 || "");
        const day = parseInt(g3 || "");

        // Handle 2-digit years
        if (year < 100) {
          year += year < 50 ? 2000 : 1900;
        }

        // Create date from parts
        const parsedDate = new Date(year, month - 1, day);

        // Validate components match (handles invalid dates like 02/31/2023)
        if (
          parsedDate.getFullYear() === year &&
          parsedDate.getMonth() === month - 1 &&
          parsedDate.getDate() === day
        ) {
          return parsedDate.toISOString().split("T")[0] || "";
        }
      }
    }

    // Return the original if couldn't parse
    return dateString;
  }

  // Return ISO date string (YYYY-MM-DD)
  return date.toISOString().split("T")[0] || "";
}

/**
 * Format a time string to HH:MM format
 * @param timeString Time string to format
 * @returns Formatted time string in HH:MM format
 */
export function formatTime(timeString: string): string {
  // Handle numeric time (like Excel time)
  if (/^\d+(\.\d+)?$/.test(timeString)) {
    const excelTime = parseFloat(timeString);
    const totalSeconds = Math.round(excelTime * 24 * 60 * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }

  // Try to extract hours and minutes
  const timeRegex =
    /(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?(?:\s*(am|pm|AM|PM))?/;
  const match = timeString.match(timeRegex);

  if (match) {
    let [, hoursStr = "0", minutesStr = "0", , period] = match;
    let hours = parseInt(hoursStr);
    const minutes = parseInt(minutesStr);

    // Handle AM/PM
    if (period?.toLowerCase() === "pm" && hours < 12) {
      hours += 12;
    } else if (period?.toLowerCase() === "am" && hours === 12) {
      hours = 0;
    }

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }

  // Return the original if couldn't parse
  return timeString;
}

/**
 * Check if a date string is valid
 * @param dateString Date string to check
 * @returns True if the date string is valid
 */
export function isValidDate(dateString: string): boolean {
  // Try to format the date
  const formattedDate = formatDate(dateString);

  // If the formatted date is the same as the input, it wasn't parsed successfully
  if (formattedDate === dateString && !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false;
  }

  // Create a date from the formatted date
  const date = new Date(formattedDate);

  // Check if the date is valid
  return !isNaN(date.getTime());
}

/**
 * Format a string for comparison (lowercase, trim, etc.)
 * @param str String to normalize
 * @returns Normalized string
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remove diacritics
}

/**
 * Deep clean object values (trim strings, format dates, etc.)
 * @param obj Object to clean
 * @returns Cleaned object
 */
export function cleanObjectValues<T extends Record<string, unknown>>(
  obj: T,
): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = value.trim();
    } else if (value instanceof Date) {
      result[key] = value;
    } else if (value === null || value === undefined) {
      result[key] = null;
    } else if (typeof value === "object" && !Array.isArray(value)) {
      result[key] = cleanObjectValues(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Format a number as currency
 * @param value Number to format
 * @param currency Currency code (default: USD)
 * @returns Formatted currency string
 */
export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

/**
 * Format a number as a percentage
 * @param value Number to format
 * @param decimals Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals = 1): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}
