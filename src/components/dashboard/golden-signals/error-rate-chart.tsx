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
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"

import { cn } from "@/lib/utils"
import { formatDate, formatNumber, formatCompactNumber } from "@/lib/utils"
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
  GoldenSignalsDashboard,
  MetricType,
  TimePeriod,
  TrendDirection,
} from "@/types"

// ============================================================
// Types
// ============================================================

export interface ErrorRateChartProps {
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
  /** Whether to show 4xx errors in addition to 5xx (default: true) */
  show4xx?: boolean
  /** Optional criticality tier for threshold display */
  tier?: CriticalityTier
  /** Additional CSS class names */
  className?: string
}

interface ErrorRateChartPoint {
  timestamp: string
  label: string
  errors_5xx: number | null
  errors_4xx: number | null
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

const ERROR_5XX_COLOR = CHART_DEFAULTS.COLORS[3] // red
const ERROR_4XX_COLOR = CHART_DEFAULTS.COLORS[2] // yellow/amber

// ============================================================
// Helpers
// ============================================================

/**
 * Extracts error rate metric values from golden signals data and builds
 * time-series chart points.
 */
function buildChartData(
  signalsData: GoldenSignalsDashboard[] | undefined
): ErrorRateChartPoint[] {
  if (!signalsData || signalsData.length === 0) return []

  const points: ErrorRateChartPoint[] = []

  for (const entry of signalsData) {
    const errors5xxSignal = entry.signals.find((s) => s.metric === "errors_5xx")
    const errors4xxSignal = entry.signals.find((s) => s.metric === "errors_4xx")

    points.push({
      timestamp: entry.timestamp,
      label: formatDate(entry.timestamp, "MMM dd HH:mm"),
      errors_5xx: errors5xxSignal?.value ?? null,
      errors_4xx: errors4xxSignal?.value ?? null,
    })
  }

  // Sort by timestamp ascending
  points.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  return points
}

/**
 * Extracts the latest error rate values from the signals data.
 */
function extractLatestErrorRates(
  signalsData: GoldenSignalsDashboard[] | undefined
): {
  errors_5xx: number | null
  errors_4xx: number | null
  total: number | null
  peak_5xx: number | null
  avg_5xx: number | null
} {
  if (!signalsData || signalsData.length === 0) {
    return { errors_5xx: null, errors_4xx: null, total: null, peak_5xx: null, avg_5xx: null }
  }

  // Get the latest entry
  const sorted = [...signalsData].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
  const latest = sorted[0]

  const e5xx = latest.signals.find((s) => s.metric === "errors_5xx")
  const e4xx = latest.signals.find((s) => s.metric === "errors_4xx")

  const current5xx = e5xx?.value ?? null
  const current4xx = e4xx?.value ?? null

  const total =
    current5xx !== null || current4xx !== null
      ? (current5xx ?? 0) + (current4xx ?? 0)
      : null

  // Compute peak and avg for 5xx across all entries
  const all5xxValues = signalsData
    .map((entry) => {
      const signal = entry.signals.find((s) => s.metric === "errors_5xx")
      return signal?.value ?? null
    })
    .filter((v): v is number => v !== null)

  const peak_5xx = all5xxValues.length > 0 ? Math.max(...all5xxValues) : null
  const avg_5xx =
    all5xxValues.length > 0
      ? Math.round(
          (all5xxValues.reduce((sum, v) => sum + v, 0) / all5xxValues.length) * 100
        ) / 100
      : null

  return {
    errors_5xx: current5xx,
    errors_4xx: current4xx,
    total,
    peak_5xx,
    avg_5xx,
  }
}

/**
 * Determines if an error rate value breaches the threshold for a given tier.
 */
function isErrorRateBreached(
  value: number | null,
  tier: CriticalityTier | undefined
): boolean {
  if (value === null || !tier) return false

  const threshold = DEFAULT_THRESHOLDS.error_rate_5xx[tier]
  return value > threshold
}

/**
 * Gets the threshold value for a given tier.
 */
function getErrorRateThreshold(
  tier: CriticalityTier | undefined
): number | undefined {
  if (!tier) return undefined
  return DEFAULT_THRESHOLDS.error_rate_5xx[tier]
}

/**
 * Computes a simple trend direction from an array of error rate values.
 */
function computeErrorRateTrend(values: (number | null)[]): TrendDirection {
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
// ErrorRateChart Component
// ============================================================

/**
 * Error rate chart component using Recharts showing 5xx errors and 4xx errors
 * over time as a bar/line combo chart with threshold line. Supports
 * domain/app/env filtering. Includes summary metric cards with threshold
 * breach indicators and trend direction.
 *
 * @example
 * ```tsx
 * <ErrorRateChart
 *   serviceId="svc-123"
 *   serviceName="Checkout API"
 *   filters={{ domain: "payments", period: "24h" }}
 *   tier="Tier-1"
 *   showSummary
 *   showChart
 *   show4xx
 * />
 * ```
 */
export function ErrorRateChart({
  serviceId,
  serviceName,
  filters,
  showSummary = true,
  showChart = true,
  defaultPeriod = "24h",
  chartHeight = 300,
  show4xx = true,
  tier,
  className,
}: ErrorRateChartProps) {
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

  const metricsToFetch: MetricType[] = show4xx
    ? ["errors_5xx", "errors_4xx"]
    : ["errors_5xx"]

  const { data, isLoading, error, mutate } = useGoldenSignals({
    service_id: serviceId,
    domain: filters?.domain,
    application: filters?.application,
    environment: filters?.environment,
    metrics: metricsToFetch,
    period,
  })

  const chartData = React.useMemo(() => buildChartData(data), [data])

  const latestErrors = React.useMemo(
    () => extractLatestErrorRates(data),
    [data]
  )

  const error5xxTrend = React.useMemo(
    () => computeErrorRateTrend(chartData.map((p) => p.errors_5xx)),
    [chartData]
  )

  const error4xxTrend = React.useMemo(
    () => computeErrorRateTrend(chartData.map((p) => p.errors_4xx)),
    [chartData]
  )

  const errorRateThreshold = getErrorRateThreshold(tier)
  const is5xxBreached = isErrorRateBreached(latestErrors.errors_5xx, tier)

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
              Error Rate Chart
            </CardTitle>
            <CardDescription>
              Failed to load error rate data.
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
        {showSummary && <MetricCardGridSkeleton cards={show4xx ? 4 : 3} columns={show4xx ? 4 : 3} />}
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
              Error Rate (5xx / 4xx)
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
          <XCircle className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No error rate data available
          </p>
          <p className="text-2xs text-muted-foreground mt-1">
            Adjust your filters or check that services are configured.
          </p>
        </CardContent>
      </Card>
    )
  }

  const hasAnyBreach = is5xxBreached

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary Metric Cards */}
      {showSummary && (
        <MetricCardGrid columns={show4xx ? 4 : 3}>
          {/* 5xx Error Rate */}
          <MetricCard
            label="5xx Error Rate"
            value={latestErrors.errors_5xx}
            format="raw"
            decimals={3}
            unit="%"
            trend={error5xxTrend}
            trendUpIsGood={false}
            threshold={errorRateThreshold}
            thresholdExceededIsBad={true}
            icon={<XCircle className="h-4 w-4" />}
            description={`Server error rate (5xx)${tier ? `. Threshold: ${errorRateThreshold}% (${tier})` : ""}`}
            onClick={serviceId ? handleServiceClick : handleDrillDown}
          />

          {/* 4xx Error Rate */}
          {show4xx && (
            <MetricCard
              label="4xx Error Rate"
              value={latestErrors.errors_4xx}
              format="raw"
              decimals={3}
              unit="%"
              trend={error4xxTrend}
              trendUpIsGood={false}
              icon={<AlertTriangle className="h-4 w-4" />}
              description="Client error rate (4xx). High 4xx rates may indicate API contract issues or invalid client requests."
            />
          )}

          {/* Total Errors */}
          <MetricCard
            label="Total Error Rate"
            value={latestErrors.total}
            format="raw"
            decimals={3}
            unit="%"
            trendUpIsGood={false}
            icon={
              <span className="text-muted-foreground text-xs font-medium">
                Σ
              </span>
            }
            description="Combined 4xx + 5xx error rate"
          />

          {/* Peak 5xx */}
          <MetricCard
            label="Peak 5xx Rate"
            value={latestErrors.peak_5xx}
            format="raw"
            decimals={3}
            unit="%"
            trendUpIsGood={false}
            threshold={errorRateThreshold}
            thresholdExceededIsBad={true}
            icon={
              <span className="text-muted-foreground text-xs font-medium">
                ↑
              </span>
            }
            description="Peak 5xx error rate during the selected period"
          />
        </MetricCardGrid>
      )}

      {/* Error Rate Chart */}
      {showChart && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">
                Error Rate Over Time
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
                      <ErrorRateTrendIndicator
                        label="5xx"
                        trend={error5xxTrend}
                        breached={is5xxBreached}
                      />
                      {show4xx && (
                        <ErrorRateTrendIndicator
                          label="4xx"
                          trend={error4xxTrend}
                          breached={false}
                        />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4}>
                    <p className="text-xs">
                      Error rate trend over the selected period
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
                    <ComposedChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="errors5xxGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={ERROR_5XX_COLOR}
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor={ERROR_5XX_COLOR}
                            stopOpacity={0.05}
                          />
                        </linearGradient>
                        <linearGradient
                          id="errors4xxGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={ERROR_4XX_COLOR}
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor={ERROR_4XX_COLOR}
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
                        tickFormatter={(value: number) =>
                          value < 1 ? `${value.toFixed(2)}%` : `${value.toFixed(1)}%`
                        }
                        label={{
                          value: "Error Rate (%)",
                          angle: -90,
                          position: "insideLeft",
                          style: {
                            fontSize: 10,
                            fill: "hsl(var(--muted-foreground))",
                          },
                        }}
                      />
                      <RechartsTooltip
                        content={<ErrorRateTooltip show4xx={show4xx} />}
                        cursor={{ strokeDasharray: "3 3" }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="rect"
                        wrapperStyle={{ fontSize: 11 }}
                      />

                      {/* 5xx Threshold Reference Line */}
                      {errorRateThreshold !== undefined && (
                        <ReferenceLine
                          y={errorRateThreshold}
                          stroke={ERROR_5XX_COLOR}
                          strokeDasharray="6 3"
                          strokeWidth={1.5}
                          strokeOpacity={0.7}
                          label={{
                            value: `5xx Threshold (${errorRateThreshold}%)`,
                            position: "right",
                            style: {
                              fontSize: 9,
                              fill: ERROR_5XX_COLOR,
                              fillOpacity: 0.8,
                            },
                          }}
                        />
                      )}

                      {/* 4xx Errors Bar */}
                      {show4xx && (
                        <Bar
                          dataKey="errors_4xx"
                          name="4xx Errors"
                          fill="url(#errors4xxGradient)"
                          stroke={ERROR_4XX_COLOR}
                          strokeWidth={1}
                          radius={[2, 2, 0, 0]}
                          barSize={chartData.length > 30 ? 6 : 12}
                        />
                      )}

                      {/* 5xx Errors Line */}
                      <Line
                        type="monotone"
                        dataKey="errors_5xx"
                        name="5xx Errors"
                        stroke={ERROR_5XX_COLOR}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 2 }}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Breach Alert */}
                {hasAnyBreach && tier && (
                  <div className="mt-3 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                    <p className="text-2xs text-red-700 dark:text-red-400">
                      5xx error rate ({latestErrors.errors_5xx?.toFixed(3)}%)
                      exceeds {tier} threshold of {errorRateThreshold}%.
                      Investigate server errors and upstream dependencies immediately.
                    </p>
                  </div>
                )}

                {/* High 4xx Warning */}
                {!hasAnyBreach &&
                  show4xx &&
                  latestErrors.errors_4xx !== null &&
                  latestErrors.errors_4xx > 1.0 && (
                    <div className="mt-3 flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                      <p className="text-2xs text-yellow-700 dark:text-yellow-400">
                        4xx error rate ({latestErrors.errors_4xx.toFixed(3)}%)
                        is elevated. Review client request patterns and API
                        contract compliance.
                      </p>
                    </div>
                  )}

                {/* Error Rate Summary Footer */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: ERROR_5XX_COLOR }}
                      />
                      <span className="text-2xs text-muted-foreground">
                        5xx Peak: {latestErrors.peak_5xx !== null ? `${latestErrors.peak_5xx.toFixed(3)}%` : "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-px w-4 border-t border-dashed"
                        style={{ borderColor: ERROR_5XX_COLOR }}
                      />
                      <span className="text-2xs text-muted-foreground">
                        5xx Avg: {latestErrors.avg_5xx !== null ? `${latestErrors.avg_5xx.toFixed(3)}%` : "—"}
                      </span>
                    </div>
                    {errorRateThreshold !== undefined && (
                      <span className="text-2xs text-muted-foreground">
                        Threshold: {errorRateThreshold}%
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
                  No error rate data available for the selected period.
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
// ErrorRateTrendIndicator Component
// ============================================================

interface ErrorRateTrendIndicatorProps {
  label: string
  trend: TrendDirection
  breached: boolean
}

/**
 * Compact trend indicator for error rate metrics.
 */
function ErrorRateTrendIndicator({
  label,
  trend,
  breached,
}: ErrorRateTrendIndicatorProps) {
  const TrendIcon = TREND_ICON_MAP[trend] || Minus

  // For error rates, "up" is bad and "down" is good
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
// ErrorRateTooltip Component
// ============================================================

interface ErrorRateTooltipProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number | null
    color: string
    dataKey: string
  }>
  label?: string
  show4xx?: boolean
}

/**
 * Custom tooltip for the error rate chart.
 */
function ErrorRateTooltip({
  active,
  payload,
  label,
  show4xx,
}: ErrorRateTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md">
      <p className="text-2xs font-medium text-foreground mb-1">{label}</p>
      <div className="space-y-0.5">
        {payload.map((entry, index) => {
          if (entry.value === null || entry.value === undefined) return null

          const formattedValue =
            entry.value < 1
              ? `${entry.value.toFixed(3)}%`
              : `${entry.value.toFixed(2)}%`

          const valueColor =
            entry.dataKey === "errors_5xx"
              ? entry.value > 0.1
                ? "#ef4444"
                : entry.value > 0.01
                  ? "#f59e0b"
                  : "#22c55e"
              : entry.value > 1.0
                ? "#f59e0b"
                : "#6b7280"

          return (
            <div key={index} className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-2xs text-muted-foreground">
                {entry.name}:
              </span>
              <span
                className="text-2xs font-medium"
                style={{ color: valueColor }}
              >
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

export interface ErrorRateChartWithBoundaryProps extends ErrorRateChartProps {}

/**
 * ErrorRateChart wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function ErrorRateChartWithBoundary(
  props: ErrorRateChartWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Error Rate Chart">
      <ErrorRateChart {...props} />
    </ModuleErrorBoundary>
  )
}

export default ErrorRateChart