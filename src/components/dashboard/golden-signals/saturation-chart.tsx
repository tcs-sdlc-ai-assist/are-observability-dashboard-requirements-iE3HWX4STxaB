"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowRight,
  Cpu,
  HardDrive,
  Minus,
  RefreshCw,
  Server,
  TrendingDown,
  TrendingUp,
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
import { formatDate, formatNumber } from "@/lib/utils"
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

export interface SaturationChartProps {
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
  /** Whether to show disk saturation in addition to CPU/memory (default: true) */
  showDisk?: boolean
  /** Optional criticality tier for threshold display */
  tier?: CriticalityTier
  /** Additional CSS class names */
  className?: string
}

interface SaturationChartPoint {
  timestamp: string
  label: string
  saturation_cpu: number | null
  saturation_memory: number | null
  saturation_disk: number | null
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

const CPU_COLOR = CHART_DEFAULTS.COLORS[0] // blue
const MEMORY_COLOR = CHART_DEFAULTS.COLORS[4] // purple
const DISK_COLOR = CHART_DEFAULTS.COLORS[2] // yellow/amber

// ============================================================
// Helpers
// ============================================================

/**
 * Extracts saturation metric values from golden signals data and builds
 * time-series chart points.
 */
function buildChartData(
  signalsData: GoldenSignalsDashboard[] | undefined
): SaturationChartPoint[] {
  if (!signalsData || signalsData.length === 0) return []

  const points: SaturationChartPoint[] = []

  for (const entry of signalsData) {
    const cpuSignal = entry.signals.find((s) => s.metric === "saturation_cpu")
    const memorySignal = entry.signals.find((s) => s.metric === "saturation_memory")
    const diskSignal = entry.signals.find((s) => s.metric === "saturation_disk")

    points.push({
      timestamp: entry.timestamp,
      label: formatDate(entry.timestamp, "MMM dd HH:mm"),
      saturation_cpu: cpuSignal?.value ?? null,
      saturation_memory: memorySignal?.value ?? null,
      saturation_disk: diskSignal?.value ?? null,
    })
  }

  // Sort by timestamp ascending
  points.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  return points
}

/**
 * Extracts the latest saturation values from the signals data.
 */
function extractLatestSaturation(
  signalsData: GoldenSignalsDashboard[] | undefined
): {
  cpu: number | null
  memory: number | null
  disk: number | null
  peak_cpu: number | null
  peak_memory: number | null
  peak_disk: number | null
  avg_cpu: number | null
  avg_memory: number | null
} {
  if (!signalsData || signalsData.length === 0) {
    return {
      cpu: null,
      memory: null,
      disk: null,
      peak_cpu: null,
      peak_memory: null,
      peak_disk: null,
      avg_cpu: null,
      avg_memory: null,
    }
  }

  // Get the latest entry
  const sorted = [...signalsData].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
  const latest = sorted[0]

  const cpuSignal = latest.signals.find((s) => s.metric === "saturation_cpu")
  const memorySignal = latest.signals.find((s) => s.metric === "saturation_memory")
  const diskSignal = latest.signals.find((s) => s.metric === "saturation_disk")

  const currentCpu = cpuSignal?.value ?? null
  const currentMemory = memorySignal?.value ?? null
  const currentDisk = diskSignal?.value ?? null

  // Compute peak and avg across all entries
  const allCpuValues = signalsData
    .map((entry) => {
      const signal = entry.signals.find((s) => s.metric === "saturation_cpu")
      return signal?.value ?? null
    })
    .filter((v): v is number => v !== null)

  const allMemoryValues = signalsData
    .map((entry) => {
      const signal = entry.signals.find((s) => s.metric === "saturation_memory")
      return signal?.value ?? null
    })
    .filter((v): v is number => v !== null)

  const allDiskValues = signalsData
    .map((entry) => {
      const signal = entry.signals.find((s) => s.metric === "saturation_disk")
      return signal?.value ?? null
    })
    .filter((v): v is number => v !== null)

  const peak_cpu = allCpuValues.length > 0 ? Math.max(...allCpuValues) : null
  const peak_memory = allMemoryValues.length > 0 ? Math.max(...allMemoryValues) : null
  const peak_disk = allDiskValues.length > 0 ? Math.max(...allDiskValues) : null

  const avg_cpu =
    allCpuValues.length > 0
      ? Math.round(
          (allCpuValues.reduce((sum, v) => sum + v, 0) / allCpuValues.length) * 100
        ) / 100
      : null

  const avg_memory =
    allMemoryValues.length > 0
      ? Math.round(
          (allMemoryValues.reduce((sum, v) => sum + v, 0) / allMemoryValues.length) * 100
        ) / 100
      : null

  return {
    cpu: currentCpu,
    memory: currentMemory,
    disk: currentDisk,
    peak_cpu,
    peak_memory,
    peak_disk,
    avg_cpu,
    avg_memory,
  }
}

/**
 * Determines if a saturation value breaches the threshold.
 */
function isSaturationBreached(
  value: number | null,
  metricType: "cpu" | "memory" | "disk"
): boolean {
  if (value === null) return false

  const thresholds = DEFAULT_THRESHOLDS.saturation
  switch (metricType) {
    case "cpu":
      return value > thresholds.cpu_critical
    case "memory":
      return value > thresholds.memory_critical
    case "disk":
      return value > thresholds.disk_critical
    default:
      return false
  }
}

/**
 * Determines if a saturation value is in warning state.
 */
function isSaturationWarning(
  value: number | null,
  metricType: "cpu" | "memory" | "disk"
): boolean {
  if (value === null) return false

  const thresholds = DEFAULT_THRESHOLDS.saturation
  switch (metricType) {
    case "cpu":
      return value > thresholds.cpu_warning && value <= thresholds.cpu_critical
    case "memory":
      return value > thresholds.memory_warning && value <= thresholds.memory_critical
    case "disk":
      return value > thresholds.disk_warning && value <= thresholds.disk_critical
    default:
      return false
  }
}

/**
 * Gets the warning and critical thresholds for a saturation metric.
 */
function getSaturationThresholds(
  metricType: "cpu" | "memory" | "disk"
): { warning: number; critical: number } {
  const thresholds = DEFAULT_THRESHOLDS.saturation
  switch (metricType) {
    case "cpu":
      return { warning: thresholds.cpu_warning, critical: thresholds.cpu_critical }
    case "memory":
      return { warning: thresholds.memory_warning, critical: thresholds.memory_critical }
    case "disk":
      return { warning: thresholds.disk_warning, critical: thresholds.disk_critical }
    default:
      return { warning: 70, critical: 90 }
  }
}

/**
 * Computes a simple trend direction from an array of saturation values.
 */
function computeSaturationTrend(values: (number | null)[]): TrendDirection {
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
 * Returns the health status label for a saturation value.
 */
function getSaturationHealthStatus(
  value: number | null,
  metricType: "cpu" | "memory" | "disk"
): "healthy" | "degraded" | "critical" | "unknown" {
  if (value === null) return "unknown"
  if (isSaturationBreached(value, metricType)) return "critical"
  if (isSaturationWarning(value, metricType)) return "degraded"
  return "healthy"
}

// ============================================================
// SaturationChart Component
// ============================================================

/**
 * Saturation chart component using Recharts showing CPU, memory, and disk
 * utilization over time as a multi-line chart with warning and critical
 * threshold indicators. Supports domain/app/env filtering. Includes summary
 * metric cards with threshold breach indicators and trend direction.
 *
 * @example
 * ```tsx
 * <SaturationChart
 *   serviceId="svc-123"
 *   serviceName="Checkout API"
 *   filters={{ domain: "payments", period: "24h" }}
 *   tier="Tier-1"
 *   showSummary
 *   showChart
 *   showDisk
 * />
 * ```
 */
export function SaturationChart({
  serviceId,
  serviceName,
  filters,
  showSummary = true,
  showChart = true,
  defaultPeriod = "24h",
  chartHeight = 300,
  showDisk = true,
  tier,
  className,
}: SaturationChartProps) {
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

  const metricsToFetch: MetricType[] = showDisk
    ? ["saturation_cpu", "saturation_memory", "saturation_disk"]
    : ["saturation_cpu", "saturation_memory"]

  const { data, isLoading, error, mutate } = useGoldenSignals({
    service_id: serviceId,
    domain: filters?.domain,
    application: filters?.application,
    environment: filters?.environment,
    metrics: metricsToFetch,
    period,
  })

  const chartData = React.useMemo(() => buildChartData(data), [data])

  const latestSaturation = React.useMemo(
    () => extractLatestSaturation(data),
    [data]
  )

  const cpuTrend = React.useMemo(
    () => computeSaturationTrend(chartData.map((p) => p.saturation_cpu)),
    [chartData]
  )

  const memoryTrend = React.useMemo(
    () => computeSaturationTrend(chartData.map((p) => p.saturation_memory)),
    [chartData]
  )

  const diskTrend = React.useMemo(
    () => computeSaturationTrend(chartData.map((p) => p.saturation_disk)),
    [chartData]
  )

  const cpuBreached = isSaturationBreached(latestSaturation.cpu, "cpu")
  const memoryBreached = isSaturationBreached(latestSaturation.memory, "memory")
  const diskBreached = isSaturationBreached(latestSaturation.disk, "disk")

  const cpuWarning = isSaturationWarning(latestSaturation.cpu, "cpu")
  const memoryWarning = isSaturationWarning(latestSaturation.memory, "memory")
  const diskWarning = isSaturationWarning(latestSaturation.disk, "disk")

  const hasAnyBreach = cpuBreached || memoryBreached || diskBreached
  const hasAnyWarning = cpuWarning || memoryWarning || diskWarning

  const cpuThresholds = getSaturationThresholds("cpu")
  const memoryThresholds = getSaturationThresholds("memory")

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
              Saturation Chart
            </CardTitle>
            <CardDescription>
              Failed to load saturation data.
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
        {showSummary && (
          <MetricCardGridSkeleton cards={showDisk ? 4 : 3} columns={showDisk ? 4 : 3} />
        )}
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
              Saturation (CPU / Memory / Disk)
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
          <Server className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No saturation data available
          </p>
          <p className="text-2xs text-muted-foreground mt-1">
            Adjust your filters or check that services are configured.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary Metric Cards */}
      {showSummary && (
        <MetricCardGrid columns={showDisk ? 4 : 3}>
          {/* CPU Saturation */}
          <MetricCard
            label="CPU Utilization"
            value={latestSaturation.cpu}
            format="raw"
            decimals={1}
            unit="%"
            trend={cpuTrend}
            trendUpIsGood={false}
            threshold={cpuThresholds.critical}
            thresholdExceededIsBad={true}
            icon={<Cpu className="h-4 w-4" />}
            description={`CPU utilization. Warning: ${cpuThresholds.warning}%, Critical: ${cpuThresholds.critical}%`}
            onClick={serviceId ? handleServiceClick : handleDrillDown}
          />

          {/* Memory Saturation */}
          <MetricCard
            label="Memory Utilization"
            value={latestSaturation.memory}
            format="raw"
            decimals={1}
            unit="%"
            trend={memoryTrend}
            trendUpIsGood={false}
            threshold={memoryThresholds.critical}
            thresholdExceededIsBad={true}
            icon={<Server className="h-4 w-4" />}
            description={`Memory utilization. Warning: ${memoryThresholds.warning}%, Critical: ${memoryThresholds.critical}%`}
            onClick={serviceId ? handleServiceClick : handleDrillDown}
          />

          {/* Disk Saturation */}
          {showDisk && (
            <MetricCard
              label="Disk Utilization"
              value={latestSaturation.disk}
              format="raw"
              decimals={1}
              unit="%"
              trend={diskTrend}
              trendUpIsGood={false}
              threshold={getSaturationThresholds("disk").critical}
              thresholdExceededIsBad={true}
              icon={<HardDrive className="h-4 w-4" />}
              description={`Disk utilization. Warning: ${getSaturationThresholds("disk").warning}%, Critical: ${getSaturationThresholds("disk").critical}%`}
            />
          )}

          {/* Peak CPU */}
          <MetricCard
            label="Peak CPU"
            value={latestSaturation.peak_cpu}
            format="raw"
            decimals={1}
            unit="%"
            trendUpIsGood={false}
            threshold={cpuThresholds.critical}
            thresholdExceededIsBad={true}
            icon={
              <span className="text-muted-foreground text-xs font-medium">
                ↑
              </span>
            }
            description="Peak CPU utilization during the selected period"
          />
        </MetricCardGrid>
      )}

      {/* Saturation Chart */}
      {showChart && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">
                Saturation Over Time
              </CardTitle>
              <CardDescription>
                <span className="flex items-center gap-2">
                  <span>
                    {serviceName || serviceId || "All Services"}
                  </span>
                  {hasAnyBreach && (
                    <Badge variant="destructive" className="text-2xs">
                      Critical Threshold Breached
                    </Badge>
                  )}
                  {!hasAnyBreach && hasAnyWarning && (
                    <Badge variant="warning" className="text-2xs">
                      Warning Threshold
                    </Badge>
                  )}
                  {!hasAnyBreach && !hasAnyWarning && (
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
                      <SaturationTrendIndicator
                        label="CPU"
                        trend={cpuTrend}
                        breached={cpuBreached}
                        warning={cpuWarning}
                      />
                      <SaturationTrendIndicator
                        label="MEM"
                        trend={memoryTrend}
                        breached={memoryBreached}
                        warning={memoryWarning}
                      />
                      {showDisk && (
                        <SaturationTrendIndicator
                          label="DISK"
                          trend={diskTrend}
                          breached={diskBreached}
                          warning={diskWarning}
                        />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4}>
                    <p className="text-xs">
                      Saturation trend over the selected period
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
                    <LineChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="saturationCpuGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={CPU_COLOR}
                            stopOpacity={0.15}
                          />
                          <stop
                            offset="95%"
                            stopColor={CPU_COLOR}
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="saturationMemoryGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={MEMORY_COLOR}
                            stopOpacity={0.15}
                          />
                          <stop
                            offset="95%"
                            stopColor={MEMORY_COLOR}
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="saturationDiskGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={DISK_COLOR}
                            stopOpacity={0.15}
                          />
                          <stop
                            offset="95%"
                            stopColor={DISK_COLOR}
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
                        domain={[0, 100]}
                        tickFormatter={(value: number) => `${value}%`}
                        label={{
                          value: "Utilization (%)",
                          angle: -90,
                          position: "insideLeft",
                          style: {
                            fontSize: 10,
                            fill: "hsl(var(--muted-foreground))",
                          },
                        }}
                      />
                      <RechartsTooltip
                        content={<SaturationTooltip showDisk={showDisk} />}
                        cursor={{ strokeDasharray: "3 3" }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="line"
                        wrapperStyle={{ fontSize: 11 }}
                      />

                      {/* Critical Threshold Reference Line */}
                      <ReferenceLine
                        y={cpuThresholds.critical}
                        stroke="#ef4444"
                        strokeDasharray="6 3"
                        strokeWidth={1.5}
                        strokeOpacity={0.6}
                        label={{
                          value: `Critical (${cpuThresholds.critical}%)`,
                          position: "right",
                          style: {
                            fontSize: 9,
                            fill: "#ef4444",
                            fillOpacity: 0.7,
                          },
                        }}
                      />

                      {/* Warning Threshold Reference Line */}
                      <ReferenceLine
                        y={cpuThresholds.warning}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        strokeWidth={1}
                        strokeOpacity={0.5}
                        label={{
                          value: `Warning (${cpuThresholds.warning}%)`,
                          position: "right",
                          style: {
                            fontSize: 9,
                            fill: "#f59e0b",
                            fillOpacity: 0.7,
                          },
                        }}
                      />

                      {/* CPU Line */}
                      <Line
                        type="monotone"
                        dataKey="saturation_cpu"
                        name="CPU"
                        stroke={CPU_COLOR}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 2 }}
                        connectNulls
                      />

                      {/* Memory Line */}
                      <Line
                        type="monotone"
                        dataKey="saturation_memory"
                        name="Memory"
                        stroke={MEMORY_COLOR}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 2 }}
                        connectNulls
                      />

                      {/* Disk Line (optional) */}
                      {showDisk && (
                        <Line
                          type="monotone"
                          dataKey="saturation_disk"
                          name="Disk"
                          stroke={DISK_COLOR}
                          strokeWidth={1.5}
                          dot={false}
                          activeDot={{ r: 3, strokeWidth: 2 }}
                          connectNulls
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Critical Breach Alert */}
                {hasAnyBreach && (
                  <div className="mt-3 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                    <p className="text-2xs text-red-700 dark:text-red-400">
                      {cpuBreached && memoryBreached
                        ? `Both CPU (${latestSaturation.cpu?.toFixed(1)}%) and Memory (${latestSaturation.memory?.toFixed(1)}%) exceed critical thresholds.`
                        : cpuBreached
                          ? `CPU utilization (${latestSaturation.cpu?.toFixed(1)}%) exceeds critical threshold of ${cpuThresholds.critical}%.`
                          : memoryBreached
                            ? `Memory utilization (${latestSaturation.memory?.toFixed(1)}%) exceeds critical threshold of ${getSaturationThresholds("memory").critical}%.`
                            : diskBreached
                              ? `Disk utilization (${latestSaturation.disk?.toFixed(1)}%) exceeds critical threshold of ${getSaturationThresholds("disk").critical}%.`
                              : "Resource utilization exceeds critical threshold."}
                      {" "}Investigate resource capacity and consider scaling.
                    </p>
                  </div>
                )}

                {/* Warning Alert */}
                {!hasAnyBreach && hasAnyWarning && (
                  <div className="mt-3 flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                    <p className="text-2xs text-yellow-700 dark:text-yellow-400">
                      {cpuWarning && `CPU utilization (${latestSaturation.cpu?.toFixed(1)}%) is above warning threshold (${cpuThresholds.warning}%). `}
                      {memoryWarning && `Memory utilization (${latestSaturation.memory?.toFixed(1)}%) is above warning threshold (${getSaturationThresholds("memory").warning}%). `}
                      {diskWarning && `Disk utilization (${latestSaturation.disk?.toFixed(1)}%) is above warning threshold (${getSaturationThresholds("disk").warning}%). `}
                      Monitor closely and plan capacity adjustments.
                    </p>
                  </div>
                )}

                {/* Saturation Summary Footer */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: CPU_COLOR }}
                      />
                      <span className="text-2xs text-muted-foreground">
                        CPU Avg: {latestSaturation.avg_cpu !== null ? `${latestSaturation.avg_cpu.toFixed(1)}%` : "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: MEMORY_COLOR }}
                      />
                      <span className="text-2xs text-muted-foreground">
                        Mem Avg: {latestSaturation.avg_memory !== null ? `${latestSaturation.avg_memory.toFixed(1)}%` : "—"}
                      </span>
                    </div>
                    {showDisk && (
                      <div className="flex items-center gap-1.5">
                        <div
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: DISK_COLOR }}
                        />
                        <span className="text-2xs text-muted-foreground">
                          Disk Peak: {latestSaturation.peak_disk !== null ? `${latestSaturation.peak_disk.toFixed(1)}%` : "—"}
                        </span>
                      </div>
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
                  No saturation data available for the selected period.
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
// SaturationTrendIndicator Component
// ============================================================

interface SaturationTrendIndicatorProps {
  label: string
  trend: TrendDirection
  breached: boolean
  warning: boolean
}

/**
 * Compact trend indicator for saturation metrics.
 */
function SaturationTrendIndicator({
  label,
  trend,
  breached,
  warning,
}: SaturationTrendIndicatorProps) {
  const TrendIcon = TREND_ICON_MAP[trend] || Minus

  // For saturation, "up" is bad and "down" is good
  const trendColor =
    trend === "up"
      ? "text-red-600 dark:text-red-400"
      : trend === "down"
        ? "text-green-600 dark:text-green-400"
        : "text-muted-foreground"

  const borderColor = breached
    ? "border-red-500/30"
    : warning
      ? "border-yellow-500/30"
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
// SaturationTooltip Component
// ============================================================

interface SaturationTooltipProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number | null
    color: string
    dataKey: string
  }>
  label?: string
  showDisk?: boolean
}

/**
 * Custom tooltip for the saturation chart.
 */
function SaturationTooltip({
  active,
  payload,
  label,
  showDisk,
}: SaturationTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md">
      <p className="text-2xs font-medium text-foreground mb-1">{label}</p>
      <div className="space-y-0.5">
        {payload.map((entry, index) => {
          if (entry.value === null || entry.value === undefined) return null

          const formattedValue = `${entry.value.toFixed(1)}%`

          // Determine the metric type from the dataKey
          let metricType: "cpu" | "memory" | "disk" = "cpu"
          if (entry.dataKey === "saturation_memory") metricType = "memory"
          else if (entry.dataKey === "saturation_disk") metricType = "disk"

          const healthStatus = getSaturationHealthStatus(entry.value, metricType)

          const valueColor =
            healthStatus === "critical"
              ? "#ef4444"
              : healthStatus === "degraded"
                ? "#f59e0b"
                : "#22c55e"

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

export interface SaturationChartWithBoundaryProps extends SaturationChartProps {}

/**
 * SaturationChart wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function SaturationChartWithBoundary(
  props: SaturationChartWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Saturation Chart">
      <SaturationChart {...props} />
    </ModuleErrorBoundary>
  )
}

export default SaturationChart