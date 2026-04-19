"use client"

import * as React from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// ============================================================
// Types
// ============================================================

export interface ErrorBoundaryProps {
  /** Child components to render */
  children: React.ReactNode
  /** Optional fallback UI to render when an error occurs */
  fallback?: React.ReactNode
  /** Optional custom fallback render function receiving the error and reset handler */
  fallbackRender?: (props: {
    error: Error
    resetErrorBoundary: () => void
  }) => React.ReactNode
  /** Callback invoked when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  /** Callback invoked when the error boundary is reset */
  onReset?: () => void
  /** Optional title for the default fallback UI */
  title?: string
  /** Optional description for the default fallback UI */
  description?: string
  /** Whether to show the error details in the fallback UI (default: false in production) */
  showErrorDetails?: boolean
  /** Size variant for the default fallback UI */
  variant?: "inline" | "card" | "full"
  /** Additional CSS class names */
  className?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

// ============================================================
// ErrorBoundary Component
// ============================================================

/**
 * React error boundary component that catches rendering errors in child
 * components and displays a fallback UI with a retry option. Prevents
 * the entire application from crashing when a single dashboard module
 * encounters an error.
 *
 * Supports three fallback variants:
 * - `inline`: Compact inline alert for use within cards or sections
 * - `card`: Card-based fallback for dashboard module errors
 * - `full`: Full-page fallback for top-level errors
 *
 * @example
 * ```tsx
 * // Card variant (default) for dashboard modules
 * <ErrorBoundary
 *   title="Availability Module Error"
 *   description="Failed to render the availability dashboard."
 *   onError={(error) => console.error("Module error:", error)}
 * >
 *   <AvailabilityDashboard />
 * </ErrorBoundary>
 *
 * // Inline variant for smaller sections
 * <ErrorBoundary variant="inline">
 *   <MetricCard label="MTTR" value={42} format="duration" />
 * </ErrorBoundary>
 *
 * // Custom fallback render function
 * <ErrorBoundary
 *   fallbackRender={({ error, resetErrorBoundary }) => (
 *     <div>
 *       <p>Something went wrong: {error.message}</p>
 *       <button onClick={resetErrorBoundary}>Try again</button>
 *     </div>
 *   )}
 * >
 *   <ServiceMap />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo })

    // Invoke the optional onError callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Log the error in non-production environments
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  /**
   * Resets the error boundary state, allowing the children to re-render.
   */
  resetErrorBoundary = (): void => {
    if (this.props.onReset) {
      this.props.onReset()
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render(): React.ReactNode {
    const {
      children,
      fallback,
      fallbackRender,
      title,
      description,
      showErrorDetails,
      variant = "card",
      className,
    } = this.props

    const { hasError, error } = this.state

    if (!hasError || !error) {
      return children
    }

    // Custom fallback element
    if (fallback) {
      return fallback
    }

    // Custom fallback render function
    if (fallbackRender) {
      return fallbackRender({
        error,
        resetErrorBoundary: this.resetErrorBoundary,
      })
    }

    // Default fallback UI based on variant
    const shouldShowDetails =
      showErrorDetails ?? process.env.NODE_ENV === "development"

    switch (variant) {
      case "inline":
        return (
          <InlineFallback
            error={error}
            title={title}
            description={description}
            showErrorDetails={shouldShowDetails}
            onRetry={this.resetErrorBoundary}
            className={className}
          />
        )
      case "full":
        return (
          <FullFallback
            error={error}
            title={title}
            description={description}
            showErrorDetails={shouldShowDetails}
            onRetry={this.resetErrorBoundary}
            className={className}
          />
        )
      case "card":
      default:
        return (
          <CardFallback
            error={error}
            title={title}
            description={description}
            showErrorDetails={shouldShowDetails}
            onRetry={this.resetErrorBoundary}
            className={className}
          />
        )
    }
  }
}

// ============================================================
// Fallback UI Components
// ============================================================

interface FallbackProps {
  error: Error
  title?: string
  description?: string
  showErrorDetails: boolean
  onRetry: () => void
  className?: string
}

/**
 * Inline fallback UI for compact error display within cards or sections.
 */
function InlineFallback({
  error,
  title,
  description,
  showErrorDetails,
  onRetry,
  className,
}: FallbackProps) {
  return (
    <Alert variant="destructive" className={cn("my-2", className)}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{title || "Something went wrong"}</AlertTitle>
      <AlertDescription>
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            {description || "An unexpected error occurred while rendering this section."}
          </p>
          {showErrorDetails && error.message && (
            <pre className="mt-1 max-h-20 overflow-auto rounded bg-destructive/10 p-2 text-2xs font-mono">
              {error.message}
            </pre>
          )}
          <div className="mt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="h-7 gap-1.5 text-xs"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  )
}

/**
 * Card-based fallback UI for dashboard module errors.
 */
function CardFallback({
  error,
  title,
  description,
  showErrorDetails,
  onRetry,
  className,
}: FallbackProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </div>
        <CardTitle className="text-base font-semibold">
          {title || "Something went wrong"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {description ||
            "An unexpected error occurred while rendering this module. Please try again or contact support if the issue persists."}
        </p>
        {showErrorDetails && error.message && (
          <pre className="mt-3 max-h-32 overflow-auto rounded-md border bg-muted/50 p-3 text-2xs font-mono text-muted-foreground">
            {error.message}
            {error.stack && (
              <>
                {"\n\n"}
                {error.stack}
              </>
            )}
          </pre>
        )}
      </CardContent>
      <CardFooter className="border-t bg-muted/20 px-6 py-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      </CardFooter>
    </Card>
  )
}

/**
 * Full-page fallback UI for top-level errors.
 */
function FullFallback({
  error,
  title,
  description,
  showErrorDetails,
  onRetry,
  className,
}: FallbackProps) {
  return (
    <div
      className={cn(
        "flex min-h-[400px] flex-col items-center justify-center px-4 py-12",
        className
      )}
    >
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="mb-2 text-xl font-semibold tracking-tight">
          {title || "Something went wrong"}
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          {description ||
            "An unexpected error occurred. Please try again or contact support if the issue persists."}
        </p>
        {showErrorDetails && error.message && (
          <pre className="mb-6 w-full max-h-40 overflow-auto rounded-md border bg-muted/50 p-4 text-left text-2xs font-mono text-muted-foreground">
            {error.message}
            {error.stack && (
              <>
                {"\n\n"}
                {error.stack}
              </>
            )}
          </pre>
        )}
        <Button onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// Convenience Wrapper Component
// ============================================================

export interface ModuleErrorBoundaryProps {
  /** Child components to render */
  children: React.ReactNode
  /** Module name for the error title */
  moduleName?: string
  /** Callback invoked when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  /** Callback invoked when the error boundary is reset */
  onReset?: () => void
  /** Additional CSS class names */
  className?: string
}

/**
 * Convenience error boundary wrapper for dashboard modules.
 * Pre-configured with the card variant and module-specific messaging.
 *
 * @example
 * ```tsx
 * <ModuleErrorBoundary moduleName="Availability">
 *   <AvailabilityDashboard />
 * </ModuleErrorBoundary>
 * ```
 */
export function ModuleErrorBoundary({
  children,
  moduleName,
  onError,
  onReset,
  className,
}: ModuleErrorBoundaryProps) {
  const moduleTitle = moduleName
    ? `${moduleName} Error`
    : "Module Error"
  const moduleDescription = moduleName
    ? `An error occurred while rendering the ${moduleName} module. Please try again.`
    : "An error occurred while rendering this module. Please try again."

  return (
    <ErrorBoundary
      title={moduleTitle}
      description={moduleDescription}
      variant="card"
      onError={onError}
      onReset={onReset}
      className={className}
    >
      {children}
    </ErrorBoundary>
  )
}

export default ErrorBoundary