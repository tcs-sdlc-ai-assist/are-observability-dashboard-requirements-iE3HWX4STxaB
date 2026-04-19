import { NextRequest, NextResponse } from "next/server";
import { withRBAC, type RBACContext } from "@/lib/services/rbac";
import {
  createMetricsConfig,
  updateMetricsConfig,
  deleteMetricsConfig,
  getMetricsConfigs,
  getMetricsConfigById,
  getMetricsConfigSummary,
  toggleMetricsConfig,
} from "@/lib/services/metrics-config-service";
import {
  sanitizeString,
  sanitizePaginationParams,
} from "@/lib/validators";
import { generateCorrelationId } from "@/lib/utils";
import type { CriticalityTier } from "@/types";

// ============================================================
// Constants
// ============================================================

const VALID_TIERS: CriticalityTier[] = ["Tier-1", "Tier-2", "Tier-3", "Tier-4"];
const VALID_ENVIRONMENTS: string[] = ["Prod", "Staging", "QA", "Dev"];
const VALID_METRIC_NAMES: string[] = [
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

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/admin/configure-metrics
 *
 * Returns current metrics configurations with optional filters.
 * Supports filtering by domain, application, metric_name, tier,
 * environment, enabled status, and configured_by user.
 *
 * Query Parameters:
 * - domain (string, optional): Filter by domain name
 * - application (string, optional): Filter by application name
 * - metric_name (string, optional): Filter by metric type
 * - tier (CriticalityTier, optional): Filter by criticality tier
 * - environment (string, optional): Filter by environment
 * - enabled (boolean, optional): Filter by enabled status
 * - configured_by (string, optional): Filter by configuring user ID
 * - page (number, optional): Page number (default: 1)
 * - page_size (number, optional): Page size (default: 20)
 * - summary (string, optional): If "true", returns grouped summary instead
 *
 * Requires: admin or are_lead role
 *
 * Response (list):
 * ```json
 * {
 *   "data": {
 *     "data": [...],
 *     "total": 10,
 *     "page": 1,
 *     "page_size": 20,
 *     "has_next": false,
 *     "has_previous": false
 *   },
 *   "status": "success",
 *   "correlation_id": "req-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 *
 * Response (summary):
 * ```json
 * {
 *   "data": [
 *     {
 *       "domain": "payments",
 *       "application": "checkout-api",
 *       "total_metrics": 5,
 *       "enabled_metrics": 4,
 *       "disabled_metrics": 1,
 *       "last_updated": "ISO8601"
 *     }
 *   ],
 *   "status": "success",
 *   "correlation_id": "req-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 */
export const GET = withRBAC(
  async (req: NextRequest, context: RBACContext): Promise<NextResponse> => {
    const correlationId = generateCorrelationId("mcfg");
    const timestamp = new Date().toISOString();

    try {
      const { searchParams } = new URL(req.url);

      // Check if summary mode is requested
      const summaryParam = sanitizeString(searchParams.get("summary"));
      if (summaryParam === "true") {
        try {
          const summaryData = await getMetricsConfigSummary();

          return NextResponse.json(
            {
              data: summaryData,
              status: "success",
              correlation_id: correlationId,
              timestamp,
            },
            { status: 200 }
          );
        } catch (error) {
          console.error("Error fetching metrics config summary:", error);

          const errorMessage =
            error instanceof Error
              ? error.message
              : "An unexpected error occurred while fetching the configuration summary.";

          return NextResponse.json(
            {
              status: "error",
              message: errorMessage,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 500 }
          );
        }
      }

      // Check if a specific config ID is requested
      const configId = sanitizeString(searchParams.get("config_id"));
      if (configId && configId.trim().length > 0) {
        try {
          const configRecord = await getMetricsConfigById(configId.trim());

          if (!configRecord) {
            return NextResponse.json(
              {
                status: "error",
                message: `Metrics configuration not found: ${configId.trim()}.`,
                correlation_id: correlationId,
                timestamp,
              },
              { status: 404 }
            );
          }

          return NextResponse.json(
            {
              data: configRecord,
              status: "success",
              correlation_id: correlationId,
              timestamp,
            },
            { status: 200 }
          );
        } catch (error) {
          console.error("Error fetching metrics config by ID:", error);

          const errorMessage =
            error instanceof Error
              ? error.message
              : "An unexpected error occurred while fetching the configuration.";

          return NextResponse.json(
            {
              status: "error",
              message: errorMessage,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 500 }
          );
        }
      }

      // Extract and sanitize filter parameters
      const domain = sanitizeString(searchParams.get("domain"));
      const application = sanitizeString(searchParams.get("application"));
      const metricName = sanitizeString(searchParams.get("metric_name"));
      const tierParam = sanitizeString(searchParams.get("tier"));
      const environment = sanitizeString(searchParams.get("environment"));
      const enabledParam = sanitizeString(searchParams.get("enabled"));
      const configuredBy = sanitizeString(searchParams.get("configured_by"));
      const { page, page_size } = sanitizePaginationParams(searchParams);

      // Validate tier parameter
      if (tierParam && !VALID_TIERS.includes(tierParam as CriticalityTier)) {
        return NextResponse.json(
          {
            status: "error",
            message: `Invalid tier parameter: "${tierParam}". Must be one of: ${VALID_TIERS.join(", ")}.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Validate environment parameter
      if (environment && !VALID_ENVIRONMENTS.includes(environment)) {
        return NextResponse.json(
          {
            status: "error",
            message: `Invalid environment parameter: "${environment}". Must be one of: ${VALID_ENVIRONMENTS.join(", ")}.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Validate metric_name parameter
      if (metricName && !VALID_METRIC_NAMES.includes(metricName)) {
        return NextResponse.json(
          {
            status: "error",
            message: `Invalid metric_name parameter: "${metricName}". Must be one of: ${VALID_METRIC_NAMES.join(", ")}.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Parse enabled parameter
      let enabled: boolean | undefined;
      if (enabledParam !== null) {
        if (enabledParam === "true" || enabledParam === "1") {
          enabled = true;
        } else if (enabledParam === "false" || enabledParam === "0") {
          enabled = false;
        }
      }

      // Fetch metrics configurations
      const configData = await getMetricsConfigs({
        domain: domain || undefined,
        application: application || undefined,
        metric_name: metricName || undefined,
        tier: tierParam ? (tierParam as CriticalityTier) : undefined,
        environment: environment || undefined,
        enabled,
        configured_by: configuredBy || undefined,
        page,
        page_size,
      });

      return NextResponse.json(
        {
          data: configData,
          status: "success",
          correlation_id: correlationId,
          timestamp,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error in GET /api/admin/configure-metrics:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while fetching metrics configurations.";

      return NextResponse.json(
        {
          status: "error",
          message: errorMessage,
          correlation_id: correlationId,
          timestamp,
        },
        { status: 500 }
      );
    }
  },
  { requiredPermission: "read:all" }
);

// ============================================================
// POST Handler
// ============================================================

/**
 * POST /api/admin/configure-metrics
 *
 * Creates one or more metrics threshold configurations for a domain/application.
 * Each metric entry is validated individually. Valid entries are inserted;
 * invalid entries are collected as errors. The operation is logged to the
 * audit trail for compliance.
 *
 * Requires: admin or are_lead role (write:services permission)
 *
 * Request Body:
 * ```json
 * {
 *   "domain": "payments",
 *   "application": "checkout-api",
 *   "metrics": [
 *     { "name": "latency_p95", "threshold": 200, "tier": "Tier-1", "environment": "Prod", "enabled": true },
 *     { "name": "errors_5xx", "threshold": 0.01 }
 *   ]
 * }
 * ```
 *
 * Response (success):
 * ```json
 * {
 *   "data": {
 *     "created": 2,
 *     "failed": 0,
 *     "errors": [],
 *     "config_ids": ["cfg-...", "cfg-..."]
 *   },
 *   "status": "success",
 *   "message": "2 metric threshold(s) configured successfully.",
 *   "correlation_id": "req-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 *
 * Response (partial):
 * ```json
 * {
 *   "data": {
 *     "created": 1,
 *     "failed": 1,
 *     "errors": ["Metric 2 (unknown): Invalid metric name..."],
 *     "config_ids": ["cfg-..."]
 *   },
 *   "status": "success",
 *   "message": "1 metric threshold(s) configured, 1 failed.",
 *   "correlation_id": "req-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 */
export const POST = withRBAC(
  async (req: NextRequest, context: RBACContext): Promise<NextResponse> => {
    const correlationId = generateCorrelationId("mcfg");
    const timestamp = new Date().toISOString();

    try {
      // Parse request body
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          {
            status: "error",
            message: "Invalid JSON in request body.",
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Extract and validate required fields
      const domain = typeof body.domain === "string" ? body.domain.trim() : "";
      const application = typeof body.application === "string" ? body.application.trim() : "";
      const metrics = Array.isArray(body.metrics) ? body.metrics : [];

      // Validate domain
      if (!domain) {
        return NextResponse.json(
          {
            status: "error",
            message: 'Missing required field: "domain". Please provide a domain name.',
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      if (domain.length > 128) {
        return NextResponse.json(
          {
            status: "error",
            message: "Domain name cannot exceed 128 characters.",
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Validate application
      if (!application) {
        return NextResponse.json(
          {
            status: "error",
            message: 'Missing required field: "application". Please provide an application name.',
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      if (application.length > 128) {
        return NextResponse.json(
          {
            status: "error",
            message: "Application name cannot exceed 128 characters.",
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Validate metrics array
      if (metrics.length === 0) {
        return NextResponse.json(
          {
            status: "error",
            message:
              'Missing required field: "metrics". At least one metric configuration is required.',
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      if (metrics.length > 50) {
        return NextResponse.json(
          {
            status: "error",
            message: "Cannot configure more than 50 metrics at once.",
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Validate individual metric entries at the API level
      const validationErrors: string[] = [];
      const validatedMetrics: Array<{
        name: string;
        threshold: number;
        tier?: CriticalityTier;
        environment?: string;
        enabled?: boolean;
      }> = [];

      for (let i = 0; i < metrics.length; i++) {
        const metric = metrics[i];
        const metricIndex = i + 1;

        if (!metric || typeof metric !== "object") {
          validationErrors.push(`Metric ${metricIndex}: Must be an object with name and threshold.`);
          continue;
        }

        const name = typeof metric.name === "string" ? metric.name.trim() : "";
        const threshold = typeof metric.threshold === "number" ? metric.threshold : Number(metric.threshold);

        if (!name) {
          validationErrors.push(`Metric ${metricIndex}: "name" is required.`);
          continue;
        }

        if (!VALID_METRIC_NAMES.includes(name)) {
          validationErrors.push(
            `Metric ${metricIndex} (${name}): Invalid metric name. Must be one of: ${VALID_METRIC_NAMES.join(", ")}.`
          );
          continue;
        }

        if (isNaN(threshold) || threshold <= 0) {
          validationErrors.push(
            `Metric ${metricIndex} (${name}): Threshold must be a positive number.`
          );
          continue;
        }

        // Validate optional tier
        let tier: CriticalityTier | undefined;
        if (metric.tier !== undefined && metric.tier !== null && metric.tier !== "") {
          const tierStr = String(metric.tier).trim();
          if (!VALID_TIERS.includes(tierStr as CriticalityTier)) {
            validationErrors.push(
              `Metric ${metricIndex} (${name}): Invalid tier "${tierStr}". Must be one of: ${VALID_TIERS.join(", ")}.`
            );
            continue;
          }
          tier = tierStr as CriticalityTier;
        }

        // Validate optional environment
        let environment: string | undefined;
        if (metric.environment !== undefined && metric.environment !== null && metric.environment !== "") {
          const envStr = String(metric.environment).trim();
          if (!VALID_ENVIRONMENTS.includes(envStr)) {
            validationErrors.push(
              `Metric ${metricIndex} (${name}): Invalid environment "${envStr}". Must be one of: ${VALID_ENVIRONMENTS.join(", ")}.`
            );
            continue;
          }
          environment = envStr;
        }

        // Parse enabled flag
        const enabled = metric.enabled !== undefined ? Boolean(metric.enabled) : true;

        validatedMetrics.push({
          name,
          threshold,
          tier,
          environment,
          enabled,
        });
      }

      // If all metrics failed validation, return error
      if (validatedMetrics.length === 0 && validationErrors.length > 0) {
        return NextResponse.json(
          {
            data: {
              created: 0,
              failed: metrics.length,
              errors: validationErrors,
              config_ids: [],
            },
            status: "error",
            message: `All ${metrics.length} metric configuration(s) failed validation.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 422 }
        );
      }

      // Check for duplicate metric names in the request
      const metricNames = validatedMetrics.map((m) => m.name);
      const uniqueNames = new Set(metricNames);
      if (metricNames.length !== uniqueNames.size) {
        return NextResponse.json(
          {
            status: "error",
            message: "Duplicate metric types are not allowed in a single request.",
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Create the metrics configuration via the service
      const result = await createMetricsConfig({
        domain,
        application,
        metrics: validatedMetrics,
        user_id: context.userId,
        user_name: context.userName,
      });

      // Combine service-level errors with API-level validation errors
      const allErrors = [...validationErrors, ...result.errors];

      // Determine HTTP status code
      const httpStatus =
        result.created === 0 && allErrors.length > 0
          ? 422
          : allErrors.length > 0
            ? 207
            : 201;

      // Build response message
      let message: string;
      if (result.created > 0 && allErrors.length === 0) {
        message = `${result.created} metric threshold(s) configured successfully.`;
      } else if (result.created > 0 && allErrors.length > 0) {
        message = `${result.created} metric threshold(s) configured, ${result.failed + validationErrors.length} failed.`;
      } else {
        message = `Configuration failed. ${allErrors.length > 0 ? allErrors[0] : "No metrics were configured."}`;
      }

      return NextResponse.json(
        {
          data: {
            created: result.created,
            failed: result.failed + validationErrors.length,
            errors: allErrors,
            config_ids: result.config_ids,
          },
          status: result.created === 0 && allErrors.length > 0 ? "error" : "success",
          message,
          correlation_id: correlationId,
          timestamp,
        },
        { status: httpStatus }
      );
    } catch (error) {
      console.error("Error in POST /api/admin/configure-metrics:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while configuring metrics.";

      return NextResponse.json(
        {
          status: "error",
          message: errorMessage,
          correlation_id: correlationId,
          timestamp,
        },
        { status: 500 }
      );
    }
  },
  { requiredPermission: "write:services" }
);

// ============================================================
// PUT Handler
// ============================================================

/**
 * PUT /api/admin/configure-metrics
 *
 * Updates an existing metrics configuration record. Only threshold, tier,
 * environment, and enabled fields can be modified. The update is recorded
 * in the audit log for compliance.
 *
 * Requires: admin or are_lead role (write:services permission)
 *
 * Request Body:
 * ```json
 * {
 *   "config_id": "cfg-123",
 *   "threshold": 250,
 *   "tier": "Tier-2",
 *   "environment": "Prod",
 *   "enabled": true
 * }
 * ```
 *
 * Response:
 * ```json
 * {
 *   "data": {
 *     "id": "cfg-123",
 *     "domain": "payments",
 *     "application": "checkout-api",
 *     "metric_name": "latency_p95",
 *     "threshold": 250,
 *     "tier": "Tier-2",
 *     "environment": "Prod",
 *     "enabled": true,
 *     "configured_by": "...",
 *     "configured_at": "ISO8601",
 *     "updated_at": "ISO8601"
 *   },
 *   "status": "success",
 *   "correlation_id": "req-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 */
export const PUT = withRBAC(
  async (req: NextRequest, context: RBACContext): Promise<NextResponse> => {
    const correlationId = generateCorrelationId("mcfg");
    const timestamp = new Date().toISOString();

    try {
      // Parse request body
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          {
            status: "error",
            message: "Invalid JSON in request body.",
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      const configId = typeof body.config_id === "string" ? body.config_id.trim() : "";

      // Validate config_id
      if (!configId) {
        return NextResponse.json(
          {
            status: "error",
            message: 'Missing required field: "config_id".',
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Validate optional threshold
      let threshold: number | undefined;
      if (body.threshold !== undefined && body.threshold !== null) {
        threshold = typeof body.threshold === "number" ? body.threshold : Number(body.threshold);
        if (isNaN(threshold) || threshold <= 0) {
          return NextResponse.json(
            {
              status: "error",
              message: "Threshold must be a positive number.",
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
      }

      // Validate optional tier
      let tier: CriticalityTier | undefined;
      if (body.tier !== undefined && body.tier !== null && body.tier !== "") {
        const tierStr = String(body.tier).trim();
        if (!VALID_TIERS.includes(tierStr as CriticalityTier)) {
          return NextResponse.json(
            {
              status: "error",
              message: `Invalid tier: "${tierStr}". Must be one of: ${VALID_TIERS.join(", ")}.`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
        tier = tierStr as CriticalityTier;
      }

      // Validate optional environment
      let environment: string | undefined;
      if (body.environment !== undefined && body.environment !== null && body.environment !== "") {
        const envStr = String(body.environment).trim();
        if (!VALID_ENVIRONMENTS.includes(envStr)) {
          return NextResponse.json(
            {
              status: "error",
              message: `Invalid environment: "${envStr}". Must be one of: ${VALID_ENVIRONMENTS.join(", ")}.`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
        environment = envStr;
      }

      // Parse optional enabled flag
      let enabled: boolean | undefined;
      if (body.enabled !== undefined && body.enabled !== null) {
        enabled = Boolean(body.enabled);
      }

      // Ensure at least one field is being updated
      if (
        threshold === undefined &&
        tier === undefined &&
        environment === undefined &&
        enabled === undefined
      ) {
        return NextResponse.json(
          {
            status: "error",
            message:
              "At least one field must be provided for update: threshold, tier, environment, or enabled.",
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Update the configuration via the service
      const updatedConfig = await updateMetricsConfig({
        config_id: configId,
        threshold,
        tier,
        environment,
        enabled,
        user_id: context.userId,
        user_name: context.userName,
      });

      return NextResponse.json(
        {
          data: updatedConfig,
          status: "success",
          correlation_id: correlationId,
          timestamp,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error in PUT /api/admin/configure-metrics:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while updating the metrics configuration.";

      // Check for not-found errors
      if (
        error instanceof Error &&
        error.message.includes("not found")
      ) {
        return NextResponse.json(
          {
            status: "error",
            message: errorMessage,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          status: "error",
          message: errorMessage,
          correlation_id: correlationId,
          timestamp,
        },
        { status: 500 }
      );
    }
  },
  { requiredPermission: "write:services" }
);

// ============================================================
// DELETE Handler
// ============================================================

/**
 * DELETE /api/admin/configure-metrics
 *
 * Deletes an existing metrics configuration record by ID.
 * The deletion is recorded in the audit log for compliance.
 *
 * Requires: admin or are_lead role (write:services permission)
 *
 * Request Body:
 * ```json
 * {
 *   "config_id": "cfg-123"
 * }
 * ```
 *
 * Response:
 * ```json
 * {
 *   "status": "success",
 *   "message": "Metrics configuration deleted successfully.",
 *   "correlation_id": "req-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 */
export const DELETE = withRBAC(
  async (req: NextRequest, context: RBACContext): Promise<NextResponse> => {
    const correlationId = generateCorrelationId("mcfg");
    const timestamp = new Date().toISOString();

    try {
      // Parse request body
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          {
            status: "error",
            message: "Invalid JSON in request body.",
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      const configId = typeof body.config_id === "string" ? body.config_id.trim() : "";

      // Validate config_id
      if (!configId) {
        return NextResponse.json(
          {
            status: "error",
            message: 'Missing required field: "config_id".',
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Delete the configuration via the service
      await deleteMetricsConfig({
        config_id: configId,
        user_id: context.userId,
        user_name: context.userName,
      });

      return NextResponse.json(
        {
          status: "success",
          message: "Metrics configuration deleted successfully.",
          correlation_id: correlationId,
          timestamp,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error in DELETE /api/admin/configure-metrics:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while deleting the metrics configuration.";

      // Check for not-found errors
      if (
        error instanceof Error &&
        error.message.includes("not found")
      ) {
        return NextResponse.json(
          {
            status: "error",
            message: errorMessage,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          status: "error",
          message: errorMessage,
          correlation_id: correlationId,
          timestamp,
        },
        { status: 500 }
      );
    }
  },
  { requiredPermission: "write:services" }
);