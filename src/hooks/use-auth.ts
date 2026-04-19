import { useSession, signIn, signOut } from "next-auth/react";
import { useMemo, useCallback } from "react";
import { hasRole, hasPermission, isAdmin as checkIsAdmin, canWrite as checkCanWrite } from "@/lib/auth";
import type { UserRole } from "@/types";

// ============================================================
// Types
// ============================================================

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  team?: string;
  avatar_url?: string;
  azure_ad_id?: string;
  is_active: boolean;
}

export interface UseAuthReturn {
  /** The authenticated user object, or null if not authenticated */
  user: AuthUser | null;
  /** Whether the session is currently loading */
  isLoading: boolean;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** The user's role, or null if not authenticated */
  role: UserRole | null;
  /** Whether the user has the admin role */
  isAdmin: boolean;
  /** Whether the user has the ARE lead role */
  isARELead: boolean;
  /** Whether the user has the SRE engineer role */
  isSREEngineer: boolean;
  /** Whether the user has the platform engineer role */
  isPlatformEngineer: boolean;
  /** Whether the user has the executive role */
  isExecutive: boolean;
  /** Whether the user is a view-only user */
  isViewOnly: boolean;
  /** Whether the user can perform write operations */
  canWrite: boolean;
  /** Whether the user's account is active */
  isActive: boolean;
  /** Checks if the user has a specific role (admin always returns true) */
  hasRole: (requiredRole: UserRole) => boolean;
  /** Checks if the user has a specific permission based on their role */
  hasPermission: (permission: string) => boolean;
  /** Triggers the sign-in flow */
  signIn: () => Promise<void>;
  /** Triggers the sign-out flow */
  signOut: () => Promise<void>;
}

// ============================================================
// Hook Implementation
// ============================================================

/**
 * Custom React hook wrapping NextAuth useSession with typed role information,
 * loading state, and convenience methods for role-based access control.
 *
 * Provides a strongly-typed interface to the current user's authentication state,
 * role, and permissions. All role checks use the centralized RBAC logic from
 * `@/lib/auth` to ensure consistency across the application.
 *
 * @returns Authentication state and convenience methods
 *
 * @example
 * ```tsx
 * const { user, isAdmin, isLoading, hasPermission } = useAuth();
 *
 * if (isLoading) return <Spinner />;
 * if (!user) return <LoginPrompt />;
 * if (!hasPermission("write:services")) return <AccessDenied />;
 *
 * return <AdminPanel user={user} />;
 * ```
 */
export function useAuth(): UseAuthReturn {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated" && !!session?.user;

  const user = useMemo<AuthUser | null>(() => {
    if (!isAuthenticated || !session?.user) {
      return null;
    }

    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      team: session.user.team,
      avatar_url: session.user.avatar_url,
      azure_ad_id: session.user.azure_ad_id,
      is_active: session.user.is_active,
    };
  }, [isAuthenticated, session]);

  const role = user?.role ?? null;
  const isActive = user?.is_active ?? false;

  const roleChecks = useMemo(() => {
    if (!role) {
      return {
        isAdmin: false,
        isARELead: false,
        isSREEngineer: false,
        isPlatformEngineer: false,
        isExecutive: false,
        isViewOnly: false,
        canWrite: false,
      };
    }

    return {
      isAdmin: checkIsAdmin(role),
      isARELead: role === "are_lead" || checkIsAdmin(role),
      isSREEngineer: role === "sre_engineer" || checkIsAdmin(role),
      isPlatformEngineer: role === "platform_engineer" || checkIsAdmin(role),
      isExecutive: role === "executive",
      isViewOnly: role === "viewer",
      canWrite: checkCanWrite(role),
    };
  }, [role]);

  const checkHasRole = useCallback(
    (requiredRole: UserRole): boolean => {
      if (!role) return false;
      return hasRole(role, requiredRole);
    },
    [role]
  );

  const checkHasPermission = useCallback(
    (permission: string): boolean => {
      if (!role) return false;
      return hasPermission(role, permission);
    },
    [role]
  );

  const handleSignIn = useCallback(async (): Promise<void> => {
    await signIn("azure-ad", { callbackUrl: "/" });
  }, []);

  const handleSignOut = useCallback(async (): Promise<void> => {
    await signOut({ callbackUrl: "/login" });
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated,
    role,
    isAdmin: roleChecks.isAdmin,
    isARELead: roleChecks.isARELead,
    isSREEngineer: roleChecks.isSREEngineer,
    isPlatformEngineer: roleChecks.isPlatformEngineer,
    isExecutive: roleChecks.isExecutive,
    isViewOnly: roleChecks.isViewOnly,
    canWrite: roleChecks.canWrite,
    isActive,
    hasRole: checkHasRole,
    hasPermission: checkHasPermission,
    signIn: handleSignIn,
    signOut: handleSignOut,
  };
}