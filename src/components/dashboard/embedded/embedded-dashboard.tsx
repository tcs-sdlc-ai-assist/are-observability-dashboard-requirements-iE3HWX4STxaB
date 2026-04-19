"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Maximize2,
  Minimize2,
  Monitor,
  RefreshCw,
  Settings,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

// ============================================================
// Types
// ============================================================

export type EmbeddedDashboardSource = "dynatrace" | "elastic" | "grafana" | "custom"

export interface EmbeddedDashboardProps {
  /** The source type of the embedded dashboard */
  source: EmbeddedDashboardSource
  /** The URL to embed in the iframe */
  url: string
  /** Display title for the dashboard */
  title?: string
  /** Description text shown below the title */
  description?: string
  /** Height of the iframe in pixels (default: 600) */
  height?: number
  /** Whether to show the header with controls (default: true) */
  showHeader?: boolean
  /** Whether to show the fullscreen toggle (default: true) */
  showFullscreen?: boolean
  /** Whether to show the refresh button (default: true) */
  showRefresh?: boolean
  /** Whether to show the open-in-new-tab button (default: true) */
  showExternalLink?: boolean
  /** Optional list of alternative dashboard URLs for a selector */
  dashboardOptions?: Array<{
    value: string
    label: string
    url: string
  }>
  /** Callback when the selected dashboard changes */
  onDashboardChange?: (url: string) => void
  /** Auto-refresh interval in seconds (0 = disabled, default: 0) */
  autoRefreshSeconds?: number
  /** Additional CSS class names */
  className?: string
}

interface IframeState {
  status: "loading" | "loaded" | "error" | "blocked"
  errorMessage?: string
}

// ============================================================
// Constants
// ============================================================

const SOURCE_CONFIG: Record<
  EmbeddedDashboardSource,
  {
    label: string
    icon: React.ElementType
    defaultTitle: string
    badgeVariant: "info" | "success" | "warning" | "secondary"
  }
> = {
  dynatrace: {
    label: "Dynatrace",
    icon: Monitor,
    defaultTitle: "Dynatrace Dashboard",
    badgeVariant: "info",
  },
  elastic: {
    label: "Elastic",
    icon: Monitor,
    defaultTitle: "Elastic Dashboard",
    badgeVariant: "success",
  },
  grafana: {
    label: "Grafana",
    icon: Monitor,
    defaultTitle: "Grafana Dashboard",
    badgeVariant: "warning",
  },
  custom: {
    label: "Custom",
    icon: Monitor,
    defaultTitle: "External Dashboard",
    badgeVariant: "secondary",
  },
}

const IFRAME_LOAD_TIMEOUT_MS = 15_000

const AUTO_REFRESH_OPTIONS = [
  { value: "0", label: "Off" },
  { value: "30", label: "30s" },
  { value: "60", label: "1m" },
  { value: "300", label: "5m" },
  { value: "600", label: "10m" },
]

// ============================================================
// Helpers
// ============================================================

/**
 * Validates that a URL is a valid HTTP/HTTPS URL.
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ["http:", "https:"].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * Extracts the hostname from a URL for display purposes.
 */
function extractHostname(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return url
  }
}

// ============================================================
// EmbeddedDashboard Component
// ============================================================

/**
 * Embedded external dashboard component rendering Dynatrace, Elastic, Grafana,
 * or custom dashboards in iframes. Configurable URL, height, and loading state.
 * Includes fallback for blocked iframes, auto-refresh support, fullscreen toggle,
 * and dashboard selector for switching between multiple views.
 *
 * @example
 * ```tsx
 * <EmbeddedDashboard
 *   source="dynatrace"
 *   url="https://your-instance.live.dynatrace.com/ui/dashboard/..."
 *   title="Infrastructure Overview"
 *   height={700}
 *   showFullscreen
 *   showRefresh
 *   autoRefreshSeconds={60}
 * />
 *
 * <EmbeddedDashboard
 *   source="elastic"
 *   url="https://your-instance.elastic.co/app/dashboards#/view/..."
 *   title="Application Logs"
 *   dashboardOptions={[
 *     { value: "logs", label: "Logs", url: "https://..." },
 *     { value: "apm", label: "APM", url: "https://..." },
 *   ]}
 *   onDashboardChange={(url) => console.log("Switched to:", url)}
 * />
 * ```
 */
export function EmbeddedDashboard({
  source,
  url,
  title,
  description,
  height = 600,
  showHeader = true,
  showFullscreen = true,
  showRefresh = true,
  showExternalLink = true,
  dashboardOptions,
  onDashboardChange,
  autoRefreshSeconds = 0,
  className,
}: EmbeddedDashboardProps) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoRefreshRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const [iframeState, setIframeState] = React.useState<IframeState>({
    status: "loading",
  })
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [currentUrl, setCurrentUrl] = React.useState(url)
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [autoRefresh, setAutoRefresh] = React.useState(autoRefreshSeconds)

  const sourceConfig = SOURCE_CONFIG[source] || SOURCE_CONFIG.custom
  const displayTitle = title || sourceConfig.defaultTitle
  const SourceIcon = sourceConfig.icon

  // Sync URL prop changes
  React.useEffect(() => {
    setCurrentUrl(url)
  }, [url])

  // Validate URL
  const isUrlValid = isValidUrl(currentUrl)

  // Handle iframe load
  const handleIframeLoad = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIframeState({ status: "loaded" })
  }, [])

  // Handle iframe error
  const handleIframeError = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIframeState({
      status: "error",
      errorMessage:
        "Failed to load the external dashboard. The resource may be unavailable or blocked by security policies.",
    })
  }, [])

  // Set up load timeout
  React.useEffect(() => {
    if (!isUrlValid) {
      setIframeState({
        status: "error",
        errorMessage: `Invalid URL: "${currentUrl}". Please provide a valid HTTP or HTTPS URL.`,
      })
      return
    }

    setIframeState({ status: "loading" })

    timeoutRef.current = setTimeout(() => {
      // If still loading after timeout, assume blocked
      setIframeState((prev) => {
        if (prev.status === "loading") {
          return {
            status: "blocked",
            errorMessage:
              "The dashboard could not be loaded within the expected time. It may be blocked by Content Security Policy, X-Frame-Options, or network restrictions.",
          }
        }
        return prev
      })
    }, IFRAME_LOAD_TIMEOUT_MS)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [currentUrl, refreshKey, isUrlValid])

  // Auto-refresh interval
  React.useEffect(() => {
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current)
      autoRefreshRef.current = null
    }

    if (autoRefresh > 0) {
      autoRefreshRef.current = setInterval(() => {
        setRefreshKey((prev) => prev + 1)
      }, autoRefresh * 1000)
    }

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current)
        autoRefreshRef.current = null
      }
    }
  }, [autoRefresh])

  const handleRefresh = React.useCallback(() => {
    setRefreshKey((prev) => prev + 1)
  }, [])

  const handleToggleFullscreen = React.useCallback(() => {
    setIsFullscreen((prev) => !prev)
  }, [])

  const handleOpenExternal = React.useCallback(() => {
    if (isUrlValid) {
      window.open(currentUrl, "_blank", "noopener,noreferrer")
    }
  }, [currentUrl, isUrlValid])

  const handleDashboardSelect = React.useCallback(
    (value: string) => {
      if (!dashboardOptions) return

      const selected = dashboardOptions.find((opt) => opt.value === value)
      if (selected) {
        setCurrentUrl(selected.url)
        if (onDashboardChange) {
          onDashboardChange(selected.url)
        }
      }
    },
    [dashboardOptions, onDashboardChange]
  )

  const handleAutoRefreshChange = React.useCallback((value: string) => {
    setAutoRefresh(Number(value))
  }, [])

  // Determine the currently selected dashboard option value
  const selectedDashboardValue = React.useMemo(() => {
    if (!dashboardOptions) return undefined
    const match = dashboardOptions.find((opt) => opt.url === currentUrl)
    return match?.value
  }, [dashboardOptions, currentUrl])

  // Invalid URL state
  if (!isUrlValid) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        {showHeader && (
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                {displayTitle}
              </CardTitle>
              <CardDescription>Invalid dashboard URL</CardDescription>
            </div>
          </CardHeader>
        )}
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Invalid URL</AlertTitle>
            <AlertDescription>
              The provided URL is not a valid HTTP or HTTPS address. Please check
              the dashboard configuration.
              <pre className="mt-2 max-h-20 overflow-auto rounded bg-destructive/10 p-2 text-2xs font-mono">
                {currentUrl}
              </pre>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        "overflow-hidden",
        isFullscreen &&
          "fixed inset-0 z-50 rounded-none border-0 shadow-none",
        className
      )}
    >
      {/* Header */}
      {showHeader && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 shrink-0">
              <SourceIcon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold truncate">
                  {displayTitle}
                </CardTitle>
                <Badge variant={sourceConfig.badgeVariant} className="text-2xs shrink-0">
                  {sourceConfig.label}
                </Badge>
                {iframeState.status === "loaded" && (
                  <Badge variant="success" className="text-2xs shrink-0">
                    Connected
                  </Badge>
                )}
                {iframeState.status === "loading" && (
                  <Badge variant="secondary" className="text-2xs shrink-0">
                    Loading…
                  </Badge>
                )}
                {(iframeState.status === "error" ||
                  iframeState.status === "blocked") && (
                  <Badge variant="destructive" className="text-2xs shrink-0">
                    {iframeState.status === "blocked" ? "Blocked" : "Error"}
                  </Badge>
                )}
              </div>
              <CardDescription className="truncate">
                {description || extractHostname(currentUrl)}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Dashboard Selector */}
            {dashboardOptions && dashboardOptions.length > 0 && (
              <Select
                value={selectedDashboardValue}
                onValueChange={handleDashboardSelect}
              >
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue placeholder="Select Dashboard" />
                </SelectTrigger>
                <SelectContent>
                  {dashboardOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Auto-Refresh Selector */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Select
                      value={String(autoRefresh)}
                      onValueChange={handleAutoRefreshChange}
                    >
                      <SelectTrigger className="h-8 w-[80px] text-xs">
                        <SelectValue placeholder="Refresh" />
                      </SelectTrigger>
                      <SelectContent>
                        {AUTO_REFRESH_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  Auto-refresh interval
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Refresh Button */}
            {showRefresh && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleRefresh}
                    >
                      <RefreshCw
                        className={cn(
                          "h-4 w-4",
                          iframeState.status === "loading" && "animate-spin"
                        )}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4}>
                    Refresh dashboard
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Fullscreen Toggle */}
            {showFullscreen && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleToggleFullscreen}
                    >
                      {isFullscreen ? (
                        <Minimize2 className="h-4 w-4" />
                      ) : (
                        <Maximize2 className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4}>
                    {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Open in New Tab */}
            {showExternalLink && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleOpenExternal}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4}>
                    Open in new tab
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Close Fullscreen */}
            {isFullscreen && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleToggleFullscreen}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
      )}

      {/* Content */}
      <CardContent className="p-0 relative">
        {/* Loading Overlay */}
        {iframeState.status === "loading" && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm"
            style={{ height: isFullscreen ? "calc(100vh - 80px)" : height }}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <RefreshCw className="h-6 w-6 text-primary animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  Loading {sourceConfig.label} Dashboard
                </p>
                <p className="text-2xs text-muted-foreground mt-1">
                  Connecting to {extractHostname(currentUrl)}…
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error / Blocked Fallback */}
        {(iframeState.status === "error" ||
          iframeState.status === "blocked") && (
          <div
            className="flex flex-col items-center justify-center px-6"
            style={{ height: isFullscreen ? "calc(100vh - 80px)" : height }}
          >
            <div className="flex max-w-md flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="mb-2 text-lg font-semibold tracking-tight">
                {iframeState.status === "blocked"
                  ? "Dashboard Blocked"
                  : "Dashboard Unavailable"}
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                {iframeState.errorMessage ||
                  "The external dashboard could not be loaded."}
              </p>

              {iframeState.status === "blocked" && (
                <Alert variant="warning" className="mb-4 text-left">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Possible Causes</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-1 space-y-1 text-2xs list-disc list-inside">
                      <li>
                        The target site sets <code>X-Frame-Options</code> or{" "}
                        <code>Content-Security-Policy</code> headers that prevent
                        embedding.
                      </li>
                      <li>
                        Your browser or network may be blocking cross-origin
                        iframes.
                      </li>
                      <li>
                        The dashboard URL may require authentication that cannot
                        be passed through an iframe.
                      </li>
                      <li>
                        VPN or proxy settings may be interfering with the
                        connection.
                      </li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleRefresh}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleOpenExternal}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in New Tab
                </Button>
              </div>

              <p className="mt-4 text-2xs text-muted-foreground">
                URL: {currentUrl}
              </p>
            </div>
          </div>
        )}

        {/* Iframe */}
        {isUrlValid && (
          <iframe
            ref={iframeRef}
            key={`${currentUrl}-${refreshKey}`}
            src={currentUrl}
            title={displayTitle}
            className={cn(
              "w-full border-0",
              (iframeState.status === "error" ||
                iframeState.status === "blocked") &&
                "hidden"
            )}
            style={{
              height: isFullscreen ? "calc(100vh - 80px)" : height,
            }}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        )}

        {/* Footer */}
        {iframeState.status === "loaded" && (
          <div className="flex items-center justify-between border-t px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-2xs text-muted-foreground">
                Connected to {extractHostname(currentUrl)}
              </span>
              {autoRefresh > 0 && (
                <span className="text-2xs text-muted-foreground">
                  · Auto-refresh: {autoRefresh}s
                </span>
              )}
            </div>
            <span className="text-2xs text-muted-foreground">
              {sourceConfig.label} Embedded Dashboard
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// EmbeddedDashboardSkeleton Component
// ============================================================

export interface EmbeddedDashboardSkeletonProps {
  /** Height of the skeleton area (default: 600) */
  height?: number
  /** Whether to show the header skeleton */
  showHeader?: boolean
  /** Additional CSS class names */
  className?: string
}

/**
 * Loading skeleton for the EmbeddedDashboard component.
 */
export function EmbeddedDashboardSkeleton({
  height = 600,
  showHeader = true,
  className,
}: EmbeddedDashboardSkeletonProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {showHeader && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-[80px] rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <div
          className="flex items-center justify-center bg-muted/30"
          style={{ height }}
        >
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Wrapped Export with Error Boundary
// ============================================================

export interface EmbeddedDashboardWithBoundaryProps
  extends EmbeddedDashboardProps {}

/**
 * EmbeddedDashboard wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function EmbeddedDashboardWithBoundary(
  props: EmbeddedDashboardWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Embedded Dashboard">
      <EmbeddedDashboard {...props} />
    </ModuleErrorBoundary>
  )
}

export default EmbeddedDashboard