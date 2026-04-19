"use client"

import * as React from "react"
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  formatPercentage,
  formatDuration,
  formatNumber,
  formatCompactNumber,
  formatRelativeTime,
} from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { TrendDirection } from "@/types"

// ============================================================
// Types
// ============================================================

export type MetricFormat =
  | "percentage"
  | "duration"
  | "number"
  | "compact"
  | "raw"

export interface SparklinePoint {
  value: number
  timestamp?: string
}

export interface MetricCardProps {
  /** The display label for the metric */
  label: string
  /** The primary metric value */
  value: number | null | undefined
  /** How to format the value for display */
  format?: MetricFormat
  /** Number of decimal places for percentage/number formats */
  decimals?: number
  /** Unit suffix to display after the value (e.g., "ms", "rps") */
  unit?: string
  /** Trend direction indicator */
  trend?: TrendDirection
  /** Percentage change from previous period */
  changePercent?: number | null
  /** Whether an upward trend is positive (green) or negative (red) */
  trendUpIsGood?: boolean
  /** Optional sparkline data points */
  sparkline?: SparklinePoint[]
  /** Optional threshold value for visual breach indication */
  threshold?: number
  /** Whether the value exceeding the threshold is bad (default: true for most metrics) */
  thresholdExceededIsBad?: boolean
  /** Optional icon to display in the card header */
  icon?: React.ReactNode
  /** Optional description shown in a tooltip */
  description?: string
  /** Last updated timestamp */
  lastUpdated?: string
  /** Whether the card is in a loading state */
  isLoading?: boolean
  /** Additional CSS class names */
  className?: string
  /** Click handler for the card */
  onClick?: () => void
}

// ============================================================
// Constants
// ============================================================

const SPARKLINE_HEIGHT = 32
const SPARKLINE_WIDTH = 80

// ============================================================
// Helpers
// ============================================================

/**
 * Formats the metric value based on the specified format type.
 */
function formatValue(
  value: number | null | undefined,
  format: MetricFormat,
  decimals: number,
  unit?: string
): string {
  if (value === null || value === undefined || isNaN(value)) return "—"

  let formatted: string

  switch (format) {
    case "percentage":
      formatted = formatPercentage(value, decimals)
      break
    case "duration":
      formatted = formatDuration(value)
      break
    case "number":
      formatted = formatNumber(value, decimals)
      break
    case "compact":
      formatted = formatCompactNumber(value)
      break
    case "raw":
    default:
      formatted = decimals > 0 ? value.toFixed(decimals) : String(value)
      break
  }

  if (unit && format !== "percentage" && format !== "duration") {
    formatted = `${formatted} ${unit}`
  }

  return formatted
}

/**
 * Determines the color scheme for the trend indicator based on direction
 * and whether an upward trend is considered positive.
 */
function getTrendColor(
  trend: TrendDirection,
  trendUpIsGood: boolean
): string {
  if (trend === "stable") {
    return "text-muted-foreground"
  }

  if (trend === "up") {
    return trendUpIsGood
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400"
  }

  // trend === "down"
  return trendUpIsGood
    ? "text-red-600 dark:text-red-400"
    : "text-green-600 dark:text-green-400"
}

/**
 * Returns the appropriate trend icon component.
 */
function getTrendIcon(trend: TrendDirection): React.ElementType {
  switch (trend) {
    case "up":
      return ArrowUp
    case "down":
      return ArrowDown
    case "stable":
    default:
      return ArrowRight
  }
}

/**
 * Returns the badge variant for the change percentage.
 */
function getChangeBadgeVariant(
  changePercent: number,
  trendUpIsGood: boolean
): "success" | "destructive" | "secondary" {
  if (Math.abs(changePercent) < 0.5) return "secondary"

  if (changePercent > 0) {
    return trendUpIsGood ? "success" : "destructive"
  }

  return trendUpIsGood ? "destructive" : "success"
}

/**
 * Determines if the threshold is breached.
 */
function isThresholdBreached(
  value: number | null | undefined,
  threshold: number | undefined,
  thresholdExceededIsBad: boolean
): boolean {
  if (
    value === null ||
    value === undefined ||
    threshold === undefined ||
    isNaN(value)
  ) {
    return false
  }

  return thresholdExceededIsBad ? value > threshold : value < threshold
}

// ============================================================
// Sparkline Component
// ============================================================

interface SparklineProps {
  data: SparklinePoint[]
  width?: number
  height?: number
  color?: string
  className?: string
}

/**
 * Minimal SVG sparkline for inline trend visualization.
 */
function Sparkline({
  data,
  width = SPARKLINE_WIDTH,
  height = SPARKLINE_HEIGHT,
  color = "currentColor",
  className,
}: SparklineProps) {
  if (!data || data.length < 2) return null

  const values = data.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const padding = 2
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2

  const points = values
    .map((val, i) => {
      const x = padding + (i / (values.length - 1)) * chartWidth
      const y = padding + chartHeight - ((val - min) / range) * chartHeight
      return `${x},${y}`
    })
    .join(" ")

  // Build the fill area path
  const firstX = padding
  const lastX = padding + chartWidth
  const bottomY = height - padding
  const fillPoints = `${firstX},${bottomY} ${points} ${lastX},${bottomY}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* Fill area */}
      <polygon
        points={fillPoints}
        fill={color}
        fillOpacity={0.1}
      />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      {values.length > 0 && (
        <circle
          cx={padding + chartWidth}
          cy={
            padding +
            chartHeight -
            ((values[values.length - 1] - min) / range) * chartHeight
          }
          r={2}
          fill={color}
        />
      )}
    </svg>
  )
}

// ============================================================
// MetricCard Component
// ============================================================

/**
 * Reusable KPI metric display card with trend indicator, optional sparkline,
 * threshold breach indication, and change percentage badge.
 *
 * Used across all dashboard modules for displaying availability %,
 * MTTR, MTTD, error rates, traffic RPS, saturation metrics, etc.
 *
 * @example
 * ```tsx
 * <MetricCard
 *   label="Availability"
 *   value={99.95}
 *   format="percentage"
 *   trend="up"
 *   trendUpIsGood={true}
 *   changePercent={0.02}
 *   threshold={99.9}
 *   thresholdExceededIsBad={false}
 *   sparkline={availabilityHistory}
 *   icon={<Activity className="h-4 w-4" />}
 *   description="Overall service availability over the selected period"
 * />
 *
 * <MetricCard
 *   label="MTTR"
 *   value={42}
 *   format="duration"
 *   trend="down"
 *   trendUpIsGood={false}
 *   changePercent={-15.3}
 *   icon={<Clock className="h-4 w-4" />}
 * />
 *
 * <MetricCard
 *   label="Error Rate (5xx)"
 *   value={0.03}
 *   format="percentage"
 *   decimals={3}
 *   trend="up"
 *   trendUpIsGood={false}
 *   threshold={0.05}
 *   thresholdExceededIsBad={true}
 * />
 * ```
 */
export function MetricCard({
  label,
  value,
  format = "raw",
  decimals = 2,
  unit,
  trend,
  changePercent,
  trendUpIsGood = true,
  sparkline,
  threshold,
  thresholdExceededIsBad = true,
  icon,
  description,
  lastUpdated,
  isLoading = false,
  className,
  onClick,
}: MetricCardProps) {
  const breached = isThresholdBreached(value, threshold, thresholdExceededIsBad)

  const trendColor = trend
    ? getTrendColor(trend, trendUpIsGood)
    : "text-muted-foreground"

  const TrendIcon = trend ? getTrendIcon(trend) : null

  const sparklineColor = breached
    ? "#ef4444"
    : trend === "up"
      ? trendUpIsGood
        ? "#22c55e"
        : "#ef4444"
      : trend === "down"
        ? trendUpIsGood
          ? "#ef4444"
          : "#22c55e"
        : "#6b7280"

  const cardContent = (
    <Card
      className={cn(
        "relative overflow-hidden transition-colors",
        onClick && "cursor-pointer hover:border-primary/50",
        breached && "border-red-500/50",
        className
      )}
      onClick={onClick}
    >
      {/* Threshold breach indicator bar */}
      {breached && (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-red-500" />
      )}

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
        <div className="flex items-center gap-1.5">
          {icon && (
            <span className="text-muted-foreground shrink-0">{icon}</span>
          )}
          {description ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs font-medium text-muted-foreground truncate max-w-[160px]">
                    {label}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4} className="max-w-xs">
                  <p className="text-xs">{description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className="text-xs font-medium text-muted-foreground truncate max-w-[160px]">
              {label}
            </span>
          )}
        </div>

        {/* Sparkline */}
        {!isLoading && sparkline && sparkline.length >= 2 && (
          <Sparkline
            data={sparkline}
            color={sparklineColor}
            width={SPARKLINE_WIDTH}
            height={SPARKLINE_HEIGHT}
          />
        )}

        {isLoading && sparkline !== undefined && (
          <Skeleton className="h-8 w-20 rounded" />
        )}
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        ) : (
          <>
            {/* Primary Value */}
            <div className="flex items-end gap-2">
              <span
                className={cn(
                  "text-2xl font-bold tracking-tight leading-none",
                  breached && "text-red-600 dark:text-red-400"
                )}
              >
                {formatValue(value, format, decimals, unit)}
              </span>

              {/* Threshold badge */}
              {breached && threshold !== undefined && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="destructive"
                        className="text-2xs h-4 px-1.5 shrink-0"
                      >
                        Breach
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>
                      <p className="text-xs">
                        {thresholdExceededIsBad
                          ? `Exceeds threshold of ${threshold}`
                          : `Below threshold of ${threshold}`}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Trend & Change Row */}
            <div className="mt-1.5 flex items-center gap-2">
              {/* Trend indicator */}
              {trend && TrendIcon && (
                <div className={cn("flex items-center gap-0.5", trendColor)}>
                  <TrendIcon className="h-3.5 w-3.5" />
                  {trend !== "stable" && (
                    <span className="text-2xs font-medium">
                      {trend === "up" ? "Up" : "Down"}
                    </span>
                  )}
                  {trend === "stable" && (
                    <span className="text-2xs font-medium">Stable</span>
                  )}
                </div>
              )}

              {/* Change percentage badge */}
              {changePercent !== null &&
                changePercent !== undefined &&
                !isNaN(changePercent) && (
                  <Badge
                    variant={getChangeBadgeVariant(changePercent, trendUpIsGood)}
                    className="text-2xs h-4 px-1.5"
                  >
                    {changePercent > 0 ? "+" : ""}
                    {changePercent.toFixed(1)}%
                  </Badge>
                )}

              {/* Last updated */}
              {lastUpdated && (
                <span className="ml-auto text-2xs text-muted-foreground truncate">
                  {formatRelativeTime(lastUpdated)}
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )

  return cardContent
}

// ============================================================
// MetricCardSkeleton Component
// ============================================================

/**
 * Loading skeleton for the MetricCard component.
 * Matches the layout dimensions of a fully rendered MetricCard.
 */
export function MetricCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-20 rounded" />
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <Skeleton className="h-8 w-28 mb-2" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-12" />
          <Skeleton className="h-4 w-14 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// MetricCardGrid Component
// ============================================================

interface MetricCardGridProps {
  children: React.ReactNode
  /** Number of columns (default: responsive grid) */
  columns?: 2 | 3 | 4 | 5
  /** Additional CSS class names */
  className?: string
}

/**
 * Responsive grid layout for MetricCard components.
 * Provides consistent spacing and column configuration.
 *
 * @example
 * ```tsx
 * <MetricCardGrid columns={4}>
 *   <MetricCard label="Availability" value={99.95} format="percentage" />
 *   <MetricCard label="MTTR" value={42} format="duration" />
 *   <MetricCard label="Error Rate" value={0.03} format="percentage" />
 *   <MetricCard label="Traffic" value={12500} format="compact" unit="rps" />
 * </MetricCardGrid>
 * ```
 */
export function MetricCardGrid({
  children,
  columns,
  className,
}: MetricCardGridProps) {
  const gridCols = columns
    ? {
        2: "grid-cols-1 sm:grid-cols-2",
        3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
      }[columns]
    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"

  return (
    <div className={cn("grid gap-4", gridCols, className)}>{children}</div>
  )
}

export default MetricCard