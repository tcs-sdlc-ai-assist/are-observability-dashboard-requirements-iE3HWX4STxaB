import { NextRequest, NextResponse } from "next/server";
import { withRBAC, type RBACContext } from "@/lib/services/rbac";
import { computeGoldenSignals } from "@/lib/services/analytics-engine";
import {
  sanitizeString,
  sanitizePaginationParams,
} from "@/lib/validators";
import { generateCorrelationId } from "@/lib/utils";
import type {
  Environment,
  MetricType,
  TimePeriod,
} from "@/types";

// ============================================================
// Constants
// ============================================================

const VALID_ENVIRONMENTS: Environment[] = ["Prod", "Staging", "QA", "Dev"];
const VALID_PERIODS: TimePeriod[] = [
  "1h",
  "6h",
  "12h",
  "24h",
  "7d",
  "14d",
  "30d",
  "90d",
];
const VALID_METRICS: MetricType[] = [
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
 * GET /api/dashboard/golden-signals
 *
 * Returns golden signals (latency, traffic, errors, saturation) time series
 * data for one or more services. Supports filtering by service, domain,
 * application, environment, specific metric types, and time period.
 *
 * Query Parameters:
 * - service_id (string, optional): Filter to a specific service
 * - domain (string, optional): Filter by business domain
 * - application (string, optional): Filter by application name
 * - environment (Environment, optional): Filter by environment
 * - metrics (string, optional): Comma-separated list of metric types to return
 * - period (TimePeriod, optional): Time range for data (default: "24h")
 *
 * Requires: read:all or read:dashboard permission
 *
 * Response:
 * ```json
 * {
 *   "data": [
 *     {
 *       "signals": [
 *         { "metric": "latency_p95", "value": 210, "unit": "ms", "threshold": 200, "breached": true },
 *         { "metric": "errors_5xx", "value": 0.03, "unit": "count", "threshold": 0.01, "breached": true },
 *         { "metric": "traffic_rps", "value": 1250, "unit": "rps" },
 *         { "metric": "saturation_cpu", "value": 72, "unit": "percent", "threshold": 90, "breached": false }
 *       ],
 *       "service_id": "svc-123",
 *       "service_name": "Checkout API",
 *       "environment": "Prod",
 *       "timestamp": "2024-06-01T12:00:00Z"
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
    const correlationId = generateCorrelationId("gs");
    const timestamp = new Date().toISOString();

    try {
      const { searchParams } = new URL(req.url);

      // Extract and sanitize query parameters
      const serviceId = sanitizeString(searchParams.get("service_id"));
      const domain = sanitizeString(searchParams.get("domain"));
      const application = sanitizeString(searchParams.get("application"));
      const environmentParam = sanitizeString(searchParams.get("environment"));
      const metricsParam = sanitizeString(searchParams.get("metrics"));
      const periodParam = sanitizeString(searchParams.get("period"));

      // Validate environment parameter
      let environment: Environment | undefined;
      if (environmentParam) {
        if (!VALID_ENVIRONMENTS.includes(environmentParam as Environment)) {
          return NextResponse.json(
            {
              status: "error",
              message: `Invalid environment parameter: "${environmentParam}". Must be one of: ${VALID_ENVIRONMENTS.join(", ")}.`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
        environment = environmentParam as Environment;
      }

      // Validate period parameter
      let period: TimePeriod | undefined;
      if (periodParam) {
        if (!VALID_PERIODS.includes(periodParam as TimePeriod)) {
          return NextResponse.json(
            {
              status: "error",
              message: `Invalid period parameter: "${periodParam}". Must be one of: ${VALID_PERIODS.join(", ")}.`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
        period = periodParam as TimePeriod;
      }

      // Validate and parse metrics parameter
      let metrics: MetricType[] | undefined;
      if (metricsParam) {
        const metricsList = metricsParam
          .split(",")
          .map((m) => m.trim())
          .filter((m) => m.length > 0);

        const invalidMetrics = metricsList.filter(
          (m) => !VALID_METRICS.includes(m as MetricType)
        );

        if (invalidMetrics.length > 0) {
          return NextResponse.json(
            {
              status: "error",
              message: `Invalid metrics parameter: "${invalidMetrics.join(", ")}". Must be one or more of: ${VALID_METRICS.join(", ")}.`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }

        metrics = metricsList as MetricType[];
      }

      // Compute golden signals via the analytics engine
      const goldenSignalsData = await computeGoldenSignals({
        service_id: serviceId || undefined,
        domain: domain || undefined,
        application: application || undefined,
        environment,
        metrics,
        period,
      });

      return NextResponse.json(
        {
          data: goldenSignalsData,
          status: "success",
          correlation_id: correlationId,
          timestamp,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error in GET /api/dashboard/golden-signals:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while fetching golden signals data.";

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
  { requiredPermission: "read:dashboard" }
);