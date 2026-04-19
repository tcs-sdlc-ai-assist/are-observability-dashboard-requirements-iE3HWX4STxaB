import { createServerClient } from "@/lib/supabase";
import type { AuditLog, EntityType, PaginatedResponse } from "@/types";
import { PAGINATION } from "@/constants/constants";

// ============================================================
// Types
// ============================================================

export interface AuditLogEntry {
  action: string;
  entity_type: EntityType;
  entity_id: string;
  user_id: string;
  user_name?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  correlation_id?: string;
}

export interface AuditLogFilter {
  action?: string;
  entity_type?: EntityType;
  entity_id?: string;
  user_id?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

// ============================================================
// Audit Action Constants
// ============================================================

export const AUDIT_ACTIONS = {
  // Upload actions
  UPLOAD_INTERIM_DATA: "UPLOAD_INTERIM_DATA",
  UPLOAD_FAILED: "UPLOAD_FAILED",

  // Metrics config actions
  CONFIGURE_METRICS: "CONFIGURE_METRICS",
  UPDATE_METRICS_CONFIG: "UPDATE_METRICS_CONFIG",
  DELETE_METRICS_CONFIG: "DELETE_METRICS_CONFIG",

  // Service actions
  CREATE_SERVICE: "CREATE_SERVICE",
  UPDATE_SERVICE: "UPDATE_SERVICE",
  DELETE_SERVICE: "DELETE_SERVICE",

  // Domain actions
  CREATE_DOMAIN: "CREATE_DOMAIN",
  UPDATE_DOMAIN: "UPDATE_DOMAIN",
  DELETE_DOMAIN: "DELETE_DOMAIN",

  // Incident actions
  CREATE_INCIDENT: "CREATE_INCIDENT",
  UPDATE_INCIDENT: "UPDATE_INCIDENT",
  RESOLVE_INCIDENT: "RESOLVE_INCIDENT",
  CLOSE_INCIDENT: "CLOSE_INCIDENT",

  // Deployment actions
  CREATE_DEPLOYMENT: "CREATE_DEPLOYMENT",
  ROLLBACK_DEPLOYMENT: "ROLLBACK_DEPLOYMENT",

  // Annotation actions
  CREATE_ANNOTATION: "CREATE_ANNOTATION",
  UPDATE_ANNOTATION: "UPDATE_ANNOTATION",
  DELETE_ANNOTATION: "DELETE_ANNOTATION",

  // Documentation link actions
  CREATE_DOCUMENTATION_LINK: "CREATE_DOCUMENTATION_LINK",
  UPDATE_DOCUMENTATION_LINK: "UPDATE_DOCUMENTATION_LINK",
  DELETE_DOCUMENTATION_LINK: "DELETE_DOCUMENTATION_LINK",

  // User management actions
  CREATE_USER: "CREATE_USER",
  UPDATE_USER: "UPDATE_USER",
  DEACTIVATE_USER: "DEACTIVATE_USER",
  REACTIVATE_USER: "REACTIVATE_USER",
  CHANGE_USER_ROLE: "CHANGE_USER_ROLE",

  // Auth actions
  USER_LOGIN: "USER_LOGIN",
  USER_LOGOUT: "USER_LOGOUT",
  LOGIN_FAILED: "LOGIN_FAILED",

  // Compliance actions
  GENERATE_COMPLIANCE_REPORT: "GENERATE_COMPLIANCE_REPORT",
  EXPORT_AUDIT_LOGS: "EXPORT_AUDIT_LOGS",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

// ============================================================
// Correlation ID Generator
// ============================================================

function generateCorrelationId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

// ============================================================
// AuditLogger Service
// ============================================================

/**
 * Logs an immutable audit entry to the Supabase audit_logs table.
 * Each entry captures the action, actor, entity, timestamp, details, and IP address.
 *
 * Audit log writes are critical — if a write fails, the error is thrown
 * to ensure no silent failures (operations should be aborted on audit failure).
 *
 * @param entry - The audit log entry to record
 * @returns The created audit log record
 * @throws Error if the audit log write fails
 */
export async function logAction(entry: AuditLogEntry): Promise<AuditLog> {
  const supabase = createServerClient();

  const correlationId = entry.correlation_id || generateCorrelationId();

  const { data, error } = await supabase
    .from("audit_logs")
    .insert({
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      user_id: entry.user_id,
      user_name: entry.user_name || null,
      details: entry.details || null,
      ip_address: entry.ip_address || null,
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to write audit log:", error);
    throw new Error(
      `Audit log write failed: ${error.message}. Action: ${entry.action}, Entity: ${entry.entity_type}:${entry.entity_id}, User: ${entry.user_id}`
    );
  }

  return data as AuditLog;
}

/**
 * Queries audit logs from the Supabase audit_logs table with optional filters.
 * Supports filtering by action, entity type, entity ID, user ID, and time range.
 * Results are paginated and ordered by timestamp descending (most recent first).
 *
 * @param filter - Optional filter criteria for the query
 * @returns Paginated audit log results
 */
export async function getAuditLogs(
  filter?: AuditLogFilter
): Promise<PaginatedResponse<AuditLog>> {
  const supabase = createServerClient();

  const page = filter?.page || PAGINATION.DEFAULT_PAGE;
  const pageSize = Math.min(
    filter?.page_size || PAGINATION.DEFAULT_PAGE_SIZE,
    PAGINATION.MAX_PAGE_SIZE
  );
  const offset = (page - 1) * pageSize;

  // Build the query
  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" });

  // Apply filters
  if (filter?.action) {
    query = query.eq("action", filter.action);
  }

  if (filter?.entity_type) {
    query = query.eq("entity_type", filter.entity_type);
  }

  if (filter?.entity_id) {
    query = query.eq("entity_id", filter.entity_id);
  }

  if (filter?.user_id) {
    query = query.eq("user_id", filter.user_id);
  }

  if (filter?.from) {
    query = query.gte("timestamp", filter.from);
  }

  if (filter?.to) {
    query = query.lte("timestamp", filter.to);
  }

  // Order by timestamp descending (most recent first) and apply pagination
  query = query
    .order("timestamp", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Failed to query audit logs:", error);
    throw new Error(`Audit log query failed: ${error.message}`);
  }

  const total = count || 0;
  const logs = (data || []) as AuditLog[];

  return {
    data: logs,
    total,
    page,
    page_size: pageSize,
    has_next: offset + pageSize < total,
    has_previous: page > 1,
  };
}

/**
 * Retrieves audit logs for a specific entity (e.g., all logs for a particular incident).
 *
 * @param entityType - The type of entity to query logs for
 * @param entityId - The ID of the entity
 * @returns Array of audit log entries for the entity, ordered by timestamp descending
 */
export async function getAuditLogsForEntity(
  entityType: EntityType,
  entityId: string
): Promise<AuditLog[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("timestamp", { ascending: false });

  if (error) {
    console.error("Failed to query audit logs for entity:", error);
    throw new Error(
      `Audit log entity query failed: ${error.message}. Entity: ${entityType}:${entityId}`
    );
  }

  return (data || []) as AuditLog[];
}

/**
 * Retrieves audit logs for a specific user.
 *
 * @param userId - The ID of the user
 * @param limit - Maximum number of records to return (default: 50)
 * @returns Array of audit log entries for the user, ordered by timestamp descending
 */
export async function getAuditLogsForUser(
  userId: string,
  limit: number = 50
): Promise<AuditLog[]> {
  const supabase = createServerClient();

  const clampedLimit = Math.min(limit, PAGINATION.MAX_PAGE_SIZE);

  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(clampedLimit);

  if (error) {
    console.error("Failed to query audit logs for user:", error);
    throw new Error(
      `Audit log user query failed: ${error.message}. User: ${userId}`
    );
  }

  return (data || []) as AuditLog[];
}

/**
 * Retrieves audit logs filtered by action type within a time range.
 * Useful for compliance reporting (e.g., all uploads in the last 30 days).
 *
 * @param action - The action type to filter by
 * @param from - Start of the time range (ISO8601)
 * @param to - End of the time range (ISO8601)
 * @returns Array of audit log entries matching the criteria
 */
export async function getAuditLogsByAction(
  action: string,
  from?: string,
  to?: string
): Promise<AuditLog[]> {
  const supabase = createServerClient();

  let query = supabase
    .from("audit_logs")
    .select("*")
    .eq("action", action);

  if (from) {
    query = query.gte("timestamp", from);
  }

  if (to) {
    query = query.lte("timestamp", to);
  }

  query = query.order("timestamp", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("Failed to query audit logs by action:", error);
    throw new Error(
      `Audit log action query failed: ${error.message}. Action: ${action}`
    );
  }

  return (data || []) as AuditLog[];
}

/**
 * Extracts the client IP address from a request object.
 * Checks common headers used by proxies and load balancers.
 *
 * @param headers - The request headers
 * @returns The client IP address or null if not determinable
 */
export function extractIpAddress(headers: Headers): string | null {
  // Check Vercel-specific header first
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs; the first is the client
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return null;
}

/**
 * Convenience function to create an audit log entry with common fields pre-populated.
 * Useful in API route handlers where user context and request info are available.
 *
 * @param params - Parameters for the audit log entry
 * @returns The created audit log record
 */
export async function logAdminAction(params: {
  action: string;
  entity_type: EntityType;
  entity_id: string;
  user_id: string;
  user_name?: string;
  details?: Record<string, unknown>;
  headers?: Headers;
  correlation_id?: string;
}): Promise<AuditLog> {
  const ipAddress = params.headers
    ? extractIpAddress(params.headers)
    : null;

  return logAction({
    action: params.action,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    user_id: params.user_id,
    user_name: params.user_name,
    details: params.details,
    ip_address: ipAddress || undefined,
    correlation_id: params.correlation_id,
  });
}