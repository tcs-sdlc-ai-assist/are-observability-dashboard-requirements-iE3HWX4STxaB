import { NextRequest, NextResponse } from "next/server";
import { withRBAC, type RBACContext } from "@/lib/services/rbac";
import { computeErrorBudget } from "@/lib/services/analytics-engine";
import {
  sanitizeString,
  sanitizePaginationParams,
} from "@/lib/validators";
import { generateCorrelationId } from "@/lib/utils";
import type { TimePeriod } from "@/types";

// ============================================================
// Constants
// ============================================================

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
 * GET /api/dashboard/error-budgets
 *
 * Returns error budget burn-down data, breach indicators, burn rate
 * history, trend information, and recommendations for a specific service.
 *
 * Query Parameters:
 * - service_id (string, required): The service ID to fetch error budget for
 * - period (TimePeriod, optional): Time range for error budget computation (default: "30d")
 *
 * Requires: read:all or read:dashboard permission
 *
 * Response:
 * ```json
 * {
 *   "data": {
 *     "error_budget": {
 *       "id": "...",
 *       "service_id": "...",
 *       "period": "30d",
 *       "initial": 1000,
 *       "consumed": 850,
 *       "remaining": 150,
 *       "breach": true,
 *       "trend": "down",
 *       "slo_target": 99.9,
 *       "burn_rate": 1.5,
 *       "projected_breach_date": "ISO8601",
 *       "updated_at": "ISO8601"
 *     },
 *     "burn_rate_history": [...],
 *     "recommendations": [...]
 *   },
 *   "status": "success",
 *   "correlation_id": "req-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 */
export const GET = withRBAC(
  async (req: NextRequest, context: RBACContext): Promise<NextResponse> => {
    const correlationId = generateCorrelationId("eb");
    const timestamp = new Date().toISOString();

    try {
      const { searchParams } = new URL(req.url);

      // Extract and sanitize query parameters
      const serviceId = sanitizeString(searchParams.get("service_id"));
      const periodParam = sanitizeString(searchParams.get("period"));

      // Validate required service_id parameter
      if (!serviceId) {
        return NextResponse.json(
          {
            status: "error",
            message:
              'Missing required query parameter: "service_id". Please provide a valid service ID.',
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
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

      // Compute error budget data via the analytics engine
      const errorBudgetData = await computeErrorBudget({
        service_id: serviceId,
        period,
      });

      return NextResponse.json(
        {
          data: errorBudgetData,
          status: "success",
          correlation_id: correlationId,
          timestamp,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error in GET /api/dashboard/error-budgets:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while fetching error budget data.";

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