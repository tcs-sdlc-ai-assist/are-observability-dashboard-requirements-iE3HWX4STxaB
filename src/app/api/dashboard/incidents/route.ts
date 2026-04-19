import { NextRequest, NextResponse } from "next/server";
import { withRBAC, type RBACContext } from "@/lib/services/rbac";
import { incidentTrends } from "@/lib/services/analytics-engine";
import {
  sanitizeString,
  sanitizePaginationParams,
} from "@/lib/validators";
import { generateCorrelationId } from "@/lib/utils";
import type {
  IncidentSeverity,
  IncidentStatus,
  TimePeriod,
} from "@/types";

// ============================================================
// Constants
// ============================================================

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

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/dashboard/incidents
 *
 * Returns incident analytics including incident counts by severity (P1-P4),
 * MTTR/MTTD averages, root cause distribution, repeat failure detection,
 * trend direction, and change failure correlation data. Supports filtering
 * by domain, service, severity, status, and time period.
 *
 * Query Parameters:
 * - domain (string, optional): Filter by business domain
 * - service_id (string, optional): Filter by service ID
 * - severity (IncidentSeverity, optional): Filter by incident severity
 * - status (IncidentStatus, optional): Filter by incident status
 * - period (TimePeriod, optional): Time range for analytics (default: "30d")
 * - start_time (string, optional): Custom start time (ISO8601)
 * - end_time (string, optional): Custom end time (ISO8601)
 *
 * Requires: read:all or read:dashboard permission
 *
 * Response:
 * ```json
 * {
 *   "data": {
 *     "incident_counts": {
 *       "critical": 2,
 *       "major": 5,
 *       "minor": 8,
 *       "warning": 3,
 *       "total": 18
 *     },
 *     "mttr": 45.5,
 *     "mttd": 12.3,
 *     "root_causes": [
 *       { "category": "Config", "count": 5 },
 *       { "category": "Code", "count": 3 }
 *     ],
 *     "repeat_failures": ["Config"],
 *     "trend": "down",
 *     "period": "30d",
 *     "change_failure_correlations": [...]
 *   },
 *   "status": "success",
 *   "correlation_id": "req-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 */
export const GET = withRBAC(
  async (req: NextRequest, context: RBACContext): Promise<NextResponse> => {
    const correlationId = generateCorrelationId("inc");
    const timestamp = new Date().toISOString();

    try {
      const { searchParams } = new URL(req.url);

      // Extract and sanitize query parameters
      const domain = sanitizeString(searchParams.get("domain"));
      const serviceId = sanitizeString(searchParams.get("service_id"));
      const severityParam = sanitizeString(searchParams.get("severity"));
      const statusParam = sanitizeString(searchParams.get("status"));
      const periodParam = sanitizeString(searchParams.get("period"));
      const startTime = sanitizeString(searchParams.get("start_time"));
      const endTime = sanitizeString(searchParams.get("end_time"));

      // Validate severity parameter
      let severity: IncidentSeverity | undefined;
      if (severityParam) {
        if (!VALID_SEVERITIES.includes(severityParam as IncidentSeverity)) {
          return NextResponse.json(
            {
              status: "error",
              message: `Invalid severity parameter: "${severityParam}". Must be one of: ${VALID_SEVERITIES.join(", ")}.`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
        severity = severityParam as IncidentSeverity;
      }

      // Validate status parameter
      if (statusParam) {
        if (!VALID_STATUSES.includes(statusParam as IncidentStatus)) {
          return NextResponse.json(
            {
              status: "error",
              message: `Invalid status parameter: "${statusParam}". Must be one of: ${VALID_STATUSES.join(", ")}.`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
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

      // Validate start_time parameter if provided
      if (startTime) {
        const parsedStart = new Date(startTime);
        if (isNaN(parsedStart.getTime())) {
          return NextResponse.json(
            {
              status: "error",
              message: `Invalid start_time parameter: "${startTime}". Must be a valid ISO8601 date string.`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
      }

      // Validate end_time parameter if provided
      if (endTime) {
        const parsedEnd = new Date(endTime);
        if (isNaN(parsedEnd.getTime())) {
          return NextResponse.json(
            {
              status: "error",
              message: `Invalid end_time parameter: "${endTime}". Must be a valid ISO8601 date string.`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
      }

      // Compute incident analytics via the analytics engine
      const incidentAnalyticsData = await incidentTrends({
        domain: domain || undefined,
        service_id: serviceId || undefined,
        severity,
        period,
        start_time: startTime || undefined,
        end_time: endTime || undefined,
      });

      return NextResponse.json(
        {
          data: incidentAnalyticsData,
          status: "success",
          correlation_id: correlationId,
          timestamp,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error in GET /api/dashboard/incidents:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while fetching incident analytics data.";

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