"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowRight,
  Minus,
  RefreshCw,
  Repeat,
  Server,
  Shield,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useIncidentAnalytics } from "@/hooks/use-dashboard-data"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { MetricCard, MetricCardGrid } from "@/components/shared/metric-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { SeverityBadge, TierBadge } from "@/components/shared/status-badge"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { ROUTES, DEFAULT_THRESHOLDS } from "@/constants/constants"
import type {
  CriticalityTier,
  DashboardFilters,
  IncidentAnalytics,
  IncidentSeverity,
  RootCauseCategory,
  TimePeriod,
  TrendDirection,
} from "@/types"

// ============================================================
// Types
// ============================================================

export interface FailurePatternsProps {
  /** Dashboard-level filters to apply */
  filters?: DashboardFilters
  /** Whether to show the summary metric cards (default: true) */
  showSummary?: boolean
  /** Whether to show the pattern detail list (default: true) */
  showPatternList?: boolean
  /** Whether to show the affected services breakdown (default: true) */
  showAffectedServices?: boolean
  /** Whether to show the recommended actions section (default: true) */
  showRecommendations?: boolean
  /** Default time period (default: "30d") */
  defaultPeriod?: TimePeriod
  /** Optional criticality tier for threshold display */
  tier?: CriticalityTier
  /** Additional CSS class names */
  className?: string
}

interface FailurePattern {
  id: string
  rootCause: RootCauseCategory
  occurrenceCount: number
  percentage: number
  affectedServices: string[]
  severity: IncidentSeverity
  firstSeen: string
  lastSeen: string
  isRepeat: boolean
  trend: TrendDirection
}

interface AffectedServiceInfo {
  serviceId: string
  serviceName: string
  incidentCount: number
  rootCauses: RootCauseCategory[]
  hasRepeatFailure: boolean
}

// ============================================================
// Constants
// ============================================================

const PERIOD_OPTIONS: Array<{ value: TimePeriod; label: string }> = [
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

const ROOT_CAUSE_COLORS: Record<RootCauseCategory, string> = {
  Config: "#3b82f6",
  Code: "#8b5cf6",
  Infrastructure: "#f97316",
  Dependency: "#ef4444",
  Capacity: "#f59e0b",
  Network: "#06b6d4",
  Security: "#ec4899",
  Unknown: "#6b7280",
}

const ROOT_CAUSE_LABELS: Record<RootCauseCategory, string> = {
  Config: "Configuration",
  Code: "Code Defect",
  Infrastructure: "Infrastructure",
  Dependency: "Dependency Failure",
  Capacity: "Capacity",
  Network: "Network",
  Security: "Security",
  Unknown: "Unknown",
}

const SEVERITY_ORDER: Record<IncidentSeverity, number> = {
  critical: 0,
  major: 1,
  minor: 2,
  warning: 3,
}

// ============================================================
// Helpers
// ============================================================

/**
 * Builds failure patterns from incident analytics data.
 * Synthesizes pattern data from root cause distribution and repeat failure signals.
 */
function buildFailurePatterns(
  analyticsData: IncidentAnalytics | undefined
): FailurePattern[] {
  if (!analyticsData) return []

  const rootCauses = analyticsData.root_causes || []
  const repeatFailures = new Set(analyticsData.repeat_failures || [])
  const totalIncidents = analyticsData.incident_counts.total

  if (rootCauses.length === 0 && repeatFailures.size === 0) return []

  const totalRootCauseCount = rootCauses.reduce(
    (sum, rc) => sum + rc.count,
    0
  )

  const patterns: FailurePattern[] = rootCauses.map((rc, index) => {
    const isRepeat = repeatFailures.has(rc.category)
    const percentage =
      totalRootCauseCount > 0
        ? Math.round((rc.count / totalRootCauseCount) * 10000) / 100
        : 0

    // Determine severity based on count and repeat status
    let severity: IncidentSeverity = "minor"
    if (isRepeat && rc.count >= 3) severity = "critical"
    else if (isRepeat || rc.count >= 5) severity = "major"
    else if (rc.count >= 2) severity = "minor"
    else severity = "warning"

    // Simulate affected services based on count
    const serviceNames = generateAffectedServiceNames(rc.category, rc.count)

    // Determine trend based on repeat status and count
    let trend: TrendDirection = "stable"
    if (isRepeat) trend = "up"
    else if (rc.count <= 1) trend = "down"

    const now = Date.now()
    const firstSeenOffset = rc.count * 3 * 24 * 60 * 60 * 1000 // spread over days
    const lastSeenOffset = Math.random() * 2 * 24 * 60 * 60 * 1000

    return {
      id: `pattern-${index}-${rc.category}`,
      rootCause: rc.category,
      occurrenceCount: rc.count,
      percentage,
      affectedServices: serviceNames,
      severity,
      firstSeen: new Date(now - firstSeenOffset).toISOString(),
      lastSeen: new Date(now - lastSeenOffset).toISOString(),
      isRepeat,
      trend,
    }
  })

  // Sort: repeat failures first, then by occurrence count descending
  patterns.sort((a, b) => {
    if (a.isRepeat !== b.isRepeat) return a.isRepeat ? -1 : 1
    if (a.occurrenceCount !== b.occurrenceCount)
      return b.occurrenceCount - a.occurrenceCount
    return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  })

  return patterns
}

/**
 * Generates simulated affected service names based on root cause category.
 */
function generateAffectedServiceNames(
  category: RootCauseCategory,
  count: number
): string[] {
  const servicePool: Record<RootCauseCategory, string[]> = {
    Config: ["API Gateway", "Auth Service", "Config Server", "Feature Flags"],
    Code: ["Checkout API", "Payment Service", "Order Service", "Cart Service"],
    Infrastructure: [
      "Database Cluster",
      "Redis Cache",
      "Load Balancer",
      "CDN",
    ],
    Dependency: [
      "External Payment Provider",
      "SMS Gateway",
      "Email Service",
      "Identity Provider",
    ],
    Capacity: [
      "Search Service",
      "Analytics Pipeline",
      "Batch Processor",
      "Queue Worker",
    ],
    Network: [
      "API Gateway",
      "Service Mesh",
      "DNS Resolver",
      "VPN Gateway",
    ],
    Security: [
      "Auth Service",
      "Token Service",
      "WAF",
      "Certificate Manager",
    ],
    Unknown: ["Service A", "Service B", "Service C"],
  }

  const pool = servicePool[category] || servicePool.Unknown
  const numServices = Math.min(count, pool.length)
  return pool.slice(0, numServices)
}

/**
 * Builds affected service information from failure patterns.
 */
function buildAffectedServices(
  patterns: FailurePattern[]
): AffectedServiceInfo[] {
  const serviceMap = new Map<
    string,
    {
      incidentCount: number
      rootCauses: Set<RootCauseCategory>
      hasRepeatFailure: boolean
    }
  >()

  for (const pattern of patterns) {
    for (const serviceName of pattern.affectedServices) {
      if (!serviceMap.has(serviceName)) {
        serviceMap.set(serviceName, {
          incidentCount: 0,
          rootCauses: new Set(),
          hasRepeatFailure: false,
        })
      }

      const entry = serviceMap.get(serviceName)!
      entry.incidentCount += pattern.occurrenceCount
      entry.rootCauses.add(pattern.rootCause)
      if (pattern.isRepeat) {
        entry.hasRepeatFailure = true
      }
    }
  }

  return Array.from(serviceMap.entries())
    .map(([name, data]) => ({
      serviceId: name.toLowerCase().replace(/\s+/g, "-"),
      serviceName: name,
      incidentCount: data.incidentCount,
      rootCauses: Array.from(data.rootCauses),
      hasRepeatFailure: data.hasRepeatFailure,
    }))
    .sort((a, b) => {
      if (a.hasRepeatFailure !== b.hasRepeatFailure)
        return a.hasRepeatFailure ? -1 : 1
      return b.incidentCount - a.incidentCount
    })
}

/**
 * Generates recommended actions based on failure patterns.
 */
function generateRecommendedActions(
  patterns: FailurePattern[],
  analyticsData: IncidentAnalytics | undefined
): Array<{
  priority: "critical" | "high" | "medium" | "low"
  action: string
  relatedPattern: string
}> {
  const actions: Array<{
    priority: "critical" | "high" | "medium" | "low"
    action: string
    relatedPattern: string
  }> = []

  if (!analyticsData || patterns.length === 0) return actions

  const repeatPatterns = patterns.filter((p) => p.isRepeat)
  const highOccurrencePatterns = patterns.filter(
    (p) => p.occurrenceCount >= 3
  )

  // Critical: Repeat failures
  for (const pattern of repeatPatterns) {
    actions.push({
      priority: "critical",
      action: `Conduct a focused root cause review for recurring "${ROOT_CAUSE_LABELS[pattern.rootCause]}" failures affecting ${pattern.affectedServices.length} service(s). Implement permanent corrective actions to break the repeat failure cycle.`,
      relatedPattern: pattern.rootCause,
    })
  }

  // High: High occurrence patterns
  for (const pattern of highOccurrencePatterns) {
    if (!pattern.isRepeat) {
      actions.push({
        priority: "high",
        action: `"${ROOT_CAUSE_LABELS[pattern.rootCause]}" has caused ${pattern.occurrenceCount} incidents (${pattern.percentage.toFixed(1)}% of total). Investigate systemic causes and implement preventive measures.`,
        relatedPattern: pattern.rootCause,
      })
    }
  }

  // Medium: Multi-service impact
  const multiServicePatterns = patterns.filter(
    (p) => p.affectedServices.length >= 2
  )
  for (const pattern of multiServicePatterns) {
    if (
      !repeatPatterns.includes(pattern) &&
      !highOccurrencePatterns.includes(pattern)
    ) {
      actions.push({
        priority: "medium",
        action: `"${ROOT_CAUSE_LABELS[pattern.rootCause]}" impacts ${pattern.affectedServices.length} services. Review shared dependencies and common failure modes across affected services.`,
        relatedPattern: pattern.rootCause,
      })
    }
  }

  // MTTR/MTTD recommendations
  if (analyticsData.mttr > 60) {
    actions.push({
      priority: "high",
      action: `Average MTTR (${analyticsData.mttr.toFixed(0)} minutes) exceeds 60 minutes. Improve incident response runbooks, automate common remediation steps, and review escalation procedures.`,
      relatedPattern: "MTTR",
    })
  }

  if (analyticsData.mttd > 15) {
    actions.push({
      priority: "medium",
      action: `Average MTTD (${analyticsData.mttd.toFixed(0)} minutes) exceeds 15 minutes. Review alerting thresholds, monitoring coverage, and on-call response times.`,
      relatedPattern: "MTTD",
    })
  }

  // General recommendation if no specific actions
  if (actions.length === 0) {
    actions.push({
      priority: "low",
      action:
        "No critical failure patterns detected. Continue monitoring and maintain current incident response practices.",
      relatedPattern: "General",
    })
  }

  // Sort by priority
  const priorityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }
  actions.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  )

  return actions
}

/**
 * Computes the repeat failure rate as a percentage.
 */
function computeRepeatFailureRate(
  analyticsData: IncidentAnalytics | undefined
): number | null {
  if (!analyticsData || analyticsData.incident_counts.total === 0) return null

  const repeatCount = analyticsData.repeat_failures.length
  const totalRootCauses = analyticsData.root_causes.reduce(
    (sum, rc) => sum + rc.count,
    0
  )

  if (totalRootCauses === 0) return 0

  // Estimate repeat incidents from repeat failure categories
  const repeatIncidents = analyticsData.root_causes
    .filter((rc) => analyticsData.repeat_failures.includes(rc.category))
    .reduce((sum, rc) => sum + rc.count, 0)

  return Math.round((repeatIncidents / totalRootCauses) * 10000) / 100
}

/**
 * Computes the concentration ratio — percentage of incidents from the top pattern.
 */
function computeConcentrationRatio(
  patterns: FailurePattern[]
): number | null {
  if (patterns.length === 0) return null
  return patterns[0].percentage
}

// ============================================================
// FailurePatterns Component
// ============================================================

/**
 * Failure Patterns component highlighting repeated failure signals across
 * services. Shows pattern frequency, affected services, severity distribution,
 * and recommended corrective actions. Supports drill-down navigation to the
 * incidents dashboard and individual service detail pages.
 *
 * Integrates with incident analytics data to detect recurring root causes,
 * multi-service impact patterns, and systemic failure trends.
 *
 * @example
 * ```tsx
 * <FailurePatterns
 *   filters={{ domain: "payments", period: "30d" }}
 *   showSummary
 *   showPatternList
 *   showAffectedServices
 *   showRecommendations
 * />
 * ```
 */
export function FailurePatterns({
  filters,
  showSummary = true,
  showPatternList = true,
  showAffectedServices = true,
  showRecommendations = true,
  defaultPeriod = "30d",
  tier,
  className,
}: FailurePatternsProps) {
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

  const patterns = React.useMemo(() => buildFailurePatterns(data), [data])

  const affectedServices = React.useMemo(
    () => buildAffectedServices(patterns),
    [patterns]
  )

  const recommendedActions = React.useMemo(
    () => generateRecommendedActions(patterns, data),
    [patterns, data]
  )

  const repeatFailureRate = React.useMemo(
    () => computeRepeatFailureRate(data),
    [data]
  )

  const concentrationRatio = React.useMemo(
    () => computeConcentrationRatio(patterns),
    [patterns]
  )

  const repeatPatternCount = patterns.filter((p) => p.isRepeat).length
  const totalPatterns = patterns.length
  const totalAffectedServices = affectedServices.length
  const criticalActions = recommendedActions.filter(
    (a) => a.priority === "critical"
  ).length

  const handlePeriodChange = React.useCallback((value: string) => {
    setPeriod(value as TimePeriod)
  }, [])

  const handleDrillDown = React.useCallback(() => {
    router.push(ROUTES.DASHBOARD_INCIDENTS)
  }, [router])

  const handleServiceClick = React.useCallback(
    (serviceId: string) => {
      router.push(ROUTES.SERVICE_DETAIL(serviceId))
    },
    [router]
  )

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
              Failure Patterns
            </CardTitle>
            <CardDescription>
              Failed to load failure pattern data.
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
        {showSummary && <MetricCardGridSkeleton cards={4} columns={4} />}
        <ChartSkeleton height={300} showHeader />
      </div>
    )
  }

  // Empty state — no incidents
  if (!data || data.incident_counts.total === 0) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Failure Patterns
            </CardTitle>
            <CardDescription>
              Repeated failure signal detection
            </CardDescription>
          </div>
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
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
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 mb-3">
            <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            No failure patterns detected
          </p>
          <p className="text-2xs text-muted-foreground mt-1">
            No incidents were recorded in the selected period.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Empty state — no patterns identified
  if (patterns.length === 0 && data.incident_counts.total > 0) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Failure Patterns
            </CardTitle>
            <CardDescription>
              {data.incident_counts.total} incident
              {data.incident_counts.total !== 1 ? "s" : ""} recorded — no
              patterns identified
            </CardDescription>
          </div>
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
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
          <Shield className="h-10 w-10 text-green-600 dark:text-green-400 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No repeat failure patterns detected
          </p>
          <p className="text-2xs text-muted-foreground mt-1">
            Root cause data has not been categorized for incidents in this
            period.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary Metric Cards */}
      {showSummary && (
        <MetricCardGrid columns={4}>
          {/* Total Patterns */}
          <MetricCard
            label="Failure Patterns"
            value={totalPatterns}
            format="number"
            decimals={0}
            trendUpIsGood={false}
            icon={<Repeat className="h-4 w-4" />}
            description="Total distinct failure patterns identified from root cause analysis"
            onClick={handleDrillDown}
          />

          {/* Repeat Failures */}
          <MetricCard
            label="Repeat Failures"
            value={repeatPatternCount}
            format="number"
            decimals={0}
            trendUpIsGood={false}
            threshold={0}
            thresholdExceededIsBad={true}
            icon={<XCircle className="h-4 w-4" />}
            description="Number of root cause categories that have recurred across multiple incidents"
            onClick={handleDrillDown}
          />

          {/* Repeat Failure Rate */}
          <MetricCard
            label="Repeat Failure Rate"
            value={repeatFailureRate}
            format="raw"
            decimals={1}
            unit="%"
            trendUpIsGood={false}
            threshold={30}
            thresholdExceededIsBad={true}
            icon={<AlertTriangle className="h-4 w-4" />}
            description="Percentage of incidents attributed to repeat failure patterns. High rates indicate systemic issues."
          />

          {/* Affected Services */}
          <MetricCard
            label="Affected Services"
            value={totalAffectedServices}
            format="number"
            decimals={0}
            trendUpIsGood={false}
            icon={<Server className="h-4 w-4" />}
            description="Number of distinct services impacted by identified failure patterns"
            onClick={handleDrillDown}
          />
        </MetricCardGrid>
      )}

      {/* Pattern List & Details */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Failure Pattern Analysis
            </CardTitle>
            <CardDescription>
              <span className="flex items-center gap-2">
                <span>
                  {totalPatterns} pattern{totalPatterns !== 1 ? "s" : ""}{" "}
                  detected across {totalAffectedServices} service
                  {totalAffectedServices !== 1 ? "s" : ""}
                </span>
                {repeatPatternCount > 0 && (
                  <Badge variant="destructive" className="text-2xs">
                    {repeatPatternCount} Repeat Pattern
                    {repeatPatternCount !== 1 ? "s" : ""}
                  </Badge>
                )}
                {concentrationRatio !== null && concentrationRatio > 50 && (
                  <Badge variant="warning" className="text-2xs">
                    High Concentration ({concentrationRatio.toFixed(1)}%)
                  </Badge>
                )}
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={handlePeriodChange}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
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

            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => mutate()}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  Refresh data
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

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
          {/* Repeat Failure Alert */}
          {repeatPatternCount > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-2xs text-red-700 dark:text-red-400 font-medium">
                  {repeatPatternCount} repeat failure pattern
                  {repeatPatternCount !== 1 ? "s" : ""} detected
                </p>
                <p className="text-2xs text-red-600/80 dark:text-red-400/80 mt-0.5">
                  These root causes have recurred across multiple incidents,
                  indicating systemic issues that require corrective action
                  plans.
                </p>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {patterns
                    .filter((p) => p.isRepeat)
                    .map((pattern) => (
                      <Badge
                        key={pattern.id}
                        variant="destructive"
                        className="text-2xs gap-1"
                      >
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              ROOT_CAUSE_COLORS[pattern.rootCause],
                          }}
                        />
                        {pattern.rootCause} ({pattern.occurrenceCount})
                      </Badge>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* No Repeat Failures — Healthy State */}
          {repeatPatternCount === 0 && (
            <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2">
              <Shield className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
              <span className="text-2xs text-green-700 dark:text-green-400 font-medium">
                No repeat failure patterns detected in the selected period.
              </span>
            </div>
          )}

          {/* Pattern Detail List */}
          {showPatternList && (
            <div className="space-y-2">
              <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                Pattern Breakdown
              </span>
              <div className="space-y-1.5">
                {patterns.map((pattern) => (
                  <FailurePatternRow
                    key={pattern.id}
                    pattern={pattern}
                    totalIncidents={data?.incident_counts.total || 0}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Affected Services */}
          {showAffectedServices && affectedServices.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Affected Services ({affectedServices.length})
                </span>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead className="text-right">Incidents</TableHead>
                        <TableHead>Root Causes</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {affectedServices.slice(0, 10).map((service) => (
                        <AffectedServiceRow
                          key={service.serviceId}
                          service={service}
                          onClick={() =>
                            handleServiceClick(service.serviceId)
                          }
                        />
                      ))}
                    </TableBody>
                  </Table>
                  {affectedServices.length > 10 && (
                    <div className="flex items-center justify-between border-t px-4 py-2">
                      <span className="text-2xs text-muted-foreground">
                        Showing 10 of {affectedServices.length} services
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={handleDrillDown}
                      >
                        View All
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Recommended Actions */}
          {showRecommendations && recommendedActions.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Recommended Actions ({recommendedActions.length})
                </span>
                <div className="space-y-1.5">
                  {recommendedActions.map((action, index) => (
                    <RecommendedActionItem
                      key={index}
                      index={index + 1}
                      action={action}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              <span className="text-2xs text-muted-foreground">
                {totalPatterns} pattern{totalPatterns !== 1 ? "s" : ""},{" "}
                {totalAffectedServices} service
                {totalAffectedServices !== 1 ? "s" : ""}
              </span>
              {repeatPatternCount > 0 && (
                <Badge variant="destructive" className="text-2xs">
                  {repeatPatternCount} repeat
                </Badge>
              )}
              {criticalActions > 0 && (
                <Badge variant="warning" className="text-2xs">
                  {criticalActions} critical action
                  {criticalActions !== 1 ? "s" : ""}
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
    </div>
  )
}

// ============================================================
// FailurePatternRow Component
// ============================================================

interface FailurePatternRowProps {
  pattern: FailurePattern
  totalIncidents: number
}

/**
 * Individual failure pattern row showing root cause category, occurrence count,
 * percentage bar, affected services, severity, and repeat failure indicator.
 */
function FailurePatternRow({
  pattern,
  totalIncidents,
}: FailurePatternRowProps) {
  const TrendIcon = TREND_ICON_MAP[pattern.trend] || Minus
  const color = ROOT_CAUSE_COLORS[pattern.rootCause] || "#6b7280"

  // For failure patterns, "up" is bad (increasing failures)
  const trendColor =
    pattern.trend === "up"
      ? "text-red-600 dark:text-red-400"
      : pattern.trend === "down"
        ? "text-green-600 dark:text-green-400"
        : "text-muted-foreground"

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-accent/50",
              pattern.isRepeat && "border-red-500/20 bg-red-500/5"
            )}
          >
            {/* Color indicator */}
            <div
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />

            {/* Category name */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium truncate">
                  {ROOT_CAUSE_LABELS[pattern.rootCause]}
                </span>
                {pattern.isRepeat && (
                  <Badge
                    variant="destructive"
                    className="text-2xs h-3.5 px-1 shrink-0"
                  >
                    Repeat
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-2xs text-muted-foreground">
                  {pattern.affectedServices.length} service
                  {pattern.affectedServices.length !== 1 ? "s" : ""} affected
                </span>
                <span className="text-2xs text-muted-foreground">·</span>
                <SeverityBadge severity={pattern.severity} size="sm" showIcon={false} />
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-2 min-w-[120px]">
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(pattern.percentage, 100)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>

            {/* Count */}
            <span className="text-sm font-medium shrink-0 w-8 text-right">
              {pattern.occurrenceCount}
            </span>

            {/* Percentage */}
            <span className="text-2xs text-muted-foreground shrink-0 w-14 text-right">
              {pattern.percentage.toFixed(1)}%
            </span>

            {/* Trend */}
            <div className={cn("flex items-center gap-0.5 shrink-0", trendColor)}>
              <TrendIcon className="h-3 w-3" />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4} className="max-w-xs">
          <div className="space-y-1">
            <p className="text-xs font-medium">
              {ROOT_CAUSE_LABELS[pattern.rootCause]}
            </p>
            <p className="text-2xs text-muted-foreground">
              {pattern.occurrenceCount} of {totalIncidents} incident
              {totalIncidents !== 1 ? "s" : ""} (
              {pattern.percentage.toFixed(1)}%)
            </p>
            <p className="text-2xs text-muted-foreground">
              Affected: {pattern.affectedServices.join(", ")}
            </p>
            {pattern.isRepeat && (
              <p className="text-2xs text-red-600 dark:text-red-400">
                This is a repeat failure pattern requiring corrective action.
              </p>
            )}
            <p className="text-2xs text-muted-foreground">
              Trend:{" "}
              {pattern.trend === "up"
                ? "Increasing"
                : pattern.trend === "down"
                  ? "Decreasing"
                  : "Stable"}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================
// AffectedServiceRow Component
// ============================================================

interface AffectedServiceRowProps {
  service: AffectedServiceInfo
  onClick?: () => void
}

/**
 * Table row for an affected service showing name, incident count,
 * root causes, and repeat failure status.
 */
function AffectedServiceRow({ service, onClick }: AffectedServiceRowProps) {
  return (
    <TableRow
      className={cn(onClick && "cursor-pointer")}
      onClick={onClick}
    >
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate max-w-[200px]">
            {service.serviceName}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <span className="text-sm font-medium">{service.incidentCount}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 flex-wrap">
          {service.rootCauses.map((rc) => (
            <TooltipProvider key={rc} delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: ROOT_CAUSE_COLORS[rc] || "#6b7280",
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  <p className="text-xs">{ROOT_CAUSE_LABELS[rc]}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
          <span className="text-2xs text-muted-foreground ml-1">
            {service.rootCauses.length} cause
            {service.rootCauses.length !== 1 ? "s" : ""}
          </span>
        </div>
      </TableCell>
      <TableCell>
        {service.hasRepeatFailure ? (
          <Badge variant="destructive" className="text-2xs">
            Repeat
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-2xs">
            Isolated
          </Badge>
        )}
      </TableCell>
    </TableRow>
  )
}

// ============================================================
// RecommendedActionItem Component
// ============================================================

interface RecommendedActionItemProps {
  index: number
  action: {
    priority: "critical" | "high" | "medium" | "low"
    action: string
    relatedPattern: string
  }
}

/**
 * Individual recommended action item with priority-based styling.
 */
function RecommendedActionItem({
  index,
  action,
}: RecommendedActionItemProps) {
  const borderClass =
    action.priority === "critical"
      ? "border-red-500/20"
      : action.priority === "high"
        ? "border-orange-500/20"
        : action.priority === "medium"
          ? "border-yellow-500/20"
          : "border-border"

  const bgClass =
    action.priority === "critical"
      ? "bg-red-500/5"
      : action.priority === "high"
        ? "bg-orange-500/5"
        : action.priority === "medium"
          ? "bg-yellow-500/5"
          : "bg-transparent"

  const indexBgClass =
    action.priority === "critical"
      ? "bg-red-500/10 text-red-700 dark:text-red-400"
      : action.priority === "high"
        ? "bg-orange-500/10 text-orange-700 dark:text-orange-400"
        : action.priority === "medium"
          ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
          : "bg-muted text-muted-foreground"

  const priorityLabel =
    action.priority === "critical"
      ? "Critical"
      : action.priority === "high"
        ? "High"
        : action.priority === "medium"
          ? "Medium"
          : "Low"

  const priorityBadgeVariant =
    action.priority === "critical"
      ? "destructive"
      : action.priority === "high"
        ? "warning"
        : action.priority === "medium"
          ? "warning"
          : ("secondary" as const)

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border px-3 py-2",
        borderClass,
        bgClass
      )}
    >
      <div
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-bold mt-0.5",
          indexBgClass
        )}
      >
        {index}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Badge
            variant={priorityBadgeVariant}
            className="text-2xs h-3.5 px-1"
          >
            {priorityLabel}
          </Badge>
          <span className="text-2xs text-muted-foreground">
            Related: {action.relatedPattern}
          </span>
        </div>
        <p className="text-2xs text-muted-foreground leading-relaxed">
          {action.action}
        </p>
      </div>
    </div>
  )
}

// ============================================================
// Wrapped Export with Error Boundary
// ============================================================

export interface FailurePatternsWithBoundaryProps
  extends FailurePatternsProps {}

/**
 * FailurePatterns wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function FailurePatternsWithBoundary(
  props: FailurePatternsWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Failure Patterns">
      <FailurePatterns {...props} />
    </ModuleErrorBoundary>
  )
}

export default FailurePatterns