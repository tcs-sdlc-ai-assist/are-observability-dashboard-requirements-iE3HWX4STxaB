"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"

import { cn } from "@/lib/utils"
import { formatDate, formatDuration, formatNumber } from "@/lib/utils"
import { useGoldenSignals } from "@/hooks/use-dashboard-data"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { MetricCard, MetricCardGrid } from "@/components/shared/metric-card"
import { StatusBadge } from "@/components/shared/status-badge"
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
import { ROUTES, DEFAULT_THRESHOLDS, CHART_DEFAULTS } from "@/constants/constants"
import type {
  CriticalityTier,
  DashboardFilters,
  Environment,
  GoldenSignalsDashboard,
  MetricType,
  TimePeriod,
  TrendDirection,
} from "@/types"

// ============================================================
// Types
// ============================================================

export interface LatencyChartProps {
  /** Optional service ID to scope the chart to a single service */
  serviceId?: string
  /** Optional service name for display */
  serviceName?: string
  /** Dashboard-level filters to apply */
  filters?: DashboardFilters
  /** Whether to show the summary metric cards (default: true) */
  showSummary?: boolean
  /** Whether to show the chart (default: true) */
  showChart?: boolean
  /** Default time period (default: "24h") */
  defaultPeriod?: TimePeriod
  /** Chart height in pixels (default: 300) */
  chartHeight?: number
  /** Whether to show the p50 line in addition to p95/p99 (default: false) */
  showP50?: boolean
  /** Optional criticality tier for threshold display */
  tier?: CriticalityTier
  /** Additional CSS class names */
  className?: string
}

interface LatencyChartPoint {
  timestamp: string
  label: string
  latency_p50: number | null
  latency_p95: number | null
  latency_p99: number | null
}

// ============================================================
// Constants
// ============================================================

const PERIOD_OPTIONS: Array<{ value: TimePeriod; label: string }> = [
  { value: "1h", label: "Last 1 Hour" },
  { value: "6h", label: "Last 6 Hours" },
  { value: "12h", label: "Last 12 Hours" },
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "14d", label: "Last 14 Days" },
  { value: "30d", label: "Last 30 Days" },
]

const TREND_ICON_MAP: Record<TrendDirection, React.ElementType> = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
}

const P95_COLOR = CHART_DEFAULTS.COLORS[0] // blue
const P99_COLOR = CHART_DEFAULTS.COLORS[3] // red
const P50_COLOR = CHART_DEFAULTS.COLORS[1] // green

// ============================================================
// Helpers
// ============================================================

/**
 * Extracts latency metric values from golden signals data and builds
 * time-series chart points.
 */
function buildChartData(
  signalsData: GoldenSignalsDashboard[] | undefined
): LatencyChartPoint[] {
  if (!signalsData || signalsData.length === 0) return []

  // If we have a single service with multiple timestamps, build time series
  // If we have multiple services at a single timestamp, show per-service
  // The golden signals API returns an array of results per service
  // For a single service, we simulate time-series from the signals array

  const points: LatencyChartPoint[] = []

  for (const entry of signalsData) {
    const p50Signal = entry.signals.find((s) => s.metric === "latency_p50")
    const p95Signal = entry.signals.find((s) => s.metric === "latency_p95")
    const p99Signal = entry.signals.find((s) => s.metric === "latency_p99")

    points.push({
      timestamp: entry.timestamp,
      label: formatDate(entry.timestamp, "MMM dd HH:mm"),
      latency_p50: p50Signal?.value ?? null,
      latency_p95: p95Signal?.value ?? null,
      latency_p99: p99Signal?.value ?? null,
    })
  }

  // Sort by timestamp ascending
  points.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  return points
}

/**
 * Extracts the latest latency values from the signals data.
 */
function extractLatestLatency(
  signalsData: GoldenSignalsDashboard[] | undefined
): {
  p50: number | null
  p95: number | null
  p99: number | null
} {
  if (!signalsData || signalsData.length === 0) {
    return { p50: null, p95: null, p99: null }
  }

  // Use the first entry (most relevant for single-service view)
  // or the latest timestamp entry
  const sorted = [...signalsData].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
  const latest = sorted[0]

  const p50 = latest.signals.find((s) => s.metric === "latency_p50")
  const p95 = latest.signals.find((s) => s.metric === "latency_p95")
  const p99 = latest.signals.find((s) => s.metric === "latency_p99")

  return {
    p50: p50?.value ?? null,
    p95: p95?.value ?? null,
    p99: p99?.value ?? null,
  }
}

/**
 * Determines if a latency value breaches the threshold for a given tier.
 */
function isLatencyBreached(
  value: number | null,
  tier: CriticalityTier | undefined,
  metricType: "p95" | "p99"
): boolean {
  if (value === null || !tier) return false

  const thresholds =
    metricType === "p95"
      ? DEFAULT_THRESHOLDS.latency_p95_ms
      : DEFAULT_THRESHOLDS.latency_p99_ms

  const threshold = thresholds[tier]
  return value > threshold
}

/**
 * Gets the threshold value for a given tier and metric type.
 */
function getLatencyThreshold(
  tier: CriticalityTier | undefined,
  metricType: "p95" | "p99"
): number | undefined {
  if (!tier) return undefined

  const thresholds =
    metricType === "p95"
      ? DEFAULT_THRESHOLDS.latency_p95_ms
      : DEFAULT_THRESHOLDS.latency_p99_ms

  return thresholds[tier]
}

/**
 * Computes a simple trend direction from an array of latency values.
 */
function computeLatencyTrend(values: (number | null)[]): TrendDirection {
  const filtered = values.filter((v): v is number => v !== null)
  if (filtered.length < 2) return "stable"

  const midpoint = Math.floor(filtered.length / 2)
  const olderHalf = filtered.slice(0, midpoint)
  const recentHalf = filtered.slice(midpoint)

  const olderAvg =
    olderHalf.length > 0
      ? olderHalf.reduce((sum, v) => sum + v, 0) / olderHalf.length
      : 0
  const recentAvg =
    recentHalf.length > 0
      ? recentHalf.reduce((sum, v) => sum + v, 0) / recentHalf.length
      : 0

  if (olderAvg === 0) return "stable"

  const delta = (recentAvg - olderAvg) / olderAvg

  if (delta > 0.05) return "up"
  if (delta < -0.05) return "down"
  return "stable"
}

// ============================================================
// LatencyChart Component
// ============================================================

/**
 * Latency chart component using Recharts showing p95 and p99 latency over
 * time with configurable time range. Supports domain/app/env filtering.
 * Includes summary metric cards with threshold breach indicators and
 * trend direction.
 *
 * @example
 * ```tsx
 * <LatencyChart
 *   serviceId="svc-123"
 *   serviceName="Checkout API"
 *   filters={{ domain: "payments", period: "24h" }}
 *   tier="Tier-1"
 *   showSummary
 *   showChart
 *   showP50
 * />
 * ```
 */
export function LatencyChart({
  serviceId,
  serviceName,
  filters,
  showSummary = true,
  showChart = true,
  defaultPeriod = "24h",
  chartHeight = 300,
  showP50 = false,
  tier,
  className,
}: LatencyChartProps) {
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

  const metricsToFetch: MetricType[] = showP50
    ? ["latency_p50", "latency_p95", "latency_p99"]
    : ["latency_p95", "latency_p99"]

  const { data, isLoading, error, mutate } = useGoldenSignals({
    service_id: serviceId,
    domain: filters?.domain,
    application: filters?.application,
    environment: filters?.environment,
    metrics: metricsToFetch,
    period,
  })

  const chartData = React.useMemo(() => buildChartData(data), [data])

  const latestLatency = React.useMemo(
    () => extractLatestLatency(data),
    [data]
  )

  const p95Trend = React.useMemo(
    () => computeLatencyTrend(chartData.map((p) => p.latency_p95)),
    [chartData]
  )

  const p99Trend = React.useMemo(
    () => computeLatencyTrend(chartData.map((p) => p.latency_p99)),
    [chartData]
  )

  const p95Threshold = getLatencyThreshold(tier, "p95")
  const p99Threshold = getLatencyThreshold(tier, "p99")

  const p95Breached = isLatencyBreached(latestLatency.p95, tier, "p95")
  const p99Breached = isLatencyBreached(latestLatency.p99, tier, "p99")

  const handlePeriodChange = React.useCallback((value: string) => {
    setPeriod(value as TimePeriod)
  }, [])

  const handleDrillDown = React.useCallback(() => {
    router.push(ROUTES.DASHBOARD_GOLDEN_SIGNALS)
  }, [router])

  const handleServiceClick = React.useCallback(() => {
    if (serviceId) {
      router.push(ROUTES.SERVICE_DETAIL(serviceId))
    }
  }, [router, serviceId])

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
              Latency Chart
            </CardTitle>
            <CardDescription>
              Failed to load latency data.
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
        {showSummary && <MetricCardGridSkeleton cards={3} columns={3} />}
        {showChart && (
          <ChartSkeleton height={chartHeight} showHeader showLegend />
        )}
      </div>
    )
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Latency (P95 / P99)
            </CardTitle>
            <CardDescription>
              {serviceName || serviceId || "All Services"}
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
          <Clock className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No latency data available
          </p>
          <p className="text-2xs text-muted-foreground mt-1">
            Adjust your filters or check that services are configured.
          </p>
        </CardContent>
      </Card>
    )
  }

  const hasAnyBreach = p95Breached || p99Breached

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary Metric Cards */}
      {showSummary && (
        <MetricCardGrid columns={showP50 ? 3 : 3}>
          {/* P95 Latency */}
          <MetricCard
            label="Latency P95"
            value={latestLatency.p95}
            format="raw"
            decimals={1}
            unit="ms"
            trend={p95Trend}
            trendUpIsGood={false}
            threshold={p95Threshold}
            thresholdExceededIsBad={true}
            icon={<Clock className="h-4 w-4" />}
            description={`95th percentile latency${tier ? `. Threshold: ${p95Threshold}ms (${tier})` : ""}`}
            onClick={serviceId ? handleServiceClick : handleDrillDown}
          />

          {/* P99 Latency */}
          <MetricCard
            label="Latency P99"
            value={latestLatency.p99}
            format="raw"
            decimals={1}
            unit="ms"
            trend={p99Trend}
            trendUpIsGood={false}
            threshold={p99Threshold}
            thresholdExceededIsBad={true}
            icon={<Clock className="h-4 w-4" />}
            description={`99th percentile latency${tier ? `. Threshold: ${p99Threshold}ms (${tier})` : ""}`}
            onClick={serviceId ? handleServiceClick : handleDrillDown}
          />

          {/* P50 Latency or Spread */}
          {showP50 ? (
            <MetricCard
              label="Latency P50"
              value={latestLatency.p50}
              format="raw"
              decimals={1}
              unit="ms"
              trendUpIsGood={false}
              icon={<Clock className="h-4 w-4" />}
              description="50th percentile (median) latency"
            />
          ) : (
            <MetricCard
              label="P99 / P95 Spread"
              value={
                latestLatency.p95 !== null && latestLatency.p99 !== null
                  ? Math.round(
                      (latestLatency.p99 - latestLatency.p95) * 10
                    ) / 10
                  : null
              }
              format="raw"
              decimals={1}
              unit="ms"
              trendUpIsGood={false}
              icon={
                <span className="text-muted-foreground text-xs font-medium">
                  Δ
                </span>
              }
              description="Difference between P99 and P95 latency. A large spread indicates tail latency issues."
            />
          )}
        </MetricCardGrid>
      )}

      {/* Latency Chart */}
      {showChart && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">
                Latency Over Time
              </CardTitle>
              <CardDescription>
                <span className="flex items-center gap-2">
                  <span>
                    {serviceName || serviceId || "All Services"}
                  </span>
                  {hasAnyBreach && (
                    <Badge variant="destructive" className="text-2xs">
                      Threshold Breached
                    </Badge>
                  )}
                  {!hasAnyBreach && tier && (
                    <Badge variant="success" className="text-2xs">
                      Within Threshold
                    </Badge>
                  )}
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Trend Indicators */}
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5">
                      <LatencyTrendIndicator
                        label="P95"
                        trend={p95Trend}
                        breached={p95Breached}
                      />
                      <LatencyTrendIndicator
                        label="P99"
                        trend={p99Trend}
                        breached={p99Breached}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4}>
                    <p className="text-xs">
                      Latency trend over the selected period
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

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
          <CardContent>
            {chartData.length > 0 ? (
              <div style={{ height: chartHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="latencyP95Gradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={P95_COLOR}
                          stopOpacity={0.15}
                        />
                        <stop
                          offset="95%"
                          stopColor={P95_COLOR}
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="latencyP99Gradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={P99_COLOR}
                          stopOpacity={0.15}
                        />
                        <stop
                          offset="95%"
                          stopColor={P99_COLOR}
                          stopOpacity={0}
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
                      tickFormatter={(value: number) => `${value}ms`}
                      label={{
                        value: "Latency (ms)",
                        angle: -90,
                        position: "insideLeft",
                        style: {
                          fontSize: 10,
                          fill: "hsl(var(--muted-foreground))",
                        },
                      }}
                    />
                    <RechartsTooltip
                      content={<LatencyTooltip showP50={showP50} />}
                      cursor={{ strokeDasharray: "3 3" }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="line"
                      wrapperStyle={{ fontSize: 11 }}
                    />

                    {/* P95 Threshold Reference Line */}
                    {p95Threshold !== undefined && (
                      <ReferenceLine
                        y={p95Threshold}
                        stroke={P95_COLOR}
                        strokeDasharray="6 3"
                        strokeWidth={1}
                        strokeOpacity={0.6}
                        label={{
                          value: `P95 Threshold (${p95Threshold}ms)`,
                          position: "right",
                          style: {
                            fontSize: 9,
                            fill: P95_COLOR,
                            fillOpacity: 0.7,
                          },
                        }}
                      />
                    )}

                    {/* P99 Threshold Reference Line */}
                    {p99Threshold !== undefined && (
                      <ReferenceLine
                        y={p99Threshold}
                        stroke={P99_COLOR}
                        strokeDasharray="4 4"
                        strokeWidth={1}
                        strokeOpacity={0.6}
                        label={{
                          value: `P99 Threshold (${p99Threshold}ms)`,
                          position: "right",
                          style: {
                            fontSize: 9,
                            fill: P99_COLOR,
                            fillOpacity: 0.7,
                          },
                        }}
                      />
                    )}

                    {/* P50 Line (optional) */}
                    {showP50 && (
                      <Line
                        type="monotone"
                        dataKey="latency_p50"
                        name="P50 Latency"
                        stroke={P50_COLOR}
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 3, strokeWidth: 2 }}
                        connectNulls
                      />
                    )}

                    {/* P95 Line */}
                    <Line
                      type="monotone"
                      dataKey="latency_p95"
                      name="P95 Latency"
                      stroke={P95_COLOR}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2 }}
                      connectNulls
                    />

                    {/* P99 Line */}
                    <Line
                      type="monotone"
                      dataKey="latency_p99"
                      name="P99 Latency"
                      stroke={P99_COLOR}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">
                  No latency data available for the selected period.
                </p>
              </div>
            )}

            {/* Breach Alert */}
            {hasAnyBreach && tier && (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                <p className="text-2xs text-red-700 dark:text-red-400">
                  {p95Breached && p99Breached
                    ? `Both P95 (${latestLatency.p95?.toFixed(1)}ms) and P99 (${latestLatency.p99?.toFixed(1)}ms) latency exceed ${tier} thresholds.`
                    : p95Breached
                      ? `P95 latency (${latestLatency.p95?.toFixed(1)}ms) exceeds ${tier} threshold of ${p95Threshold}ms.`
                      : `P99 latency (${latestLatency.p99?.toFixed(1)}ms) exceeds ${tier} threshold of ${p99Threshold}ms.`}
                  {" "}Investigate service performance and upstream dependencies.
                </p>
              </div>
            )}

            {/* Tail Latency Warning */}
            {!hasAnyBreach &&
              latestLatency.p95 !== null &&
              latestLatency.p99 !== null &&
              latestLatency.p99 > latestLatency.p95 * 3 && (
                <div className="mt-3 flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                  <p className="text-2xs text-yellow-700 dark:text-yellow-400">
                    P99 latency ({latestLatency.p99.toFixed(1)}ms) is more than
                    3x the P95 ({latestLatency.p95.toFixed(1)}ms), indicating
                    significant tail latency. Consider investigating outlier
                    requests.
                  </p>
                </div>
              )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================================
// LatencyTrendIndicator Component
// ============================================================

interface LatencyTrendIndicatorProps {
  label: string
  trend: TrendDirection
  breached: boolean
}

/**
 * Compact trend indicator for latency metrics.
 */
function LatencyTrendIndicator({
  label,
  trend,
  breached,
}: LatencyTrendIndicatorProps) {
  const TrendIcon = TREND_ICON_MAP[trend] || Minus

  // For latency, "up" is bad and "down" is good
  const trendColor =
    trend === "up"
      ? "text-red-600 dark:text-red-400"
      : trend === "down"
        ? "text-green-600 dark:text-green-400"
        : "text-muted-foreground"

  const borderColor = breached
    ? "border-red-500/30"
    : "border-border"

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-md border px-1.5 py-0.5",
        borderColor,
        trendColor
      )}
    >
      <span className="text-2xs font-medium">{label}</span>
      <TrendIcon className="h-3 w-3" />
    </div>
  )
}

// ============================================================
// LatencyTooltip Component
// ============================================================

interface LatencyTooltipProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number | null
    color: string
    dataKey: string
  }>
  label?: string
  showP50?: boolean
}

/**
 * Custom tooltip for the latency chart.
 */
function LatencyTooltip({
  active,
  payload,
  label,
  showP50,
}: LatencyTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md">
      <p className="text-2xs font-medium text-foreground mb-1">{label}</p>
      <div className="space-y-0.5">
        {payload.map((entry, index) => {
          if (entry.value === null || entry.value === undefined) return null

          const formattedValue = `${entry.value.toFixed(1)}ms`

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
                {formattedValue}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// Wrapped Export with Error Boundary
// ============================================================

export interface LatencyChartWithBoundaryProps extends LatencyChartProps {}

/**
 * LatencyChart wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function LatencyChartWithBoundary(
  props: LatencyChartWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Latency Chart">
      <LatencyChart {...props} />
    </ModuleErrorBoundary>
  )
}

export default LatencyChart