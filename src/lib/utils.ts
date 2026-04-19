import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, parseISO, isValid } from "date-fns";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type {
  CriticalityTier,
  DeploymentStatus,
  IncidentSeverity,
  IncidentStatus,
  TrendDirection,
} from "@/types";
import {
  SEVERITY_COLORS,
  STATUS_COLORS,
  TIER_COLORS,
  DEPLOYMENT_STATUS_COLORS,
  SEVERITY_BG_CLASSES,
  STATUS_BG_CLASSES,
  TIER_BG_CLASSES,
  APP_CONFIG,
} from "@/constants/constants";

// ============================================================
// Class Name Utility
// ============================================================

/**
 * Merges Tailwind CSS class names using clsx and tailwind-merge.
 * Handles conditional classes, arrays, and deduplication of conflicting utilities.
 *
 * @param inputs - Class values to merge
 * @returns Merged class name string
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ============================================================
// Date & Time Formatting
// ============================================================

/**
 * Formats a date string or Date object using the application's default date format.
 * Returns a formatted date string or a fallback value if the input is invalid.
 *
 * @param date - ISO8601 date string or Date object
 * @param formatStr - Optional format string (defaults to APP_CONFIG.DATE_FORMAT)
 * @returns Formatted date string or "—" if invalid
 */
export function formatDate(
  date: string | Date | null | undefined,
  formatStr?: string
): string {
  if (!date) return "—";

  try {
    const dateObj = typeof date === "string" ? parseISO(date) : date;

    if (!isValid(dateObj)) return "—";

    return format(dateObj, formatStr || APP_CONFIG.DATE_FORMAT);
  } catch {
    return "—";
  }
}

/**
 * Formats a date string or Date object using the application's default datetime format.
 *
 * @param date - ISO8601 date string or Date object
 * @returns Formatted datetime string or "—" if invalid
 */
export function formatDateTime(
  date: string | Date | null | undefined
): string {
  return formatDate(date, APP_CONFIG.DATETIME_FORMAT);
}

/**
 * Formats a date string or Date object using the application's default time format.
 *
 * @param date - ISO8601 date string or Date object
 * @returns Formatted time string or "—" if invalid
 */
export function formatTime(
  date: string | Date | null | undefined
): string {
  return formatDate(date, APP_CONFIG.TIME_FORMAT);
}

/**
 * Returns a human-readable relative time string (e.g., "5 minutes ago").
 *
 * @param date - ISO8601 date string or Date object
 * @returns Relative time string or "—" if invalid
 */
export function formatRelativeTime(
  date: string | Date | null | undefined
): string {
  if (!date) return "—";

  try {
    const dateObj = typeof date === "string" ? parseISO(date) : date;

    if (!isValid(dateObj)) return "—";

    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch {
    return "—";
  }
}

// ============================================================
// Number Formatting
// ============================================================

/**
 * Formats a number as a percentage string with configurable decimal places.
 *
 * @param value - The numeric value to format
 * @param decimals - Number of decimal places (default: 2)
 * @param includeSign - Whether to include the % sign (default: true)
 * @returns Formatted percentage string or "—" if invalid
 */
export function formatPercentage(
  value: number | null | undefined,
  decimals: number = 2,
  includeSign: boolean = true
): string {
  if (value === null || value === undefined || isNaN(value)) return "—";

  const formatted = value.toFixed(decimals);
  return includeSign ? `${formatted}%` : formatted;
}

/**
 * Formats a duration in minutes into a human-readable string.
 * Handles conversion to hours and days for larger values.
 *
 * @param minutes - Duration in minutes
 * @returns Formatted duration string (e.g., "45m", "2h 15m", "1d 3h")
 */
export function formatDuration(
  minutes: number | null | undefined
): string {
  if (minutes === null || minutes === undefined || isNaN(minutes)) return "—";

  if (minutes < 0) return "—";

  if (minutes < 1) {
    const seconds = Math.round(minutes * 60);
    return `${seconds}s`;
  }

  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }

  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  const days = Math.floor(minutes / 1440);
  const remainingHours = Math.floor((minutes % 1440) / 60);
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/**
 * Formats a number with locale-aware thousand separators.
 *
 * @param value - The numeric value to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted number string or "—" if invalid
 */
export function formatNumber(
  value: number | null | undefined,
  decimals: number = 0
): string {
  if (value === null || value === undefined || isNaN(value)) return "—";

  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formats a number in a compact notation (e.g., 1.2K, 3.5M).
 *
 * @param value - The numeric value to format
 * @returns Compact formatted string or "—" if invalid
 */
export function formatCompactNumber(
  value: number | null | undefined
): string {
  if (value === null || value === undefined || isNaN(value)) return "—";

  if (Math.abs(value) < 1000) {
    return value.toFixed(value % 1 === 0 ? 0 : 1);
  }

  if (Math.abs(value) < 1_000_000) {
    return `${(value / 1000).toFixed(1)}K`;
  }

  if (Math.abs(value) < 1_000_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  return `${(value / 1_000_000_000).toFixed(1)}B`;
}

// ============================================================
// Trend Calculation
// ============================================================

/**
 * Calculates the trend direction by comparing two values.
 * Uses a configurable threshold to determine if the change is significant.
 *
 * @param current - The current value
 * @param previous - The previous value
 * @param threshold - Percentage threshold for significance (default: 0.05 = 5%)
 * @returns Trend direction: "up", "down", or "stable"
 */
export function calculateTrend(
  current: number | null | undefined,
  previous: number | null | undefined,
  threshold: number = 0.05
): TrendDirection {
  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined ||
    isNaN(current) ||
    isNaN(previous)
  ) {
    return "stable";
  }

  if (previous === 0) {
    if (current > 0) return "up";
    if (current < 0) return "down";
    return "stable";
  }

  const delta = (current - previous) / Math.abs(previous);

  if (delta > threshold) return "up";
  if (delta < -threshold) return "down";
  return "stable";
}

/**
 * Calculates the percentage change between two values.
 *
 * @param current - The current value
 * @param previous - The previous value
 * @returns Percentage change or null if calculation is not possible
 */
export function calculatePercentageChange(
  current: number | null | undefined,
  previous: number | null | undefined
): number | null {
  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined ||
    isNaN(current) ||
    isNaN(previous)
  ) {
    return null;
  }

  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return Math.round(((current - previous) / Math.abs(previous)) * 10000) / 100;
}

// ============================================================
// Color & Status Utilities
// ============================================================

/**
 * Returns the hex color for an incident severity level.
 *
 * @param severity - The incident severity
 * @returns Hex color string
 */
export function getSeverityColor(severity: IncidentSeverity): string {
  return SEVERITY_COLORS[severity] || "#6b7280";
}

/**
 * Returns the Tailwind background class for an incident severity level.
 *
 * @param severity - The incident severity
 * @returns Tailwind class string
 */
export function getSeverityBgClass(severity: IncidentSeverity): string {
  return SEVERITY_BG_CLASSES[severity] || "bg-gray-500/10 text-gray-700 dark:text-gray-400";
}

/**
 * Returns the hex color for an incident status.
 *
 * @param status - The incident status
 * @returns Hex color string
 */
export function getStatusColor(status: IncidentStatus): string {
  return STATUS_COLORS[status] || "#6b7280";
}

/**
 * Returns the Tailwind background class for an incident status.
 *
 * @param status - The incident status
 * @returns Tailwind class string
 */
export function getStatusBgClass(status: IncidentStatus): string {
  return STATUS_BG_CLASSES[status] || "bg-gray-500/10 text-gray-700 dark:text-gray-400";
}

/**
 * Returns the hex color for a criticality tier.
 *
 * @param tier - The criticality tier
 * @returns Hex color string
 */
export function getTierColor(tier: CriticalityTier): string {
  return TIER_COLORS[tier] || "#6b7280";
}

/**
 * Returns the Tailwind background class for a criticality tier.
 *
 * @param tier - The criticality tier
 * @returns Tailwind class string
 */
export function getTierBgClass(tier: CriticalityTier): string {
  return TIER_BG_CLASSES[tier] || "bg-gray-500/10 text-gray-700 dark:text-gray-400";
}

/**
 * Returns the hex color for a deployment status.
 *
 * @param status - The deployment status
 * @returns Hex color string
 */
export function getDeploymentStatusColor(status: DeploymentStatus): string {
  return DEPLOYMENT_STATUS_COLORS[status] || "#6b7280";
}

/**
 * Returns a color based on a health/availability percentage.
 * Green for healthy, yellow for warning, red for critical.
 *
 * @param percentage - The availability/health percentage (0-100)
 * @returns Hex color string
 */
export function getHealthColor(percentage: number): string {
  if (percentage >= 99.9) return "#22c55e"; // green
  if (percentage >= 99.5) return "#f59e0b"; // yellow/warning
  if (percentage >= 99.0) return "#f97316"; // orange
  return "#ef4444"; // red
}

// ============================================================
// File Parsing Utilities
// ============================================================

/**
 * Parses a CSV file and returns an array of row objects.
 * Uses Papa Parse with headers enabled and empty lines skipped.
 *
 * @param file - The File object to parse
 * @returns Promise resolving to an array of parsed row objects
 */
export function parseCsvFile(
  file: File
): Promise<Array<Record<string, string>>> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim().toLowerCase(),
      transform: (value: string) => value.trim(),
      complete: (results) => {
        resolve(results.data);
      },
      error: (error: Error) => {
        reject(new Error(`CSV parse error: ${error.message}`));
      },
    });
  });
}

/**
 * Parses an Excel file (.xlsx/.xls) and returns an array of row objects.
 * Reads only the first sheet. Headers are normalized to lowercase.
 *
 * @param file - The File object to parse
 * @returns Promise resolving to an array of parsed row objects
 */
export function parseExcelFile(
  file: File
): Promise<Array<Record<string, unknown>>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        if (!data) {
          reject(new Error("Failed to read Excel file."));
          return;
        }

        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
          reject(new Error("Excel file contains no sheets."));
          return;
        }

        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
          raw: false,
        });

        // Normalize headers to lowercase
        const normalized = rows.map((row) => {
          const normalizedRow: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            normalizedRow[key.trim().toLowerCase()] =
              typeof value === "string" ? value.trim() : value;
          }
          return normalizedRow;
        });

        resolve(normalized);
      } catch (error) {
        reject(
          new Error(
            `Excel parse error: ${error instanceof Error ? error.message : "Unknown error."}`
          )
        );
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file."));
    };

    reader.readAsArrayBuffer(file);
  });
}

// ============================================================
// Environment Variable Validation
// ============================================================

/**
 * Validates that all required environment variables are set.
 * Throws an error listing any missing variables.
 *
 * @param requiredVars - Array of environment variable names to validate
 * @throws Error if any required variables are missing
 */
export function validateEnvVars(requiredVars: string[]): void {
  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName] || process.env[varName]!.trim().length === 0) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. Please check your .env file.`
    );
  }
}

/**
 * Validates all critical environment variables required by the application.
 * Intended to be called during application startup.
 *
 * @throws Error if any critical variables are missing
 */
export function validateCriticalEnvVars(): void {
  validateEnvVars([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXTAUTH_URL",
    "NEXTAUTH_SECRET",
    "AZURE_AD_CLIENT_ID",
    "AZURE_AD_CLIENT_SECRET",
    "AZURE_AD_TENANT_ID",
  ]);
}

// ============================================================
// String Utilities
// ============================================================

/**
 * Truncates a string to a maximum length, appending an ellipsis if truncated.
 *
 * @param str - The string to truncate
 * @param maxLength - Maximum length (default: 100)
 * @returns Truncated string
 */
export function truncate(str: string | null | undefined, maxLength: number = 100): string {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return `${str.substring(0, maxLength)}…`;
}

/**
 * Converts a string to title case (first letter of each word capitalized).
 *
 * @param str - The string to convert
 * @returns Title-cased string
 */
export function toTitleCase(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/(?:^|\s|[-_])\w/g, (match) => match.toUpperCase())
    .replace(/[-_]/g, " ");
}

/**
 * Generates a slug from a string (lowercase, hyphens instead of spaces).
 *
 * @param str - The string to slugify
 * @returns Slugified string
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ============================================================
// Miscellaneous Utilities
// ============================================================

/**
 * Generates a unique correlation ID for request tracing.
 *
 * @param prefix - Optional prefix (default: "req")
 * @returns Unique correlation ID string
 */
export function generateCorrelationId(prefix: string = "req"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Delays execution for a specified number of milliseconds.
 * Useful for debouncing or rate limiting.
 *
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely parses a JSON string, returning a default value on failure.
 *
 * @param json - The JSON string to parse
 * @param defaultValue - Default value to return on parse failure
 * @returns Parsed value or default
 */
export function safeJsonParse<T>(json: string | null | undefined, defaultValue: T): T {
  if (!json) return defaultValue;

  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Creates a debounced version of a function.
 *
 * @param fn - The function to debounce
 * @param delayMs - Debounce delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
}

/**
 * Groups an array of objects by a key.
 *
 * @param items - Array of items to group
 * @param keyFn - Function to extract the grouping key from each item
 * @returns Map of key to array of items
 */
export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K
): Map<K, T[]> {
  const map = new Map<K, T[]>();

  for (const item of items) {
    const key = keyFn(item);
    const existing = map.get(key) || [];
    existing.push(item);
    map.set(key, existing);
  }

  return map;
}