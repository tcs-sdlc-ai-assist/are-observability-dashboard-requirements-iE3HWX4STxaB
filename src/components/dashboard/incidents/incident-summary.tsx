"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowRight,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useIncidentAnalytics } from "@/hooks/use-dashboard-data"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { MetricCard, MetricCardGrid } from "@/components/shared/metric-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { SeverityBadge } from "@/components/shared/status-badge"
import { MetricCardGridSkeleton, ChartSkeleton } from "@/components/shared/loading-skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { ROUTES, DEFAULT_THRESHOLDS } from "@/constants/constants"
import type {
  CriticalityTier,
  DashboardFilters,
  IncidentAnalytics,
  IncidentCounts,
  IncidentSeverity,
  RootCauseCategory,
  TimePeriod,
  TrendDirection,
} from "@/types"

// ============================================================
// Types
// ============================================================

export interface IncidentSummaryProps {
  /** Dashboard-level filters to apply */
  filters?: DashboardFilters
  /** Whether to show the summary metric cards (default: true) */
  showSummary?: boolean
  /** Whether to show the MTTR/MTTD cards (default: true) */
  showResponseMetrics?: boolean
  /** Whether to show the root cause breakdown (default: true) */
  showRootCauses?: boolean
  /** Whether to show the repeat failure indicator (default: true) */
  showRepeatFailures?: boolean
  /** Default time period (default: "30d") */
  defaultPeriod?: TimePeriod
  /** Optional criticality tier for threshold display */
  tier?: CriticalityTier
  /** Additional CSS class names */
  className?: string
}

// ============================================================
// Constants
// ============================================================

const PERIOD_OPTIONS: Array<{ value: TimePeriod; label: string }> = [
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "14d", label: "Last 14 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
]

const TREND_ICON_MAP: Record<TrendDirection, React.ElementType> = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
}

const SEVERITY_ICON_MAP: Record<IncidentSeverity, React.ReactNode> = {
  critical: <XCircle className="h-4 w-4" />,
  major: <AlertTriangle className="h-4 w-4" />,
  minor: <AlertTriangle className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
}

const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  critical: "P1 — Critical",
  major: "P2 — Major",
  minor: "P3 — Minor",
  warning: "P4 — Warning",
}

// ============================================================
// Helpers
// ============================================================

/**
 * Returns the MTTR threshold for a given tier.
 */
function getMTTRThreshold(tier: CriticalityTier | undefined): number | undefined {
  if (!tier) return undefined
  return DEFAULT_THRESHOLDS.mttr_minutes[tier]
}

/**
 * Returns the MTTD threshold for a given tier.
 */
function getMTTDThreshold(tier: CriticalityTier | undefined): number | undefined {
  if (!tier) return undefined
  return DEFAULT_THRESHOLDS.mttd_minutes[tier]
}

/**
 * Determines the health status based on incident counts.
 */
function getIncidentHealthStatus(
  counts: IncidentCounts
): "healthy" | "degraded" | "critical" {
  if (counts.critical > 0) return "critical"
  if (counts.major > 0) return "degraded"
  return "healthy"
}

/**
 * Computes the percentage of root cause occurrences.
 */
function computeRootCausePercentage(
  count: number,
  total: number
): number {
  if (total === 0) return 0
  return Math.round((count / total) * 10000) / 100
}

// ============================================================
// IncidentSummary Component
// ============================================================

/**
 * Incident Summary component showing incident counts by severity (P1-P4)
 * as metric cards, with total active incidents, MTTR/MTTD response metrics,
 * root cause breakdown, repeat failure indicators, and trend direction.
 *
 * Supports drill-down navigation to the incidents dashboard and
 * individual incident detail pages.
 *
 * @example
 * ```tsx
 * <IncidentSummary
 *   filters={{ domain: "payments", period: "30d" }}
 *   tier="Tier-1"
 *   showSummary
 *   showResponseMetrics
 *   showRootCauses
 *   showRepeatFailures
 * />
 * ```
 */
export function IncidentSummary({
  filters,
  showSummary = true,
  showResponseMetrics = true,
  showRootCauses = true,
  showRepeatFailures = true,
  defaultPeriod = "30d",
  tier,
  className,
}: IncidentSummaryProps) {
  const router = useRouter()

  const [period, setPeriod] = React.useState<TimePeriod>(
    filters?.period || defaultPeriod
  )

  // Sync period with external filter changes
  React.useEffect(() => {
    if (filters?.period) {
      setPeriod(filters.period)
    }
  }, [filters?.period])

  const { data, isLoading, error, mutate } = useIncidentAnalytics({
    domain: filters?.domain,
    service_id: filters?.service,
    severity: filters?.severity,
    period,
  })

  const incidentCounts = data?.incident_counts || {
    critical: 0,
    major: 0,
    minor: 0,
    warning: 0,
    total: 0,
  }

  const mttr = data?.mttr ?? null
  const mttd = data?.mttd ?? null
  const rootCauses = data?.root_causes || []
  const repeatFailures = data?.repeat_failures || []
  const trend = data?.trend || "stable"

  const healthStatus = getIncidentHealthStatus(incidentCounts)
  const mttrThreshold = getMTTRThreshold(tier)
  const mttdThreshold = getMTTDThreshold(tier)

  const totalRootCauseCount = rootCauses.reduce(
    (sum, rc) => sum + rc.count,
    0
  )

  const handlePeriodChange = React.useCallback((value: string) => {
    setPeriod(value as TimePeriod)
  }, [])

  const handleDrillDown = React.useCallback(() => {
    router.push(ROUTES.DASHBOARD_INCIDENTS)
  }, [router])

  // Error state
  if (error) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              Incident Summary
            </CardTitle>
            <CardDescription>
              Failed to load incident data.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {error.message || "An unexpected error occurred."}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => mutate()}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        {showSummary && <MetricCardGridSkeleton cards={5} columns={5} />}
        {showResponseMetrics && <MetricCardGridSkeleton cards={2} columns={2} />}
        {showRootCauses && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-1.5">
                <div className="h-5 w-40 animate-pulse rounded bg-muted" />
                <div className="h-3 w-56 animate-pulse rounded bg-muted" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-muted/30" />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // Empty state
  if (!data) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Incident Summary
            </CardTitle>
            <CardDescription>
              Incident counts by severity
            </CardDescription>
          </div>
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No incident data available
          </p>
          <p className="text-2xs text-muted-foreground mt-1">
            Adjust your filters or check that incidents are configured.
          </p>
        </CardContent>
      </Card>
    )
  }

  const TrendIcon = TREND_ICON_MAP[trend] || Minus

  // For incidents, "up" is bad (more incidents) and "down" is good
  const trendColor =
    trend === "up"
      ? "text-red-600 dark:text-red-400"
      : trend === "down"
        ? "text-green-600 dark:text-green-400"
        : "text-muted-foreground"

  return (
    <div className={cn("space-y-4", className)}>
      {/* Severity Summary Metric Cards */}
      {showSummary && (
        <MetricCardGrid columns={5}>
          {/* Total Incidents */}
          <MetricCard
            label="Total Incidents"
            value={incidentCounts.total}
            format="number"
            decimals={0}
            trend={trend}
            trendUpIsGood={false}
            icon={<AlertTriangle className="h-4 w-4" />}
            description={`Total incidents across all severities in the selected period. Trend: ${trend === "up" ? "increasing" : trend === "down" ? "decreasing" : "stable"}.`}
            onClick={handleDrillDown}
          />

          {/* P1 — Critical */}
          <MetricCard
            label="P1 — Critical"
            value={incidentCounts.critical}
            format="number"
            decimals={0}
            trendUpIsGood={false}
            threshold={0}
            thresholdExceededIsBad={true}
            icon={SEVERITY_ICON_MAP.critical}
            description="Critical severity incidents requiring immediate response. Any P1 incident is a threshold breach."
            onClick={handleDrillDown}
          />

          {/* P2 — Major */}
          <MetricCard
            label="P2 — Major"
            value={incidentCounts.major}
            format="number"
            decimals={0}
            trendUpIsGood={false}
            threshold={0}
            thresholdExceededIsBad={true}
            icon={SEVERITY_ICON_MAP.major}
            description="Major severity incidents with significant customer or business impact."
            onClick={handleDrillDown}
          />

          {/* P3 — Minor */}
          <MetricCard
            label="P3 — Minor"
            value={incidentCounts.minor}
            format="number"
            decimals={0}
            trendUpIsGood={false}
            icon={SEVERITY_ICON_MAP.minor}
            description="Minor severity incidents with limited impact."
          />

          {/* P4 — Warning */}
          <MetricCard
            label="P4 — Warning"
            value={incidentCounts.warning}
            format="number"
            decimals={0}
            trendUpIsGood={false}
            icon={SEVERITY_ICON_MAP.warning}
            description="Warning-level incidents or alerts that may require attention."
          />
        </MetricCardGrid>
      )}

      {/* MTTR / MTTD Response Metrics */}
      {showResponseMetrics && (
        <MetricCardGrid columns={2}>
          {/* MTTR */}
          <MetricCard
            label="Mean Time to Resolve (MTTR)"
            value={mttr}
            format="duration"
            trend={trend === "up" ? "up" : trend === "down" ? "down" : "stable"}
            trendUpIsGood={false}
            threshold={mttrThreshold}
            thresholdExceededIsBad={true}
            icon={
              <span className="text-muted-foreground text-xs font-medium">
                MTTR
              </span>
            }
            description={`Average time to resolve incidents${tier ? `. ${tier} threshold: ${mttrThreshold} minutes` : ""}.`}
            onClick={handleDrillDown}
          />

          {/* MTTD */}
          <MetricCard
            label="Mean Time to Detect (MTTD)"
            value={mttd}
            format="duration"
            trendUpIsGood={false}
            threshold={mttdThreshold}
            thresholdExceededIsBad={true}
            icon={
              <span className="text-muted-foreground text-xs font-medium">
                MTTD
              </span>
            }
            description={`Average time to detect incidents${tier ? `. ${tier} threshold: ${mttdThreshold} minutes` : ""}.`}
            onClick={handleDrillDown}
          />
        </MetricCardGrid>
      )}

      {/* Root Cause Breakdown & Repeat Failures */}
      {(showRootCauses || showRepeatFailures) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">
                Incident Analytics
              </CardTitle>
              <CardDescription>
                <span className="flex items-center gap-2">
                  <span>
                    {incidentCounts.total} incident{incidentCounts.total !== 1 ? "s" : ""} in period
                  </span>
                  <span>·</span>
                  <div className={cn("flex items-center gap-1", trendColor)}>
                    <TrendIcon className="h-3.5 w-3.5" />
                    <span className="text-2xs font-medium">
                      {trend === "up"
                        ? "Increasing"
                        : trend === "down"
                          ? "Decreasing"
                          : "Stable"}
                    </span>
                  </div>
                  {healthStatus === "critical" && (
                    <Badge variant="destructive" className="text-2xs">
                      Critical Incidents Active
                    </Badge>
                  )}
                  {healthStatus === "degraded" && (
                    <Badge variant="warning" className="text-2xs">
                      Major Incidents Active
                    </Badge>
                  )}
                  {healthStatus === "healthy" && incidentCounts.total === 0 && (
                    <Badge variant="success" className="text-2xs">
                      No Incidents
                    </Badge>
                  )}
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={period} onValueChange={handlePeriodChange}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={handleDrillDown}
              >
                Details
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {/* Root Cause Breakdown */}
            {showRootCauses && rootCauses.length > 0 && (
              <div className="space-y-2">
                <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Root Cause Distribution
                </span>
                <div className="space-y-1.5">
                  {rootCauses.map((rc) => {
                    const percentage = computeRootCausePercentage(
                      rc.count,
                      totalRootCauseCount
                    )

                    return (
                      <RootCauseBar
                        key={rc.category}
                        category={rc.category}
                        count={rc.count}
                        percentage={percentage}
                        total={incidentCounts.total}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {showRootCauses && rootCauses.length === 0 && incidentCounts.total > 0 && (
              <div className="space-y-1">
                <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Root Cause Distribution
                </span>
                <p className="text-2xs text-muted-foreground">
                  No root cause data available for the selected period.
                </p>
              </div>
            )}

            {/* Repeat Failures */}
            {showRepeatFailures && repeatFailures.length > 0 && (
              <div className="space-y-2">
                <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Repeat Failures Detected
                </span>
                <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-2xs text-red-700 dark:text-red-400 font-medium">
                      {repeatFailures.length} repeat failure pattern{repeatFailures.length !== 1 ? "s" : ""} identified
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {repeatFailures.map((failure, index) => (
                        <Badge
                          key={index}
                          variant="destructive"
                          className="text-2xs"
                        >
                          {failure}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showRepeatFailures && repeatFailures.length === 0 && incidentCounts.total > 0 && (
              <div className="space-y-1">
                <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Repeat Failures
                </span>
                <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2">
                  <span className="text-2xs text-green-700 dark:text-green-400 font-medium">
                    No repeat failure patterns detected in the selected period.
                  </span>
                </div>
              </div>
            )}

            {/* Severity Breakdown Bar */}
            {incidentCounts.total > 0 && (
              <div className="space-y-1.5">
                <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Severity Breakdown
                </span>
                <SeverityBreakdownBar counts={incidentCounts} />
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-3">
                {incidentCounts.critical > 0 && (
                  <Badge variant="critical" className="text-2xs">
                    {incidentCounts.critical} Critical
                  </Badge>
                )}
                {incidentCounts.major > 0 && (
                  <Badge variant="major" className="text-2xs">
                    {incidentCounts.major} Major
                  </Badge>
                )}
                {incidentCounts.minor > 0 && (
                  <Badge variant="minor" className="text-2xs">
                    {incidentCounts.minor} Minor
                  </Badge>
                )}
                {incidentCounts.warning > 0 && (
                  <Badge variant="warning" className="text-2xs">
                    {incidentCounts.warning} Warning
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={handleDrillDown}
              >
                Incidents Dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================================
// RootCauseBar Component
// ============================================================

interface RootCauseBarProps {
  category: RootCauseCategory
  count: number
  percentage: number
  total: number
}

/**
 * Individual root cause bar showing category, count, and percentage.
 */
function RootCauseBar({ category, count, percentage, total }: RootCauseBarProps) {
  const barColor =
    category === "Config"
      ? "bg-blue-500"
      : category === "Code"
        ? "bg-purple-500"
        : category === "Infrastructure"
          ? "bg-orange-500"
          : category === "Dependency"
            ? "bg-red-500"
            : category === "Capacity"
              ? "bg-yellow-500"
              : category === "Network"
                ? "bg-cyan-500"
                : category === "Security"
                  ? "bg-pink-500"
                  : "bg-gray-500"

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-3">
            <span className="text-2xs text-muted-foreground w-24 shrink-0 truncate">
              {category}
            </span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                  barColor
                )}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <span className="text-2xs font-medium shrink-0 w-8 text-right">
              {count}
            </span>
            <span className="text-2xs text-muted-foreground shrink-0 w-12 text-right">
              {percentage.toFixed(1)}%
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4} className="max-w-xs">
          <div className="space-y-0.5">
            <p className="text-xs font-medium">{category}</p>
            <p className="text-2xs text-muted-foreground">
              {count} of {total} incident{total !== 1 ? "s" : ""} ({percentage.toFixed(1)}%)
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================
// SeverityBreakdownBar Component
// ============================================================

interface SeverityBreakdownBarProps {
  counts: IncidentCounts
}

/**
 * Stacked horizontal bar showing the severity distribution of incidents.
 */
function SeverityBreakdownBar({ counts }: SeverityBreakdownBarProps) {
  if (counts.total === 0) return null

  const segments: Array<{
    severity: IncidentSeverity
    count: number
    percentage: number
    color: string
    label: string
  }> = [
    {
      severity: "critical",
      count: counts.critical,
      percentage: (counts.critical / counts.total) * 100,
      color: "bg-red-500",
      label: "Critical",
    },
    {
      severity: "major",
      count: counts.major,
      percentage: (counts.major / counts.total) * 100,
      color: "bg-orange-500",
      label: "Major",
    },
    {
      severity: "minor",
      count: counts.minor,
      percentage: (counts.minor / counts.total) * 100,
      color: "bg-yellow-500",
      label: "Minor",
    },
    {
      severity: "warning",
      count: counts.warning,
      percentage: (counts.warning / counts.total) * 100,
      color: "bg-amber-400",
      label: "Warning",
    },
  ].filter((s) => s.count > 0)

  return (
    <div className="space-y-1.5">
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted flex">
        {segments.map((segment) => (
          <TooltipProvider key={segment.severity} delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "h-full transition-all duration-500",
                    segment.color
                  )}
                  style={{ width: `${segment.percentage}%` }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                <p className="text-xs">
                  {segment.label}: {segment.count} ({segment.percentage.toFixed(1)}%)
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {segments.map((segment) => (
          <div key={segment.severity} className="flex items-center gap-1">
            <div
              className={cn("h-2 w-2 rounded-full", segment.color)}
            />
            <span className="text-2xs text-muted-foreground">
              {segment.label} ({segment.count})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Wrapped Export with Error Boundary
// ============================================================

export interface IncidentSummaryWithBoundaryProps
  extends IncidentSummaryProps {}

/**
 * IncidentSummary wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function IncidentSummaryWithBoundary(
  props: IncidentSummaryWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Incident Summary">
      <IncidentSummary {...props} />
    </ModuleErrorBoundary>
  )
}

export default IncidentSummary