"use client"

import * as React from "react"

import { useAuth } from "@/hooks/use-auth"
import type { UserRole } from "@/types"

// ============================================================
// Types
// ============================================================

export interface RoleGuardProps {
  /** Child components to render when access is granted */
  children: React.ReactNode
  /** Required role — user must have this role (admin always passes) */
  requiredRole?: UserRole
  /** Required permission string (e.g., "write:services", "upload:data") */
  requiredPermission?: string
  /** Array of roles — user must have at least one of these roles */
  allowedRoles?: UserRole[]
  /** Whether the user must be an admin */
  requireAdmin?: boolean
  /** Whether the user must have write access */
  requireWrite?: boolean
  /** Optional fallback UI to render when access is denied */
  fallback?: React.ReactNode
  /** Whether to render nothing (null) when loading auth state (default: true) */
  hideWhileLoading?: boolean
  /** Optional loading UI to render while auth state is resolving */
  loadingFallback?: React.ReactNode
}

// ============================================================
// RoleGuard Component
// ============================================================

/**
 * Client-side RBAC guard component that conditionally renders children
 * based on the current user's role and permissions. Used throughout the
 * dashboard to show/hide admin controls, annotation buttons, upload
 * actions, and other role-restricted UI elements.
 *
 * Supports multiple authorization strategies:
 * - `requiredRole`: User must have a specific role (admin always passes)
 * - `requiredPermission`: User must have a specific permission string
 * - `allowedRoles`: User must have at least one of the listed roles
 * - `requireAdmin`: User must be an admin
 * - `requireWrite`: User must have write access
 *
 * When multiple conditions are specified, ALL must be satisfied.
 *
 * @example
 * ```tsx
 * // Show only for admins
 * <RoleGuard requireAdmin>
 *   <AdminPanel />
 * </RoleGuard>
 *
 * // Show for users with write access
 * <RoleGuard requireWrite>
 *   <Button>Edit Service</Button>
 * </RoleGuard>
 *
 * // Show for specific roles
 * <RoleGuard allowedRoles={["admin", "are_lead", "sre_engineer"]}>
 *   <AnnotationForm />
 * </RoleGuard>
 *
 * // Show with a specific permission
 * <RoleGuard requiredPermission="upload:data">
 *   <UploadButton />
 * </RoleGuard>
 *
 * // Show with a fallback for unauthorized users
 * <RoleGuard requiredRole="admin" fallback={<p>Access denied.</p>}>
 *   <UserManagement />
 * </RoleGuard>
 *
 * // Show with a custom loading state
 * <RoleGuard requireAdmin loadingFallback={<Skeleton className="h-10 w-32" />}>
 *   <AdminActions />
 * </RoleGuard>
 * ```
 */
export function RoleGuard({
  children,
  requiredRole,
  requiredPermission,
  allowedRoles,
  requireAdmin = false,
  requireWrite = false,
  fallback = null,
  hideWhileLoading = true,
  loadingFallback,
}: RoleGuardProps) {
  const {
    isLoading,
    isAuthenticated,
    isAdmin,
    canWrite,
    hasRole,
    hasPermission,
  } = useAuth()

  // Handle loading state
  if (isLoading) {
    if (loadingFallback) {
      return <>{loadingFallback}</>
    }
    if (hideWhileLoading) {
      return null
    }
    return null
  }

  // User must be authenticated
  if (!isAuthenticated) {
    return <>{fallback}</>
  }

  // Check requireAdmin
  if (requireAdmin && !isAdmin) {
    return <>{fallback}</>
  }

  // Check requireWrite
  if (requireWrite && !canWrite) {
    return <>{fallback}</>
  }

  // Check requiredRole
  if (requiredRole && !hasRole(requiredRole)) {
    return <>{fallback}</>
  }

  // Check requiredPermission
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <>{fallback}</>
  }

  // Check allowedRoles — user must have at least one of the listed roles
  if (allowedRoles && allowedRoles.length > 0) {
    const hasAllowedRole = allowedRoles.some((role) => hasRole(role))
    if (!hasAllowedRole) {
      return <>{fallback}</>
    }
  }

  // All checks passed — render children
  return <>{children}</>
}

// ============================================================
// Convenience Components
// ============================================================

export interface AdminOnlyProps {
  /** Child components to render when user is an admin */
  children: React.ReactNode
  /** Optional fallback UI for non-admin users */
  fallback?: React.ReactNode
}

/**
 * Convenience component that renders children only for admin users.
 *
 * @example
 * ```tsx
 * <AdminOnly>
 *   <Button variant="destructive">Delete Service</Button>
 * </AdminOnly>
 * ```
 */
export function AdminOnly({ children, fallback }: AdminOnlyProps) {
  return (
    <RoleGuard requireAdmin fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

export interface WriteAccessOnlyProps {
  /** Child components to render when user has write access */
  children: React.ReactNode
  /** Optional fallback UI for read-only users */
  fallback?: React.ReactNode
}

/**
 * Convenience component that renders children only for users with write access.
 *
 * @example
 * ```tsx
 * <WriteAccessOnly>
 *   <Button>Save Changes</Button>
 * </WriteAccessOnly>
 * ```
 */
export function WriteAccessOnly({ children, fallback }: WriteAccessOnlyProps) {
  return (
    <RoleGuard requireWrite fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

export interface PermissionGuardProps {
  /** The permission string required (e.g., "write:services") */
  permission: string
  /** Child components to render when permission is granted */
  children: React.ReactNode
  /** Optional fallback UI when permission is denied */
  fallback?: React.ReactNode
}

/**
 * Convenience component that renders children only when the user has
 * a specific permission.
 *
 * @example
 * ```tsx
 * <PermissionGuard permission="manage:users">
 *   <UserManagementPanel />
 * </PermissionGuard>
 * ```
 */
export function PermissionGuard({
  permission,
  children,
  fallback,
}: PermissionGuardProps) {
  return (
    <RoleGuard requiredPermission={permission} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

// ============================================================
// Hook: useRoleAccess
// ============================================================

export interface UseRoleAccessOptions {
  /** Required role */
  requiredRole?: UserRole
  /** Required permission string */
  requiredPermission?: string
  /** Array of allowed roles */
  allowedRoles?: UserRole[]
  /** Whether admin is required */
  requireAdmin?: boolean
  /** Whether write access is required */
  requireWrite?: boolean
}

export interface UseRoleAccessReturn {
  /** Whether access is granted based on the specified criteria */
  hasAccess: boolean
  /** Whether the auth state is still loading */
  isLoading: boolean
  /** Whether the user is authenticated */
  isAuthenticated: boolean
}

/**
 * Hook that evaluates role-based access without rendering.
 * Useful for conditionally enabling buttons, showing indicators,
 * or controlling logic flow based on the user's role.
 *
 * @param options - Access check options
 * @returns Access evaluation result
 *
 * @example
 * ```tsx
 * const { hasAccess, isLoading } = useRoleAccess({ requireWrite: true });
 *
 * return (
 *   <Button disabled={!hasAccess || isLoading} onClick={handleSave}>
 *     Save
 *   </Button>
 * );
 * ```
 */
export function useRoleAccess(
  options: UseRoleAccessOptions
): UseRoleAccessReturn {
  const {
    isLoading,
    isAuthenticated,
    isAdmin,
    canWrite,
    hasRole,
    hasPermission,
  } = useAuth()

  const hasAccess = React.useMemo(() => {
    if (isLoading || !isAuthenticated) {
      return false
    }

    if (options.requireAdmin && !isAdmin) {
      return false
    }

    if (options.requireWrite && !canWrite) {
      return false
    }

    if (options.requiredRole && !hasRole(options.requiredRole)) {
      return false
    }

    if (
      options.requiredPermission &&
      !hasPermission(options.requiredPermission)
    ) {
      return false
    }

    if (options.allowedRoles && options.allowedRoles.length > 0) {
      const hasAllowedRole = options.allowedRoles.some((role) => hasRole(role))
      if (!hasAllowedRole) {
        return false
      }
    }

    return true
  }, [
    isLoading,
    isAuthenticated,
    isAdmin,
    canWrite,
    hasRole,
    hasPermission,
    options.requireAdmin,
    options.requireWrite,
    options.requiredRole,
    options.requiredPermission,
    options.allowedRoles,
  ])

  return {
    hasAccess,
    isLoading,
    isAuthenticated,
  }
}

export default RoleGuard