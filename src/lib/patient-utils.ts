// src/lib/patient-utils.ts
import { createHash } from "crypto";

/**
 * Generate a hash for patient deduplication based on phone and DOB
 * @param phone The patient's phone number
 * @param dob The patient's date of birth
 * @returns A hash string for deduplication
 */
export function generatePatientHash(phone: string, dob: string): string {
  // Normalize inputs
  const normalizedPhone = normalizePhone(phone);
  const normalizedDob = normalizeDob(dob);

  // Create a hash using SHA-256
  const hash = createHash("sha256");
  hash.update(`${normalizedPhone}-${normalizedDob}`);
  return hash.digest("hex");
}

/**
 * Normalize a phone number by removing all non-digit characters
 * @param phone The phone number to normalize
 * @returns Normalized phone number with only digits
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Normalize a date of birth to YYYY-MM-DD format
 * @param dob The date of birth to normalize
 * @returns Normalized date in YYYY-MM-DD format
 */
function normalizeDob(dob: string): string {
  // Try to parse the date
  const date = new Date(dob);
  if (isNaN(date.getTime())) {
    // If parsing fails, return original string
    return dob;
  }

  // Format as YYYY-MM-DD
  return date.toISOString().split("T")[0] || "";
}

/**
 * Format a patient's name
 * @param firstName First name
 * @param lastName Last name
 * @returns Formatted full name
 */
export function formatPatientName(
  firstName?: string,
  lastName?: string,
): string {
  if (!firstName && !lastName) {
    return "Unknown Patient";
  }

  if (!firstName) {
    return lastName || "";
  }

  if (!lastName) {
    return firstName;
  }

  return `${firstName} ${lastName}`;
}

/**
 * Calculate a patient's age from their date of birth
 * @param dob Date of birth string or Date object
 * @returns Age in years, or null if invalid date
 */
export function calculateAge(dob: string | Date): number | null {
  const birthDate = dob instanceof Date ? dob : new Date(dob);

  if (isNaN(birthDate.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  // Adjust age if birthday hasn't occurred yet this year
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
}

/**
 * Check if a patient is a minor (under 18 years old)
 * @param dob Date of birth string or Date object
 * @returns True if patient is a minor, false otherwise
 */
export function isMinor(dob: string | Date): boolean {
  const age = calculateAge(dob);
  return age !== null && age < 18;
}

/**
 * Format a phone number for display
 * @param phone Raw phone number
 * @returns Formatted phone number (e.g., (555) 123-4567)
 */
export function formatDisplayPhone(phone: string): string {
  // Remove non-digit characters
  const digits = phone.replace(/\D/g, "");

  // Format based on length
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits[0] === "1") {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // Return original if not standard format
  return phone;
}

/**
 * Format a date for display
 * @param date Date string or Date object
 * @returns Formatted date (e.g., Jan 1, 2023)
 */
export function formatDisplayDate(date: string | Date): string {
  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return String(date);
  }

  return dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
