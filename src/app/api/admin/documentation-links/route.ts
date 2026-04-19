import { NextRequest, NextResponse } from "next/server";
import { withRBAC, type RBACContext } from "@/lib/services/rbac";
import {
  createDocumentationLink,
  updateDocumentationLink,
  deleteDocumentationLink,
  getDocumentationLinks,
  getDocumentationLinkById,
  getDocumentationLinkSummary,
} from "@/lib/services/documentation-link-service";
import {
  sanitizeString,
  sanitizePaginationParams,
} from "@/lib/validators";
import { generateCorrelationId } from "@/lib/utils";
import type { DocumentationLink } from "@/types";

// ============================================================
// Constants
// ============================================================

const VALID_CATEGORIES: DocumentationLink["category"][] = [
  "runbook",
  "architecture",
  "sop",
  "postmortem",
  "sla",
  "other",
];

const MAX_TITLE_LENGTH = 256;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_URL_LENGTH = 2048;

// ============================================================
// Helpers
// ============================================================

/**
 * Validates that a URL is a valid HTTP/HTTPS URL.
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/admin/documentation-links
 *
 * Returns documentation links with optional filters. Supports filtering
 * by category, service_id, domain_id, created_by, and search text.
 * Supports a summary mode that returns grouped category counts.
 *
 * Restricted to users with read:dashboard permission.
 *
 * Query Parameters:
 * - category (string, optional): Filter by link category
 * - service_id (string, optional): Filter by service ID
 * - domain_id (string, optional): Filter by domain ID
 * - created_by (string, optional): Filter by creator user ID
 * - search (string, optional): Full-text search across title, description, URL
 * - page (number, optional): Page number (default: 1)
 * - page_size (number, optional): Page size (default: 20)
 * - summary (string, optional): If "true", returns grouped summary instead
 * - link_id (string, optional): Fetch a specific link by ID
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
 *   "correlation_id": "doclink-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 *
 * Response (summary):
 * ```json
 * {
 *   "data": [
 *     {
 *       "category": "runbook",
 *       "total_links": 5,
 *       "last_updated": "ISO8601"
 *     }
 *   ],
 *   "status": "success",
 *   "correlation_id": "doclink-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 */
export const GET = withRBAC(
  async (req: NextRequest, context: RBACContext): Promise<NextResponse> => {
    const correlationId = generateCorrelationId("doclink");
    const timestamp = new Date().toISOString();

    try {
      const { searchParams } = new URL(req.url);

      // Check if summary mode is requested
      const summaryParam = sanitizeString(searchParams.get("summary"));
      if (summaryParam === "true") {
        try {
          const summaryData = await getDocumentationLinkSummary();

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
          console.error("Error fetching documentation link summary:", error);

          const errorMessage =
            error instanceof Error
              ? error.message
              : "An unexpected error occurred while fetching the documentation link summary.";

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

      // Check if a specific link ID is requested
      const linkId = sanitizeString(searchParams.get("link_id"));
      if (linkId && linkId.trim().length > 0) {
        try {
          const linkRecord = await getDocumentationLinkById(linkId.trim());

          if (!linkRecord) {
            return NextResponse.json(
              {
                status: "error",
                message: `Documentation link not found: ${linkId.trim()}.`,
                correlation_id: correlationId,
                timestamp,
              },
              { status: 404 }
            );
          }

          return NextResponse.json(
            {
              data: linkRecord,
              status: "success",
              correlation_id: correlationId,
              timestamp,
            },
            { status: 200 }
          );
        } catch (error) {
          console.error("Error fetching documentation link by ID:", error);

          const errorMessage =
            error instanceof Error
              ? error.message
              : "An unexpected error occurred while fetching the documentation link.";

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
      const categoryParam = sanitizeString(searchParams.get("category"));
      const serviceId = sanitizeString(searchParams.get("service_id"));
      const domainId = sanitizeString(searchParams.get("domain_id"));
      const createdBy = sanitizeString(searchParams.get("created_by"));
      const search = sanitizeString(searchParams.get("search"));
      const { page, page_size } = sanitizePaginationParams(searchParams);

      // Validate category parameter if provided
      if (categoryParam && !VALID_CATEGORIES.includes(categoryParam as DocumentationLink["category"])) {
        return NextResponse.json(
          {
            status: "error",
            message: `Invalid category parameter: "${categoryParam}". Must be one of: ${VALID_CATEGORIES.join(", ")}.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Fetch documentation links
      const linkData = await getDocumentationLinks({
        category: categoryParam ? (categoryParam as DocumentationLink["category"]) : undefined,
        service_id: serviceId || undefined,
        domain_id: domainId || undefined,
        created_by: createdBy || undefined,
        search: search || undefined,
        page,
        page_size,
      });

      return NextResponse.json(
        {
          data: linkData,
          status: "success",
          correlation_id: correlationId,
          timestamp,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error in GET /api/admin/documentation-links:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while fetching documentation links.";

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
 * POST /api/admin/documentation-links
 *
 * Creates a new documentation link (playbook, runbook, SOP, architecture doc, etc.).
 * Validates all fields and logs the action to the audit trail for compliance.
 *
 * Requires: admin or are_lead role (write:services permission)
 *
 * Request Body:
 * ```json
 * {
 *   "title": "Checkout API Runbook",
 *   "url": "https://confluence.example.com/runbooks/checkout",
 *   "category": "runbook",
 *   "service_id": "svc-123",
 *   "domain_id": "dom-456",
 *   "description": "Operational runbook for the Checkout API service."
 * }
 * ```
 *
 * Response:
 * ```json
 * {
 *   "data": {
 *     "id": "doc-...",
 *     "title": "Checkout API Runbook",
 *     "url": "https://confluence.example.com/runbooks/checkout",
 *     "category": "runbook",
 *     "service_id": "svc-123",
 *     "domain_id": "dom-456",
 *     "description": "Operational runbook for the Checkout API service.",
 *     "created_by": "...",
 *     "created_at": "ISO8601",
 *     "updated_at": "ISO8601"
 *   },
 *   "status": "success",
 *   "message": "Documentation link created successfully.",
 *   "correlation_id": "doclink-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 */
export const POST = withRBAC(
  async (req: NextRequest, context: RBACContext): Promise<NextResponse> => {
    const correlationId = generateCorrelationId("doclink");
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
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const url = typeof body.url === "string" ? body.url.trim() : "";
      const category = typeof body.category === "string" ? body.category.trim() : "";
      const serviceId = typeof body.service_id === "string" ? body.service_id.trim() : undefined;
      const domainId = typeof body.domain_id === "string" ? body.domain_id.trim() : undefined;
      const description = typeof body.description === "string" ? body.description.trim() : undefined;

      // Validate title
      if (!title) {
        return NextResponse.json(
          {
            status: "error",
            message: 'Missing required field: "title". Please provide a title for the documentation link.',
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      if (title.length > MAX_TITLE_LENGTH) {
        return NextResponse.json(
          {
            status: "error",
            message: `Title cannot exceed ${MAX_TITLE_LENGTH} characters. Current length: ${title.length}.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Validate URL
      if (!url) {
        return NextResponse.json(
          {
            status: "error",
            message: 'Missing required field: "url". Please provide a valid HTTP or HTTPS URL.',
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      if (url.length > MAX_URL_LENGTH) {
        return NextResponse.json(
          {
            status: "error",
            message: `URL cannot exceed ${MAX_URL_LENGTH} characters. Current length: ${url.length}.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      if (!isValidUrl(url)) {
        return NextResponse.json(
          {
            status: "error",
            message: `Invalid URL: "${url}". Must be a valid HTTP or HTTPS URL.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Validate category
      if (!category) {
        return NextResponse.json(
          {
            status: "error",
            message: `Missing required field: "category". Must be one of: ${VALID_CATEGORIES.join(", ")}.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      if (!VALID_CATEGORIES.includes(category as DocumentationLink["category"])) {
        return NextResponse.json(
          {
            status: "error",
            message: `Invalid category: "${category}". Must be one of: ${VALID_CATEGORIES.join(", ")}.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Validate description length if provided
      if (description && description.length > MAX_DESCRIPTION_LENGTH) {
        return NextResponse.json(
          {
            status: "error",
            message: `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters. Current length: ${description.length}.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Create the documentation link via the service
      const createdLink = await createDocumentationLink({
        title,
        url,
        category: category as DocumentationLink["category"],
        service_id: serviceId || undefined,
        domain_id: domainId || undefined,
        description: description || undefined,
        user_id: context.userId,
        user_name: context.userName,
      });

      return NextResponse.json(
        {
          data: createdLink,
          status: "success",
          message: "Documentation link created successfully.",
          correlation_id: correlationId,
          timestamp,
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("Error in POST /api/admin/documentation-links:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while creating the documentation link.";

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
 * PUT /api/admin/documentation-links
 *
 * Updates an existing documentation link. Only provided fields are updated;
 * others remain unchanged. The update is recorded in the audit log for compliance.
 *
 * Requires: admin or are_lead role (write:services permission)
 *
 * Request Body:
 * ```json
 * {
 *   "link_id": "doc-123",
 *   "title": "Updated Runbook Title",
 *   "url": "https://confluence.example.com/runbooks/checkout-v2",
 *   "category": "runbook",
 *   "service_id": "svc-123",
 *   "domain_id": "dom-456",
 *   "description": "Updated description."
 * }
 * ```
 *
 * Response:
 * ```json
 * {
 *   "data": {
 *     "id": "doc-123",
 *     "title": "Updated Runbook Title",
 *     "url": "https://confluence.example.com/runbooks/checkout-v2",
 *     "category": "runbook",
 *     "service_id": "svc-123",
 *     "domain_id": "dom-456",
 *     "description": "Updated description.",
 *     "created_by": "...",
 *     "created_at": "ISO8601",
 *     "updated_at": "ISO8601"
 *   },
 *   "status": "success",
 *   "correlation_id": "doclink-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 */
export const PUT = withRBAC(
  async (req: NextRequest, context: RBACContext): Promise<NextResponse> => {
    const correlationId = generateCorrelationId("doclink");
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

      const linkId = typeof body.link_id === "string" ? body.link_id.trim() : "";

      // Validate link_id
      if (!linkId) {
        return NextResponse.json(
          {
            status: "error",
            message: 'Missing required field: "link_id".',
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Validate optional title
      let title: string | undefined;
      if (body.title !== undefined && body.title !== null) {
        title = typeof body.title === "string" ? body.title.trim() : "";
        if (!title) {
          return NextResponse.json(
            {
              status: "error",
              message: "Title cannot be empty.",
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
        if (title.length > MAX_TITLE_LENGTH) {
          return NextResponse.json(
            {
              status: "error",
              message: `Title cannot exceed ${MAX_TITLE_LENGTH} characters. Current length: ${title.length}.`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
      }

      // Validate optional URL
      let url: string | undefined;
      if (body.url !== undefined && body.url !== null) {
        url = typeof body.url === "string" ? body.url.trim() : "";
        if (!url) {
          return NextResponse.json(
            {
              status: "error",
              message: "URL cannot be empty.",
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
        if (url.length > MAX_URL_LENGTH) {
          return NextResponse.json(
            {
              status: "error",
              message: `URL cannot exceed ${MAX_URL_LENGTH} characters. Current length: ${url.length}.`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
        if (!isValidUrl(url)) {
          return NextResponse.json(
            {
              status: "error",
              message: `Invalid URL: "${url}". Must be a valid HTTP or HTTPS URL.`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
      }

      // Validate optional category
      let category: DocumentationLink["category"] | undefined;
      if (body.category !== undefined && body.category !== null && body.category !== "") {
        const categoryStr = String(body.category).trim();
        if (!VALID_CATEGORIES.includes(categoryStr as DocumentationLink["category"])) {
          return NextResponse.json(
            {
              status: "error",
              message: `Invalid category: "${categoryStr}". Must be one of: ${VALID_CATEGORIES.join(", ")}.`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
        category = categoryStr as DocumentationLink["category"];
      }

      // Validate optional description
      let description: string | undefined | null;
      if (body.description !== undefined) {
        if (body.description === null || body.description === "") {
          description = null;
        } else {
          description = typeof body.description === "string" ? body.description.trim() : undefined;
          if (description && description.length > MAX_DESCRIPTION_LENGTH) {
            return NextResponse.json(
              {
                status: "error",
                message: `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters. Current length: ${description.length}.`,
                correlation_id: correlationId,
                timestamp,
              },
              { status: 400 }
            );
          }
        }
      }

      // Extract optional service_id and domain_id
      const serviceId = body.service_id !== undefined
        ? (typeof body.service_id === "string" ? body.service_id.trim() : undefined)
        : undefined;
      const domainId = body.domain_id !== undefined
        ? (typeof body.domain_id === "string" ? body.domain_id.trim() : undefined)
        : undefined;

      // Ensure at least one field is being updated
      if (
        title === undefined &&
        url === undefined &&
        category === undefined &&
        description === undefined &&
        serviceId === undefined &&
        domainId === undefined
      ) {
        return NextResponse.json(
          {
            status: "error",
            message:
              "At least one field must be provided for update: title, url, category, description, service_id, or domain_id.",
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Update the documentation link via the service
      const updatedLink = await updateDocumentationLink({
        link_id: linkId,
        title,
        url,
        category,
        service_id: serviceId,
        domain_id: domainId,
        description: description !== undefined ? (description ?? undefined) : undefined,
        user_id: context.userId,
        user_name: context.userName,
      });

      return NextResponse.json(
        {
          data: updatedLink,
          status: "success",
          correlation_id: correlationId,
          timestamp,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error in PUT /api/admin/documentation-links:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while updating the documentation link.";

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
 * DELETE /api/admin/documentation-links
 *
 * Deletes an existing documentation link by ID.
 * The deletion is recorded in the audit log for compliance.
 *
 * Requires: admin or are_lead role (write:services permission)
 *
 * Request Body:
 * ```json
 * {
 *   "link_id": "doc-123"
 * }
 * ```
 *
 * Response:
 * ```json
 * {
 *   "status": "success",
 *   "message": "Documentation link deleted successfully.",
 *   "correlation_id": "doclink-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 */
export const DELETE = withRBAC(
  async (req: NextRequest, context: RBACContext): Promise<NextResponse> => {
    const correlationId = generateCorrelationId("doclink");
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

      const linkId = typeof body.link_id === "string" ? body.link_id.trim() : "";

      // Validate link_id
      if (!linkId) {
        return NextResponse.json(
          {
            status: "error",
            message: 'Missing required field: "link_id".',
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Delete the documentation link via the service
      await deleteDocumentationLink({
        link_id: linkId,
        user_id: context.userId,
        user_name: context.userName,
      });

      return NextResponse.json(
        {
          status: "success",
          message: "Documentation link deleted successfully.",
          correlation_id: correlationId,
          timestamp,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error in DELETE /api/admin/documentation-links:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while deleting the documentation link.";

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