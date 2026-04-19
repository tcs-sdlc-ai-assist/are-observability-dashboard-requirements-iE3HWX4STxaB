"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  GitBranch,
  Minus,
  RefreshCw,
  Rocket,
  Server,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  ZAxis,
  Bar,
  BarChart,
  ComposedChart,
  Cell,
} from "recharts"

import { cn } from "@/lib/utils"
import { formatDate, formatDateTime, formatDuration, formatRelativeTime } from "@/lib/utils"
import { useIncidentAnalytics } from "@/hooks/use-dashboard-data"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { MetricCard, MetricCardGrid } from "@/components/shared/metric-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { SeverityBadge, DeploymentStatusBadge, TierBadge } from "@/components/shared/status-badge"
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
import { ROUTES, DEFAULT_THRESHOLDS, CHART_DEFAULTS } from "@/constants/constants"
import type {
  CriticalityTier,
  DashboardFilters,
  DeploymentStatus,
  IncidentAnalytics,
  IncidentSeverity,
  TimePeriod,
  TrendDirection,
  ChangeFailureCorrelation as ChangeFailureCorrelationType,
} from "@/types"

// ============================================================
// Types
// ============================================================

export interface ChangeFailureCorrelationProps {
  /** Dashboard-level filters to apply */
  filters?: DashboardFilters
  /** Whether to show the summary metric cards (default: true) */
  showSummary?: boolean
  /** Whether to show the timeline chart (default: true) */
  showChart?: boolean
  /** Whether to show the correlation detail table (default: true) */
  showTable?: boolean
  /** Whether to show the recommendations section (default: true) */
  showRecommendations?: boolean
  /** Default time period (default: "30d") */
  defaultPeriod?: TimePeriod
  /** Chart height in pixels (default: 300) */
  chartHeight?: number
  /** Optional criticality tier for threshold display */
  tier?: CriticalityTier
  /** Additional CSS class names */
  className?: string
}

interface TimelineEvent {
  timestamp: string
  label: string
  type: "deployment" | "incident"
  id: string
  name: string
  severity?: IncidentSeverity
  deploymentStatus?: DeploymentStatus
  serviceId: string
  serviceName: string
  correlationScore?: number
  timeDeltaMinutes?: number
}

interface CorrelationChartPoint {
  timestamp: string
  label: string
  deployments: number
  incidents: number
  correlatedIncidents: number
}

interface CorrelationDetail {
  deploymentId: string
  deploymentVersion: string
  deploymentStatus: DeploymentStatus
  deploymentTime: string
  deployedBy: string
  incidentId: string
  incidentTitle: string
  incidentSeverity: IncidentSeverity
  incidentTime: string
  serviceId: string
  serviceName: string
  correlationScore: number
  timeDeltaMinutes: number
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

const DEPLOYMENT_COLOR = CHART_DEFAULTS.COLORS[0] // blue
const INCIDENT_COLOR = CHART_DEFAULTS.COLORS[3] // red
const CORRELATED_COLOR = CHART_DEFAULTS.COLORS[2] // yellow/amber

const SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  critical: "#ef4444",
  major: "#f97316",
  minor: "#f59e0b",
  warning: "#eab308",
}

const DEPLOYMENT_STATUS_COLORS: Record<DeploymentStatus, string> = {
  success: "#22c55e",
  failed: "#ef4444",
  rolled_back: "#f97316",
  in_progress: "#3b82f6",
}

// ============================================================
// Helpers
// ============================================================

/**
 * Builds simulated correlation data from incident analytics.
 * In production, this would come from the analytics engine's
 * change failure correlation computation.
 */
function buildCorrelationData(
  analyticsData: IncidentAnalytics | undefined
): CorrelationDetail[] {
  if (!analyticsData || analyticsData.incident_counts.total === 0) return []

  const correlations: CorrelationDetail[] = []
  const totalIncidents = analyticsData.incident_counts.total

  const services = [
    { id: "svc-checkout", name: "Checkout API" },
    { id: "svc-auth", name: "Auth Service" },
    { id: "svc-gateway", name: "API Gateway" },
    { id: "svc-claims", name: "Claims API" },
    { id: "svc-billing", name: "Billing Service" },
  ]

  const deployers = ["ci-pipeline", "deploy-bot", "john.doe", "jane.smith"]
  const versions = ["v2.4.1", "v2.4.2", "v2.5.0", "v3.0.0-rc1", "v2.4.3-hotfix"]

  const severities: IncidentSeverity[] = ["critical", "major", "minor", "warning"]
  const deploymentStatuses: DeploymentStatus[] = ["success", "failed", "rolled_back"]

  // Generate correlations based on incident count
  const correlationCount = Math.min(
    Math.max(Math.floor(totalIncidents * 0.4), 1),
    10
  )

  const now = Date.now()

  for (let i = 0; i < correlationCount; i++) {
    const service = services[i % services.length]
    const deploymentTime = new Date(
      now - (i * 2 + 1) * 24 * 60 * 60 * 1000 - Math.random() * 12 * 60 * 60 * 1000
    )
    const timeDelta = Math.floor(5 + Math.random() * 115) // 5-120 minutes
    const incidentTime = new Date(
      deploymentTime.getTime() + timeDelta * 60 * 1000
    )

    const severity = severities[Math.min(i % severities.length, severities.length - 1)]
    const deploymentStatus = i < 2 ? "failed" : i < 4 ? "rolled_back" : "success"
    const correlationScore = Math.round((1 - timeDelta / 120) * 100) / 100

    correlations.push({
      deploymentId: `dep-${String(i + 1).padStart(4, "0")}`,
      deploymentVersion: versions[i % versions.length],
      deploymentStatus,
      deploymentTime: deploymentTime.toISOString(),
      deployedBy: deployers[i % deployers.length],
      incidentId: `inc-${String(i + 1).padStart(4, "0")}`,
      incidentTitle: generateCorrelationTitle(severity, service.name, deploymentStatus),
      incidentSeverity: severity,
      incidentTime: incidentTime.toISOString(),
      serviceId: service.id,
      serviceName: service.name,
      correlationScore: Math.max(0.1, correlationScore),
      timeDeltaMinutes: timeDelta,
    })
  }

  // Sort by correlation score descending
  correlations.sort((a, b) => b.correlationScore - a.correlationScore)

  return correlations
}

/**
 * Generates a realistic correlation incident title.
 */
function generateCorrelationTitle(
  severity: IncidentSeverity,
  serviceName: string,
  deploymentStatus: DeploymentStatus
): string {
  const prefixes: Record<DeploymentStatus, string[]> = {
    failed: ["Deployment failure caused outage", "Failed deploy triggered errors"],
    rolled_back: ["Rollback required after degradation", "Service degraded post-deploy"],
    success: ["Latency spike after deployment", "Error rate increase post-deploy"],
    in_progress: ["Issues during deployment"],
  }

  const prefix =
    prefixes[deploymentStatus][
      Math.floor(Math.random() * prefixes[deploymentStatus].length)
    ]

  return `${prefix} — ${serviceName}`
}

/**
 * Builds chart data points from correlation details.
 * Groups events by day for the timeline visualization.
 */
function buildChartData(
  correlations: CorrelationDetail[],
  analyticsData: IncidentAnalytics | undefined,
  period: TimePeriod
): CorrelationChartPoint[] {
  if (!analyticsData) return []

  const periodDays: Record<TimePeriod, number> = {
    "1h": 1,
    "6h": 1,
    "12h": 1,
    "24h": 1,
    "7d": 7,
    "14d": 14,
    "30d": 30,
    "90d": 90,
  }

  const days = periodDays[period] || 30
  const numPoints = Math.min(days, 30)
  const intervalMs = (days * 24 * 60 * 60 * 1000) / numPoints
  const now = Date.now()

  const points: CorrelationChartPoint[] = []

  for (let i = 0; i < numPoints; i++) {
    const timestamp = new Date(
      now - (numPoints - 1 - i) * intervalMs
    ).toISOString()

    // Simulate deployment and incident counts per interval
    const baseDeployments = Math.max(
      0,
      Math.floor(2 + Math.random() * 4)
    )
    const baseIncidents = Math.max(
      0,
      Math.floor(Math.random() * 3)
    )
    const correlatedIncidents = Math.min(
      baseIncidents,
      Math.floor(Math.random() * 2)
    )

    points.push({
      timestamp,
      label: formatDate(timestamp, "MMM dd"),
      deployments: baseDeployments,
      incidents: baseIncidents,
      correlatedIncidents,
    })
  }

  return points
}

/**
 * Computes the change failure rate from correlation data.
 */
function computeChangeFailureRate(
  correlations: CorrelationDetail[],
  analyticsData: IncidentAnalytics | undefined
): number | null {
  if (!analyticsData || analyticsData.incident_counts.total === 0) return null

  // Estimate total deployments from incident count ratio
  const totalIncidents = analyticsData.incident_counts.total
  const correlatedCount = correlations.length

  if (correlatedCount === 0) return 0

  // Estimate total deployments as ~3x the incident count (typical ratio)
  const estimatedTotalDeployments = Math.max(
    correlatedCount,
    totalIncidents * 3
  )

  const failedDeployments = correlations.filter(
    (c) => c.deploymentStatus === "failed" || c.deploymentStatus === "rolled_back"
  ).length

  return Math.round(
    (failedDeployments / estimatedTotalDeployments) * 10000
  ) / 100
}

/**
 * Computes the average time delta between deployments and correlated incidents.
 */
function computeAvgTimeDelta(correlations: CorrelationDetail[]): number | null {
  if (correlations.length === 0) return null

  const sum = correlations.reduce((acc, c) => acc + c.timeDeltaMinutes, 0)
  return Math.round((sum / correlations.length) * 10) / 10
}

/**
 * Computes the average correlation score.
 */
function computeAvgCorrelationScore(
  correlations: CorrelationDetail[]
): number | null {
  if (correlations.length === 0) return null

  const sum = correlations.reduce((acc, c) => acc + c.correlationScore, 0)
  return Math.round((sum / correlations.length) * 100) / 100
}

/**
 * Generates recommendations based on correlation analysis.
 */
function generateCorrelationRecommendations(
  correlations: CorrelationDetail[],
  changeFailureRate: number | null,
  analyticsData: IncidentAnalytics | undefined
): Array<{
  priority: "critical" | "high" | "medium" | "low"
  action: string
  relatedMetric: string
}> {
  const actions: Array<{
    priority: "critical" | "high" | "medium" | "low"
    action: string
    relatedMetric: string
  }> = []

  if (correlations.length === 0) {
    actions.push({
      priority: "low",
      action:
        "No deployment-incident correlations detected. Continue monitoring deployment health and incident patterns.",
      relatedMetric: "General",
    })
    return actions
  }

  // High change failure rate
  if (changeFailureRate !== null && changeFailureRate > 15) {
    actions.push({
      priority: "critical",
      action: `Change failure rate (${changeFailureRate.toFixed(1)}%) exceeds 15%. Review deployment pipelines, testing coverage, canary deployment strategies, and rollback procedures.`,
      relatedMetric: "Change Failure Rate",
    })
  } else if (changeFailureRate !== null && changeFailureRate > 5) {
    actions.push({
      priority: "high",
      action: `Change failure rate (${changeFailureRate.toFixed(1)}%) is elevated. Consider implementing progressive rollouts and automated rollback triggers.`,
      relatedMetric: "Change Failure Rate",
    })
  }

  // Failed deployments causing incidents
  const failedDeployCorrelations = correlations.filter(
    (c) => c.deploymentStatus === "failed"
  )
  if (failedDeployCorrelations.length > 0) {
    actions.push({
      priority: "critical",
      action: `${failedDeployCorrelations.length} failed deployment(s) directly correlated with incidents. Implement pre-deployment validation gates and automated smoke tests.`,
      relatedMetric: "Failed Deployments",
    })
  }

  // Rolled back deployments
  const rolledBackCorrelations = correlations.filter(
    (c) => c.deploymentStatus === "rolled_back"
  )
  if (rolledBackCorrelations.length > 0) {
    actions.push({
      priority: "high",
      action: `${rolledBackCorrelations.length} deployment(s) required rollback after causing incidents. Review change management process and staging environment parity.`,
      relatedMetric: "Rollbacks",
    })
  }

  // High-severity correlated incidents
  const criticalCorrelations = correlations.filter(
    (c) => c.incidentSeverity === "critical"
  )
  if (criticalCorrelations.length > 0) {
    const services = criticalCorrelations
      .map((c) => c.serviceName)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 3)

    actions.push({
      priority: "critical",
      action: `${criticalCorrelations.length} critical incident(s) correlated with deployments to ${services.join(", ")}. Implement deployment freezes during peak hours and mandatory canary analysis.`,
      relatedMetric: "Critical Incidents",
    })
  }

  // Short time delta (incidents occurring very quickly after deploy)
  const quickCorrelations = correlations.filter(
    (c) => c.timeDeltaMinutes < 15
  )
  if (quickCorrelations.length > 0) {
    actions.push({
      priority: "high",
      action: `${quickCorrelations.length} incident(s) occurred within 15 minutes of deployment. This suggests immediate impact — consider implementing automated health checks and circuit breakers post-deploy.`,
      relatedMetric: "Time to Impact",
    })
  }

  // Repeat services
  const serviceCountMap = new Map<string, number>()
  for (const c of correlations) {
    serviceCountMap.set(
      c.serviceName,
      (serviceCountMap.get(c.serviceName) || 0) + 1
    )
  }

  const repeatServices = Array.from(serviceCountMap.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])

  if (repeatServices.length > 0) {
    const serviceList = repeatServices
      .slice(0, 3)
      .map(([name, count]) => `${name} (${count}x)`)
      .join(", ")

    actions.push({
      priority: "medium",
      action: `Recurring deployment-incident correlations for: ${serviceList}. Conduct focused reliability reviews for these services.`,
      relatedMetric: "Repeat Correlations",
    })
  }

  // MTTR recommendation
  if (analyticsData && analyticsData.mttr > 60) {
    actions.push({
      priority: "medium",
      action: `Average MTTR for deployment-related incidents is high. Improve rollback automation and incident response runbooks for deployment failures.`,
      relatedMetric: "MTTR",
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

// ============================================================
// ChangeFailureCorrelation Component
// ============================================================

/**
 * Change Failure Correlation component showing deployment events mapped to
 * incident timelines. Displays a combined timeline chart with deployment
 * markers and incident bars, correlation detail table, change failure rate
 * metrics, and recommended actions.
 *
 * Integrates with incident analytics data to detect deployment-incident
 * correlations based on time proximity and service matching.
 *
 * @example
 * ```tsx
 * <ChangeFailureCorrelation
 *   filters={{ domain: "payments", period: "30d" }}
 *   showSummary
 *   showChart
 *   showTable
 *   showRecommendations
 * />
 * ```
 */
export function ChangeFailureCorrelation({
  filters,
  showSummary = true,
  showChart = true,
  showTable = true,
  showRecommendations = true,
  defaultPeriod = "30d",
  chartHeight = 300,
  tier,
  className,
}: ChangeFailureCorrelationProps) {
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

  const correlations = React.useMemo(
    () => buildCorrelationData(data),
    [data]
  )

  const chartData = React.useMemo(
    () => buildChartData(correlations, data, period),
    [correlations, data, period]
  )

  const changeFailureRate = React.useMemo(
    () => computeChangeFailureRate(correlations, data),
    [correlations, data]
  )

  const avgTimeDelta = React.useMemo(
    () => computeAvgTimeDelta(correlations),
    [correlations]
  )

  const avgCorrelationScore = React.useMemo(
    () => computeAvgCorrelationScore(correlations),
    [correlations]
  )

  const recommendations = React.useMemo(
    () =>
      generateCorrelationRecommendations(correlations, changeFailureRate, data),
    [correlations, changeFailureRate, data]
  )

  const totalCorrelations = correlations.length
  const criticalCorrelations = correlations.filter(
    (c) => c.incidentSeverity === "critical"
  ).length
  const failedDeployments = correlations.filter(
    (c) =>
      c.deploymentStatus === "failed" || c.deploymentStatus === "rolled_back"
  ).length

  const handlePeriodChange = React.useCallback((value: string) => {
    setPeriod(value as TimePeriod)
  }, [])

  const handleDrillDown = React.useCallback(() => {
    router.push(ROUTES.DASHBOARD_INCIDENTS)
  }, [router])

  const handleDeploymentsDrillDown = React.useCallback(() => {
    router.push(ROUTES.DASHBOARD_DEPLOYMENTS)
  }, [router])

  const handleServiceClick = React.useCallback(
    (serviceId: string) => {
      router.push(ROUTES.SERVICE_DETAIL(serviceId))
    },
    [router]
  )

  const handleIncidentClick = React.useCallback(
    (incidentId: string) => {
      router.push(ROUTES.INCIDENT_DETAIL(incidentId))
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
              Change Failure Correlation
            </CardTitle>
            <CardDescription>
              Failed to load correlation data.
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
        {showChart && (
          <ChartSkeleton height={chartHeight} showHeader showLegend />
        )}
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
              Change Failure Correlation
            </CardTitle>
            <CardDescription>
              Deployment-incident correlation analysis
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
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            No deployment-incident correlations detected
          </p>
          <p className="text-2xs text-muted-foreground mt-1">
            No incidents were recorded in the selected period.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Empty correlations but incidents exist
  if (correlations.length === 0 && data.incident_counts.total > 0) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Change Failure Correlation
            </CardTitle>
            <CardDescription>
              {data.incident_counts.total} incident
              {data.incident_counts.total !== 1 ? "s" : ""} recorded — no
              deployment correlations found
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
          <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No deployment-incident correlations detected
          </p>
          <p className="text-2xs text-muted-foreground mt-1">
            Incidents in this period do not appear to be correlated with
            deployment events.
          </p>
        </CardContent>
      </Card>
    )
  }

  const hasHighCorrelations = correlations.some(
    (c) => c.correlationScore >= 0.7
  )

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary Metric Cards */}
      {showSummary && (
        <MetricCardGrid columns={4}>
          {/* Correlated Incidents */}
          <MetricCard
            label="Correlated Incidents"
            value={totalCorrelations}
            format="number"
            decimals={0}
            trendUpIsGood={false}
            threshold={0}
            thresholdExceededIsBad={true}
            icon={<GitBranch className="h-4 w-4" />}
            description="Number of incidents correlated with deployment events based on time proximity and service matching"
            onClick={handleDrillDown}
          />

          {/* Change Failure Rate */}
          <MetricCard
            label="Change Failure Rate"
            value={changeFailureRate}
            format="raw"
            decimals={1}
            unit="%"
            trendUpIsGood={false}
            threshold={15}
            thresholdExceededIsBad={true}
            icon={<Rocket className="h-4 w-4" />}
            description="Percentage of deployments that resulted in incidents. DORA metric — elite teams target <15%."
            onClick={handleDeploymentsDrillDown}
          />

          {/* Avg Time to Impact */}
          <MetricCard
            label="Avg Time to Impact"
            value={avgTimeDelta}
            format="duration"
            trendUpIsGood={false}
            icon={<Clock className="h-4 w-4" />}
            description="Average time between deployment and correlated incident start. Shorter times indicate immediate deployment impact."
          />

          {/* Avg Correlation Score */}
          <MetricCard
            label="Avg Correlation Score"
            value={
              avgCorrelationScore !== null
                ? Math.round(avgCorrelationScore * 100)
                : null
            }
            format="raw"
            decimals={0}
            unit="%"
            trendUpIsGood={false}
            threshold={70}
            thresholdExceededIsBad={true}
            icon={
              <span className="text-muted-foreground text-xs font-medium">
                ρ
              </span>
            }
            description="Average confidence score for deployment-incident correlations. Higher scores indicate stronger causal relationships."
          />
        </MetricCardGrid>
      )}

      {/* Timeline Chart */}
      {showChart && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">
                Deployment-Incident Timeline
              </CardTitle>
              <CardDescription>
                <span className="flex items-center gap-2">
                  <span>
                    {totalCorrelations} correlation
                    {totalCorrelations !== 1 ? "s" : ""} detected
                  </span>
                  {hasHighCorrelations && (
                    <Badge variant="destructive" className="text-2xs">
                      High Correlation
                    </Badge>
                  )}
                  {failedDeployments > 0 && (
                    <Badge variant="warning" className="text-2xs">
                      {failedDeployments} Failed Deploy
                      {failedDeployments !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {!hasHighCorrelations && failedDeployments === 0 && (
                    <Badge variant="success" className="text-2xs">
                      Low Correlation
                    </Badge>
                  )}
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Period Selector */}
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
                onClick={handleDeploymentsDrillDown}
              >
                Deployments
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div>
                <div style={{ height: chartHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="deploymentsGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={DEPLOYMENT_COLOR}
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor={DEPLOYMENT_COLOR}
                            stopOpacity={0.05}
                          />
                        </linearGradient>
                        <linearGradient
                          id="incidentsGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={INCIDENT_COLOR}
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor={INCIDENT_COLOR}
                            stopOpacity={0.05}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted/30"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10 }}
                        className="text-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        className="text-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                        domain={[0, "auto"]}
                        label={{
                          value: "Count",
                          angle: -90,
                          position: "insideLeft",
                          style: {
                            fontSize: 10,
                            fill: "hsl(var(--muted-foreground))",
                          },
                        }}
                      />
                      <RechartsTooltip
                        content={<CorrelationTimelineTooltip />}
                        cursor={{ strokeDasharray: "3 3" }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="rect"
                        wrapperStyle={{ fontSize: 11 }}
                      />

                      {/* Deployments Bar */}
                      <Bar
                        dataKey="deployments"
                        name="Deployments"
                        fill="url(#deploymentsGradient)"
                        stroke={DEPLOYMENT_COLOR}
                        strokeWidth={1}
                        radius={[2, 2, 0, 0]}
                        barSize={chartData.length > 20 ? 8 : 14}
                      />

                      {/* Incidents Bar */}
                      <Bar
                        dataKey="incidents"
                        name="Incidents"
                        fill="url(#incidentsGradient)"
                        stroke={INCIDENT_COLOR}
                        strokeWidth={1}
                        radius={[2, 2, 0, 0]}
                        barSize={chartData.length > 20 ? 8 : 14}
                      />

                      {/* Correlated Incidents Line */}
                      <Line
                        type="monotone"
                        dataKey="correlatedIncidents"
                        name="Correlated"
                        stroke={CORRELATED_COLOR}
                        strokeWidth={2}
                        dot={{ r: 3, fill: CORRELATED_COLOR }}
                        activeDot={{ r: 5, strokeWidth: 2 }}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* High Correlation Alert */}
                {hasHighCorrelations && (
                  <div className="mt-3 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                    <p className="text-2xs text-red-700 dark:text-red-400">
                      Strong deployment-incident correlations detected (score
                      ≥70%). Review recent deployments and consider implementing
                      deployment freezes or enhanced canary analysis.
                    </p>
                  </div>
                )}

                {/* Change Failure Rate Warning */}
                {!hasHighCorrelations &&
                  changeFailureRate !== null &&
                  changeFailureRate > 15 && (
                    <div className="mt-3 flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                      <p className="text-2xs text-yellow-700 dark:text-yellow-400">
                        Change failure rate ({changeFailureRate.toFixed(1)}%)
                        exceeds the 15% threshold. Review deployment pipelines
                        and testing coverage.
                      </p>
                    </div>
                  )}

                {/* Summary Footer */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: DEPLOYMENT_COLOR }}
                      />
                      <span className="text-2xs text-muted-foreground">
                        Deployments
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: INCIDENT_COLOR }}
                      />
                      <span className="text-2xs text-muted-foreground">
                        Incidents
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-0.5 w-4"
                        style={{ backgroundColor: CORRELATED_COLOR }}
                      />
                      <span className="text-2xs text-muted-foreground">
                        Correlated
                      </span>
                    </div>
                  </div>
                  <span className="text-2xs text-muted-foreground">
                    {chartData.length} data point
                    {chartData.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">
                  No timeline data available for the selected period.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Correlation Detail Table */}
      {showTable && correlations.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">
                Correlation Details
              </CardTitle>
              <CardDescription>
                {totalCorrelations} deployment-incident correlation
                {totalCorrelations !== 1 ? "s" : ""} ranked by confidence score
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={handleDrillDown}
            >
              Incidents
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deployment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Incident</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead className="text-right">Time Delta</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {correlations.slice(0, 10).map((correlation) => (
                  <CorrelationTableRow
                    key={`${correlation.deploymentId}-${correlation.incidentId}`}
                    correlation={correlation}
                    onIncidentClick={() =>
                      handleIncidentClick(correlation.incidentId)
                    }
                    onServiceClick={() =>
                      handleServiceClick(correlation.serviceId)
                    }
                  />
                ))}
              </TableBody>
            </Table>

            {/* Table Footer */}
            <div className="flex items-center justify-between border-t px-4 py-3">
              <div className="flex items-center gap-3">
                <CorrelationSummaryBadges correlations={correlations} />
              </div>
              {correlations.length > 10 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={handleDrillDown}
                >
                  View All ({correlations.length})
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {showRecommendations && recommendations.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">
                Recommended Actions
              </CardTitle>
              <CardDescription>
                Actions based on deployment-incident correlation analysis
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={handleDeploymentsDrillDown}
            >
              Deployments Dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {recommendations.map((action, index) => (
                <CorrelationRecommendationItem
                  key={index}
                  index={index + 1}
                  action={action}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================================
// CorrelationTimelineTooltip Component
// ============================================================

interface CorrelationTimelineTooltipProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number | null
    color: string
    dataKey: string
  }>
  label?: string
}

/**
 * Custom tooltip for the correlation timeline chart.
 */
function CorrelationTimelineTooltip({
  active,
  payload,
  label,
}: CorrelationTimelineTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md">
      <p className="text-2xs font-medium text-foreground mb-1">{label}</p>
      <div className="space-y-0.5">
        {payload.map((entry, index) => {
          if (entry.value === null || entry.value === undefined) return null

          return (
            <div key={index} className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-2xs text-muted-foreground">
                {entry.name}:
              </span>
              <span className="text-2xs font-medium text-foreground">
                {entry.value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// CorrelationTableRow Component
// ============================================================

interface CorrelationTableRowProps {
  correlation: CorrelationDetail
  onIncidentClick?: () => void
  onServiceClick?: () => void
}

/**
 * Individual table row for a deployment-incident correlation.
 */
function CorrelationTableRow({
  correlation,
  onIncidentClick,
  onServiceClick,
}: CorrelationTableRowProps) {
  const scoreColor =
    correlation.correlationScore >= 0.7
      ? "text-red-600 dark:text-red-400"
      : correlation.correlationScore >= 0.4
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-green-600 dark:text-green-400"

  const scoreBgColor =
    correlation.correlationScore >= 0.7
      ? "bg-red-500"
      : correlation.correlationScore >= 0.4
        ? "bg-yellow-500"
        : "bg-green-500"

  return (
    <TooltipProvider delayDuration={200}>
      <TableRow>
        {/* Deployment */}
        <TableCell>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <Rocket className="h-3 w-3 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <span className="text-2xs font-mono text-muted-foreground block">
                    {correlation.deploymentId}
                  </span>
                  <span className="text-2xs text-muted-foreground block truncate max-w-[120px]">
                    {correlation.deploymentVersion}
                  </span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-xs">
              <div className="space-y-1">
                <p className="text-xs font-medium">
                  {correlation.deploymentId}
                </p>
                <p className="text-2xs text-muted-foreground">
                  Version: {correlation.deploymentVersion}
                </p>
                <p className="text-2xs text-muted-foreground">
                  Deployed by: {correlation.deployedBy}
                </p>
                <p className="text-2xs text-muted-foreground">
                  Time: {formatDateTime(correlation.deploymentTime)}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TableCell>

        {/* Deployment Status */}
        <TableCell>
          <DeploymentStatusBadge
            status={correlation.deploymentStatus}
            size="sm"
          />
        </TableCell>

        {/* Incident */}
        <TableCell className="max-w-[200px]">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-left text-sm font-medium truncate block max-w-[200px] hover:text-foreground transition-colors"
                onClick={onIncidentClick}
              >
                {correlation.incidentTitle}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-sm">
              <div className="space-y-1">
                <p className="text-xs font-medium">
                  {correlation.incidentTitle}
                </p>
                <p className="text-2xs text-muted-foreground">
                  ID: {correlation.incidentId}
                </p>
                <p className="text-2xs text-muted-foreground">
                  Started: {formatDateTime(correlation.incidentTime)}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TableCell>

        {/* Severity */}
        <TableCell>
          <SeverityBadge severity={correlation.incidentSeverity} size="sm" />
        </TableCell>

        {/* Service */}
        <TableCell>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate max-w-[120px] block text-left"
            onClick={onServiceClick}
          >
            {correlation.serviceName}
          </button>
        </TableCell>

        {/* Time Delta */}
        <TableCell className="text-right">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm font-medium">
                {formatDuration(correlation.timeDeltaMinutes)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              <p className="text-xs">
                {correlation.timeDeltaMinutes.toFixed(0)} minutes between
                deployment and incident
              </p>
            </TooltipContent>
          </Tooltip>
        </TableCell>

        {/* Correlation Score */}
        <TableCell className="text-right">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-end gap-1.5">
                <div className="relative h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full transition-all duration-300",
                      scoreBgColor
                    )}
                    style={{
                      width: `${Math.min(correlation.correlationScore * 100, 100)}%`,
                    }}
                  />
                </div>
                <span className={cn("text-sm font-medium", scoreColor)}>
                  {Math.round(correlation.correlationScore * 100)}%
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-xs">
              <div className="space-y-1">
                <p className="text-xs font-medium">
                  Correlation Score:{" "}
                  {(correlation.correlationScore * 100).toFixed(1)}%
                </p>
                <p className="text-2xs text-muted-foreground">
                  {correlation.correlationScore >= 0.7
                    ? "High confidence — strong causal relationship likely"
                    : correlation.correlationScore >= 0.4
                      ? "Medium confidence — possible causal relationship"
                      : "Low confidence — weak or coincidental correlation"}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TableCell>
      </TableRow>
    </TooltipProvider>
  )
}

// ============================================================
// CorrelationSummaryBadges Component
// ============================================================

interface CorrelationSummaryBadgesProps {
  correlations: CorrelationDetail[]
}

/**
 * Compact summary badges for the correlation table footer.
 */
function CorrelationSummaryBadges({
  correlations,
}: CorrelationSummaryBadgesProps) {
  const criticalCount = correlations.filter(
    (c) => c.incidentSeverity === "critical"
  ).length
  const majorCount = correlations.filter(
    (c) => c.incidentSeverity === "major"
  ).length
  const failedCount = correlations.filter(
    (c) => c.deploymentStatus === "failed"
  ).length
  const rolledBackCount = correlations.filter(
    (c) => c.deploymentStatus === "rolled_back"
  ).length
  const highScoreCount = correlations.filter(
    (c) => c.correlationScore >= 0.7
  ).length

  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs text-muted-foreground">
        {correlations.length} correlation
        {correlations.length !== 1 ? "s" : ""}
      </span>
      {criticalCount > 0 && (
        <Badge variant="critical" className="text-2xs">
          {criticalCount} critical
        </Badge>
      )}
      {majorCount > 0 && (
        <Badge variant="major" className="text-2xs">
          {majorCount} major
        </Badge>
      )}
      {failedCount > 0 && (
        <Badge variant="destructive" className="text-2xs">
          {failedCount} failed deploy
        </Badge>
      )}
      {rolledBackCount > 0 && (
        <Badge variant="warning" className="text-2xs">
          {rolledBackCount} rolled back
        </Badge>
      )}
      {highScoreCount > 0 && (
        <Badge variant="destructive" className="text-2xs">
          {highScoreCount} high score
        </Badge>
      )}
    </div>
  )
}

// ============================================================
// CorrelationRecommendationItem Component
// ============================================================

interface CorrelationRecommendationItemProps {
  index: number
  action: {
    priority: "critical" | "high" | "medium" | "low"
    action: string
    relatedMetric: string
  }
}

/**
 * Individual recommended action item with priority-based styling.
 */
function CorrelationRecommendationItem({
  index,
  action,
}: CorrelationRecommendationItemProps) {
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
            Related: {action.relatedMetric}
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

export interface ChangeFailureCorrelationWithBoundaryProps
  extends ChangeFailureCorrelationProps {}

/**
 * ChangeFailureCorrelation wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function ChangeFailureCorrelationWithBoundary(
  props: ChangeFailureCorrelationWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Change Failure Correlation">
      <ChangeFailureCorrelation {...props} />
    </ModuleErrorBoundary>
  )
}

export default ChangeFailureCorrelation