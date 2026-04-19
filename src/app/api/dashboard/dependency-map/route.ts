import { NextRequest, NextResponse } from "next/server";
import { withRBAC, type RBACContext } from "@/lib/services/rbac";
import { buildDependencyGraph } from "@/lib/services/dependency-map-service";
import {
  sanitizeString,
  sanitizePaginationParams,
} from "@/lib/validators";
import { generateCorrelationId } from "@/lib/utils";
import type {
  CriticalityTier,
  Environment,
} from "@/types";

// ============================================================
// Constants
// ============================================================

const VALID_TIERS: CriticalityTier[] = ["Tier-1", "Tier-2", "Tier-3", "Tier-4"];
const VALID_ENVIRONMENTS: Environment[] = ["Prod", "Staging", "QA", "Dev"];
const MIN_DEPTH = 1;
const MAX_DEPTH = 10;
const DEFAULT_DEPTH = 3;

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/dashboard/dependency-map
 *
 * Returns service dependency nodes and edges with health status indicators.
 * Supports scoping to a specific incident (for blast radius computation),
 * a specific service (for neighborhood view), or a domain/tier filter.
 *
 * Query Parameters:
 * - incident_id (string, optional): Incident ID to compute blast radius for
 * - service_id (string, optional): Service ID to center the graph on
 * - domain (string, optional): Filter by business domain
 * - tier (CriticalityTier, optional): Filter by criticality tier
 * - environment (Environment, optional): Filter by environment
 * - depth (number, optional): Maximum traversal depth (default: 3, max: 10)
 *
 * Requires: read:all or read:dashboard permission
 *
 * Response:
 * ```json
 * {
 *   "data": {
 *     "nodes": [...],
 *     "edges": [...],
 *     "blast_radius": [...],
 *     "incident_id": "inc-123",
 *     "root_service_id": "svc-456",
 *     "depth": 3,
 *     "total_nodes": 12,
 *     "total_edges": 18
 *   },
 *   "status": "success",
 *   "correlation_id": "req-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 */
export const GET = withRBAC(
  async (req: NextRequest, context: RBACContext): Promise<NextResponse> => {
    const correlationId = generateCorrelationId("depmap");
    const timestamp = new Date().toISOString();

    try {
      const { searchParams } = new URL(req.url);

      // Extract and sanitize query parameters
      const incidentId = sanitizeString(searchParams.get("incident_id"));
      const serviceId = sanitizeString(searchParams.get("service_id"));
      const domain = sanitizeString(searchParams.get("domain"));
      const tierParam = sanitizeString(searchParams.get("tier"));
      const environmentParam = sanitizeString(searchParams.get("environment"));
      const depthParam = sanitizeString(searchParams.get("depth"));

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

      // Validate depth parameter
      let depth: number | undefined;
      if (depthParam) {
        const parsedDepth = Number(depthParam);
        if (isNaN(parsedDepth) || !Number.isInteger(parsedDepth)) {
          return NextResponse.json(
            {
              status: "error",
              message: `Invalid depth parameter: "${depthParam}". Must be an integer between ${MIN_DEPTH} and ${MAX_DEPTH}.`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
        if (parsedDepth < MIN_DEPTH || parsedDepth > MAX_DEPTH) {
          return NextResponse.json(
            {
              status: "error",
              message: `Invalid depth parameter: ${parsedDepth}. Must be between ${MIN_DEPTH} and ${MAX_DEPTH}.`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
        depth = parsedDepth;
      }

      // Build the dependency graph via the dependency map service
      const dependencyGraphData = await buildDependencyGraph({
        incident_id: incidentId || undefined,
        service_id: serviceId || undefined,
        domain: domain || undefined,
        tier,
        environment,
        depth,
      });

      return NextResponse.json(
        {
          data: dependencyGraphData,
          status: "success",
          correlation_id: correlationId,
          timestamp,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error in GET /api/dashboard/dependency-map:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while fetching dependency map data.";

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