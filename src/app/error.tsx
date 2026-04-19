"use client"

import * as React from "react"
import { AlertTriangle, Home, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { APP_CONFIG, ROUTES } from "@/constants/constants"

// ============================================================
// Types
// ============================================================

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

// ============================================================
// Global Error Page
// ============================================================

/**
 * Global error boundary page rendered by Next.js when an unhandled
 * error occurs during rendering. Displays a centered error message
 * with retry and navigation options.
 *
 * This is a client component as required by Next.js error boundaries.
 * It receives the error object and a reset function to re-render the
 * segment that threw the error.
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  React.useEffect(() => {
    console.error("Global error boundary caught an error:", error)
  }, [error])

  const showErrorDetails = process.env.NODE_ENV === "development"

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        {/* Error Icon */}
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>

        {/* Title */}
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Something went wrong
        </h1>

        {/* Description */}
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          An unexpected error occurred while rendering this page. Please try
          again or navigate back to the dashboard. If the issue persists,
          contact support.
        </p>

        {/* Error Details (development only) */}
        {showErrorDetails && error.message && (
          <pre className="mt-4 w-full max-h-40 overflow-auto rounded-md border bg-muted/50 p-4 text-left text-2xs font-mono text-muted-foreground">
            {error.message}
            {error.digest && (
              <>
                {"\n\n"}Digest: {error.digest}
              </>
            )}
            {error.stack && (
              <>
                {"\n\n"}
                {error.stack}
              </>
            )}
          </pre>
        )}

        {/* Error Digest (production) */}
        {!showErrorDetails && error.digest && (
          <p className="mt-3 text-2xs text-muted-foreground font-mono">
            Error ID: {error.digest}
          </p>
        )}

        {/* Actions */}
        <div className="mt-8 flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={reset}
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Button size="sm" className="gap-1.5" asChild>
            <a href={ROUTES.DASHBOARD}>
              <Home className="h-4 w-4" />
              Dashboard
            </a>
          </Button>
        </div>

        {/* Footer */}
        <p className="mt-12 text-2xs text-muted-foreground">
          {APP_CONFIG.NAME} &middot; v{APP_CONFIG.VERSION}
        </p>
      </div>
    </div>
  )
}