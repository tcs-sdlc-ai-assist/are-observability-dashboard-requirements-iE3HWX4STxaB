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
} from "lucide-react"
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip as RechartsTooltip,
} from "recharts"

import { cn } from "@/lib/utils"
import { useIncidentAnalytics } from "@/hooks/use-dashboard-data"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { MetricCard, MetricCardGrid } from "@/components/shared/metric-card"
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
  IncidentAnalytics,
  RootCauseCategory,
  TimePeriod,
  TrendDirection,
} from "@/types"

// ============================================================
// Types
// ============================================================

export interface RCABreakdownProps {
  /** Dashboard-level filters to apply */
  filters?: DashboardFilters
  /** Whether to show the summary metric cards (default: true) */
  showSummary?: boolean
  /** Whether to show the donut chart (default: true) */
  showChart?: boolean
  /** Whether to show the repeat failure section (default: true) */
  showRepeatFailures?: boolean
  /** Whether to show the category detail list (default: true) */
  showCategoryList?: boolean
  /** Default time period (default: "30d") */
  defaultPeriod?: TimePeriod
  /** Chart height in pixels (default: 300) */
  chartHeight?: number
  /** Optional criticality tier for threshold display */
  tier?: CriticalityTier
  /** Additional CSS class names */
  className?: string
}

interface RCACategoryData {
  category: RootCauseCategory
  count: number
  percentage: number
  color: string
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

// ============================================================
// Helpers
// ============================================================

/**
 * Builds the donut chart data from root cause analytics.
 */
function buildChartData(
  rootCauses: Array<{ category: RootCauseCategory; count: number }>
): RCACategoryData[] {
  if (!rootCauses || rootCauses.length === 0) return []

  const total = rootCauses.reduce((sum, rc) => sum + rc.count, 0)

  return rootCauses
    .map((rc) => ({
      category: rc.category,
      count: rc.count,
      percentage:
        total > 0 ? Math.round((rc.count / total) * 10000) / 100 : 0,
      color: ROOT_CAUSE_COLORS[rc.category] || "#6b7280",
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Computes the dominant root cause category.
 */
function getDominantCategory(
  data: RCACategoryData[]
): RCACategoryData | null {
  if (data.length === 0) return null
  return data[0]
}

/**
 * Computes the number of unique root cause categories.
 */
function getUniqueCategoryCount(
  data: RCACategoryData[]
): number {
  return data.length
}

/**
 * Computes the concentration ratio — percentage of incidents
 * attributed to the top category.
 */
function getConcentrationRatio(
  data: RCACategoryData[]
): number | null {
  if (data.length === 0) return null
  return data[0].percentage
}

// ============================================================
// RCABreakdown Component
// ============================================================

/**
 * Root Cause Analysis breakdown component with donut chart showing
 * distribution by category (Code, Infrastructure, Config, Dependency,
 * Capacity, Network, Security, Unknown) and repeated failure signal
 * highlighting. Includes summary metric cards with dominant category,
 * unique categories, concentration ratio, and repeat failure count.
 *
 * Supports drill-down navigation to the incidents dashboard.
 *
 * @example
 * ```tsx
 * <RCABreakdown
 *   filters={{ domain: "payments", period: "30d" }}
 *   showSummary
 *   showChart
 *   showRepeatFailures
 *   showCategoryList
 * />
 * ```
 */
export function RCABreakdown({
  filters,
  showSummary = true,
  showChart = true,
  showRepeatFailures = true,
  showCategoryList = true,
  defaultPeriod = "30d",
  chartHeight = 300,
  tier,
  className,
}: RCABreakdownProps) {
  const router = useRouter()

  const [period, setPeriod] = React.useState<TimePeriod>(
    filters?.period || defaultPeriod
  )
  const [activeIndex, setActiveIndex] = React.useState<number | undefined>(
    undefined
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

  const rootCauses = data?.root_causes || []
  const repeatFailures = data?.repeat_failures || []
  const incidentCounts = data?.incident_counts || {
    critical: 0,
    major: 0,
    minor: 0,
    warning: 0,
    total: 0,
  }
  const trend = data?.trend || "stable"

  const chartData = React.useMemo(
    () => buildChartData(rootCauses),
    [rootCauses]
  )

  const dominantCategory = React.useMemo(
    () => getDominantCategory(chartData),
    [chartData]
  )

  const uniqueCategoryCount = React.useMemo(
    () => getUniqueCategoryCount(chartData),
    [chartData]
  )

  const concentrationRatio = React.useMemo(
    () => getConcentrationRatio(chartData),
    [chartData]
  )

  const totalRootCauseCount = React.useMemo(
    () => rootCauses.reduce((sum, rc) => sum + rc.count, 0),
    [rootCauses]
  )

  const handlePeriodChange = React.useCallback((value: string) => {
    setPeriod(value as TimePeriod)
  }, [])

  const handleDrillDown = React.useCallback(() => {
    router.push(ROUTES.DASHBOARD_INCIDENTS)
  }, [router])

  const handlePieEnter = React.useCallback(
    (_: unknown, index: number) => {
      setActiveIndex(index)
    },
    []
  )

  const handlePieLeave = React.useCallback(() => {
    setActiveIndex(undefined)
  }, [])

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
              Root Cause Analysis
            </CardTitle>
            <CardDescription>
              Failed to load root cause data.
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
  if (!data || incidentCounts.total === 0) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Root Cause Analysis
            </CardTitle>
            <CardDescription>
              Distribution by root cause category
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
          <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No root cause data available
          </p>
          <p className="text-2xs text-muted-foreground mt-1">
            No incidents were recorded in the selected period.
          </p>
        </CardContent>
      </Card>
    )
  }

  // No root causes identified but incidents exist
  const hasRootCauses = rootCauses.length > 0

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary Metric Cards */}
      {showSummary && (
        <MetricCardGrid columns={4}>
          {/* Total Incidents with Root Cause */}
          <MetricCard
            label="Incidents Analyzed"
            value={totalRootCauseCount}
            format="number"
            decimals={0}
            trend={trend}
            trendUpIsGood={false}
            icon={<AlertTriangle className="h-4 w-4" />}
            description="Total incidents with identified root causes in the selected period"
            onClick={handleDrillDown}
          />

          {/* Dominant Category */}
          <MetricCard
            label="Dominant Category"
            value={dominantCategory ? dominantCategory.count : null}
            format="number"
            decimals={0}
            unit={
              dominantCategory
                ? `(${dominantCategory.category})`
                : undefined
            }
            trendUpIsGood={false}
            icon={
              <span
                className="inline-block h-3 w-3 rounded-full shrink-0"
                style={{
                  backgroundColor: dominantCategory?.color || "#6b7280",
                }}
              />
            }
            description={
              dominantCategory
                ? `${ROOT_CAUSE_LABELS[dominantCategory.category]} is the most common root cause (${dominantCategory.percentage.toFixed(1)}%)`
                : "No dominant root cause identified"
            }
            onClick={handleDrillDown}
          />

          {/* Unique Categories */}
          <MetricCard
            label="Unique Categories"
            value={uniqueCategoryCount}
            format="number"
            decimals={0}
            icon={
              <span className="text-muted-foreground text-xs font-medium">
                #
              </span>
            }
            description="Number of distinct root cause categories identified"
          />

          {/* Repeat Failures */}
          <MetricCard
            label="Repeat Failures"
            value={repeatFailures.length}
            format="number"
            decimals={0}
            trendUpIsGood={false}
            threshold={0}
            thresholdExceededIsBad={true}
            icon={
              <span className="text-red-600 dark:text-red-400 text-xs font-bold">
                !
              </span>
            }
            description="Number of repeat failure patterns detected. Repeat failures indicate systemic issues requiring corrective action."
            onClick={
              repeatFailures.length > 0 ? handleDrillDown : undefined
            }
          />
        </MetricCardGrid>
      )}

      {/* Donut Chart & Category List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Root Cause Distribution
            </CardTitle>
            <CardDescription>
              <span className="flex items-center gap-2">
                <span>
                  {totalRootCauseCount} incident{totalRootCauseCount !== 1 ? "s" : ""} across{" "}
                  {uniqueCategoryCount} categor{uniqueCategoryCount !== 1 ? "ies" : "y"}
                </span>
                {concentrationRatio !== null && concentrationRatio > 50 && (
                  <Badge variant="warning" className="text-2xs">
                    High Concentration ({concentrationRatio.toFixed(1)}%)
                  </Badge>
                )}
                {repeatFailures.length > 0 && (
                  <Badge variant="destructive" className="text-2xs">
                    {repeatFailures.length} Repeat Pattern{repeatFailures.length !== 1 ? "s" : ""}
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
          {hasRootCauses ? (
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Donut Chart */}
              {showChart && (
                <div
                  className="flex-1 min-w-0"
                  style={{ height: chartHeight }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={2}
                        dataKey="count"
                        nameKey="category"
                        activeIndex={activeIndex}
                        activeShape={renderActiveShape}
                        onMouseEnter={handlePieEnter}
                        onMouseLeave={handlePieLeave}
                      >
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            stroke="hsl(var(--background))"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        content={<RCATooltip totalCount={totalRootCauseCount} />}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        wrapperStyle={{ fontSize: 11 }}
                        formatter={(value: string) =>
                          ROOT_CAUSE_LABELS[value as RootCauseCategory] || value
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Category Detail List */}
              {showCategoryList && (
                <div className="flex-1 min-w-0 space-y-2">
                  <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Category Breakdown
                  </span>
                  <div className="space-y-1.5">
                    {chartData.map((entry) => (
                      <RCACategoryRow
                        key={entry.category}
                        data={entry}
                        totalCount={totalRootCauseCount}
                        isRepeatFailure={repeatFailures.includes(
                          entry.category
                        )}
                      />
                    ))}
                  </div>

                  {/* Concentration Warning */}
                  {concentrationRatio !== null &&
                    concentrationRatio > 50 &&
                    dominantCategory && (
                      <div className="mt-3 flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                        <p className="text-2xs text-yellow-700 dark:text-yellow-400">
                          <span className="font-medium">
                            {ROOT_CAUSE_LABELS[dominantCategory.category]}
                          </span>{" "}
                          accounts for{" "}
                          <span className="font-medium">
                            {concentrationRatio.toFixed(1)}%
                          </span>{" "}
                          of all root causes. Consider targeted remediation for
                          this category.
                        </p>
                      </div>
                    )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-muted-foreground">
                No root causes identified
              </p>
              <p className="text-2xs text-muted-foreground mt-1">
                {incidentCounts.total} incident{incidentCounts.total !== 1 ? "s" : ""} recorded
                but no root causes have been categorized yet.
              </p>
            </div>
          )}

          {/* Repeat Failures Section */}
          {showRepeatFailures && repeatFailures.length > 0 && (
            <div className="space-y-2">
              <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                Repeat Failure Patterns
              </span>
              <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-2xs text-red-700 dark:text-red-400 font-medium">
                    {repeatFailures.length} repeat failure pattern
                    {repeatFailures.length !== 1 ? "s" : ""} identified
                  </p>
                  <p className="text-2xs text-red-600/80 dark:text-red-400/80 mt-0.5">
                    These root causes have recurred across multiple incidents,
                    indicating systemic issues that require corrective action.
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {repeatFailures.map((failure, index) => {
                      const color =
                        ROOT_CAUSE_COLORS[failure as RootCauseCategory] ||
                        "#6b7280"
                      return (
                        <TooltipProvider key={index} delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="destructive"
                                className="text-2xs gap-1"
                              >
                                <span
                                  className="inline-block h-2 w-2 rounded-full shrink-0"
                                  style={{ backgroundColor: color }}
                                />
                                {failure}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              sideOffset={4}
                              className="max-w-xs"
                            >
                              <p className="text-xs">
                                {ROOT_CAUSE_LABELS[failure as RootCauseCategory] ||
                                  failure}{" "}
                                has been identified as a repeat failure pattern.
                                Conduct a focused review to address systemic
                                issues.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {showRepeatFailures &&
            repeatFailures.length === 0 &&
            incidentCounts.total > 0 && (
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

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              <span className="text-2xs text-muted-foreground">
                {totalRootCauseCount} root cause{totalRootCauseCount !== 1 ? "s" : ""} identified
              </span>
              {repeatFailures.length > 0 && (
                <Badge variant="destructive" className="text-2xs">
                  {repeatFailures.length} repeat
                </Badge>
              )}
              {concentrationRatio !== null && concentrationRatio > 50 && (
                <Badge variant="warning" className="text-2xs">
                  Concentrated
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
// Active Shape Renderer for Donut Chart
// ============================================================

/**
 * Renders the active (hovered) sector of the donut chart with
 * an expanded outer radius and label.
 */
function renderActiveShape(props: {
  cx: number
  cy: number
  midAngle: number
  innerRadius: number
  outerRadius: number
  startAngle: number
  endAngle: number
  fill: string
  payload: RCACategoryData
  percent: number
  value: number
}) {
  const RADIAN = Math.PI / 180
  const {
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
    value,
  } = props

  const sin = Math.sin(-RADIAN * midAngle)
  const cos = Math.cos(-RADIAN * midAngle)
  const sx = cx + (outerRadius + 6) * cos
  const sy = cy + (outerRadius + 6) * sin
  const mx = cx + (outerRadius + 16) * cos
  const my = cy + (outerRadius + 16) * sin
  const ex = mx + (cos >= 0 ? 1 : -1) * 16
  const ey = my
  const textAnchor = cos >= 0 ? "start" : "end"

  return (
    <g>
      {/* Center label */}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fill="hsl(var(--foreground))"
        fontSize={12}
        fontWeight={600}
      >
        {payload.category}
      </text>
      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        fill="hsl(var(--muted-foreground))"
        fontSize={10}
      >
        {value} ({(percent * 100).toFixed(1)}%)
      </text>

      {/* Active sector */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 8}
        outerRadius={outerRadius + 10}
        fill={fill}
      />
    </g>
  )
}

// ============================================================
// RCACategoryRow Component
// ============================================================

interface RCACategoryRowProps {
  data: RCACategoryData
  totalCount: number
  isRepeatFailure: boolean
}

/**
 * Individual root cause category row showing category name, count,
 * percentage bar, and repeat failure indicator.
 */
function RCACategoryRow({
  data,
  totalCount,
  isRepeatFailure,
}: RCACategoryRowProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-3 rounded-md border px-3 py-2 transition-colors hover:bg-accent/50",
              isRepeatFailure && "border-red-500/20 bg-red-500/5"
            )}
          >
            {/* Color indicator */}
            <div
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: data.color }}
            />

            {/* Category name */}
            <span className="text-2xs text-muted-foreground w-28 shrink-0 truncate">
              {ROOT_CAUSE_LABELS[data.category]}
            </span>

            {/* Progress bar */}
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(data.percentage, 100)}%`,
                  backgroundColor: data.color,
                }}
              />
            </div>

            {/* Count */}
            <span className="text-2xs font-medium shrink-0 w-8 text-right">
              {data.count}
            </span>

            {/* Percentage */}
            <span className="text-2xs text-muted-foreground shrink-0 w-14 text-right">
              {data.percentage.toFixed(1)}%
            </span>

            {/* Repeat failure indicator */}
            {isRepeatFailure && (
              <Badge variant="destructive" className="text-2xs h-3.5 px-1 shrink-0">
                Repeat
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4} className="max-w-xs">
          <div className="space-y-1">
            <p className="text-xs font-medium">
              {ROOT_CAUSE_LABELS[data.category]}
            </p>
            <p className="text-2xs text-muted-foreground">
              {data.count} of {totalCount} incident{totalCount !== 1 ? "s" : ""} (
              {data.percentage.toFixed(1)}%)
            </p>
            {isRepeatFailure && (
              <p className="text-2xs text-red-600 dark:text-red-400">
                This category has been identified as a repeat failure pattern.
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================
// RCATooltip Component
// ============================================================

interface RCATooltipProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number
    payload: RCACategoryData
  }>
  totalCount: number
}

/**
 * Custom tooltip for the donut chart.
 */
function RCATooltip({ active, payload, totalCount }: RCATooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const entry = payload[0]
  const data = entry.payload

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md">
      <div className="flex items-center gap-2 mb-1">
        <div
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: data.color }}
        />
        <p className="text-2xs font-medium text-foreground">
          {ROOT_CAUSE_LABELS[data.category]}
        </p>
      </div>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-2xs text-muted-foreground">Count:</span>
          <span className="text-2xs font-medium text-foreground">
            {data.count}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xs text-muted-foreground">Percentage:</span>
          <span className="text-2xs font-medium text-foreground">
            {data.percentage.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xs text-muted-foreground">Total:</span>
          <span className="text-2xs text-muted-foreground">
            {data.count} of {totalCount}
          </span>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Wrapped Export with Error Boundary
// ============================================================

export interface RCABreakdownWithBoundaryProps extends RCABreakdownProps {}

/**
 * RCABreakdown wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function RCABreakdownWithBoundary(
  props: RCABreakdownWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Root Cause Analysis">
      <RCABreakdown {...props} />
    </ModuleErrorBoundary>
  )
}

export default RCABreakdown