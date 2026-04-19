import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions, hasRole, hasPermission, isAdmin } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { ROLE_PERMISSIONS } from "@/constants/constants";
import type { UserRole } from "@/types";

// ============================================================
// Types
// ============================================================

export interface RBACContext {
  userId: string;
  userName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface RBACError {
  status: number;
  message: string;
  error_code: string;
  correlation_id: string;
  timestamp: string;
}

type ApiHandler = (
  req: NextRequest,
  context: RBACContext
) => Promise<NextResponse>;

// ============================================================
// Correlation ID Generator
// ============================================================

function generateCorrelationId(): string {
  return `corr-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

// ============================================================
// Error Response Builder
// ============================================================

function buildErrorResponse(
  status: number,
  message: string,
  errorCode: string
): NextResponse {
  const correlationId = generateCorrelationId();
  const body: RBACError = {
    status,
    message,
    error_code: errorCode,
    correlation_id: correlationId,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, { status });
}

// ============================================================
// RBACService
// ============================================================

/**
 * Checks if a user has the specified role.
 * Admin role has access to everything.
 * Queries the database for the user's current role to ensure freshness.
 */
export async function getUserRole(userId: string): Promise<UserRole | null> {
  try {
    const supabase = createServerClient();

    const { data: user, error } = await supabase
      .from("users")
      .select("role, is_active")
      .eq("id", userId)
      .single();

    if (error || !user) {
      console.error("Error fetching user role:", error);
      return null;
    }

    if (!user.is_active) {
      return null;
    }

    return user.role as UserRole;
  } catch (error) {
    console.error("Error in getUserRole:", error);
    return null;
  }
}

/**
 * Checks if a user has the required role.
 * Admin role always returns true.
 * Falls back to session role if database lookup fails.
 */
export async function checkUserHasRole(
  userId: string,
  requiredRole: UserRole
): Promise<boolean> {
  const role = await getUserRole(userId);

  if (!role) {
    return false;
  }

  return hasRole(role, requiredRole);
}

/**
 * Checks if a user has a specific permission.
 * Queries the database for the user's current role.
 */
export async function checkUserHasPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  const role = await getUserRole(userId);

  if (!role) {
    return false;
  }

  return hasPermission(role, permission);
}

/**
 * Checks if a user has admin-level access.
 */
export async function checkUserIsAdmin(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);

  if (!role) {
    return false;
  }

  return isAdmin(role);
}

/**
 * Returns the full list of permissions for a given role.
 */
export function getPermissionsForRole(role: UserRole): readonly string[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Checks if a role can perform a specific action on a resource.
 */
export function canPerformAction(
  role: UserRole,
  action: string,
  resource: string
): boolean {
  const permission = `${action}:${resource}`;
  return hasPermission(role, permission);
}

// ============================================================
// RBAC Middleware for API Routes
// ============================================================

/**
 * Wraps an API route handler with RBAC enforcement.
 * Validates the NextAuth session and checks that the user has the required role.
 *
 * @param handler - The API route handler to wrap
 * @param requiredRole - The minimum role required to access the endpoint (optional)
 * @param requiredPermission - A specific permission required (optional)
 * @returns A wrapped handler that enforces RBAC before calling the original handler
 *
 * @example
 * ```ts
 * // Require admin role
 * export const POST = withRBAC(async (req, context) => {
 *   // context.userId, context.role, etc. are available
 *   return NextResponse.json({ status: "success" });
 * }, { requiredRole: "admin" });
 *
 * // Require specific permission
 * export const GET = withRBAC(async (req, context) => {
 *   return NextResponse.json({ data: [] });
 * }, { requiredPermission: "read:all" });
 * ```
 */
export function withRBAC(
  handler: ApiHandler,
  options?: {
    requiredRole?: UserRole;
    requiredPermission?: string;
  }
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Validate session
      const session = await getServerSession(authOptions);

      if (!session || !session.user) {
        return buildErrorResponse(
          401,
          "Authentication required. Please sign in.",
          "UNAUTHORIZED"
        );
      }

      // Check if user account is active
      if (!session.user.is_active) {
        return buildErrorResponse(
          403,
          "Your account has been deactivated. Please contact an administrator.",
          "ACCOUNT_INACTIVE"
        );
      }

      const userRole = session.user.role as UserRole;

      // Check required role
      if (options?.requiredRole) {
        if (!hasRole(userRole, options.requiredRole)) {
          return buildErrorResponse(
            403,
            `Insufficient permissions. Required role: ${options.requiredRole}.`,
            "FORBIDDEN"
          );
        }
      }

      // Check required permission
      if (options?.requiredPermission) {
        if (!hasPermission(userRole, options.requiredPermission)) {
          return buildErrorResponse(
            403,
            `Insufficient permissions. Required permission: ${options.requiredPermission}.`,
            "FORBIDDEN"
          );
        }
      }

      // Build RBAC context
      const context: RBACContext = {
        userId: session.user.id,
        userName: session.user.name,
        email: session.user.email,
        role: userRole,
        isActive: session.user.is_active,
      };

      // Call the wrapped handler
      return await handler(req, context);
    } catch (error) {
      console.error("RBAC middleware error:", error);

      // Handle structured auth errors thrown by requireRole/requirePermission
      if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        "message" in error &&
        "error_code" in error
      ) {
        const authError = error as {
          status: number;
          message: string;
          error_code: string;
        };
        return buildErrorResponse(
          authError.status,
          authError.message,
          authError.error_code
        );
      }

      return buildErrorResponse(
        500,
        "An unexpected error occurred. Please try again later.",
        "INTERNAL_SERVER_ERROR"
      );
    }
  };
}

/**
 * Convenience wrapper that requires admin role.
 */
export function withAdminRBAC(handler: ApiHandler) {
  return withRBAC(handler, { requiredRole: "admin" });
}

/**
 * Convenience wrapper that requires at least ARE lead role.
 */
export function withARELeadRBAC(handler: ApiHandler) {
  return withRBAC(handler, { requiredRole: "are_lead" });
}

/**
 * Convenience wrapper that requires read access to all resources.
 */
export function withReadAccess(handler: ApiHandler) {
  return withRBAC(handler, { requiredPermission: "read:all" });
}

/**
 * Convenience wrapper that requires write access.
 */
export function withWriteAccess(handler: ApiHandler) {
  return withRBAC(handler, { requiredPermission: "write:all" });
}

/**
 * Convenience wrapper that requires upload permission.
 */
export function withUploadAccess(handler: ApiHandler) {
  return withRBAC(handler, { requiredPermission: "upload:data" });
}

// ============================================================
// Role Permission Matrix (Re-exported for convenience)
// ============================================================

export { ROLE_PERMISSIONS } from "@/constants/constants";

// ============================================================
// Role Hierarchy Utilities
// ============================================================

/**
 * Role hierarchy from highest to lowest privilege.
 */
export const ROLE_HIERARCHY: readonly UserRole[] = [
  "admin",
  "are_lead",
  "sre_engineer",
  "platform_engineer",
  "executive",
  "viewer",
] as const;

/**
 * Returns the numeric privilege level for a role.
 * Lower number = higher privilege.
 */
export function getRoleLevel(role: UserRole): number {
  const index = ROLE_HIERARCHY.indexOf(role);
  return index === -1 ? ROLE_HIERARCHY.length : index;
}

/**
 * Checks if roleA has equal or higher privilege than roleB.
 */
export function isRoleAtLeast(roleA: UserRole, roleB: UserRole): boolean {
  return getRoleLevel(roleA) <= getRoleLevel(roleB);
}

/**
 * Returns all roles that have a specific permission.
 */
export function getRolesWithPermission(permission: string): UserRole[] {
  return (Object.keys(ROLE_PERMISSIONS) as UserRole[]).filter((role) =>
    hasPermission(role, permission)
  );
}