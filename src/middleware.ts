import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// ============================================================
// Constants
// ============================================================

/**
 * Routes that require authentication.
 * All paths starting with these prefixes will be checked for a valid session.
 */
const PROTECTED_ROUTE_PREFIXES = ["/dashboard", "/admin"];

/**
 * Routes that should never be intercepted by the middleware.
 * Includes API routes (handled by their own RBAC), static assets,
 * auth endpoints, and the health check.
 */
const PUBLIC_ROUTE_PREFIXES = [
  "/api/",
  "/_next/",
  "/_vercel/",
  "/favicon.ico",
  "/auth/",
  "/login",
];

/**
 * The sign-in page path. Unauthenticated users are redirected here.
 */
const SIGN_IN_PATH = "/auth/signin";

/**
 * Security headers applied to all responses.
 * These supplement the headers configured in next.config.js and vercel.json,
 * providing defense-in-depth at the middleware layer.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  "Strict-Transport-Security":
    "max-age=63072000; includeSubDomains; preload",
};

// ============================================================
// Helpers
// ============================================================

/**
 * Determines whether a given pathname is a public (non-protected) route.
 * Public routes bypass authentication checks entirely.
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Determines whether a given pathname requires authentication.
 */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
}

/**
 * Applies security headers to a NextResponse object.
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

// ============================================================
// Middleware
// ============================================================

/**
 * Next.js middleware for global authentication enforcement and security headers.
 *
 * Responsibilities:
 * 1. Applies security headers (CSP, X-Frame-Options, HSTS, etc.) to all responses.
 * 2. Checks for a valid NextAuth JWT token on all protected routes (/dashboard/*, /admin/*).
 * 3. Redirects unauthenticated users to the sign-in page with a callbackUrl parameter.
 * 4. Redirects inactive users (is_active === false) to the sign-in page.
 * 5. Passes through public routes (API, static assets, auth pages) without auth checks.
 *
 * This middleware runs on the Edge Runtime for optimal performance.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Skip public routes — no auth check needed
  if (isPublicRoute(pathname)) {
    const response = NextResponse.next();
    return applySecurityHeaders(response);
  }

  // Check if the route requires authentication
  if (isProtectedRoute(pathname)) {
    try {
      // Retrieve the NextAuth JWT token from the request cookies
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      });

      // No valid token — redirect to sign-in
      if (!token) {
        const signInUrl = new URL(SIGN_IN_PATH, request.url);
        signInUrl.searchParams.set("callbackUrl", pathname);

        const redirectResponse = NextResponse.redirect(signInUrl);
        return applySecurityHeaders(redirectResponse);
      }

      // Token exists but user account is inactive — redirect to sign-in with error
      if (token.is_active === false) {
        const signInUrl = new URL(SIGN_IN_PATH, request.url);
        signInUrl.searchParams.set("error", "AccessDenied");

        const redirectResponse = NextResponse.redirect(signInUrl);
        return applySecurityHeaders(redirectResponse);
      }

      // Authenticated and active — proceed with security headers
      const response = NextResponse.next();

      // Set user context headers for downstream consumption (non-sensitive only)
      if (token.sub) {
        response.headers.set("x-user-id", token.sub);
      }
      if (token.role && typeof token.role === "string") {
        response.headers.set("x-user-role", token.role);
      }

      return applySecurityHeaders(response);
    } catch (error) {
      // Token verification failed — redirect to sign-in
      console.error("Middleware auth error:", error);

      const signInUrl = new URL(SIGN_IN_PATH, request.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      signInUrl.searchParams.set("error", "Callback");

      const redirectResponse = NextResponse.redirect(signInUrl);
      return applySecurityHeaders(redirectResponse);
    }
  }

  // Non-protected, non-public route (e.g., root "/") — apply headers only
  const response = NextResponse.next();
  return applySecurityHeaders(response);
}

// ============================================================
// Middleware Configuration
// ============================================================

/**
 * Matcher configuration for the middleware.
 * Excludes static files, images, and Next.js internals from middleware processing
 * to avoid unnecessary overhead on asset requests.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Public assets with file extensions (e.g., .svg, .png, .jpg)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};