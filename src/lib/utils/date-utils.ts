import { formatDistance } from "date-fns";

/**
 * Format a date as a human-readable distance string (e.g., "2 hours ago")
 */
export function formatDateDistance(date: Date | string | null): string {
  if (!date) return "";

  const dateObj = typeof date === "string" ? new Date(date) : date;
  return formatDistance(dateObj, new Date(), { addSuffix: true });
}
