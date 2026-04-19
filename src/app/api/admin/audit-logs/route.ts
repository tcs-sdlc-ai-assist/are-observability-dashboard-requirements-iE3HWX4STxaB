import { NextRequest, NextResponse } from "next/server";
import { withRBAC, type RBACContext } from "@/lib/services/rbac";
import { getAuditLogs } from "@/lib/services/audit-logger";
import {
  sanitizeString,
  sanitizePaginationParams,
} from "@/lib/validators";
import { generateCorrelationId } from "@/lib/utils";
import type { EntityType } from "@/types";

// ============================================================
// Constants
// ============================================================

const VALID_ENTITY_TYPES: EntityType[] = [
  "incident",
  "metric",
  "service",
  "deployment",
];

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/admin/audit-logs
 *
 * Returns paginated, filterable audit log entries. Supports filtering
 * by action type, entity type, entity ID, user ID, and time range.
 *
 * Restricted to users with view:audit_log permission (admin, are_lead roles).
 *
 * Query Parameters:
 * - action (string, optional): Filter by action type (e.g., "UPLOAD_INTERIM_DATA")
 * - entity_type (EntityType, optional): Filter by entity type
 * - entity_id (string, optional): Filter by entity ID
 * - user_id (string, optional): Filter by actor user ID
 * - from (string, optional): Start of time range (ISO8601)
 * - to (string, optional): End of time range (ISO8601)
 * - page (number, optional): Page number (default: 1)
 * - page_size (number, optional): Page size (default: 20)
 *
 * Response:
 * ```json
 * {
 *   "data": {
 *     "data": [...],
 *     "total": 100,
 *     "page": 1,
 *     "page_size": 20,
 *     "has_next": true,
 *     "has_previous": false
 *   },
 *   "status": "success",
 *   "correlation_id": "audit-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 */
export const GET = withRBAC(
  async (req: NextRequest, context: RBACContext): Promise<NextResponse> => {
    const correlationId = generateCorrelationId("audit");
    const timestamp = new Date().toISOString();

    try {
      const { searchParams } = new URL(req.url);

      // Extract and sanitize filter parameters
      const action = sanitizeString(searchParams.get("action"));
      const entityTypeParam = sanitizeString(searchParams.get("entity_type"));
      const entityId = sanitizeString(searchParams.get("entity_id"));
      const userId = sanitizeString(searchParams.get("user_id"));
      const from = sanitizeString(searchParams.get("from"));
      const to = sanitizeString(searchParams.get("to"));
      const { page, page_size } = sanitizePaginationParams(searchParams);

      // Validate entity_type parameter if provided
      if (entityTypeParam && !VALID_ENTITY_TYPES.includes(entityTypeParam as EntityType)) {
        return NextResponse.json(
          {
            status: "error",
            message: `Invalid entity_type parameter: "${entityTypeParam}". Must be one of: ${VALID_ENTITY_TYPES.join(", ")}.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Validate from parameter if provided
      if (from) {
        const parsedFrom = new Date(from);
        if (isNaN(parsedFrom.getTime())) {
          return NextResponse.json(
            {
              status: "error",
              message: `Invalid from parameter: "${from}". Must be a valid ISO8601 date string.`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
      }

      // Validate to parameter if provided
      if (to) {
        const parsedTo = new Date(to);
        if (isNaN(parsedTo.getTime())) {
          return NextResponse.json(
            {
              status: "error",
              message: `Invalid to parameter: "${to}". Must be a valid ISO8601 date string.`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
      }

      // Validate from/to ordering if both are provided
      if (from && to) {
        const parsedFrom = new Date(from);
        const parsedTo = new Date(to);
        if (parsedFrom.getTime() > parsedTo.getTime()) {
          return NextResponse.json(
            {
              status: "error",
              message: `Invalid time range: "from" (${from}) must be before "to" (${to}).`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
      }

      // Fetch audit logs via the audit logger service
      const auditLogData = await getAuditLogs({
        action: action || undefined,
        entity_type: entityTypeParam ? (entityTypeParam as EntityType) : undefined,
        entity_id: entityId || undefined,
        user_id: userId || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        page_size,
      });

      return NextResponse.json(
        {
          data: auditLogData,
          status: "success",
          correlation_id: correlationId,
          timestamp,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error in GET /api/admin/audit-logs:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while fetching audit logs.";

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
  { requiredPermission: "view:audit_log" }
);