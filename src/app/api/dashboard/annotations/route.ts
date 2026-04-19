import { NextRequest, NextResponse } from "next/server";
import { withRBAC, type RBACContext } from "@/lib/services/rbac";
import {
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  getAnnotations,
} from "@/lib/services/annotation-service";
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

const MAX_ANNOTATION_LENGTH = 5000;

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/dashboard/annotations
 *
 * Returns annotations for a specific entity or filtered list of annotations.
 * Supports filtering by entity_type, entity_id, user_id, and time range.
 *
 * Query Parameters:
 * - entity_type (EntityType, optional): Filter by entity type
 * - entity_id (string, optional): Filter by entity ID
 * - user_id (string, optional): Filter by annotation author
 * - from (string, optional): Start of time range (ISO8601)
 * - to (string, optional): End of time range (ISO8601)
 * - page (number, optional): Page number (default: 1)
 * - page_size (number, optional): Page size (default: 20)
 *
 * Requires: read:all or read:dashboard permission
 *
 * Response:
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
 */
export const GET = withRBAC(
  async (req: NextRequest, context: RBACContext): Promise<NextResponse> => {
    const correlationId = generateCorrelationId("ann");
    const timestamp = new Date().toISOString();

    try {
      const { searchParams } = new URL(req.url);

      // Extract and sanitize query parameters
      const entityTypeParam = sanitizeString(searchParams.get("entity_type"));
      const entityId = sanitizeString(searchParams.get("entity_id"));
      const userId = sanitizeString(searchParams.get("user_id"));
      const from = sanitizeString(searchParams.get("from"));
      const to = sanitizeString(searchParams.get("to"));
      const { page, page_size } = sanitizePaginationParams(searchParams);

      // Validate entity_type parameter
      let entityType: EntityType | undefined;
      if (entityTypeParam) {
        if (!VALID_ENTITY_TYPES.includes(entityTypeParam as EntityType)) {
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
        entityType = entityTypeParam as EntityType;
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

      // Fetch annotations via the annotation service
      const annotationsData = await getAnnotations({
        entity_type: entityType,
        entity_id: entityId || undefined,
        user_id: userId || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        page_size,
      });

      return NextResponse.json(
        {
          data: annotationsData,
          status: "success",
          correlation_id: correlationId,
          timestamp,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error in GET /api/dashboard/annotations:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while fetching annotations.";

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

// ============================================================
// POST Handler
// ============================================================

/**
 * POST /api/dashboard/annotations
 *
 * Creates a new annotation on an entity (incident, metric, service, or deployment).
 * The annotation is recorded in the audit log for compliance.
 *
 * Requires: annotate:all permission (admin, are_lead, sre_engineer, platform_engineer)
 *
 * Request Body:
 * ```json
 * {
 *   "entity_type": "incident",
 *   "entity_id": "inc-123",
 *   "annotation": "Root cause identified as config change."
 * }
 * ```
 *
 * Response:
 * ```json
 * {
 *   "data": {
 *     "id": "ann-...",
 *     "entity_type": "incident",
 *     "entity_id": "inc-123",
 *     "annotation": "Root cause identified as config change.",
 *     "user_id": "...",
 *     "user_name": "...",
 *     "timestamp": "ISO8601",
 *     "updated_at": "ISO8601"
 *   },
 *   "status": "success",
 *   "correlation_id": "req-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 */
export const POST = withRBAC(
  async (req: NextRequest, context: RBACContext): Promise<NextResponse> => {
    const correlationId = generateCorrelationId("ann");
    const timestamp = new Date().toISOString();

    try {
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

      const entityTypeParam = typeof body.entity_type === "string" ? body.entity_type.trim() : "";
      const entityId = typeof body.entity_id === "string" ? body.entity_id.trim() : "";
      const annotationText = typeof body.annotation === "string" ? body.annotation.trim() : "";

      // Validate entity_type
      if (!entityTypeParam) {
        return NextResponse.json(
          {
            status: "error",
            message: 'Missing required field: "entity_type".',
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      if (!VALID_ENTITY_TYPES.includes(entityTypeParam as EntityType)) {
        return NextResponse.json(
          {
            status: "error",
            message: `Invalid entity_type: "${entityTypeParam}". Must be one of: ${VALID_ENTITY_TYPES.join(", ")}.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Validate entity_id
      if (!entityId) {
        return NextResponse.json(
          {
            status: "error",
            message: 'Missing required field: "entity_id".',
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Validate annotation text
      if (!annotationText) {
        return NextResponse.json(
          {
            status: "error",
            message: 'Missing required field: "annotation". Annotation text cannot be empty.',
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      if (annotationText.length > MAX_ANNOTATION_LENGTH) {
        return NextResponse.json(
          {
            status: "error",
            message: `Annotation text cannot exceed ${MAX_ANNOTATION_LENGTH} characters. Current length: ${annotationText.length}.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Create the annotation via the annotation service
      const createdAnnotation = await createAnnotation({
        entity_type: entityTypeParam as EntityType,
        entity_id: entityId,
        annotation: annotationText,
        user_id: context.userId,
        user_name: context.userName,
      });

      return NextResponse.json(
        {
          data: createdAnnotation,
          status: "success",
          correlation_id: correlationId,
          timestamp,
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("Error in POST /api/dashboard/annotations:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while creating the annotation.";

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
  { requiredPermission: "annotate:all" }
);

// ============================================================
// PUT Handler
// ============================================================

/**
 * PUT /api/dashboard/annotations
 *
 * Updates an existing annotation. Only the annotation text can be modified.
 * The update is recorded in the audit log for compliance.
 *
 * Requires: annotate:all permission (admin, are_lead, sre_engineer, platform_engineer)
 *
 * Request Body:
 * ```json
 * {
 *   "annotation_id": "ann-123",
 *   "annotation": "Updated root cause analysis text."
 * }
 * ```
 *
 * Response:
 * ```json
 * {
 *   "data": {
 *     "id": "ann-123",
 *     "entity_type": "incident",
 *     "entity_id": "inc-123",
 *     "annotation": "Updated root cause analysis text.",
 *     "user_id": "...",
 *     "user_name": "...",
 *     "timestamp": "ISO8601",
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
    const correlationId = generateCorrelationId("ann");
    const timestamp = new Date().toISOString();

    try {
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

      const annotationId = typeof body.annotation_id === "string" ? body.annotation_id.trim() : "";
      const annotationText = typeof body.annotation === "string" ? body.annotation.trim() : "";

      // Validate annotation_id
      if (!annotationId) {
        return NextResponse.json(
          {
            status: "error",
            message: 'Missing required field: "annotation_id".',
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Validate annotation text
      if (!annotationText) {
        return NextResponse.json(
          {
            status: "error",
            message: 'Missing required field: "annotation". Annotation text cannot be empty.',
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      if (annotationText.length > MAX_ANNOTATION_LENGTH) {
        return NextResponse.json(
          {
            status: "error",
            message: `Annotation text cannot exceed ${MAX_ANNOTATION_LENGTH} characters. Current length: ${annotationText.length}.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Update the annotation via the annotation service
      const updatedAnnotation = await updateAnnotation({
        annotation_id: annotationId,
        annotation: annotationText,
        user_id: context.userId,
        user_name: context.userName,
      });

      return NextResponse.json(
        {
          data: updatedAnnotation,
          status: "success",
          correlation_id: correlationId,
          timestamp,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error in PUT /api/dashboard/annotations:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while updating the annotation.";

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
  { requiredPermission: "annotate:all" }
);

// ============================================================
// DELETE Handler
// ============================================================

/**
 * DELETE /api/dashboard/annotations
 *
 * Deletes an existing annotation by ID.
 * The deletion is recorded in the audit log for compliance.
 *
 * Requires: annotate:all permission (admin, are_lead, sre_engineer, platform_engineer)
 *
 * Request Body:
 * ```json
 * {
 *   "annotation_id": "ann-123"
 * }
 * ```
 *
 * Response:
 * ```json
 * {
 *   "status": "success",
 *   "message": "Annotation deleted successfully.",
 *   "correlation_id": "req-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 */
export const DELETE = withRBAC(
  async (req: NextRequest, context: RBACContext): Promise<NextResponse> => {
    const correlationId = generateCorrelationId("ann");
    const timestamp = new Date().toISOString();

    try {
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

      const annotationId = typeof body.annotation_id === "string" ? body.annotation_id.trim() : "";

      // Validate annotation_id
      if (!annotationId) {
        return NextResponse.json(
          {
            status: "error",
            message: 'Missing required field: "annotation_id".',
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Delete the annotation via the annotation service
      await deleteAnnotation(
        annotationId,
        context.userId,
        context.userName
      );

      return NextResponse.json(
        {
          status: "success",
          message: "Annotation deleted successfully.",
          correlation_id: correlationId,
          timestamp,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error in DELETE /api/dashboard/annotations:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while deleting the annotation.";

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
  { requiredPermission: "annotate:all" }
);