import Papa from "papaparse";
import * as XLSX from "xlsx";
import { createServerClient } from "@/lib/supabase";
import { logAction, AUDIT_ACTIONS } from "@/lib/services/audit-logger";
import { UPLOAD } from "@/constants/constants";
import type {
  DataType,
  CriticalityTier,
  DeploymentStatus,
  DependencyType,
  Environment,
  IncidentSeverity,
  IncidentStatus,
  MetricType,
  RootCauseCategory,
} from "@/types";

// ============================================================
// Types
// ============================================================

export interface IngestionResult {
  status: "success" | "partial" | "failed";
  records_ingested: number;
  records_failed: number;
  errors: string[];
  file_name: string;
  data_type: DataType;
  upload_log_id?: string;
}

export interface IngestionParams {
  file: Buffer | ArrayBuffer;
  file_name: string;
  file_size_bytes: number;
  data_type: DataType;
  uploader_id: string;
  uploader_name?: string;
}

export interface ParsedRow {
  [key: string]: unknown;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

// ============================================================
// Constants
// ============================================================

const VALID_DATA_TYPES: DataType[] = [
  "incident",
  "metric",
  "service_map",
  "deployment",
  "error_budget",
];

const VALID_METRIC_TYPES: MetricType[] = [
  "latency_p50",
  "latency_p95",
  "latency_p99",
  "errors_4xx",
  "errors_5xx",
  "traffic_rps",
  "saturation_cpu",
  "saturation_memory",
  "saturation_disk",
  "availability",
];

const VALID_SEVERITIES: IncidentSeverity[] = [
  "critical",
  "major",
  "minor",
  "warning",
];

const VALID_STATUSES: IncidentStatus[] = [
  "open",
  "investigating",
  "mitigated",
  "resolved",
  "closed",
];

const VALID_ENVIRONMENTS: Environment[] = ["Prod", "Staging", "QA", "Dev"];

const VALID_TIERS: CriticalityTier[] = [
  "Tier-1",
  "Tier-2",
  "Tier-3",
  "Tier-4",
];

const VALID_DEPLOYMENT_STATUSES: DeploymentStatus[] = [
  "success",
  "failed",
  "rolled_back",
  "in_progress",
];

const VALID_DEPENDENCY_TYPES: DependencyType[] = [
  "calls",
  "publishes",
  "subscribes",
  "queries",
  "depends_on",
];

const VALID_ROOT_CAUSES: RootCauseCategory[] = [
  "Config",
  "Code",
  "Infrastructure",
  "Dependency",
  "Capacity",
  "Network",
  "Security",
  "Unknown",
];

// Required columns per data type
const REQUIRED_COLUMNS: Record<DataType, string[]> = {
  metric: ["service_id", "metric_type", "value", "timestamp"],
  incident: ["service_id", "severity", "status", "title", "start_time"],
  service_map: ["from_service", "to_service", "type"],
  deployment: [
    "service_id",
    "version",
    "environment",
    "status",
    "deployed_by",
    "deployed_at",
  ],
  error_budget: [
    "service_id",
    "period",
    "initial",
    "consumed",
    "remaining",
    "slo_target",
    "trend",
  ],
};

// ============================================================
// File Parsing
// ============================================================

/**
 * Determines the file type from the file name extension.
 */
function getFileType(
  fileName: string
): "csv" | "xlsx" | "xls" | "json" | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".xls")) return "xls";
  if (lower.endsWith(".json")) return "json";
  return null;
}

/**
 * Parses a CSV file buffer into an array of row objects using Papa Parse.
 */
function parseCSV(buffer: Buffer | ArrayBuffer): ParsedRow[] {
  const text =
    buffer instanceof Buffer
      ? buffer.toString("utf-8")
      : new TextDecoder("utf-8").decode(buffer);

  const result = Papa.parse<ParsedRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase(),
    transform: (value: string) => value.trim(),
  });

  if (result.errors && result.errors.length > 0) {
    const parseErrors = result.errors
      .slice(0, 10)
      .map(
        (e) =>
          `Row ${e.row !== undefined ? e.row + 2 : "?"}: ${e.message}`
      );
    if (parseErrors.length > 0) {
      console.warn("CSV parse warnings:", parseErrors);
    }
  }

  return result.data;
}

/**
 * Parses an Excel file buffer (xlsx/xls) into an array of row objects using XLSX.
 * Reads only the first sheet.
 */
function parseExcel(buffer: Buffer | ArrayBuffer): ParsedRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("Excel file contains no sheets.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<ParsedRow>(sheet, {
    defval: "",
    raw: false,
  });

  // Normalize headers to lowercase
  return rows.map((row) => {
    const normalized: ParsedRow = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key.trim().toLowerCase()] = typeof value === "string" ? value.trim() : value;
    }
    return normalized;
  });
}

/**
 * Parses a JSON file buffer into an array of row objects.
 */
function parseJSON(buffer: Buffer | ArrayBuffer): ParsedRow[] {
  const text =
    buffer instanceof Buffer
      ? buffer.toString("utf-8")
      : new TextDecoder("utf-8").decode(buffer);

  const parsed = JSON.parse(text);

  if (Array.isArray(parsed)) {
    return parsed.map((row) => {
      if (typeof row !== "object" || row === null) {
        throw new Error("JSON array must contain objects.");
      }
      const normalized: ParsedRow = {};
      for (const [key, value] of Object.entries(row)) {
        normalized[key.trim().toLowerCase()] = value;
      }
      return normalized;
    });
  }

  throw new Error(
    "JSON file must contain an array of objects at the top level."
  );
}

/**
 * Parses a file buffer into an array of row objects based on file type.
 */
function parseFile(
  buffer: Buffer | ArrayBuffer,
  fileName: string
): ParsedRow[] {
  const fileType = getFileType(fileName);

  if (!fileType) {
    throw new Error(
      `Unsupported file type: "${fileName}". Accepted types: ${UPLOAD.ACCEPTED_FILE_TYPES.join(", ")}.`
    );
  }

  switch (fileType) {
    case "csv":
      return parseCSV(buffer);
    case "xlsx":
    case "xls":
      return parseExcel(buffer);
    case "json":
      return parseJSON(buffer);
    default:
      throw new Error(`Unsupported file type: "${fileType}".`);
  }
}

// ============================================================
// Validation Helpers
// ============================================================

/**
 * Validates that all required columns are present in the parsed rows.
 */
function validateRequiredColumns(
  rows: ParsedRow[],
  dataType: DataType
): string[] {
  const errors: string[] = [];
  const required = REQUIRED_COLUMNS[dataType];

  if (!required) {
    errors.push(`Unknown data type: "${dataType}".`);
    return errors;
  }

  if (rows.length === 0) {
    errors.push("File contains no data rows.");
    return errors;
  }

  const firstRow = rows[0];
  const columns = Object.keys(firstRow);

  for (const col of required) {
    if (!columns.includes(col)) {
      errors.push(
        `Missing required column: "${col}". Required columns for ${dataType}: ${required.join(", ")}.`
      );
    }
  }

  return errors;
}

/**
 * Validates a string value is non-empty.
 */
function isNonEmpty(value: unknown): boolean {
  return (
    value !== undefined &&
    value !== null &&
    String(value).trim().length > 0
  );
}

/**
 * Safely converts a value to a number. Returns null if invalid.
 */
function toNumber(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
}

/**
 * Validates and parses an ISO8601 timestamp string.
 * Returns the ISO string or null if invalid.
 */
function toTimestamp(value: unknown): string | null {
  if (!isNonEmpty(value)) return null;
  const str = String(value).trim();
  const date = new Date(str);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Validates a value is one of the allowed values (case-sensitive).
 */
function isOneOf<T extends string>(value: unknown, allowed: T[]): value is T {
  if (!isNonEmpty(value)) return false;
  return allowed.includes(String(value).trim() as T);
}

/**
 * Converts a value to a boolean.
 */
function toBoolean(value: unknown): boolean {
  if (value === true || value === "true" || value === "1" || value === "yes") {
    return true;
  }
  return false;
}

// ============================================================
// Row Validation per Data Type
// ============================================================

/**
 * Validates a single metric row and returns validation errors.
 */
function validateMetricRow(
  row: ParsedRow,
  rowIndex: number
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isNonEmpty(row.service_id)) {
    errors.push({
      row: rowIndex,
      field: "service_id",
      message: "service_id is required.",
    });
  }

  if (!isOneOf(row.metric_type, VALID_METRIC_TYPES)) {
    errors.push({
      row: rowIndex,
      field: "metric_type",
      message: `Invalid metric_type: "${row.metric_type}". Must be one of: ${VALID_METRIC_TYPES.join(", ")}.`,
    });
  }

  if (toNumber(row.value) === null) {
    errors.push({
      row: rowIndex,
      field: "value",
      message: `Invalid value: "${row.value}". Must be a number.`,
    });
  }

  if (!toTimestamp(row.timestamp)) {
    errors.push({
      row: rowIndex,
      field: "timestamp",
      message: `Invalid timestamp: "${row.timestamp}". Must be a valid ISO8601 date.`,
    });
  }

  if (isNonEmpty(row.environment) && !isOneOf(row.environment, VALID_ENVIRONMENTS)) {
    errors.push({
      row: rowIndex,
      field: "environment",
      message: `Invalid environment: "${row.environment}". Must be one of: ${VALID_ENVIRONMENTS.join(", ")}.`,
    });
  }

  return errors;
}

/**
 * Validates a single incident row and returns validation errors.
 */
function validateIncidentRow(
  row: ParsedRow,
  rowIndex: number
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isNonEmpty(row.service_id)) {
    errors.push({
      row: rowIndex,
      field: "service_id",
      message: "service_id is required.",
    });
  }

  if (!isOneOf(row.severity, VALID_SEVERITIES)) {
    errors.push({
      row: rowIndex,
      field: "severity",
      message: `Invalid severity: "${row.severity}". Must be one of: ${VALID_SEVERITIES.join(", ")}.`,
    });
  }

  if (!isOneOf(row.status, VALID_STATUSES)) {
    errors.push({
      row: rowIndex,
      field: "status",
      message: `Invalid status: "${row.status}". Must be one of: ${VALID_STATUSES.join(", ")}.`,
    });
  }

  if (!isNonEmpty(row.title)) {
    errors.push({
      row: rowIndex,
      field: "title",
      message: "title is required.",
    });
  }

  if (!toTimestamp(row.start_time)) {
    errors.push({
      row: rowIndex,
      field: "start_time",
      message: `Invalid start_time: "${row.start_time}". Must be a valid ISO8601 date.`,
    });
  }

  if (isNonEmpty(row.end_time) && !toTimestamp(row.end_time)) {
    errors.push({
      row: rowIndex,
      field: "end_time",
      message: `Invalid end_time: "${row.end_time}". Must be a valid ISO8601 date.`,
    });
  }

  if (isNonEmpty(row.mttr) && toNumber(row.mttr) === null) {
    errors.push({
      row: rowIndex,
      field: "mttr",
      message: `Invalid mttr: "${row.mttr}". Must be a number.`,
    });
  }

  if (isNonEmpty(row.mttd) && toNumber(row.mttd) === null) {
    errors.push({
      row: rowIndex,
      field: "mttd",
      message: `Invalid mttd: "${row.mttd}". Must be a number.`,
    });
  }

  if (
    isNonEmpty(row.root_cause) &&
    !isOneOf(row.root_cause, VALID_ROOT_CAUSES)
  ) {
    errors.push({
      row: rowIndex,
      field: "root_cause",
      message: `Invalid root_cause: "${row.root_cause}". Must be one of: ${VALID_ROOT_CAUSES.join(", ")}.`,
    });
  }

  return errors;
}

/**
 * Validates a single service_map (dependency edge) row.
 */
function validateServiceMapRow(
  row: ParsedRow,
  rowIndex: number
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isNonEmpty(row.from_service)) {
    errors.push({
      row: rowIndex,
      field: "from_service",
      message: "from_service is required.",
    });
  }

  if (!isNonEmpty(row.to_service)) {
    errors.push({
      row: rowIndex,
      field: "to_service",
      message: "to_service is required.",
    });
  }

  if (!isOneOf(row.type, VALID_DEPENDENCY_TYPES)) {
    errors.push({
      row: rowIndex,
      field: "type",
      message: `Invalid type: "${row.type}". Must be one of: ${VALID_DEPENDENCY_TYPES.join(", ")}.`,
    });
  }

  if (isNonEmpty(row.latency_ms) && toNumber(row.latency_ms) === null) {
    errors.push({
      row: rowIndex,
      field: "latency_ms",
      message: `Invalid latency_ms: "${row.latency_ms}". Must be a number.`,
    });
  }

  if (isNonEmpty(row.error_rate) && toNumber(row.error_rate) === null) {
    errors.push({
      row: rowIndex,
      field: "error_rate",
      message: `Invalid error_rate: "${row.error_rate}". Must be a number.`,
    });
  }

  if (isNonEmpty(row.traffic_rps) && toNumber(row.traffic_rps) === null) {
    errors.push({
      row: rowIndex,
      field: "traffic_rps",
      message: `Invalid traffic_rps: "${row.traffic_rps}". Must be a number.`,
    });
  }

  return errors;
}

/**
 * Validates a single deployment row.
 */
function validateDeploymentRow(
  row: ParsedRow,
  rowIndex: number
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isNonEmpty(row.service_id)) {
    errors.push({
      row: rowIndex,
      field: "service_id",
      message: "service_id is required.",
    });
  }

  if (!isNonEmpty(row.version)) {
    errors.push({
      row: rowIndex,
      field: "version",
      message: "version is required.",
    });
  }

  if (!isOneOf(row.environment, VALID_ENVIRONMENTS)) {
    errors.push({
      row: rowIndex,
      field: "environment",
      message: `Invalid environment: "${row.environment}". Must be one of: ${VALID_ENVIRONMENTS.join(", ")}.`,
    });
  }

  if (!isOneOf(row.status, VALID_DEPLOYMENT_STATUSES)) {
    errors.push({
      row: rowIndex,
      field: "status",
      message: `Invalid status: "${row.status}". Must be one of: ${VALID_DEPLOYMENT_STATUSES.join(", ")}.`,
    });
  }

  if (!isNonEmpty(row.deployed_by)) {
    errors.push({
      row: rowIndex,
      field: "deployed_by",
      message: "deployed_by is required.",
    });
  }

  if (!toTimestamp(row.deployed_at)) {
    errors.push({
      row: rowIndex,
      field: "deployed_at",
      message: `Invalid deployed_at: "${row.deployed_at}". Must be a valid ISO8601 date.`,
    });
  }

  if (isNonEmpty(row.rollback_at) && !toTimestamp(row.rollback_at)) {
    errors.push({
      row: rowIndex,
      field: "rollback_at",
      message: `Invalid rollback_at: "${row.rollback_at}". Must be a valid ISO8601 date.`,
    });
  }

  return errors;
}

/**
 * Validates a single error_budget row.
 */
function validateErrorBudgetRow(
  row: ParsedRow,
  rowIndex: number
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isNonEmpty(row.service_id)) {
    errors.push({
      row: rowIndex,
      field: "service_id",
      message: "service_id is required.",
    });
  }

  if (!isNonEmpty(row.period)) {
    errors.push({
      row: rowIndex,
      field: "period",
      message: "period is required.",
    });
  }

  if (toNumber(row.initial) === null) {
    errors.push({
      row: rowIndex,
      field: "initial",
      message: `Invalid initial: "${row.initial}". Must be a number.`,
    });
  }

  if (toNumber(row.consumed) === null) {
    errors.push({
      row: rowIndex,
      field: "consumed",
      message: `Invalid consumed: "${row.consumed}". Must be a number.`,
    });
  }

  if (toNumber(row.remaining) === null) {
    errors.push({
      row: rowIndex,
      field: "remaining",
      message: `Invalid remaining: "${row.remaining}". Must be a number.`,
    });
  }

  if (toNumber(row.slo_target) === null) {
    errors.push({
      row: rowIndex,
      field: "slo_target",
      message: `Invalid slo_target: "${row.slo_target}". Must be a number.`,
    });
  }

  if (!isNonEmpty(row.trend)) {
    errors.push({
      row: rowIndex,
      field: "trend",
      message: "trend is required.",
    });
  } else if (!isOneOf(row.trend, ["up", "down", "stable"])) {
    errors.push({
      row: rowIndex,
      field: "trend",
      message: `Invalid trend: "${row.trend}". Must be one of: up, down, stable.`,
    });
  }

  return errors;
}

/**
 * Validates a row based on the data type.
 */
function validateRow(
  row: ParsedRow,
  rowIndex: number,
  dataType: DataType
): ValidationError[] {
  switch (dataType) {
    case "metric":
      return validateMetricRow(row, rowIndex);
    case "incident":
      return validateIncidentRow(row, rowIndex);
    case "service_map":
      return validateServiceMapRow(row, rowIndex);
    case "deployment":
      return validateDeploymentRow(row, rowIndex);
    case "error_budget":
      return validateErrorBudgetRow(row, rowIndex);
    default:
      return [
        {
          row: rowIndex,
          field: "_data_type",
          message: `Unsupported data type: "${dataType}".`,
        },
      ];
  }
}

// ============================================================
// Row Mapping to Database Records
// ============================================================

/**
 * Maps a validated metric row to a database insert record.
 */
function mapMetricRow(row: ParsedRow): Record<string, unknown> {
  const unit = deriveMetricUnit(String(row.metric_type));
  return {
    service_id: String(row.service_id).trim(),
    metric_type: String(row.metric_type).trim(),
    value: toNumber(row.value)!,
    unit,
    timestamp: toTimestamp(row.timestamp)!,
    environment: isNonEmpty(row.environment)
      ? String(row.environment).trim()
      : null,
    tags: isNonEmpty(row.tags) ? parseTagsField(row.tags) : null,
  };
}

/**
 * Maps a validated incident row to a database insert record.
 */
function mapIncidentRow(row: ParsedRow): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    service_id: String(row.service_id).trim(),
    service_name: isNonEmpty(row.service_name)
      ? String(row.service_name).trim()
      : null,
    domain: isNonEmpty(row.domain) ? String(row.domain).trim() : null,
    severity: String(row.severity).trim(),
    status: String(row.status).trim(),
    title: String(row.title).trim(),
    description: isNonEmpty(row.description)
      ? String(row.description).trim()
      : null,
    start_time: toTimestamp(row.start_time)!,
    end_time: isNonEmpty(row.end_time) ? toTimestamp(row.end_time) : null,
    mttr: isNonEmpty(row.mttr) ? toNumber(row.mttr) : null,
    mttd: isNonEmpty(row.mttd) ? toNumber(row.mttd) : null,
    root_cause: isNonEmpty(row.root_cause)
      ? String(row.root_cause).trim()
      : null,
    root_cause_details: isNonEmpty(row.root_cause_details)
      ? String(row.root_cause_details).trim()
      : null,
    repeat_failure: toBoolean(row.repeat_failure),
    external_id: isNonEmpty(row.external_id)
      ? String(row.external_id).trim()
      : null,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Maps a validated service_map row to a dependency_edges insert record.
 */
function mapServiceMapRow(row: ParsedRow): Record<string, unknown> {
  return {
    from_service: String(row.from_service).trim(),
    to_service: String(row.to_service).trim(),
    from_service_name: isNonEmpty(row.from_service_name)
      ? String(row.from_service_name).trim()
      : null,
    to_service_name: isNonEmpty(row.to_service_name)
      ? String(row.to_service_name).trim()
      : null,
    type: String(row.type).trim(),
    latency_ms: isNonEmpty(row.latency_ms) ? toNumber(row.latency_ms) : null,
    error_rate: isNonEmpty(row.error_rate) ? toNumber(row.error_rate) : null,
    traffic_rps: isNonEmpty(row.traffic_rps)
      ? toNumber(row.traffic_rps)
      : null,
  };
}

/**
 * Maps a validated deployment row to a database insert record.
 */
function mapDeploymentRow(row: ParsedRow): Record<string, unknown> {
  return {
    service_id: String(row.service_id).trim(),
    service_name: isNonEmpty(row.service_name)
      ? String(row.service_name).trim()
      : null,
    version: String(row.version).trim(),
    environment: String(row.environment).trim(),
    status: String(row.status).trim(),
    deployed_by: String(row.deployed_by).trim(),
    deployed_at: toTimestamp(row.deployed_at)!,
    rollback_at: isNonEmpty(row.rollback_at)
      ? toTimestamp(row.rollback_at)
      : null,
    change_ticket: isNonEmpty(row.change_ticket)
      ? String(row.change_ticket).trim()
      : null,
    description: isNonEmpty(row.description)
      ? String(row.description).trim()
      : null,
    has_incident: toBoolean(row.has_incident),
    incident_id: isNonEmpty(row.incident_id)
      ? String(row.incident_id).trim()
      : null,
  };
}

/**
 * Maps a validated error_budget row to a database insert record.
 */
function mapErrorBudgetRow(row: ParsedRow): Record<string, unknown> {
  return {
    service_id: String(row.service_id).trim(),
    service_name: isNonEmpty(row.service_name)
      ? String(row.service_name).trim()
      : null,
    period: String(row.period).trim(),
    initial: toNumber(row.initial)!,
    consumed: toNumber(row.consumed)!,
    remaining: toNumber(row.remaining)!,
    breach: toBoolean(row.breach),
    trend: String(row.trend).trim(),
    slo_target: toNumber(row.slo_target)!,
    burn_rate: isNonEmpty(row.burn_rate) ? toNumber(row.burn_rate) : null,
    projected_breach_date: isNonEmpty(row.projected_breach_date)
      ? toTimestamp(row.projected_breach_date)
      : null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Derives the metric unit from the metric type.
 */
function deriveMetricUnit(metricType: string): string {
  if (metricType.startsWith("latency")) return "ms";
  if (metricType.startsWith("saturation") || metricType === "availability")
    return "percent";
  if (metricType === "traffic_rps") return "rps";
  return "count";
}

/**
 * Parses a tags field that may be a JSON string or already an object.
 */
function parseTagsField(value: unknown): Record<string, string> | null {
  if (!value) return null;

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, string>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    } catch {
      // Not valid JSON — ignore
    }
  }

  return null;
}

/**
 * Returns the Supabase table name for a given data type.
 */
function getTableName(dataType: DataType): string {
  switch (dataType) {
    case "metric":
      return "metrics";
    case "incident":
      return "incidents";
    case "service_map":
      return "dependency_edges";
    case "deployment":
      return "deployments";
    case "error_budget":
      return "error_budgets";
    default:
      throw new Error(`Unknown data type: "${dataType}".`);
  }
}

/**
 * Maps a validated row to a database insert record based on data type.
 */
function mapRow(
  row: ParsedRow,
  dataType: DataType
): Record<string, unknown> {
  switch (dataType) {
    case "metric":
      return mapMetricRow(row);
    case "incident":
      return mapIncidentRow(row);
    case "service_map":
      return mapServiceMapRow(row);
    case "deployment":
      return mapDeploymentRow(row);
    case "error_budget":
      return mapErrorBudgetRow(row);
    default:
      throw new Error(`Unsupported data type for mapping: "${dataType}".`);
  }
}

// ============================================================
// Batch Insert
// ============================================================

const BATCH_SIZE = 500;

/**
 * Inserts records into the database in batches.
 * Returns the count of successfully inserted records and any errors.
 */
async function batchInsert(
  tableName: string,
  records: Record<string, unknown>[]
): Promise<{ inserted: number; errors: string[] }> {
  const supabase = createServerClient();
  let totalInserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from(tableName)
      .insert(batch)
      .select("id");

    if (error) {
      console.error(
        `Batch insert error (rows ${i + 1}-${i + batch.length}):`,
        error
      );
      errors.push(
        `Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error.message}`
      );
    } else {
      totalInserted += (data || []).length;
    }
  }

  return { inserted: totalInserted, errors };
}

// ============================================================
// Upload Log
// ============================================================

/**
 * Creates an upload log record in the database.
 */
async function createUploadLog(params: {
  file_name: string;
  data_type: DataType;
  uploader: string;
  uploader_name?: string;
  records_ingested: number;
  records_failed: number;
  errors: string[];
  status: "success" | "partial" | "failed";
  file_size_bytes: number;
}): Promise<string | undefined> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("upload_logs")
    .insert({
      file_name: params.file_name,
      data_type: params.data_type,
      uploader: params.uploader,
      uploader_name: params.uploader_name || null,
      records_ingested: params.records_ingested,
      records_failed: params.records_failed,
      errors: params.errors.length > 0 ? params.errors.slice(0, 100) : null,
      status: params.status,
      file_size_bytes: params.file_size_bytes,
      timestamp: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create upload log:", error);
    return undefined;
  }

  return data?.id;
}

// ============================================================
// Main Ingestion Function
// ============================================================

/**
 * Ingests an interim data file (CSV, Excel, or JSON) into the appropriate
 * Supabase table. Validates the file format, schema, and individual rows.
 * Records the upload in the upload_logs table and audit trail.
 *
 * @param params - Ingestion parameters including file buffer, metadata, and uploader info
 * @returns Ingestion result with counts and error details
 * @throws Error if the file cannot be parsed or critical validation fails
 */
export async function ingestInterimUpload(
  params: IngestionParams
): Promise<IngestionResult> {
  const {
    file,
    file_name,
    file_size_bytes,
    data_type,
    uploader_id,
    uploader_name,
  } = params;

  // Validate data type
  if (!VALID_DATA_TYPES.includes(data_type)) {
    throw new Error(
      `Invalid data_type: "${data_type}". Must be one of: ${VALID_DATA_TYPES.join(", ")}.`
    );
  }

  // Validate file size
  if (file_size_bytes > UPLOAD.MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File size (${file_size_bytes} bytes) exceeds maximum allowed size (${UPLOAD.MAX_FILE_SIZE_BYTES} bytes).`
    );
  }

  // Validate file type
  const fileType = getFileType(file_name);
  if (!fileType) {
    throw new Error(
      `Unsupported file type: "${file_name}". Accepted types: ${UPLOAD.ACCEPTED_FILE_TYPES.join(", ")}.`
    );
  }

  // Parse the file
  let rows: ParsedRow[];
  try {
    rows = parseFile(file, file_name);
  } catch (parseError) {
    const errorMessage =
      parseError instanceof Error
        ? parseError.message
        : "Unknown parse error.";

    // Log the failed upload
    const uploadLogId = await createUploadLog({
      file_name,
      data_type,
      uploader: uploader_id,
      uploader_name,
      records_ingested: 0,
      records_failed: 0,
      errors: [`File parse error: ${errorMessage}`],
      status: "failed",
      file_size_bytes,
    });

    // Audit log
    try {
      await logAction({
        action: AUDIT_ACTIONS.UPLOAD_FAILED,
        entity_type: "service",
        entity_id: data_type,
        user_id: uploader_id,
        user_name: uploader_name,
        details: {
          file_name,
          data_type,
          error: errorMessage,
          upload_log_id: uploadLogId,
        },
      });
    } catch (auditError) {
      console.error("Audit log failed for upload error:", auditError);
    }

    throw new Error(`Failed to parse file: ${errorMessage}`);
  }

  // Validate record count
  if (rows.length > UPLOAD.MAX_RECORDS_PER_FILE) {
    throw new Error(
      `File contains ${rows.length} records, which exceeds the maximum of ${UPLOAD.MAX_RECORDS_PER_FILE}.`
    );
  }

  // Validate required columns
  const columnErrors = validateRequiredColumns(rows, data_type);
  if (columnErrors.length > 0) {
    const uploadLogId = await createUploadLog({
      file_name,
      data_type,
      uploader: uploader_id,
      uploader_name,
      records_ingested: 0,
      records_failed: rows.length,
      errors: columnErrors,
      status: "failed",
      file_size_bytes,
    });

    try {
      await logAction({
        action: AUDIT_ACTIONS.UPLOAD_FAILED,
        entity_type: "service",
        entity_id: data_type,
        user_id: uploader_id,
        user_name: uploader_name,
        details: {
          file_name,
          data_type,
          column_errors: columnErrors,
          upload_log_id: uploadLogId,
        },
      });
    } catch (auditError) {
      console.error("Audit log failed for column validation error:", auditError);
    }

    return {
      status: "failed",
      records_ingested: 0,
      records_failed: rows.length,
      errors: columnErrors,
      file_name,
      data_type,
      upload_log_id: uploadLogId,
    };
  }

  // Validate individual rows and collect valid records
  const validRecords: Record<string, unknown>[] = [];
  const allErrors: string[] = [];
  let failedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +2 for 1-indexed + header row
    const validationErrors = validateRow(row, rowNumber, data_type);

    if (validationErrors.length > 0) {
      failedCount++;
      // Limit error messages to avoid excessive output
      if (allErrors.length < 100) {
        for (const ve of validationErrors) {
          allErrors.push(`Row ${ve.row}, ${ve.field}: ${ve.message}`);
        }
      }
    } else {
      try {
        const mapped = mapRow(row, data_type);
        validRecords.push(mapped);
      } catch (mapError) {
        failedCount++;
        if (allErrors.length < 100) {
          allErrors.push(
            `Row ${rowNumber}: Mapping error - ${mapError instanceof Error ? mapError.message : "Unknown error"}`
          );
        }
      }
    }
  }

  // If no valid records, return failure
  if (validRecords.length === 0) {
    const uploadLogId = await createUploadLog({
      file_name,
      data_type,
      uploader: uploader_id,
      uploader_name,
      records_ingested: 0,
      records_failed: failedCount,
      errors: allErrors,
      status: "failed",
      file_size_bytes,
    });

    try {
      await logAction({
        action: AUDIT_ACTIONS.UPLOAD_FAILED,
        entity_type: "service",
        entity_id: data_type,
        user_id: uploader_id,
        user_name: uploader_name,
        details: {
          file_name,
          data_type,
          total_rows: rows.length,
          failed_rows: failedCount,
          upload_log_id: uploadLogId,
        },
      });
    } catch (auditError) {
      console.error("Audit log failed for validation failure:", auditError);
    }

    return {
      status: "failed",
      records_ingested: 0,
      records_failed: failedCount,
      errors: allErrors,
      file_name,
      data_type,
      upload_log_id: uploadLogId,
    };
  }

  // Insert valid records into the database
  const tableName = getTableName(data_type);
  const { inserted, errors: insertErrors } = await batchInsert(
    tableName,
    validRecords
  );

  const totalErrors = [...allErrors, ...insertErrors];
  const totalFailed =
    failedCount + (validRecords.length - inserted);

  // Determine overall status
  let status: "success" | "partial" | "failed";
  if (inserted === 0) {
    status = "failed";
  } else if (totalFailed > 0) {
    status = "partial";
  } else {
    status = "success";
  }

  // Create upload log
  const uploadLogId = await createUploadLog({
    file_name,
    data_type,
    uploader: uploader_id,
    uploader_name,
    records_ingested: inserted,
    records_failed: totalFailed,
    errors: totalErrors,
    status,
    file_size_bytes,
  });

  // Audit log
  try {
    await logAction({
      action: AUDIT_ACTIONS.UPLOAD_INTERIM_DATA,
      entity_type: "service",
      entity_id: data_type,
      user_id: uploader_id,
      user_name: uploader_name,
      details: {
        file_name,
        data_type,
        total_rows: rows.length,
        records_ingested: inserted,
        records_failed: totalFailed,
        status,
        upload_log_id: uploadLogId,
      },
    });
  } catch (auditError) {
    console.error("Audit log failed for successful upload:", auditError);
  }

  return {
    status,
    records_ingested: inserted,
    records_failed: totalFailed,
    errors: totalErrors,
    file_name,
    data_type,
    upload_log_id: uploadLogId,
  };
}

// ============================================================
// Upload History
// ============================================================

/**
 * Retrieves the upload history for a specific user or all users.
 * Results are ordered by timestamp descending (most recent first).
 *
 * @param userId - Optional user ID to filter by
 * @param limit - Maximum number of records to return (default: 50)
 * @returns Array of upload log records
 */
export async function getUploadHistory(
  userId?: string,
  limit: number = 50
): Promise<
  Array<{
    id: string;
    file_name: string;
    data_type: string;
    uploader: string;
    uploader_name: string | null;
    records_ingested: number;
    records_failed: number | null;
    errors: string[] | null;
    status: string;
    file_size_bytes: number | null;
    timestamp: string;
  }>
> {
  const supabase = createServerClient();
  const clampedLimit = Math.min(limit, 100);

  let query = supabase
    .from("upload_logs")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(clampedLimit);

  if (userId) {
    query = query.eq("uploader", userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching upload history:", error);
    throw new Error(`Failed to fetch upload history: ${error.message}`);
  }

  return (data || []) as Array<{
    id: string;
    file_name: string;
    data_type: string;
    uploader: string;
    uploader_name: string | null;
    records_ingested: number;
    records_failed: number | null;
    errors: string[] | null;
    status: string;
    file_size_bytes: number | null;
    timestamp: string;
  }>;
}

/**
 * Retrieves a single upload log by ID.
 *
 * @param uploadLogId - The ID of the upload log
 * @returns The upload log record or null if not found
 */
export async function getUploadLogById(
  uploadLogId: string
): Promise<{
  id: string;
  file_name: string;
  data_type: string;
  uploader: string;
  uploader_name: string | null;
  records_ingested: number;
  records_failed: number | null;
  errors: string[] | null;
  status: string;
  file_size_bytes: number | null;
  timestamp: string;
} | null> {
  if (!uploadLogId || uploadLogId.trim().length === 0) {
    throw new Error("Upload log ID is required.");
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("upload_logs")
    .select("*")
    .eq("id", uploadLogId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching upload log:", error);
    throw new Error(`Failed to fetch upload log: ${error.message}`);
  }

  return data as {
    id: string;
    file_name: string;
    data_type: string;
    uploader: string;
    uploader_name: string | null;
    records_ingested: number;
    records_failed: number | null;
    errors: string[] | null;
    status: string;
    file_size_bytes: number | null;
    timestamp: string;
  };
}

// ============================================================
// Validation-Only Mode
// ============================================================

/**
 * Validates a file without ingesting it. Useful for dry-run / preview mode.
 * Returns validation results including row-level errors.
 *
 * @param params - The file and metadata to validate
 * @returns Validation result with error details
 */
export async function validateFile(params: {
  file: Buffer | ArrayBuffer;
  file_name: string;
  file_size_bytes: number;
  data_type: DataType;
}): Promise<{
  valid: boolean;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  errors: string[];
}> {
  const { file, file_name, file_size_bytes, data_type } = params;

  // Validate data type
  if (!VALID_DATA_TYPES.includes(data_type)) {
    return {
      valid: false,
      total_rows: 0,
      valid_rows: 0,
      invalid_rows: 0,
      errors: [
        `Invalid data_type: "${data_type}". Must be one of: ${VALID_DATA_TYPES.join(", ")}.`,
      ],
    };
  }

  // Validate file size
  if (file_size_bytes > UPLOAD.MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      total_rows: 0,
      valid_rows: 0,
      invalid_rows: 0,
      errors: [
        `File size (${file_size_bytes} bytes) exceeds maximum allowed size (${UPLOAD.MAX_FILE_SIZE_BYTES} bytes).`,
      ],
    };
  }

  // Parse the file
  let rows: ParsedRow[];
  try {
    rows = parseFile(file, file_name);
  } catch (parseError) {
    return {
      valid: false,
      total_rows: 0,
      valid_rows: 0,
      invalid_rows: 0,
      errors: [
        `File parse error: ${parseError instanceof Error ? parseError.message : "Unknown error."}`,
      ],
    };
  }

  if (rows.length > UPLOAD.MAX_RECORDS_PER_FILE) {
    return {
      valid: false,
      total_rows: rows.length,
      valid_rows: 0,
      invalid_rows: rows.length,
      errors: [
        `File contains ${rows.length} records, which exceeds the maximum of ${UPLOAD.MAX_RECORDS_PER_FILE}.`,
      ],
    };
  }

  // Validate required columns
  const columnErrors = validateRequiredColumns(rows, data_type);
  if (columnErrors.length > 0) {
    return {
      valid: false,
      total_rows: rows.length,
      valid_rows: 0,
      invalid_rows: rows.length,
      errors: columnErrors,
    };
  }

  // Validate individual rows
  const allErrors: string[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    const validationErrors = validateRow(rows[i], rowNumber, data_type);

    if (validationErrors.length > 0) {
      invalidCount++;
      if (allErrors.length < 100) {
        for (const ve of validationErrors) {
          allErrors.push(`Row ${ve.row}, ${ve.field}: ${ve.message}`);
        }
      }
    } else {
      validCount++;
    }
  }

  return {
    valid: invalidCount === 0,
    total_rows: rows.length,
    valid_rows: validCount,
    invalid_rows: invalidCount,
    errors: allErrors,
  };
}