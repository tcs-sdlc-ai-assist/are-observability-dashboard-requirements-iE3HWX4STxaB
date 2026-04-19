import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { APP_CONFIG } from "@/constants/constants";
import { generateCorrelationId } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  timestamp: string;
  correlation_id: string;
  uptime_seconds: number;
  checks: {
    supabase: ComponentHealth;
    environment: ComponentHealth;
  };
}

interface ComponentHealth {
  status: "healthy" | "unhealthy";
  latency_ms?: number;
  message?: string;
}

// ============================================================
// Constants
// ============================================================

const startTime = Date.now();

const SUPABASE_TIMEOUT_MS = 5_000;

// ============================================================
// Helpers
// ============================================================

/**
 * Checks Supabase connectivity by performing a lightweight query.
 * Returns the health status and latency of the database connection.
 */
async function checkSupabaseHealth(): Promise<ComponentHealth> {
  const start = Date.now();

  try {
    const supabase = createServerClient();

    // Perform a lightweight query to verify connectivity
    const { error } = await Promise.race([
      supabase.from("users").select("id", { count: "exact", head: true }).limit(1),
      new Promise<{ error: { message: string } }>((_, reject) =>
        setTimeout(
          () => reject({ error: { message: `Supabase health check timed out after ${SUPABASE_TIMEOUT_MS}ms.` } }),
          SUPABASE_TIMEOUT_MS
        )
      ),
    ]);

    const latencyMs = Date.now() - start;

    if (error) {
      return {
        status: "unhealthy",
        latency_ms: latencyMs,
        message: `Supabase query failed: ${error.message}`,
      };
    }

    return {
      status: "healthy",
      latency_ms: latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message =
      err instanceof Error
        ? err.message
        : "Supabase connectivity check failed.";

    return {
      status: "unhealthy",
      latency_ms: latencyMs,
      message,
    };
  }
}

/**
 * Checks that critical environment variables are configured.
 * Does not expose values — only checks for presence.
 */
function checkEnvironmentHealth(): ComponentHealth {
  const requiredVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXTAUTH_URL",
    "NEXTAUTH_SECRET",
    "AZURE_AD_CLIENT_ID",
    "AZURE_AD_CLIENT_SECRET",
    "AZURE_AD_TENANT_ID",
  ];

  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName] || process.env[varName]!.trim().length === 0) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    return {
      status: "unhealthy",
      message: `Missing environment variables: ${missing.join(", ")}.`,
    };
  }

  return {
    status: "healthy",
  };
}

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/health
 *
 * Application health check endpoint returning overall status,
 * Supabase connectivity, environment configuration, and version info.
 * Used by Vercel monitoring, load balancers, and uptime checks.
 *
 * This endpoint does NOT require authentication.
 *
 * Response:
 * ```json
 * {
 *   "status": "healthy",
 *   "version": "0.1.0",
 *   "timestamp": "ISO8601",
 *   "correlation_id": "health-...",
 *   "uptime_seconds": 12345,
 *   "checks": {
 *     "supabase": {
 *       "status": "healthy",
 *       "latency_ms": 42
 *     },
 *     "environment": {
 *       "status": "healthy"
 *     }
 *   }
 * }
 * ```
 *
 * Returns HTTP 200 if healthy, HTTP 503 if unhealthy or degraded.
 */
export async function GET(_req: NextRequest): Promise<NextResponse> {
  const correlationId = generateCorrelationId("health");
  const timestamp = new Date().toISOString();
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  try {
    // Run health checks in parallel
    const [supabaseHealth, environmentHealth] = await Promise.all([
      checkSupabaseHealth(),
      Promise.resolve(checkEnvironmentHealth()),
    ]);

    // Determine overall status
    const allHealthy =
      supabaseHealth.status === "healthy" &&
      environmentHealth.status === "healthy";

    const anyUnhealthy =
      supabaseHealth.status === "unhealthy" ||
      environmentHealth.status === "unhealthy";

    let overallStatus: HealthCheckResult["status"];
    if (allHealthy) {
      overallStatus = "healthy";
    } else if (anyUnhealthy) {
      overallStatus = "unhealthy";
    } else {
      overallStatus = "degraded";
    }

    const result: HealthCheckResult = {
      status: overallStatus,
      version: APP_CONFIG.VERSION,
      timestamp,
      correlation_id: correlationId,
      uptime_seconds: uptimeSeconds,
      checks: {
        supabase: supabaseHealth,
        environment: environmentHealth,
      },
    };

    const httpStatus = overallStatus === "healthy" ? 200 : 503;

    return NextResponse.json(result, {
      status: httpStatus,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "X-Correlation-Id": correlationId,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/health:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred during health check.";

    const result: HealthCheckResult = {
      status: "unhealthy",
      version: APP_CONFIG.VERSION,
      timestamp,
      correlation_id: correlationId,
      uptime_seconds: uptimeSeconds,
      checks: {
        supabase: {
          status: "unhealthy",
          message: "Health check failed before Supabase check could complete.",
        },
        environment: {
          status: "unhealthy",
          message: errorMessage,
        },
      },
    };

    return NextResponse.json(result, {
      status: 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "X-Correlation-Id": correlationId,
      },
    });
  }
}