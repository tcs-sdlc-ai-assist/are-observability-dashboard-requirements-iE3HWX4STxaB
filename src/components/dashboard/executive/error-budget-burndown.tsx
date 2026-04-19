"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
  PieChart,
  RefreshCw,
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
import { formatDate, formatPercentage, formatRelativeTime } from "@/lib/utils"
import { useErrorBudgets } from "@/hooks/use-dashboard-data"
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
  DashboardFilters,
  ErrorBudget,
  ErrorBudgetDashboard,
  TimePeriod,
  TrendDirection,
} from "@/types"

// ============================================================
// Types
// ============================================================

export interface ErrorBudgetBurndownProps {
  /** The service ID to display error budget for */
  serviceId: string
  /** Optional service name for display */
  serviceName?: string
  /** Dashboard-level filters to apply */
  filters?: DashboardFilters
  /** Whether to show the summary metric cards (default: true) */
  showSummary?: boolean
  /** Whether to show the burn rate chart (default: true) */
  showChart?: boolean
  /** Whether to show the recommendations section (default: true) */
  showRecommendations?: boolean
  /** Default time period (default: "30d") */
  defaultPeriod?: TimePeriod
  /** Chart height in pixels (default: 300) */
  chartHeight?: number
  /** Additional CSS class names */
  className?: string
}

interface BurnRateChartPoint {
  timestamp: string
  label: string
  burn_rate: number
  budget_remaining_pct: number
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

const BREACH_THRESHOLD_BURN_RATE =
  DEFAULT_THRESHOLDS.error_budget_burn_rate.critical

const WARNING_THRESHOLD_BURN_RATE =
  DEFAULT_THRESHOLDS.error_budget_burn_rate.warning

// ============================================================
// Helpers
// ============================================================

/**
 * Computes the remaining budget percentage from an ErrorBudget.
 */
function computeRemainingPct(budget: ErrorBudget): number {
  if (budget.initial <= 0) return 0
  const pct = (budget.remaining / budget.initial) * 100
  return Math.round(Math.max(0, Math.min(100, pct)) * 100) / 100
}

/**
 * Computes the consumed budget percentage from an ErrorBudget.
 */
function computeConsumedPct(budget: ErrorBudget): number {
  if (budget.initial <= 0) return 0
  const pct = (budget.consumed / budget.initial) * 100
  return Math.round(Math.max(0, Math.min(100, pct)) * 100) / 100
}

/**
 * Determines the health status based on remaining budget percentage.
 */
function budgetToHealthStatus(
  remainingPct: number
): "healthy" | "degraded" | "critical" {
  if (remainingPct <= 0) return "critical"
  if (remainingPct <= 20) return "degraded"
  return "healthy"
}

/**
 * Builds chart data from burn rate history and error budget.
 */
function buildChartData(
  burnRateHistory: Array<{ timestamp: string; burn_rate: number }>,
  budget: ErrorBudget
): BurnRateChartPoint[] {
  if (!burnRateHistory || burnRateHistory.length === 0) return []

  const initial = budget.initial > 0 ? budget.initial : 1

  let cumulativeConsumed = 0

  return burnRateHistory.map((point, index) => {
    // Estimate consumed budget at each point based on burn rate
    // burn_rate represents the rate of consumption relative to the budget
    const stepConsumption = point.burn_rate * (initial / burnRateHistory.length)
    cumulativeConsumed += stepConsumption
    const remainingPct = Math.max(
      0,
      Math.round(((initial - cumulativeConsumed) / initial) * 10000) / 100
    )

    return {
      timestamp: point.timestamp,
      label: formatDate(point.timestamp, "MMM dd HH:mm"),
      burn_rate: Math.round(point.burn_rate * 100) / 100,
      budget_remaining_pct: remainingPct,
    }
  })
}

/**
 * Returns the color for a burn rate value.
 */
function getBurnRateColor(burnRate: number): string {
  if (burnRate >= BREACH_THRESHOLD_BURN_RATE) return "#ef4444"
  if (burnRate >= WARNING_THRESHOLD_BURN_RATE) return "#f59e0b"
  return "#22c55e"
}

// ============================================================
// ErrorBudgetBurndown Component
// ============================================================

/**
 * Error Budget Burn-down chart component showing budget consumption over time
 * per service with breach threshold line, trend arrows, and remaining budget
 * percentage. Includes summary metric cards, burn rate chart, and
 * recommendations section.
 *
 * @example
 * ```tsx
 * <ErrorBudgetBurndown
 *   serviceId="svc-123"
 *   serviceName="Checkout API"
 *   filters={{ period: "30d" }}
 *   showSummary
 *   showChart
 *   showRecommendations
 * />
 * ```
 */
export function ErrorBudgetBurndown({
  serviceId,
  serviceName,
  filters,
  showSummary = true,
  showChart = true,
  showRecommendations = true,
  defaultPeriod = "30d",
  chartHeight = 300,
  className,
}: ErrorBudgetBurndownProps) {
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

  const { data, isLoading, error, mutate } = useErrorBudgets(
    serviceId
      ? {
          service_id: serviceId,
          period,
        }
      : null
  )

  const errorBudget = data?.error_budget
  const burnRateHistory = data?.burn_rate_history || []
  const recommendations = data?.recommendations || []

  const remainingPct = errorBudget ? computeRemainingPct(errorBudget) : null
  const consumedPct = errorBudget ? computeConsumedPct(errorBudget) : null
  const healthStatus = remainingPct !== null ? budgetToHealthStatus(remainingPct) : "unknown"

  const chartData = React.useMemo(() => {
    if (!errorBudget) return []
    return buildChartData(burnRateHistory, errorBudget)
  }, [burnRateHistory, errorBudget])

  const handlePeriodChange = React.useCallback((value: string) => {
    setPeriod(value as TimePeriod)
  }, [])

  const handleDrillDown = React.useCallback(() => {
    router.push(ROUTES.DASHBOARD_ERROR_BUDGET)
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
              Error Budget Burn-down
            </CardTitle>
            <CardDescription>
              Failed to load error budget data.
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
        {showChart && <ChartSkeleton height={chartHeight} showHeader showLegend />}
      </div>
    )
  }

  // No service ID provided
  if (!serviceId) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <PieChart className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No service selected
          </p>
          <p className="text-2xs text-muted-foreground mt-1">
            Select a service to view its error budget burn-down.
          </p>
        </CardContent>
      </Card>
    )
  }

  // No data available
  if (!errorBudget) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Error Budget Burn-down
            </CardTitle>
            <CardDescription>
              {serviceName || serviceId}
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
          <PieChart className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No error budget data available
          </p>
          <p className="text-2xs text-muted-foreground mt-1">
            Error budget data has not been computed for this service yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  const TrendIcon = TREND_ICON_MAP[errorBudget.trend] || Minus
  const trendColor =
    errorBudget.trend === "up"
      ? "text-green-600 dark:text-green-400"
      : errorBudget.trend === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground"

  const currentBurnRate = errorBudget.burn_rate || 0
  const burnRateColor = getBurnRateColor(currentBurnRate)

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary Metric Cards */}
      {showSummary && (
        <MetricCardGrid columns={4}>
          {/* Remaining Budget */}
          <MetricCard
            label="Budget Remaining"
            value={remainingPct}
            format="percentage"
            decimals={1}
            trend={errorBudget.trend}
            trendUpIsGood={true}
            threshold={20}
            thresholdExceededIsBad={false}
            icon={<PieChart className="h-4 w-4" />}
            description="Percentage of error budget remaining for the current period"
            onClick={handleDrillDown}
          />

          {/* Consumed Budget */}
          <MetricCard
            label="Budget Consumed"
            value={consumedPct}
            format="percentage"
            decimals={1}
            trendUpIsGood={false}
            threshold={80}
            thresholdExceededIsBad={true}
            icon={
              <span className="text-muted-foreground text-xs font-medium">
                %
              </span>
            }
            description="Percentage of error budget consumed in the current period"
          />

          {/* Burn Rate */}
          <MetricCard
            label="Burn Rate"
            value={currentBurnRate}
            format="raw"
            decimals={2}
            unit="x"
            trendUpIsGood={false}
            threshold={BREACH_THRESHOLD_BURN_RATE}
            thresholdExceededIsBad={true}
            icon={<TrendingDown className="h-4 w-4" />}
            description={`Current burn rate. Warning at ${WARNING_THRESHOLD_BURN_RATE}x, critical at ${BREACH_THRESHOLD_BURN_RATE}x`}
          />

          {/* Breach Status */}
          <MetricCard
            label="SLO Target"
            value={errorBudget.slo_target}
            format="percentage"
            decimals={2}
            icon={
              <span className="text-muted-foreground text-xs font-medium">
                SLO
              </span>
            }
            description="The SLO availability target for this service"
            onClick={handleServiceClick}
          />
        </MetricCardGrid>
      )}

      {/* Burn Rate Chart */}
      {showChart && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">
                Error Budget Burn-down
              </CardTitle>
              <CardDescription>
                <span className="flex items-center gap-2">
                  <span>
                    {serviceName || errorBudget.service_name || serviceId}
                  </span>
                  <span>·</span>
                  <span>Period: {errorBudget.period}</span>
                  {errorBudget.breach && (
                    <Badge variant="destructive" className="text-2xs">
                      Budget Breached
                    </Badge>
                  )}
                  {!errorBudget.breach && healthStatus === "degraded" && (
                    <Badge variant="warning" className="text-2xs">
                      At Risk
                    </Badge>
                  )}
                  {!errorBudget.breach && healthStatus === "healthy" && (
                    <Badge variant="success" className="text-2xs">
                      Healthy
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
                    <div
                      className={cn(
                        "flex items-center gap-1 rounded-md border px-2 py-1",
                        trendColor
                      )}
                    >
                      <TrendIcon className="h-3.5 w-3.5" />
                      <span className="text-2xs font-medium">
                        {errorBudget.trend === "up"
                          ? "Improving"
                          : errorBudget.trend === "down"
                            ? "Declining"
                            : "Stable"}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4}>
                    <p className="text-xs">
                      Error budget trend over the selected period
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
                {/* Budget Summary Bar */}
                <BudgetProgressBar
                  remainingPct={remainingPct || 0}
                  consumedPct={consumedPct || 0}
                  breach={errorBudget.breach}
                />

                {/* Burn Rate Chart */}
                <div className="mt-4" style={{ height: chartHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="budgetRemainingGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={CHART_DEFAULTS.COLORS[0]}
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="95%"
                            stopColor={CHART_DEFAULTS.COLORS[0]}
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="burnRateGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#f59e0b"
                            stopOpacity={0.15}
                          />
                          <stop
                            offset="95%"
                            stopColor="#f59e0b"
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
                        yAxisId="left"
                        tick={{ fontSize: 10 }}
                        className="text-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 100]}
                        tickFormatter={(value: number) => `${value}%`}
                        label={{
                          value: "Budget Remaining %",
                          angle: -90,
                          position: "insideLeft",
                          style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
                        }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 10 }}
                        className="text-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                        domain={[0, "auto"]}
                        tickFormatter={(value: number) => `${value}x`}
                        label={{
                          value: "Burn Rate",
                          angle: 90,
                          position: "insideRight",
                          style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
                        }}
                      />
                      <RechartsTooltip
                        content={<BurndownTooltip />}
                        cursor={{ strokeDasharray: "3 3" }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="line"
                        wrapperStyle={{ fontSize: 11 }}
                      />

                      {/* Breach threshold reference line */}
                      <ReferenceLine
                        yAxisId="right"
                        y={BREACH_THRESHOLD_BURN_RATE}
                        stroke="#ef4444"
                        strokeDasharray="6 3"
                        strokeWidth={1.5}
                        label={{
                          value: `Critical (${BREACH_THRESHOLD_BURN_RATE}x)`,
                          position: "right",
                          style: { fontSize: 9, fill: "#ef4444" },
                        }}
                      />

                      {/* Warning threshold reference line */}
                      <ReferenceLine
                        yAxisId="right"
                        y={WARNING_THRESHOLD_BURN_RATE}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        strokeWidth={1}
                        label={{
                          value: `Warning (${WARNING_THRESHOLD_BURN_RATE}x)`,
                          position: "right",
                          style: { fontSize: 9, fill: "#f59e0b" },
                        }}
                      />

                      {/* Budget Remaining Area */}
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="budget_remaining_pct"
                        name="Budget Remaining %"
                        stroke={CHART_DEFAULTS.COLORS[0]}
                        strokeWidth={2}
                        fill="url(#budgetRemainingGradient)"
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 2 }}
                      />

                      {/* Burn Rate Line */}
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="burn_rate"
                        name="Burn Rate"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        fill="url(#burnRateGradient)"
                        dot={false}
                        activeDot={{ r: 3, strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Projected Breach Date */}
                {errorBudget.projected_breach_date && !errorBudget.breach && (
                  <div className="mt-3 flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                    <p className="text-2xs text-yellow-700 dark:text-yellow-400">
                      Projected breach date:{" "}
                      <span className="font-medium">
                        {formatDate(errorBudget.projected_breach_date)}
                      </span>{" "}
                      ({formatRelativeTime(errorBudget.projected_breach_date)})
                    </p>
                  </div>
                )}

                {/* Breach Alert */}
                {errorBudget.breach && (
                  <div className="mt-3 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                    <p className="text-2xs text-red-700 dark:text-red-400 font-medium">
                      Error budget has been exhausted. Non-critical deployments
                      should be frozen until the budget recovers.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">
                  No burn rate history available for the selected period.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {showRecommendations && recommendations.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">
                Recommendations
              </CardTitle>
              <CardDescription>
                Actions based on current error budget status
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={handleDrillDown}
            >
              View All
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {recommendations.map((recommendation, index) => (
                <RecommendationItem
                  key={index}
                  index={index + 1}
                  text={recommendation}
                  isCritical={
                    errorBudget.breach ||
                    recommendation.toLowerCase().includes("critical") ||
                    recommendation.toLowerCase().includes("immediate")
                  }
                  isWarning={
                    recommendation.toLowerCase().includes("warning") ||
                    recommendation.toLowerCase().includes("monitor") ||
                    recommendation.toLowerCase().includes("80%")
                  }
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
// BudgetProgressBar Component
// ============================================================

interface BudgetProgressBarProps {
  remainingPct: number
  consumedPct: number
  breach: boolean
}

/**
 * Visual progress bar showing budget consumption with color-coded segments.
 */
function BudgetProgressBar({
  remainingPct,
  consumedPct,
  breach,
}: BudgetProgressBarProps) {
  const barColor = breach
    ? "bg-red-500"
    : consumedPct > 80
      ? "bg-yellow-500"
      : "bg-green-500"

  const remainingColor = breach
    ? "text-red-600 dark:text-red-400"
    : consumedPct > 80
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-green-600 dark:text-green-400"

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-2xs text-muted-foreground">
          Budget Consumption
        </span>
        <div className="flex items-center gap-3">
          <span className="text-2xs text-muted-foreground">
            Consumed:{" "}
            <span className="font-medium text-foreground">
              {consumedPct.toFixed(1)}%
            </span>
          </span>
          <span className={cn("text-2xs font-medium", remainingColor)}>
            Remaining: {remainingPct.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
            barColor
          )}
          style={{ width: `${Math.min(consumedPct, 100)}%` }}
        />
        {/* Threshold markers */}
        <div
          className="absolute inset-y-0 w-px bg-yellow-600/50"
          style={{ left: "80%" }}
        />
        <div
          className="absolute inset-y-0 w-px bg-red-600/50"
          style={{ left: "100%" }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-2xs text-muted-foreground">0%</span>
        <span className="text-2xs text-yellow-600 dark:text-yellow-400">
          80%
        </span>
        <span className="text-2xs text-red-600 dark:text-red-400">100%</span>
      </div>
    </div>
  )
}

// ============================================================
// BurndownTooltip Component
// ============================================================

interface BurndownTooltipProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number
    color: string
    dataKey: string
  }>
  label?: string
}

/**
 * Custom tooltip for the burn-down chart.
 */
function BurndownTooltip({ active, payload, label }: BurndownTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md">
      <p className="text-2xs font-medium text-foreground mb-1">{label}</p>
      <div className="space-y-0.5">
        {payload.map((entry, index) => {
          const isPercentage = entry.dataKey === "budget_remaining_pct"
          const formattedValue = isPercentage
            ? `${entry.value.toFixed(1)}%`
            : `${entry.value.toFixed(2)}x`

          const valueColor =
            entry.dataKey === "burn_rate"
              ? getBurnRateColor(entry.value)
              : entry.value <= 20
                ? "#ef4444"
                : entry.value <= 50
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
// RecommendationItem Component
// ============================================================

interface RecommendationItemProps {
  index: number
  text: string
  isCritical?: boolean
  isWarning?: boolean
}

/**
 * Individual recommendation item with severity-based styling.
 */
function RecommendationItem({
  index,
  text,
  isCritical = false,
  isWarning = false,
}: RecommendationItemProps) {
  const borderClass = isCritical
    ? "border-red-500/20"
    : isWarning
      ? "border-yellow-500/20"
      : "border-border"

  const bgClass = isCritical
    ? "bg-red-500/5"
    : isWarning
      ? "bg-yellow-500/5"
      : "bg-transparent"

  const indexBgClass = isCritical
    ? "bg-red-500/10 text-red-700 dark:text-red-400"
    : isWarning
      ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
      : "bg-muted text-muted-foreground"

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
      <p className="text-2xs text-muted-foreground leading-relaxed">{text}</p>
    </div>
  )
}

// ============================================================
// Wrapped Export with Error Boundary
// ============================================================

export interface ErrorBudgetBurndownWithBoundaryProps
  extends ErrorBudgetBurndownProps {}

/**
 * ErrorBudgetBurndown wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function ErrorBudgetBurndownWithBoundary(
  props: ErrorBudgetBurndownWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Error Budget Burn-down">
      <ErrorBudgetBurndown {...props} />
    </ModuleErrorBoundary>
  )
}

export default ErrorBudgetBurndown