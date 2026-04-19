import { NextRequest, NextResponse } from "next/server";
import { withRBAC, type RBACContext } from "@/lib/services/rbac";
import { computeAvailability } from "@/lib/services/analytics-engine";
import {
  sanitizeString,
  sanitizePaginationParams,
} from "@/lib/validators";
import { generateCorrelationId } from "@/lib/utils";
import type {
  CriticalityTier,
  Environment,
  TimePeriod,
} from "@/types";

// ============================================================
// Constants
// ============================================================

const VALID_TIERS: CriticalityTier[] = ["Tier-1", "Tier-2", "Tier-3", "Tier-4"];
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

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/dashboard/availability
 *
 * Returns availability % by domain/tier, top degraded services,
 * and SLA/SLO compliance data. Supports filtering by domain, tier,
 * environment, and time period.
 *
 * Query Parameters:
 * - domain (string, optional): Filter by business domain
 * - tier (CriticalityTier, optional): Filter by criticality tier
 * - environment (Environment, optional): Filter by environment
 * - period (TimePeriod, optional): Time range for availability computation (default: "24h")
 *
 * Requires: read:all or read:dashboard permission
 *
 * Response:
 * ```json
 * {
 *   "data": {
 *     "availability": [...],
 *     "top_degraded_services": [...],
 *     "sla_slo_compliance": [...],
 *     "last_updated": "ISO8601"
 *   },
 *   "status": "success",
 *   "correlation_id": "req-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 */
export const GET = withRBAC(
  async (req: NextRequest, context: RBACContext): Promise<NextResponse> => {
    const correlationId = generateCorrelationId("avail");
    const timestamp = new Date().toISOString();

    try {
      const { searchParams } = new URL(req.url);

      // Extract and sanitize query parameters
      const domain = sanitizeString(searchParams.get("domain"));
      const tierParam = sanitizeString(searchParams.get("tier"));
      const environmentParam = sanitizeString(searchParams.get("environment"));
      const periodParam = sanitizeString(searchParams.get("period"));

      // Validate tier parameter
      let tier: CriticalityTier | undefined;
      if (tierParam) {
        if (!VALID_TIERS.includes(tierParam as CriticalityTier)) {
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
        tier = tierParam as CriticalityTier;
      }

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

      // Compute availability data via the analytics engine
      const availabilityData = await computeAvailability({
        domain: domain || undefined,
        tier,
        period,
        environment,
      });

      return NextResponse.json(
        {
          data: availabilityData,
          status: "success",
          correlation_id: correlationId,
          timestamp,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error in GET /api/dashboard/availability:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while fetching availability data.";

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