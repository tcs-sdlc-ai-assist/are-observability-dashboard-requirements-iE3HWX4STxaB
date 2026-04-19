"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

// ============================================================
// Types
// ============================================================

export interface DashboardCardSkeletonProps {
  /** Whether to show a sparkline placeholder in the header */
  showSparkline?: boolean
  /** Whether to show a trend indicator placeholder */
  showTrend?: boolean
  /** Additional CSS class names */
  className?: string
}

export interface ChartSkeletonProps {
  /** Height of the chart area (default: 300) */
  height?: number
  /** Whether to show a header with title and controls */
  showHeader?: boolean
  /** Whether to show a legend placeholder */
  showLegend?: boolean
  /** Additional CSS class names */
  className?: string
}

export interface TableSkeletonProps {
  /** Number of rows to render (default: 5) */
  rows?: number
  /** Number of columns to render (default: 5) */
  columns?: number
  /** Whether to show a header row */
  showHeader?: boolean
  /** Additional CSS class names */
  className?: string
}

export interface FilterBarSkeletonProps {
  /** Number of filter selectors to show (default: 4) */
  filters?: number
  /** Additional CSS class names */
  className?: string
}

export interface MetricCardGridSkeletonProps {
  /** Number of cards to render (default: 4) */
  cards?: number
  /** Number of grid columns */
  columns?: 2 | 3 | 4 | 5
  /** Additional CSS class names */
  className?: string
}

export interface PageSkeletonProps {
  /** Whether to show a filter bar skeleton */
  showFilterBar?: boolean
  /** Number of metric cards to show (default: 4) */
  metricCards?: number
  /** Whether to show a chart skeleton */
  showChart?: boolean
  /** Whether to show a table skeleton */
  showTable?: boolean
  /** Additional CSS class names */
  className?: string
}

export interface SidebarSkeletonProps {
  /** Number of navigation items to render (default: 7) */
  items?: number
  /** Whether the sidebar is collapsed */
  collapsed?: boolean
  /** Additional CSS class names */
  className?: string
}

export interface DetailPageSkeletonProps {
  /** Whether to show a breadcrumb skeleton */
  showBreadcrumb?: boolean
  /** Number of detail sections to show (default: 3) */
  sections?: number
  /** Additional CSS class names */
  className?: string
}

// ============================================================
// DashboardCardSkeleton Component
// ============================================================

/**
 * Loading skeleton for a single dashboard metric card.
 * Matches the layout dimensions of a fully rendered MetricCard.
 *
 * @example
 * ```tsx
 * <DashboardCardSkeleton showSparkline showTrend />
 * ```
 */
export function DashboardCardSkeleton({
  showSparkline = true,
  showTrend = true,
  className,
}: DashboardCardSkeletonProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
        {showSparkline && <Skeleton className="h-8 w-20 rounded" />}
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <Skeleton className="h-8 w-28 mb-2" />
        {showTrend && (
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-12" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// ChartSkeleton Component
// ============================================================

/**
 * Loading skeleton for chart/visualization areas.
 * Renders a card with a header, chart area placeholder, and optional legend.
 *
 * @example
 * ```tsx
 * <ChartSkeleton height={400} showHeader showLegend />
 * ```
 */
export function ChartSkeleton({
  height = 300,
  showHeader = true,
  showLegend = false,
  className,
}: ChartSkeletonProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {showHeader && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </CardHeader>
      )}
      <CardContent className="px-4 pb-4 pt-0">
        {/* Chart area */}
        <div
          className="relative w-full rounded-md bg-muted/30"
          style={{ height }}
        >
          {/* Y-axis labels */}
          <div className="absolute left-2 top-2 flex flex-col justify-between h-[calc(100%-24px)]">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-8" />
            ))}
          </div>

          {/* Chart bars / lines placeholder */}
          <div className="absolute bottom-6 left-12 right-4 flex items-end justify-between gap-1 h-[calc(100%-48px)]">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-t"
                style={{
                  height: `${30 + Math.random() * 60}%`,
                }}
              />
            ))}
          </div>

          {/* X-axis labels */}
          <div className="absolute bottom-0 left-12 right-4 flex justify-between">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-10" />
            ))}
          </div>
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="mt-3 flex items-center justify-center gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// TableSkeleton Component
// ============================================================

/**
 * Loading skeleton for data tables.
 * Renders a card with header row and configurable data rows.
 *
 * @example
 * ```tsx
 * <TableSkeleton rows={10} columns={6} showHeader />
 * ```
 */
export function TableSkeleton({
  rows = 5,
  columns = 5,
  showHeader = true,
  className,
}: TableSkeletonProps) {
  // Vary column widths for a more realistic appearance
  const columnWidths = React.useMemo(() => {
    const widths = ["w-24", "w-32", "w-20", "w-28", "w-16", "w-36", "w-24", "w-20"]
    return Array.from({ length: columns }).map(
      (_, i) => widths[i % widths.length]
    )
  }, [columns])

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="relative w-full overflow-auto">
        <table className="w-full caption-bottom text-sm">
          {showHeader && (
            <thead className="[&_tr]:border-b">
              <tr className="border-b">
                {columnWidths.map((width, i) => (
                  <th key={i} className="h-12 px-4 text-left align-middle">
                    <Skeleton className={cn("h-4", width)} />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b transition-colors"
              >
                {columnWidths.map((width, colIndex) => (
                  <td key={colIndex} className="p-4 align-middle">
                    <Skeleton className={cn("h-4", width)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between border-t px-4 py-3">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>
    </Card>
  )
}

// ============================================================
// FilterBarSkeleton Component
// ============================================================

/**
 * Loading skeleton for the filter bar component.
 * Renders placeholder selectors and action buttons.
 *
 * @example
 * ```tsx
 * <FilterBarSkeleton filters={5} />
 * ```
 */
export function FilterBarSkeleton({
  filters = 4,
  className,
}: FilterBarSkeletonProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 shadow-dashboard",
        className
      )}
    >
      {/* Filter icon & label */}
      <div className="flex items-center gap-1.5 mr-1">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="hidden h-4 w-12 sm:block" />
      </div>

      {/* Filter selectors */}
      {Array.from({ length: filters }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-[140px] rounded-md" />
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action buttons */}
      <Skeleton className="h-8 w-8 rounded-md" />
    </div>
  )
}

// ============================================================
// MetricCardGridSkeleton Component
// ============================================================

/**
 * Loading skeleton for a grid of metric cards.
 * Renders multiple DashboardCardSkeleton components in a responsive grid.
 *
 * @example
 * ```tsx
 * <MetricCardGridSkeleton cards={4} columns={4} />
 * ```
 */
export function MetricCardGridSkeleton({
  cards = 4,
  columns,
  className,
}: MetricCardGridSkeletonProps) {
  const gridCols = columns
    ? {
        2: "grid-cols-1 sm:grid-cols-2",
        3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
      }[columns]
    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"

  return (
    <div className={cn("grid gap-4", gridCols, className)}>
      {Array.from({ length: cards }).map((_, i) => (
        <DashboardCardSkeleton key={i} />
      ))}
    </div>
  )
}

// ============================================================
// PageSkeleton Component
// ============================================================

/**
 * Full page loading skeleton that composes filter bar, metric cards,
 * chart, and table skeletons into a complete dashboard page layout.
 *
 * @example
 * ```tsx
 * <PageSkeleton showFilterBar metricCards={4} showChart showTable />
 * ```
 */
export function PageSkeleton({
  showFilterBar = true,
  metricCards = 4,
  showChart = true,
  showTable = true,
  className,
}: PageSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Page title */}
      <div className="flex flex-col gap-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Filter bar */}
      {showFilterBar && <FilterBarSkeleton />}

      {/* Metric cards */}
      {metricCards > 0 && <MetricCardGridSkeleton cards={metricCards} />}

      {/* Chart */}
      {showChart && <ChartSkeleton height={300} showHeader showLegend />}

      {/* Table */}
      {showTable && <TableSkeleton rows={5} columns={5} showHeader />}
    </div>
  )
}

// ============================================================
// SidebarNavigationSkeleton Component
// ============================================================

/**
 * Loading skeleton for sidebar navigation items.
 * Supports both expanded and collapsed states.
 *
 * @example
 * ```tsx
 * <SidebarNavigationSkeleton items={7} collapsed={false} />
 * ```
 */
export function SidebarNavigationSkeleton({
  items = 7,
  collapsed = false,
  className,
}: SidebarSkeletonProps) {
  return (
    <div className={cn("space-y-1 px-2 pt-2", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2",
            collapsed && "justify-center px-2"
          )}
        >
          <Skeleton className="h-4 w-4 shrink-0 rounded" />
          {!collapsed && <Skeleton className="h-4 w-24" />}
        </div>
      ))}
    </div>
  )
}

// ============================================================
// DetailPageSkeleton Component
// ============================================================

/**
 * Loading skeleton for entity detail pages (service detail, incident detail, etc.).
 * Renders breadcrumb, title area, and configurable content sections.
 *
 * @example
 * ```tsx
 * <DetailPageSkeleton showBreadcrumb sections={3} />
 * ```
 */
export function DetailPageSkeleton({
  showBreadcrumb = true,
  sections = 3,
  className,
}: DetailPageSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Breadcrumb */}
      {showBreadcrumb && (
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-3" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-3" />
          <Skeleton className="h-4 w-32" />
        </div>
      )}

      {/* Title & status area */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>

      {/* Summary metric cards */}
      <MetricCardGridSkeleton cards={4} columns={4} />

      {/* Content sections */}
      {Array.from({ length: sections }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-8 w-8 rounded-md" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 flex-1 max-w-xs" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================================
// InlineLoadingSkeleton Component
// ============================================================

export interface InlineLoadingSkeletonProps {
  /** Number of lines to render (default: 3) */
  lines?: number
  /** Additional CSS class names */
  className?: string
}

/**
 * Compact inline loading skeleton for use within cards or sections.
 * Renders a configurable number of text-like skeleton lines.
 *
 * @example
 * ```tsx
 * <InlineLoadingSkeleton lines={4} />
 * ```
 */
export function InlineLoadingSkeleton({
  lines = 3,
  className,
}: InlineLoadingSkeletonProps) {
  // Vary line widths for a more realistic appearance
  const lineWidths = ["w-full", "w-4/5", "w-3/5", "w-full", "w-2/3", "w-5/6"]

  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", lineWidths[i % lineWidths.length])}
        />
      ))}
    </div>
  )
}

// ============================================================
// ListItemSkeleton Component
// ============================================================

export interface ListItemSkeletonProps {
  /** Number of list items to render (default: 5) */
  items?: number
  /** Whether to show an avatar/icon placeholder */
  showAvatar?: boolean
  /** Whether to show a secondary text line */
  showSecondaryText?: boolean
  /** Whether to show a trailing action/badge */
  showTrailing?: boolean
  /** Additional CSS class names */
  className?: string
}

/**
 * Loading skeleton for list items (e.g., incident lists, service lists).
 * Supports avatar, secondary text, and trailing action placeholders.
 *
 * @example
 * ```tsx
 * <ListItemSkeleton items={5} showAvatar showSecondaryText showTrailing />
 * ```
 */
export function ListItemSkeleton({
  items = 5,
  showAvatar = false,
  showSecondaryText = true,
  showTrailing = true,
  className,
}: ListItemSkeletonProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-md border px-4 py-3"
        >
          {showAvatar && (
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          )}
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-48" />
            {showSecondaryText && <Skeleton className="h-3 w-32" />}
          </div>
          {showTrailing && (
            <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
          )}
        </div>
      ))}
    </div>
  )
}

export default PageSkeleton