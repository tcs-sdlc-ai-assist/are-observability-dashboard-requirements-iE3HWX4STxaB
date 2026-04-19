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
  Zap,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"

import { cn } from "@/lib/utils"
import { formatDate, formatCompactNumber, formatNumber } from "@/lib/utils"
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
import { ROUTES, CHART_DEFAULTS } from "@/constants/constants"
import type {
  CriticalityTier,
  DashboardFilters,
  GoldenSignalsDashboard,
  MetricType,
  TimePeriod,
  TrendDirection,
} from "@/types"

// ============================================================
// Types
// ============================================================

export interface TrafficChartProps {
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
  /** Optional criticality tier for threshold display */
  tier?: CriticalityTier
  /** Additional CSS class names */
  className?: string
}

interface TrafficChartPoint {
  timestamp: string
  label: string
  traffic_rps: number | null
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

const TRAFFIC_COLOR = CHART_DEFAULTS.COLORS[1] // green

// ============================================================
// Helpers
// ============================================================

/**
 * Extracts traffic metric values from golden signals data and builds
 * time-series chart points.
 */
function buildChartData(
  signalsData: GoldenSignalsDashboard[] | undefined
): TrafficChartPoint[] {
  if (!signalsData || signalsData.length === 0) return []

  const points: TrafficChartPoint[] = []

  for (const entry of signalsData) {
    const trafficSignal = entry.signals.find((s) => s.metric === "traffic_rps")

    points.push({
      timestamp: entry.timestamp,
      label: formatDate(entry.timestamp, "MMM dd HH:mm"),
      traffic_rps: trafficSignal?.value ?? null,
    })
  }

  // Sort by timestamp ascending
  points.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  return points
}

/**
 * Extracts the latest traffic values from the signals data.
 */
function extractLatestTraffic(
  signalsData: GoldenSignalsDashboard[] | undefined
): {
  rps: number | null
  peak: number | null
  min: number | null
  avg: number | null
} {
  if (!signalsData || signalsData.length === 0) {
    return { rps: null, peak: null, min: null, avg: null }
  }

  // Get the latest entry
  const sorted = [...signalsData].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
  const latest = sorted[0]
  const trafficSignal = latest.signals.find((s) => s.metric === "traffic_rps")
  const currentRps = trafficSignal?.value ?? null

  // Compute peak, min, avg across all entries
  const allValues = signalsData
    .map((entry) => {
      const signal = entry.signals.find((s) => s.metric === "traffic_rps")
      return signal?.value ?? null
    })
    .filter((v): v is number => v !== null)

  const peak = allValues.length > 0 ? Math.max(...allValues) : null
  const min = allValues.length > 0 ? Math.min(...allValues) : null
  const avg =
    allValues.length > 0
      ? Math.round(
          (allValues.reduce((sum, v) => sum + v, 0) / allValues.length) * 100
        ) / 100
      : null

  return {
    rps: currentRps,
    peak,
    min,
    avg,
  }
}

/**
 * Computes a simple trend direction from an array of traffic values.
 */
function computeTrafficTrend(values: (number | null)[]): TrendDirection {
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

/**
 * Computes the percentage change between peak and current traffic.
 */
function computeTrafficVariance(
  current: number | null,
  avg: number | null
): number | null {
  if (current === null || avg === null || avg === 0) return null
  return Math.round(((current - avg) / avg) * 10000) / 100
}

// ============================================================
// TrafficChart Component
// ============================================================

/**
 * Traffic chart component using Recharts showing RPS and throughput over
 * time with configurable time range. Area chart with gradient fill and
 * tooltip details. Supports domain/app/env filtering. Includes summary
 * metric cards with current RPS, peak, average, and trend direction.
 *
 * @example
 * ```tsx
 * <TrafficChart
 *   serviceId="svc-123"
 *   serviceName="Checkout API"
 *   filters={{ domain: "payments", period: "24h" }}
 *   tier="Tier-1"
 *   showSummary
 *   showChart
 * />
 * ```
 */
export function TrafficChart({
  serviceId,
  serviceName,
  filters,
  showSummary = true,
  showChart = true,
  defaultPeriod = "24h",
  chartHeight = 300,
  tier,
  className,
}: TrafficChartProps) {
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

  const metricsToFetch: MetricType[] = ["traffic_rps"]

  const { data, isLoading, error, mutate } = useGoldenSignals({
    service_id: serviceId,
    domain: filters?.domain,
    application: filters?.application,
    environment: filters?.environment,
    metrics: metricsToFetch,
    period,
  })

  const chartData = React.useMemo(() => buildChartData(data), [data])

  const latestTraffic = React.useMemo(
    () => extractLatestTraffic(data),
    [data]
  )

  const trafficTrend = React.useMemo(
    () => computeTrafficTrend(chartData.map((p) => p.traffic_rps)),
    [chartData]
  )

  const trafficVariance = React.useMemo(
    () => computeTrafficVariance(latestTraffic.rps, latestTraffic.avg),
    [latestTraffic.rps, latestTraffic.avg]
  )

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
              Traffic Chart
            </CardTitle>
            <CardDescription>
              Failed to load traffic data.
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

  // Empty state
  if (!data || data.length === 0) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Traffic (RPS)
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
          <Zap className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No traffic data available
          </p>
          <p className="text-2xs text-muted-foreground mt-1">
            Adjust your filters or check that services are configured.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Determine if there's a significant traffic spike or drop
  const hasTrafficAnomaly =
    trafficVariance !== null && Math.abs(trafficVariance) > 50

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary Metric Cards */}
      {showSummary && (
        <MetricCardGrid columns={4}>
          {/* Current RPS */}
          <MetricCard
            label="Current RPS"
            value={latestTraffic.rps}
            format="compact"
            unit="rps"
            trend={trafficTrend}
            trendUpIsGood={true}
            icon={<Zap className="h-4 w-4" />}
            description="Current requests per second"
            onClick={serviceId ? handleServiceClick : handleDrillDown}
          />

          {/* Peak RPS */}
          <MetricCard
            label="Peak RPS"
            value={latestTraffic.peak}
            format="compact"
            unit="rps"
            icon={
              <span className="text-muted-foreground text-xs font-medium">
                ↑
              </span>
            }
            description="Peak requests per second during the selected period"
          />

          {/* Average RPS */}
          <MetricCard
            label="Average RPS"
            value={latestTraffic.avg}
            format="compact"
            unit="rps"
            icon={
              <span className="text-muted-foreground text-xs font-medium">
                μ
              </span>
            }
            description="Average requests per second during the selected period"
          />

          {/* Traffic Variance */}
          <MetricCard
            label="Variance from Avg"
            value={trafficVariance}
            format="raw"
            decimals={1}
            unit="%"
            trendUpIsGood={true}
            changePercent={trafficVariance}
            icon={
              <span className="text-muted-foreground text-xs font-medium">
                Δ
              </span>
            }
            description="Current traffic deviation from the period average. Large deviations may indicate traffic spikes or drops."
          />
        </MetricCardGrid>
      )}

      {/* Traffic Chart */}
      {showChart && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">
                Traffic Over Time
              </CardTitle>
              <CardDescription>
                <span className="flex items-center gap-2">
                  <span>
                    {serviceName || serviceId || "All Services"}
                  </span>
                  {hasTrafficAnomaly && trafficVariance !== null && (
                    <Badge
                      variant={trafficVariance > 0 ? "warning" : "destructive"}
                      className="text-2xs"
                    >
                      {trafficVariance > 0 ? "Traffic Spike" : "Traffic Drop"}{" "}
                      ({trafficVariance > 0 ? "+" : ""}
                      {trafficVariance.toFixed(1)}%)
                    </Badge>
                  )}
                  {!hasTrafficAnomaly && (
                    <Badge variant="success" className="text-2xs">
                      Normal
                    </Badge>
                  )}
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Trend Indicator */}
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TrafficTrendIndicator
                      trend={trafficTrend}
                      hasAnomaly={hasTrafficAnomaly}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4}>
                    <p className="text-xs">
                      Traffic trend over the selected period
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
              <div>
                <div style={{ height: chartHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="trafficRpsGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={TRAFFIC_COLOR}
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="95%"
                            stopColor={TRAFFIC_COLOR}
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
                        tickFormatter={(value: number) =>
                          formatCompactNumber(value)
                        }
                        label={{
                          value: "Requests / sec",
                          angle: -90,
                          position: "insideLeft",
                          style: {
                            fontSize: 10,
                            fill: "hsl(var(--muted-foreground))",
                          },
                        }}
                      />
                      <RechartsTooltip
                        content={<TrafficTooltip />}
                        cursor={{ strokeDasharray: "3 3" }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="rect"
                        wrapperStyle={{ fontSize: 11 }}
                      />

                      {/* Average reference line */}
                      {latestTraffic.avg !== null && (
                        <ReferenceLine
                          y={latestTraffic.avg}
                          stroke={TRAFFIC_COLOR}
                          strokeDasharray="6 3"
                          strokeWidth={1}
                          strokeOpacity={0.5}
                          label={{
                            value: `Avg (${formatCompactNumber(latestTraffic.avg)} rps)`,
                            position: "right",
                            style: {
                              fontSize: 9,
                              fill: TRAFFIC_COLOR,
                              fillOpacity: 0.7,
                            },
                          }}
                        />
                      )}

                      {/* Traffic RPS Area */}
                      <Area
                        type="monotone"
                        dataKey="traffic_rps"
                        name="Traffic (RPS)"
                        stroke={TRAFFIC_COLOR}
                        strokeWidth={2}
                        fill="url(#trafficRpsGradient)"
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 2 }}
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Traffic Spike Alert */}
                {hasTrafficAnomaly &&
                  trafficVariance !== null &&
                  trafficVariance > 50 && (
                    <div className="mt-3 flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                      <p className="text-2xs text-yellow-700 dark:text-yellow-400">
                        Traffic is{" "}
                        <span className="font-medium">
                          {trafficVariance.toFixed(1)}%
                        </span>{" "}
                        above the period average (
                        {formatCompactNumber(latestTraffic.avg)} rps). Current:{" "}
                        {formatCompactNumber(latestTraffic.rps)} rps. Monitor
                        for capacity issues and upstream load changes.
                      </p>
                    </div>
                  )}

                {/* Traffic Drop Alert */}
                {hasTrafficAnomaly &&
                  trafficVariance !== null &&
                  trafficVariance < -50 && (
                    <div className="mt-3 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                      <p className="text-2xs text-red-700 dark:text-red-400">
                        Traffic has dropped{" "}
                        <span className="font-medium">
                          {Math.abs(trafficVariance).toFixed(1)}%
                        </span>{" "}
                        below the period average (
                        {formatCompactNumber(latestTraffic.avg)} rps). Current:{" "}
                        {formatCompactNumber(latestTraffic.rps)} rps. Investigate
                        potential upstream failures or routing issues.
                      </p>
                    </div>
                  )}

                {/* Traffic Summary Footer */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: TRAFFIC_COLOR }}
                      />
                      <span className="text-2xs text-muted-foreground">
                        Peak: {formatCompactNumber(latestTraffic.peak)} rps
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-px w-4 border-t border-dashed" style={{ borderColor: TRAFFIC_COLOR }} />
                      <span className="text-2xs text-muted-foreground">
                        Avg: {formatCompactNumber(latestTraffic.avg)} rps
                      </span>
                    </div>
                    {latestTraffic.min !== null && (
                      <span className="text-2xs text-muted-foreground">
                        Min: {formatCompactNumber(latestTraffic.min)} rps
                      </span>
                    )}
                  </div>
                  <span className="text-2xs text-muted-foreground">
                    {chartData.length} data point{chartData.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">
                  No traffic data available for the selected period.
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
// TrafficTrendIndicator Component
// ============================================================

interface TrafficTrendIndicatorProps {
  trend: TrendDirection
  hasAnomaly: boolean
}

/**
 * Compact trend indicator for traffic metrics.
 */
function TrafficTrendIndicator({
  trend,
  hasAnomaly,
}: TrafficTrendIndicatorProps) {
  const TrendIcon = TREND_ICON_MAP[trend] || Minus

  // For traffic, "up" is generally good (more traffic = more usage)
  const trendColor =
    trend === "up"
      ? "text-green-600 dark:text-green-400"
      : trend === "down"
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-muted-foreground"

  const borderColor = hasAnomaly ? "border-yellow-500/30" : "border-border"

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-md border px-1.5 py-0.5",
        borderColor,
        trendColor
      )}
    >
      <span className="text-2xs font-medium">RPS</span>
      <TrendIcon className="h-3 w-3" />
    </div>
  )
}

// ============================================================
// TrafficTooltip Component
// ============================================================

interface TrafficTooltipProps {
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
 * Custom tooltip for the traffic chart.
 */
function TrafficTooltip({ active, payload, label }: TrafficTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md">
      <p className="text-2xs font-medium text-foreground mb-1">{label}</p>
      <div className="space-y-0.5">
        {payload.map((entry, index) => {
          if (entry.value === null || entry.value === undefined) return null

          const formattedValue = `${formatNumber(entry.value, 1)} rps`

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

export interface TrafficChartWithBoundaryProps extends TrafficChartProps {}

/**
 * TrafficChart wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function TrafficChartWithBoundary(
  props: TrafficChartWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Traffic Chart">
      <TrafficChart {...props} />
    </ModuleErrorBoundary>
  )
}

export default TrafficChart