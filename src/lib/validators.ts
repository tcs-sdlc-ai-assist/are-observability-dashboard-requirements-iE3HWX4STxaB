import { z } from "zod";
import type {
  CriticalityTier,
  DataType,
  DeploymentStatus,
  DependencyType,
  EntityType,
  Environment,
  IncidentSeverity,
  IncidentStatus,
  MetricType,
  RootCauseCategory,
  TimePeriod,
} from "@/types";
import { UPLOAD, PAGINATION } from "@/constants/constants";

// ============================================================
// Shared Zod Primitives
// ============================================================

const nonEmptyString = z.string().trim().min(1, "This field is required.");

const uuidString = z
  .string()
  .trim()
  .min(1, "ID is required.")
  .max(256, "ID cannot exceed 256 characters.");

const isoTimestamp = z.string().refine(
  (val) => {
    const date = new Date(val);
    return !isNaN(date.getTime());
  },
  { message: "Must be a valid ISO8601 date string." }
);

const optionalIsoTimestamp = z
  .string()
  .optional()
  .nullable()
  .refine(
    (val) => {
      if (!val) return true;
      const date = new Date(val);
      return !isNaN(date.getTime());
    },
    { message: "Must be a valid ISO8601 date string." }
  );

const positiveNumber = z.number().positive("Must be a positive number.");

const nonNegativeNumber = z.number().min(0, "Must be a non-negative number.");

// ============================================================
// Enum Schemas
// ============================================================

const criticalityTierSchema = z.enum(["Tier-1", "Tier-2", "Tier-3", "Tier-4"], {
  errorMap: () => ({
    message: 'Must be one of: Tier-1, Tier-2, Tier-3, Tier-4.',
  }),
});

const environmentSchema = z.enum(["Prod", "Staging", "QA", "Dev"], {
  errorMap: () => ({
    message: 'Must be one of: Prod, Staging, QA, Dev.',
  }),
});

const incidentSeveritySchema = z.enum(["critical", "major", "minor", "warning"], {
  errorMap: () => ({
    message: 'Must be one of: critical, major, minor, warning.',
  }),
});

const incidentStatusSchema = z.enum(
  ["open", "investigating", "mitigated", "resolved", "closed"],
  {
    errorMap: () => ({
      message: 'Must be one of: open, investigating, mitigated, resolved, closed.',
    }),
  }
);

const metricTypeSchema = z.enum(
  [
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
  ],
  {
    errorMap: () => ({
      message:
        'Must be one of: latency_p50, latency_p95, latency_p99, errors_4xx, errors_5xx, traffic_rps, saturation_cpu, saturation_memory, saturation_disk, availability.',
    }),
  }
);

const rootCauseCategorySchema = z.enum(
  ["Config", "Code", "Infrastructure", "Dependency", "Capacity", "Network", "Security", "Unknown"],
  {
    errorMap: () => ({
      message:
        'Must be one of: Config, Code, Infrastructure, Dependency, Capacity, Network, Security, Unknown.',
    }),
  }
);

const deploymentStatusSchema = z.enum(["success", "failed", "rolled_back", "in_progress"], {
  errorMap: () => ({
    message: 'Must be one of: success, failed, rolled_back, in_progress.',
  }),
});

const dependencyTypeSchema = z.enum(
  ["calls", "publishes", "subscribes", "queries", "depends_on"],
  {
    errorMap: () => ({
      message: 'Must be one of: calls, publishes, subscribes, queries, depends_on.',
    }),
  }
);

const dataTypeSchema = z.enum(
  ["incident", "metric", "service_map", "deployment", "error_budget"],
  {
    errorMap: () => ({
      message: 'Must be one of: incident, metric, service_map, deployment, error_budget.',
    }),
  }
);

const entityTypeSchema = z.enum(["incident", "metric", "service", "deployment"], {
  errorMap: () => ({
    message: 'Must be one of: incident, metric, service, deployment.',
  }),
});

const trendDirectionSchema = z.enum(["up", "down", "stable"], {
  errorMap: () => ({
    message: 'Must be one of: up, down, stable.',
  }),
});

const timePeriodSchema = z.enum(
  ["1h", "6h", "12h", "24h", "7d", "14d", "30d", "90d"],
  {
    errorMap: () => ({
      message: 'Must be one of: 1h, 6h, 12h, 24h, 7d, 14d, 30d, 90d.',
    }),
  }
);

const documentationLinkCategorySchema = z.enum(
  ["runbook", "architecture", "sop", "postmortem", "sla", "other"],
  {
    errorMap: () => ({
      message: 'Must be one of: runbook, architecture, sop, postmortem, sla, other.',
    }),
  }
);

// ============================================================
// Upload Data Schemas
// ============================================================

/**
 * Schema for validating a single metric row in an upload file.
 */
export const metricRowSchema = z.object({
  service_id: nonEmptyString,
  metric_type: metricTypeSchema,
  value: z.coerce.number({ invalid_type_error: "value must be a number." }),
  timestamp: isoTimestamp,
  environment: environmentSchema.optional().nullable(),
  unit: z.string().optional().nullable(),
  tags: z
    .union([z.record(z.string()), z.string()])
    .optional()
    .nullable(),
});

/**
 * Schema for validating a single incident row in an upload file.
 */
export const incidentRowSchema = z.object({
  service_id: nonEmptyString,
  service_name: z.string().optional().nullable(),
  domain: z.string().optional().nullable(),
  severity: incidentSeveritySchema,
  status: incidentStatusSchema,
  title: nonEmptyString.max(512, "Title cannot exceed 512 characters."),
  description: z.string().optional().nullable(),
  start_time: isoTimestamp,
  end_time: optionalIsoTimestamp,
  mttr: z.coerce.number().optional().nullable(),
  mttd: z.coerce.number().optional().nullable(),
  root_cause: rootCauseCategorySchema.optional().nullable(),
  root_cause_details: z.string().optional().nullable(),
  repeat_failure: z
    .union([z.boolean(), z.string()])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === true || val === "true" || val === "1" || val === "yes") return true;
      return false;
    }),
  external_id: z.string().optional().nullable(),
});

/**
 * Schema for validating a single service_map (dependency edge) row in an upload file.
 */
export const serviceMapRowSchema = z.object({
  from_service: nonEmptyString,
  to_service: nonEmptyString,
  from_service_name: z.string().optional().nullable(),
  to_service_name: z.string().optional().nullable(),
  type: dependencyTypeSchema,
  latency_ms: z.coerce.number().optional().nullable(),
  error_rate: z.coerce.number().optional().nullable(),
  traffic_rps: z.coerce.number().optional().nullable(),
});

/**
 * Schema for validating a single deployment row in an upload file.
 */
export const deploymentRowSchema = z.object({
  service_id: nonEmptyString,
  service_name: z.string().optional().nullable(),
  version: nonEmptyString,
  environment: environmentSchema,
  status: deploymentStatusSchema,
  deployed_by: nonEmptyString,
  deployed_at: isoTimestamp,
  rollback_at: optionalIsoTimestamp,
  change_ticket: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  has_incident: z
    .union([z.boolean(), z.string()])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === true || val === "true" || val === "1" || val === "yes") return true;
      return false;
    }),
  incident_id: z.string().optional().nullable(),
});

/**
 * Schema for validating a single error_budget row in an upload file.
 */
export const errorBudgetRowSchema = z.object({
  service_id: nonEmptyString,
  service_name: z.string().optional().nullable(),
  period: nonEmptyString,
  initial: z.coerce.number({ invalid_type_error: "initial must be a number." }),
  consumed: z.coerce.number({ invalid_type_error: "consumed must be a number." }),
  remaining: z.coerce.number({ invalid_type_error: "remaining must be a number." }),
  breach: z
    .union([z.boolean(), z.string()])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === true || val === "true" || val === "1" || val === "yes") return true;
      return false;
    }),
  trend: trendDirectionSchema,
  slo_target: z.coerce.number({ invalid_type_error: "slo_target must be a number." }),
  burn_rate: z.coerce.number().optional().nullable(),
  projected_breach_date: optionalIsoTimestamp,
});

/**
 * Schema for the upload file metadata (not the file content itself).
 */
export const uploadMetadataSchema = z.object({
  file_name: nonEmptyString.max(512, "File name cannot exceed 512 characters."),
  file_size_bytes: z
    .number()
    .int()
    .positive("File size must be a positive integer.")
    .max(
      UPLOAD.MAX_FILE_SIZE_BYTES,
      `File size cannot exceed ${UPLOAD.MAX_FILE_SIZE_BYTES} bytes.`
    ),
  data_type: dataTypeSchema,
  uploader_id: nonEmptyString,
  uploader_name: z.string().optional(),
});

// ============================================================
// Metrics Config Schemas
// ============================================================

/**
 * Schema for a single metric entry within a metrics config creation request.
 */
export const metricsConfigEntrySchema = z.object({
  name: metricTypeSchema,
  threshold: positiveNumber,
  tier: criticalityTierSchema.optional(),
  environment: z.string().optional().refine(
    (val) => {
      if (!val) return true;
      return ["Prod", "Staging", "QA", "Dev"].includes(val);
    },
    { message: "Must be one of: Prod, Staging, QA, Dev." }
  ),
  enabled: z.boolean().optional().default(true),
});

/**
 * Schema for creating one or more metrics configurations.
 */
export const createMetricsConfigSchema = z.object({
  domain: nonEmptyString.max(128, "Domain name cannot exceed 128 characters."),
  application: nonEmptyString.max(128, "Application name cannot exceed 128 characters."),
  metrics: z
    .array(metricsConfigEntrySchema)
    .min(1, "At least one metric configuration is required.")
    .max(50, "Cannot configure more than 50 metrics at once."),
  user_id: nonEmptyString,
  user_name: z.string().optional(),
});

/**
 * Schema for updating an existing metrics configuration.
 */
export const updateMetricsConfigSchema = z.object({
  config_id: nonEmptyString,
  threshold: positiveNumber.optional(),
  tier: criticalityTierSchema.optional(),
  environment: z.string().optional().refine(
    (val) => {
      if (!val) return true;
      return ["Prod", "Staging", "QA", "Dev"].includes(val);
    },
    { message: "Must be one of: Prod, Staging, QA, Dev." }
  ),
  enabled: z.boolean().optional(),
  user_id: nonEmptyString,
  user_name: z.string().optional(),
});

/**
 * Schema for deleting a metrics configuration.
 */
export const deleteMetricsConfigSchema = z.object({
  config_id: nonEmptyString,
  user_id: nonEmptyString,
  user_name: z.string().optional(),
});

// ============================================================
// Annotation Schemas
// ============================================================

/**
 * Schema for creating a new annotation.
 */
export const createAnnotationSchema = z.object({
  entity_type: entityTypeSchema,
  entity_id: nonEmptyString.max(256, "Entity ID cannot exceed 256 characters."),
  annotation: nonEmptyString.max(5000, "Annotation text cannot exceed 5000 characters."),
  user_id: nonEmptyString,
  user_name: z.string().optional(),
});

/**
 * Schema for updating an existing annotation.
 */
export const updateAnnotationSchema = z.object({
  annotation_id: nonEmptyString,
  annotation: nonEmptyString.max(5000, "Annotation text cannot exceed 5000 characters."),
  user_id: nonEmptyString,
  user_name: z.string().optional(),
});

/**
 * Schema for deleting an annotation.
 */
export const deleteAnnotationSchema = z.object({
  annotation_id: nonEmptyString,
  user_id: nonEmptyString,
  user_name: z.string().optional(),
});

/**
 * Schema for creating a manual override (a special annotation).
 */
export const createManualOverrideSchema = z.object({
  entity_type: entityTypeSchema,
  entity_id: nonEmptyString.max(256, "Entity ID cannot exceed 256 characters."),
  field: nonEmptyString.max(128, "Field name cannot exceed 128 characters."),
  original_value: z.unknown(),
  override_value: z.unknown().refine(
    (val) => val !== undefined && val !== null,
    { message: "Override value is required." }
  ),
  reason: nonEmptyString.max(2000, "Reason cannot exceed 2000 characters."),
  user_id: nonEmptyString,
  user_name: z.string().optional(),
});

// ============================================================
// Documentation Link Schemas
// ============================================================

const httpUrlSchema = z
  .string()
  .trim()
  .min(1, "URL is required.")
  .max(2048, "URL cannot exceed 2048 characters.")
  .refine(
    (val) => {
      try {
        const parsed = new URL(val);
        return ["http:", "https:"].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    { message: "Must be a valid HTTP or HTTPS URL." }
  );

/**
 * Schema for creating a new documentation link.
 */
export const createDocumentationLinkSchema = z.object({
  title: nonEmptyString.max(256, "Title cannot exceed 256 characters."),
  url: httpUrlSchema,
  category: documentationLinkCategorySchema,
  service_id: z.string().optional(),
  domain_id: z.string().optional(),
  description: z.string().max(2000, "Description cannot exceed 2000 characters.").optional(),
  user_id: nonEmptyString,
  user_name: z.string().optional(),
});

/**
 * Schema for updating an existing documentation link.
 */
export const updateDocumentationLinkSchema = z.object({
  link_id: nonEmptyString,
  title: nonEmptyString.max(256, "Title cannot exceed 256 characters.").optional(),
  url: httpUrlSchema.optional(),
  category: documentationLinkCategorySchema.optional(),
  service_id: z.string().optional(),
  domain_id: z.string().optional(),
  description: z
    .string()
    .max(2000, "Description cannot exceed 2000 characters.")
    .optional()
    .nullable(),
  user_id: nonEmptyString,
  user_name: z.string().optional(),
});

/**
 * Schema for deleting a documentation link.
 */
export const deleteDocumentationLinkSchema = z.object({
  link_id: nonEmptyString,
  user_id: nonEmptyString,
  user_name: z.string().optional(),
});

// ============================================================
// Query Parameter Schemas
// ============================================================

/**
 * Schema for dashboard filter query parameters.
 */
export const dashboardFiltersSchema = z.object({
  domain: z.string().optional(),
  application: z.string().optional(),
  service: z.string().optional(),
  tier: criticalityTierSchema.optional(),
  environment: environmentSchema.optional(),
  period: timePeriodSchema.optional(),
  severity: incidentSeveritySchema.optional(),
  status: incidentStatusSchema.optional(),
});

/**
 * Schema for pagination query parameters.
 */
export const paginationSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1, "Page must be at least 1.")
    .default(PAGINATION.DEFAULT_PAGE),
  page_size: z.coerce
    .number()
    .int()
    .min(1, "Page size must be at least 1.")
    .max(PAGINATION.MAX_PAGE_SIZE, `Page size cannot exceed ${PAGINATION.MAX_PAGE_SIZE}.`)
    .default(PAGINATION.DEFAULT_PAGE_SIZE),
});

/**
 * Schema for annotation filter query parameters.
 */
export const annotationFilterSchema = z
  .object({
    entity_type: entityTypeSchema.optional(),
    entity_id: z.string().optional(),
    user_id: z.string().optional(),
    from: isoTimestamp.optional(),
    to: isoTimestamp.optional(),
  })
  .merge(paginationSchema.partial());

/**
 * Schema for metrics config filter query parameters.
 */
export const metricsConfigFilterSchema = z
  .object({
    domain: z.string().optional(),
    application: z.string().optional(),
    metric_name: z.string().optional(),
    tier: criticalityTierSchema.optional(),
    environment: z.string().optional(),
    enabled: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((val) => {
        if (val === undefined || val === null) return undefined;
        if (val === true || val === "true" || val === "1") return true;
        if (val === false || val === "false" || val === "0") return false;
        return undefined;
      }),
    configured_by: z.string().optional(),
  })
  .merge(paginationSchema.partial());

/**
 * Schema for documentation link filter query parameters.
 */
export const documentationLinkFilterSchema = z
  .object({
    category: documentationLinkCategorySchema.optional(),
    service_id: z.string().optional(),
    domain_id: z.string().optional(),
    created_by: z.string().optional(),
    search: z.string().max(256, "Search query cannot exceed 256 characters.").optional(),
  })
  .merge(paginationSchema.partial());

/**
 * Schema for audit log filter query parameters.
 */
export const auditLogFilterSchema = z
  .object({
    action: z.string().optional(),
    entity_type: entityTypeSchema.optional(),
    entity_id: z.string().optional(),
    user_id: z.string().optional(),
    from: isoTimestamp.optional(),
    to: isoTimestamp.optional(),
  })
  .merge(paginationSchema.partial());

/**
 * Schema for incident query parameters.
 */
export const incidentQuerySchema = z
  .object({
    domain: z.string().optional(),
    service: z.string().optional(),
    service_id: z.string().optional(),
    severity: incidentSeveritySchema.optional(),
    status: incidentStatusSchema.optional(),
    period: timePeriodSchema.optional(),
    start_time: isoTimestamp.optional(),
    end_time: isoTimestamp.optional(),
  })
  .merge(paginationSchema.partial());

/**
 * Schema for golden signals query parameters.
 */
export const goldenSignalsQuerySchema = z.object({
  service_id: z.string().optional(),
  domain: z.string().optional(),
  application: z.string().optional(),
  environment: environmentSchema.optional(),
  metrics: z.array(metricTypeSchema).optional(),
  period: timePeriodSchema.optional(),
});

/**
 * Schema for availability query parameters.
 */
export const availabilityQuerySchema = z.object({
  domain: z.string().optional(),
  tier: criticalityTierSchema.optional(),
  period: timePeriodSchema.optional(),
  environment: environmentSchema.optional(),
});

/**
 * Schema for error budget query parameters.
 */
export const errorBudgetQuerySchema = z.object({
  service_id: nonEmptyString,
  period: timePeriodSchema.optional(),
});

/**
 * Schema for dependency map query parameters.
 */
export const dependencyMapQuerySchema = z.object({
  incident_id: z.string().optional(),
  service_id: z.string().optional(),
  domain: z.string().optional(),
  tier: criticalityTierSchema.optional(),
  environment: environmentSchema.optional(),
  depth: z.coerce.number().int().min(1).max(10).optional(),
});

/**
 * Schema for compliance report query parameters.
 */
export const complianceReportQuerySchema = z.object({
  domain: z.string().optional(),
  service_id: z.string().optional(),
  tier: criticalityTierSchema.optional(),
  environment: environmentSchema.optional(),
  period: timePeriodSchema.optional(),
  from: isoTimestamp.optional(),
  to: isoTimestamp.optional(),
});

// ============================================================
// Validation Helper Functions
// ============================================================

/**
 * Validates input against a Zod schema and returns a structured result.
 * Does not throw — returns either the validated data or an array of error messages.
 *
 * @param schema - The Zod schema to validate against
 * @param data - The input data to validate
 * @returns Validation result with either parsed data or errors
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });

  return { success: false, errors };
}

/**
 * Validates input against a Zod schema and throws an error if validation fails.
 * Returns the parsed and validated data on success.
 *
 * @param schema - The Zod schema to validate against
 * @param data - The input data to validate
 * @returns The validated and parsed data
 * @throws Error with a descriptive message listing all validation failures
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = validate(schema, data);

  if (result.success) {
    return result.data;
  }

  throw new Error(`Validation failed: ${result.errors.join("; ")}`);
}

/**
 * Validates an upload row against the appropriate schema based on data type.
 * Returns a structured result with either the parsed row or validation errors.
 *
 * @param dataType - The data type of the upload
 * @param row - The row data to validate
 * @returns Validation result
 */
export function validateUploadRow(
  dataType: DataType,
  row: unknown
): { success: true; data: Record<string, unknown> } | { success: false; errors: string[] } {
  switch (dataType) {
    case "metric":
      return validate(metricRowSchema, row) as
        | { success: true; data: Record<string, unknown> }
        | { success: false; errors: string[] };
    case "incident":
      return validate(incidentRowSchema, row) as
        | { success: true; data: Record<string, unknown> }
        | { success: false; errors: string[] };
    case "service_map":
      return validate(serviceMapRowSchema, row) as
        | { success: true; data: Record<string, unknown> }
        | { success: false; errors: string[] };
    case "deployment":
      return validate(deploymentRowSchema, row) as
        | { success: true; data: Record<string, unknown> }
        | { success: false; errors: string[] };
    case "error_budget":
      return validate(errorBudgetRowSchema, row) as
        | { success: true; data: Record<string, unknown> }
        | { success: false; errors: string[] };
    default:
      return {
        success: false,
        errors: [`Unsupported data type: "${dataType}".`],
      };
  }
}

// ============================================================
// Query Parameter Sanitization
// ============================================================

/**
 * Sanitizes a string value by trimming whitespace and removing potentially
 * dangerous characters. Returns null if the input is empty after sanitization.
 *
 * @param value - The string value to sanitize
 * @returns Sanitized string or null
 */
export function sanitizeString(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  // Remove null bytes and control characters (except newlines and tabs)
  const sanitized = trimmed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return sanitized.length > 0 ? sanitized : null;
}

/**
 * Sanitizes and parses query parameters from a URL search params object.
 * Extracts known parameters, sanitizes string values, and coerces numeric values.
 *
 * @param searchParams - The URLSearchParams object to parse
 * @returns Sanitized query parameter object
 */
export function sanitizeQueryParams(
  searchParams: URLSearchParams
): Record<string, string | number | boolean | undefined> {
  const params: Record<string, string | number | boolean | undefined> = {};

  for (const [key, value] of searchParams.entries()) {
    const sanitized = sanitizeString(value);
    if (sanitized === null) continue;

    // Coerce known numeric parameters
    if (["page", "page_size", "depth", "limit"].includes(key)) {
      const num = Number(sanitized);
      if (!isNaN(num) && Number.isFinite(num)) {
        params[key] = Math.floor(num);
        continue;
      }
    }

    // Coerce known boolean parameters
    if (["enabled"].includes(key)) {
      if (sanitized === "true" || sanitized === "1") {
        params[key] = true;
        continue;
      }
      if (sanitized === "false" || sanitized === "0") {
        params[key] = false;
        continue;
      }
    }

    params[key] = sanitized;
  }

  return params;
}

/**
 * Validates and sanitizes pagination parameters from query params.
 * Returns safe defaults if the values are invalid.
 *
 * @param searchParams - The URLSearchParams object
 * @returns Validated pagination parameters
 */
export function sanitizePaginationParams(
  searchParams: URLSearchParams
): { page: number; page_size: number } {
  const rawPage = searchParams.get("page");
  const rawPageSize = searchParams.get("page_size");

  let page = PAGINATION.DEFAULT_PAGE;
  let pageSize = PAGINATION.DEFAULT_PAGE_SIZE;

  if (rawPage) {
    const parsed = Number(rawPage);
    if (!isNaN(parsed) && Number.isFinite(parsed) && parsed >= 1) {
      page = Math.floor(parsed);
    }
  }

  if (rawPageSize) {
    const parsed = Number(rawPageSize);
    if (!isNaN(parsed) && Number.isFinite(parsed) && parsed >= 1) {
      pageSize = Math.min(Math.floor(parsed), PAGINATION.MAX_PAGE_SIZE);
    }
  }

  return { page, page_size: pageSize };
}

/**
 * Validates that a file name has an accepted extension for upload.
 *
 * @param fileName - The file name to validate
 * @returns True if the file extension is accepted
 */
export function isAcceptedFileType(fileName: string): boolean {
  if (!fileName || fileName.trim().length === 0) return false;

  const lower = fileName.toLowerCase().trim();
  return UPLOAD.ACCEPTED_FILE_TYPES.some((ext) => lower.endsWith(ext));
}

/**
 * Validates that a file size is within the allowed upload limit.
 *
 * @param fileSizeBytes - The file size in bytes
 * @returns True if the file size is within limits
 */
export function isAcceptedFileSize(fileSizeBytes: number): boolean {
  if (!fileSizeBytes || fileSizeBytes <= 0) return false;
  return fileSizeBytes <= UPLOAD.MAX_FILE_SIZE_BYTES;
}

// ============================================================
// Re-exported Enum Schemas (for external use)
// ============================================================

export {
  criticalityTierSchema,
  environmentSchema,
  incidentSeveritySchema,
  incidentStatusSchema,
  metricTypeSchema,
  rootCauseCategorySchema,
  deploymentStatusSchema,
  dependencyTypeSchema,
  dataTypeSchema,
  entityTypeSchema,
  trendDirectionSchema,
  timePeriodSchema,
  documentationLinkCategorySchema,
};