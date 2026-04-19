import type { NextAuthOptions, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import AzureADProvider from "next-auth/providers/azure-ad";
import { createServerClient } from "@/lib/supabase";
import type { UserRole } from "@/types";

// ============================================================
// Type Extensions for NextAuth
// ============================================================

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      team?: string;
      avatar_url?: string;
      azure_ad_id?: string;
      is_active: boolean;
    };
    accessToken?: string;
  }

  interface User {
    id: string;
    name: string;
    email: string;
    role?: UserRole;
    team?: string;
    avatar_url?: string;
    azure_ad_id?: string;
    is_active?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    team?: string;
    avatar_url?: string;
    azure_ad_id?: string;
    is_active?: boolean;
    accessToken?: string;
  }
}

// ============================================================
// Azure AD Role to App Role Mapping
// ============================================================

const AZURE_AD_ROLE_MAP: Record<string, UserRole> = {
  "Admin": "admin",
  "ARE Lead": "are_lead",
  "ARE_Lead": "are_lead",
  "SRE Engineer": "sre_engineer",
  "SRE_Engineer": "sre_engineer",
  "Platform Engineer": "platform_engineer",
  "Platform_Engineer": "platform_engineer",
  "Executive": "executive",
  "View-Only": "viewer",
  "View_Only": "viewer",
  "Viewer": "viewer",
};

/**
 * Maps an Azure AD role claim to the application's UserRole type.
 * Falls back to "viewer" if no matching role is found.
 */
function mapAzureADRoleToAppRole(azureRoles?: string | string[]): UserRole {
  if (!azureRoles) {
    return "viewer";
  }

  const roles = Array.isArray(azureRoles) ? azureRoles : [azureRoles];

  // Priority order: admin > are_lead > sre_engineer > platform_engineer > executive > viewer
  const rolePriority: UserRole[] = [
    "admin",
    "are_lead",
    "sre_engineer",
    "platform_engineer",
    "executive",
    "viewer",
  ];

  const mappedRoles: UserRole[] = roles
    .map((role) => AZURE_AD_ROLE_MAP[role])
    .filter((role): role is UserRole => role !== undefined);

  if (mappedRoles.length === 0) {
    return "viewer";
  }

  // Return the highest-priority role
  for (const priorityRole of rolePriority) {
    if (mappedRoles.includes(priorityRole)) {
      return priorityRole;
    }
  }

  return "viewer";
}

// ============================================================
// User Sync with Supabase
// ============================================================

/**
 * Upserts the user record in Supabase after successful authentication.
 * Returns the user record from the database.
 */
async function syncUserToDatabase(profile: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  azure_ad_id?: string;
}) {
  try {
    const supabase = createServerClient();

    // Check if user already exists by email
    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("email", profile.email)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 = no rows found, which is expected for new users
      console.error("Error fetching user from database:", fetchError);
      return null;
    }

    if (existingUser) {
      // Update last login and azure_ad_id if needed
      const { data: updatedUser, error: updateError } = await supabase
        .from("users")
        .update({
          name: profile.name,
          avatar_url: profile.avatar_url || existingUser.avatar_url,
          azure_ad_id: profile.azure_ad_id || existingUser.azure_ad_id,
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingUser.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating user in database:", updateError);
        return existingUser;
      }

      return updatedUser;
    }

    // Create new user
    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        name: profile.name,
        email: profile.email,
        role: profile.role,
        avatar_url: profile.avatar_url,
        azure_ad_id: profile.azure_ad_id,
        is_active: true,
        last_login_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating user in database:", insertError);
      return null;
    }

    return newUser;
  } catch (error) {
    console.error("Error syncing user to database:", error);
    return null;
  }
}

// ============================================================
// NextAuth Configuration
// ============================================================

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      authorization: {
        params: {
          scope: "openid profile email User.Read",
        },
      },
      profile(profile) {
        return {
          id: profile.sub || profile.oid,
          name: profile.name || profile.preferred_username || "",
          email: profile.email || profile.preferred_username || "",
          azure_ad_id: profile.oid || profile.sub,
          avatar_url: profile.picture || undefined,
          role: mapAzureADRoleToAppRole(profile.roles),
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, account, profile }): Promise<JWT> {
      // Initial sign-in: populate token with user data
      if (user) {
        token.id = user.id;
        token.role = user.role || "viewer";
        token.team = user.team;
        token.avatar_url = user.avatar_url;
        token.azure_ad_id = user.azure_ad_id;
        token.is_active = user.is_active ?? true;
      }

      if (account?.access_token) {
        token.accessToken = account.access_token;
      }

      // Map roles from Azure AD profile claims if available
      if (profile) {
        const azureProfile = profile as Record<string, unknown>;
        if (azureProfile.roles) {
          token.role = mapAzureADRoleToAppRole(
            azureProfile.roles as string | string[]
          );
        }
      }

      // Sync user to database on initial sign-in
      if (user && token.email) {
        const dbUser = await syncUserToDatabase({
          id: user.id,
          name: user.name || "",
          email: token.email,
          role: token.role || "viewer",
          avatar_url: token.avatar_url,
          azure_ad_id: token.azure_ad_id,
        });

        if (dbUser) {
          // Use the database role as the source of truth (admin may have overridden)
          token.id = dbUser.id;
          token.role = dbUser.role as UserRole;
          token.team = dbUser.team || undefined;
          token.is_active = dbUser.is_active;
          token.avatar_url = dbUser.avatar_url || token.avatar_url;
        }
      }

      return token;
    },

    async session({ session, token }): Promise<Session> {
      if (token) {
        session.user = {
          id: token.id || token.sub || "",
          name: token.name || "",
          email: token.email || "",
          role: token.role || "viewer",
          team: token.team,
          avatar_url: token.avatar_url,
          azure_ad_id: token.azure_ad_id,
          is_active: token.is_active ?? true,
        };
        session.accessToken = token.accessToken;
      }

      return session;
    },

    async signIn({ user }) {
      // Block inactive users from signing in
      if (user.is_active === false) {
        return false;
      }
      return true;
    },

    async redirect({ url, baseUrl }) {
      // Allow relative URLs
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      // Allow URLs on the same origin
      if (new URL(url).origin === baseUrl) {
        return url;
      }
      return baseUrl;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },

  jwt: {
    maxAge: 8 * 60 * 60, // 8 hours
  },

  secret: process.env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === "development",
};

// ============================================================
// RBAC Helper Functions
// ============================================================

/**
 * Checks if a user has a specific role.
 * Admin role has access to everything.
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  if (userRole === "admin") {
    return true;
  }
  return userRole === requiredRole;
}

/**
 * Checks if a user has a specific permission based on their role.
 */
export function hasPermission(userRole: UserRole, permission: string): boolean {
  const { ROLE_PERMISSIONS } = require("@/constants/constants");
  const permissions = ROLE_PERMISSIONS[userRole] as readonly string[];

  if (!permissions) {
    return false;
  }

  // Check for exact match
  if (permissions.includes(permission)) {
    return true;
  }

  // Check for wildcard permissions (e.g., "read:all" covers "read:services")
  const [action] = permission.split(":");
  if (permissions.includes(`${action}:all`)) {
    return true;
  }

  // Check for "write:all" or "delete:all" wildcards
  if (permissions.includes("write:all") && permission.startsWith("write:")) {
    return true;
  }
  if (permissions.includes("delete:all") && permission.startsWith("delete:")) {
    return true;
  }

  return false;
}

/**
 * Checks if a user has admin-level access.
 */
export function isAdmin(userRole: UserRole): boolean {
  return userRole === "admin";
}

/**
 * Checks if a user can perform write operations.
 */
export function canWrite(userRole: UserRole): boolean {
  return hasPermission(userRole, "write:all") || hasPermission(userRole, "upload:data");
}

/**
 * Validates that the current session has the required role.
 * Throws an error object suitable for API responses if unauthorized.
 */
export function requireRole(
  session: Session | null,
  requiredRole: UserRole
): asserts session is Session {
  if (!session) {
    throw {
      status: 401,
      message: "Authentication required. Please sign in.",
      error_code: "UNAUTHORIZED",
    };
  }

  if (!session.user.is_active) {
    throw {
      status: 403,
      message: "Your account has been deactivated. Please contact an administrator.",
      error_code: "ACCOUNT_INACTIVE",
    };
  }

  if (!hasRole(session.user.role, requiredRole)) {
    throw {
      status: 403,
      message: `Insufficient permissions. Required role: ${requiredRole}.`,
      error_code: "FORBIDDEN",
    };
  }
}

/**
 * Validates that the current session has the required permission.
 * Throws an error object suitable for API responses if unauthorized.
 */
export function requirePermission(
  session: Session | null,
  permission: string
): asserts session is Session {
  if (!session) {
    throw {
      status: 401,
      message: "Authentication required. Please sign in.",
      error_code: "UNAUTHORIZED",
    };
  }

  if (!session.user.is_active) {
    throw {
      status: 403,
      message: "Your account has been deactivated. Please contact an administrator.",
      error_code: "ACCOUNT_INACTIVE",
    };
  }

  if (!hasPermission(session.user.role, permission)) {
    throw {
      status: 403,
      message: `Insufficient permissions. Required permission: ${permission}.`,
      error_code: "FORBIDDEN",
    };
  }
}