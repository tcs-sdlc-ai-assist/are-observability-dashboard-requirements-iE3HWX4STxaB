"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Minus,
  PieChart,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useAvailability } from "@/hooks/use-dashboard-data"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { StatusBadge } from "@/components/shared/status-badge"
import { TierBadge } from "@/components/shared/status-badge"
import { MetricCard, MetricCardGrid } from "@/components/shared/metric-card"
import { TableSkeleton } from "@/components/shared/loading-skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { ROUTES, DEFAULT_THRESHOLDS } from "@/constants/constants"
import type {
  CriticalityTier,
  DashboardFilters,
  SLACompliance,
  TimePeriod,
  TrendDirection,
} from "@/types"

// ============================================================
// Types
// ============================================================

export interface ErrorBudgetTableProps {
  /** Dashboard-level filters to apply */
  filters?: DashboardFilters
  /** Maximum number of services to display (default: 20) */
  maxServices?: number
  /** Whether to show the period selector (default: true) */
  showPeriodSelector?: boolean
  /** Default time period (default: "30d") */
  defaultPeriod?: TimePeriod
  /** Whether to show the summary metric cards (default: true) */
  showSummary?: boolean
  /** Whether to show the view all button (default: true) */
  showViewAll?: boolean
  /** Additional CSS class names */
  className?: string
}

type SortField =
  | "service"
  | "tier"
  | "availability"
  | "target"
  | "budget_remaining"
  | "burn_rate"
  | "breach"
  | "trend"

type SortDirection = "asc" | "desc"

interface SortState {
  field: SortField
  direction: SortDirection
}

interface ErrorBudgetRow {
  service_id: string
  service_name: string
  tier: CriticalityTier
  availability_pct: number
  target_pct: number
  budget_remaining_pct: number
  burn_rate: number
  breach: boolean
  trend: TrendDirection
  sla_met: boolean
  slo_met: boolean
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

const BREACH_FILTER_OPTIONS = [
  { value: "all", label: "All Services" },
  { value: "breached", label: "Breached" },
  { value: "at_risk", label: "At Risk" },
  { value: "healthy", label: "Healthy" },
]

const TREND_ICON_MAP: Record<TrendDirection, React.ElementType> = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
}

// ============================================================
// Helpers
// ============================================================

/**
 * Computes the budget remaining percentage from availability and target.
 */
function computeBudgetRemainingPct(
  availabilityPct: number,
  targetPct: number
): number {
  const errorBudgetTotal = 100 - targetPct
  if (errorBudgetTotal <= 0) return 0

  const errorConsumed = Math.max(0, targetPct - availabilityPct)
  const remainingPct =
    Math.round(((errorBudgetTotal - errorConsumed) / errorBudgetTotal) * 10000) / 100

  return Math.max(0, Math.min(100, remainingPct))
}

/**
 * Computes a synthetic burn rate from availability and target.
 */
function computeBurnRate(
  availabilityPct: number,
  targetPct: number
): number {
  const errorBudgetTotal = 100 - targetPct
  if (errorBudgetTotal <= 0) return 0

  const errorConsumed = Math.max(0, targetPct - availabilityPct)
  const rate = Math.round((errorConsumed / errorBudgetTotal) * 100) / 100

  return Math.max(0, rate)
}

/**
 * Determines the trend direction from availability vs target gap.
 */
function inferTrend(
  availabilityPct: number,
  targetPct: number
): TrendDirection {
  const gap = availabilityPct - targetPct
  if (gap > 0.5) return "up"
  if (gap < -0.1) return "down"
  return "stable"
}

/**
 * Determines the health status label for a budget row.
 */
function getBudgetHealthStatus(
  row: ErrorBudgetRow
): "healthy" | "degraded" | "critical" {
  if (row.breach || row.budget_remaining_pct <= 0) return "critical"
  if (row.budget_remaining_pct <= 20 || row.burn_rate >= 1.0) return "degraded"
  return "healthy"
}

/**
 * Builds error budget rows from SLA compliance data.
 */
function buildErrorBudgetRows(
  compliance: SLACompliance[]
): ErrorBudgetRow[] {
  return compliance.map((sla) => {
    // Infer tier from target_pct
    let tier: CriticalityTier = "Tier-3"
    if (sla.target_pct >= 99.99) tier = "Tier-1"
    else if (sla.target_pct >= 99.95) tier = "Tier-2"
    else if (sla.target_pct >= 99.9) tier = "Tier-3"
    else tier = "Tier-4"

    const budgetRemainingPct = computeBudgetRemainingPct(
      sla.availability_pct,
      sla.target_pct
    )
    const burnRate = computeBurnRate(sla.availability_pct, sla.target_pct)
    const breach = budgetRemainingPct <= 0
    const trend = inferTrend(sla.availability_pct, sla.target_pct)

    return {
      service_id: sla.service_id,
      service_name: sla.service_name,
      tier,
      availability_pct: sla.availability_pct,
      target_pct: sla.target_pct,
      budget_remaining_pct: budgetRemainingPct,
      burn_rate: burnRate,
      breach,
      trend,
      sla_met: sla.sla_met,
      slo_met: sla.slo_met,
    }
  })
}

/**
 * Sorts error budget rows based on the current sort state.
 */
function sortRows(
  rows: ErrorBudgetRow[],
  sort: SortState
): ErrorBudgetRow[] {
  const sorted = [...rows]

  sorted.sort((a, b) => {
    let comparison = 0

    switch (sort.field) {
      case "service":
        comparison = a.service_name.localeCompare(b.service_name)
        break
      case "tier": {
        const tierOrder: Record<CriticalityTier, number> = {
          "Tier-1": 1,
          "Tier-2": 2,
          "Tier-3": 3,
          "Tier-4": 4,
        }
        comparison = (tierOrder[a.tier] || 99) - (tierOrder[b.tier] || 99)
        break
      }
      case "availability":
        comparison = a.availability_pct - b.availability_pct
        break
      case "target":
        comparison = a.target_pct - b.target_pct
        break
      case "budget_remaining":
        comparison = a.budget_remaining_pct - b.budget_remaining_pct
        break
      case "burn_rate":
        comparison = a.burn_rate - b.burn_rate
        break
      case "breach": {
        const breachOrder = (v: boolean) => (v ? 0 : 1)
        comparison = breachOrder(a.breach) - breachOrder(b.breach)
        break
      }
      case "trend": {
        const trendOrder: Record<TrendDirection, number> = {
          down: 0,
          stable: 1,
          up: 2,
        }
        comparison =
          (trendOrder[a.trend] || 99) - (trendOrder[b.trend] || 99)
        break
      }
      default:
        comparison = 0
    }

    return sort.direction === "asc" ? comparison : -comparison
  })

  return sorted
}

/**
 * Filters rows based on breach status filter.
 */
function filterByBreachStatus(
  rows: ErrorBudgetRow[],
  filter: string
): ErrorBudgetRow[] {
  switch (filter) {
    case "breached":
      return rows.filter((r) => r.breach)
    case "at_risk":
      return rows.filter(
        (r) => !r.breach && (r.budget_remaining_pct <= 20 || r.burn_rate >= 1.0)
      )
    case "healthy":
      return rows.filter(
        (r) => !r.breach && r.budget_remaining_pct > 20 && r.burn_rate < 1.0
      )
    case "all":
    default:
      return rows
  }
}

// ============================================================
// ErrorBudgetTable Component
// ============================================================

/**
 * Error Budget summary table showing all services with current budget %,
 * burn rate, breach status, and trend direction. Sortable and filterable.
 *
 * Supports drill-down navigation to the error budget dashboard and
 * individual service detail pages.
 *
 * @example
 * ```tsx
 * <ErrorBudgetTable
 *   filters={{ domain: "payments", period: "30d" }}
 *   maxServices={20}
 *   showSummary
 *   showPeriodSelector
 * />
 * ```
 */
export function ErrorBudgetTable({
  filters,
  maxServices = 20,
  showPeriodSelector = true,
  defaultPeriod = "30d",
  showSummary = true,
  showViewAll = true,
  className,
}: ErrorBudgetTableProps) {
  const router = useRouter()

  const [period, setPeriod] = React.useState<TimePeriod>(
    filters?.period || defaultPeriod
  )

  const [sort, setSort] = React.useState<SortState>({
    field: "budget_remaining",
    direction: "asc",
  })

  const [breachFilter, setBreachFilter] = React.useState<string>("all")

  // Sync period with external filter changes
  React.useEffect(() => {
    if (filters?.period) {
      setPeriod(filters.period)
    }
  }, [filters?.period])

  const { data, isLoading, error, mutate } = useAvailability({
    domain: filters?.domain,
    tier: filters?.tier,
    period,
    environment: filters?.environment,
  })

  const slaCompliance = data?.sla_slo_compliance || []

  // Build error budget rows from SLA compliance data
  const allRows = React.useMemo(
    () => buildErrorBudgetRows(slaCompliance),
    [slaCompliance]
  )

  // Apply breach filter
  const filteredRows = React.useMemo(
    () => filterByBreachStatus(allRows, breachFilter),
    [allRows, breachFilter]
  )

  // Apply sorting
  const sortedRows = React.useMemo(
    () => sortRows(filteredRows, sort),
    [filteredRows, sort]
  )

  const displayedRows = sortedRows.slice(0, maxServices)
  const hasMore = sortedRows.length > maxServices

  // Compute summary metrics
  const totalServices = allRows.length
  const breachedCount = allRows.filter((r) => r.breach).length
  const atRiskCount = allRows.filter(
    (r) => !r.breach && (r.budget_remaining_pct <= 20 || r.burn_rate >= 1.0)
  ).length
  const healthyCount = totalServices - breachedCount - atRiskCount
  const avgBudgetRemaining =
    totalServices > 0
      ? Math.round(
          (allRows.reduce((sum, r) => sum + r.budget_remaining_pct, 0) /
            totalServices) *
            100
        ) / 100
      : 0

  /**
   * Toggles the sort direction for a field, or sets a new sort field.
   */
  const handleSort = React.useCallback(
    (field: SortField) => {
      setSort((prev) => {
        if (prev.field === field) {
          return {
            field,
            direction: prev.direction === "asc" ? "desc" : "asc",
          }
        }
        return { field, direction: "asc" }
      })
    },
    []
  )

  const handleViewAll = React.useCallback(() => {
    router.push(ROUTES.DASHBOARD_ERROR_BUDGET)
  }, [router])

  const handleServiceClick = React.useCallback(
    (serviceId: string) => {
      router.push(ROUTES.SERVICE_DETAIL(serviceId))
    },
    [router]
  )

  const handlePeriodChange = React.useCallback((value: string) => {
    setPeriod(value as TimePeriod)
  }, [])

  const handleBreachFilterChange = React.useCallback((value: string) => {
    setBreachFilter(value)
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
              Error Budget Summary
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
        {showSummary && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    <div className="h-8 w-16 animate-pulse rounded bg-muted" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <TableSkeleton
          rows={5}
          columns={8}
          showHeader
        />
      </div>
    )
  }

  // Empty state
  if (allRows.length === 0) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Error Budget Summary
            </CardTitle>
            <CardDescription>
              Error budget status across all services
            </CardDescription>
          </div>
          {showPeriodSelector && (
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
          )}
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <PieChart className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No error budget data available
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
        <MetricCardGrid columns={4}>
          <MetricCard
            label="Avg Budget Remaining"
            value={avgBudgetRemaining}
            format="percentage"
            decimals={1}
            trendUpIsGood={true}
            threshold={20}
            thresholdExceededIsBad={false}
            icon={<PieChart className="h-4 w-4" />}
            description="Average error budget remaining across all services"
            onClick={handleViewAll}
          />

          <MetricCard
            label="Healthy"
            value={healthyCount}
            format="number"
            decimals={0}
            trendUpIsGood={true}
            icon={
              <span className="text-green-600 dark:text-green-400 text-xs font-medium">
                ✓
              </span>
            }
            description="Services with healthy error budgets (>20% remaining)"
          />

          <MetricCard
            label="At Risk"
            value={atRiskCount}
            format="number"
            decimals={0}
            trendUpIsGood={false}
            threshold={0}
            thresholdExceededIsBad={true}
            icon={<AlertTriangle className="h-4 w-4" />}
            description="Services with ≤20% budget remaining or burn rate ≥1.0x"
          />

          <MetricCard
            label="Breached"
            value={breachedCount}
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
            description="Services with exhausted error budgets"
            onClick={breachedCount > 0 ? handleViewAll : undefined}
          />
        </MetricCardGrid>
      )}

      {/* Table */}
      <Card className={cn("overflow-hidden")}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Error Budget Summary
            </CardTitle>
            <CardDescription>
              {filteredRows.length} service{filteredRows.length !== 1 ? "s" : ""}{" "}
              {breachFilter !== "all" ? `(${breachFilter})` : ""} — budget status
              and burn rate
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Breach Status Filter */}
            <Select
              value={breachFilter}
              onValueChange={handleBreachFilterChange}
            >
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="All Services" />
              </SelectTrigger>
              <SelectContent>
                {BREACH_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Period Selector */}
            {showPeriodSelector && (
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
            )}

            {showViewAll && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={handleViewAll}
              >
                Details
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader
                    label="Service"
                    field="service"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Tier"
                    field="tier"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader
                    label="Availability"
                    field="availability"
                    currentSort={sort}
                    onSort={handleSort}
                    align="right"
                  />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader
                    label="Target"
                    field="target"
                    currentSort={sort}
                    onSort={handleSort}
                    align="right"
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Budget Remaining"
                    field="budget_remaining"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader
                    label="Burn Rate"
                    field="burn_rate"
                    currentSort={sort}
                    onSort={handleSort}
                    align="right"
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Status"
                    field="breach"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Trend"
                    field="trend"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedRows.map((row) => (
                <ErrorBudgetTableRow
                  key={row.service_id}
                  row={row}
                  onClick={() => handleServiceClick(row.service_id)}
                />
              ))}
            </TableBody>
          </Table>

          {/* Footer */}
          {(hasMore || filteredRows.length > 0) && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <div className="flex items-center gap-3">
                <ErrorBudgetSummaryBadges rows={allRows} />
              </div>
              {showViewAll && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={handleViewAll}
                >
                  Error Budget Dashboard
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// SortableHeader Component
// ============================================================

interface SortableHeaderProps {
  label: string
  field: SortField
  currentSort: SortState
  onSort: (field: SortField) => void
  align?: "left" | "right"
}

/**
 * Sortable column header with directional indicator.
 */
function SortableHeader({
  label,
  field,
  currentSort,
  onSort,
  align = "left",
}: SortableHeaderProps) {
  const isActive = currentSort.field === field

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors",
        align === "right" && "ml-auto",
        isActive && "text-foreground"
      )}
      onClick={() => onSort(field)}
    >
      <span>{label}</span>
      {isActive ? (
        currentSort.direction === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  )
}

// ============================================================
// ErrorBudgetTableRow Component
// ============================================================

interface ErrorBudgetTableRowProps {
  row: ErrorBudgetRow
  onClick?: () => void
}

/**
 * Table row for a single service's error budget status.
 */
function ErrorBudgetTableRow({ row, onClick }: ErrorBudgetTableRowProps) {
  const healthStatus = getBudgetHealthStatus(row)
  const TrendIcon = TREND_ICON_MAP[row.trend] || Minus

  const trendColor =
    row.trend === "up"
      ? "text-green-600 dark:text-green-400"
      : row.trend === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground"

  const budgetBarColor =
    row.breach
      ? "bg-red-500"
      : row.budget_remaining_pct <= 20
        ? "bg-yellow-500"
        : "bg-green-500"

  const burnRateColor =
    row.burn_rate >= DEFAULT_THRESHOLDS.error_budget_burn_rate.critical
      ? "text-red-600 dark:text-red-400"
      : row.burn_rate >= DEFAULT_THRESHOLDS.error_budget_burn_rate.warning
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-green-600 dark:text-green-400"

  const availabilityColor =
    row.availability_pct >= row.target_pct
      ? "text-green-600 dark:text-green-400"
      : row.availability_pct >= row.target_pct - 0.5
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400"

  return (
    <TooltipProvider delayDuration={200}>
      <TableRow
        className={cn(onClick && "cursor-pointer")}
        onClick={onClick}
      >
        {/* Service Name */}
        <TableCell className="font-medium">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="truncate max-w-[200px] inline-block">
                {row.service_name}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-xs">
              <div className="space-y-1">
                <p className="text-xs font-medium">{row.service_name}</p>
                <p className="text-2xs text-muted-foreground">
                  Target: {row.target_pct}% | Current: {row.availability_pct.toFixed(2)}%
                </p>
                <p className="text-2xs text-muted-foreground">
                  Budget Remaining: {row.budget_remaining_pct.toFixed(1)}%
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TableCell>

        {/* Tier */}
        <TableCell>
          <TierBadge tier={row.tier} size="sm" />
        </TableCell>

        {/* Availability */}
        <TableCell className="text-right">
          <span className={cn("text-sm font-medium", availabilityColor)}>
            {row.availability_pct.toFixed(2)}%
          </span>
        </TableCell>

        {/* Target */}
        <TableCell className="text-right">
          <span className="text-sm text-muted-foreground">
            {row.target_pct}%
          </span>
        </TableCell>

        {/* Budget Remaining */}
        <TableCell>
          <div className="flex items-center gap-2 min-w-[120px]">
            <div className="relative h-2 w-full max-w-[80px] overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full transition-all duration-300",
                  budgetBarColor
                )}
                style={{
                  width: `${Math.min(Math.max(100 - row.budget_remaining_pct, 0), 100)}%`,
                }}
              />
            </div>
            <span
              className={cn(
                "text-2xs font-medium shrink-0",
                row.breach
                  ? "text-red-600 dark:text-red-400"
                  : row.budget_remaining_pct <= 20
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-green-600 dark:text-green-400"
              )}
            >
              {row.budget_remaining_pct.toFixed(1)}%
            </span>
          </div>
        </TableCell>

        {/* Burn Rate */}
        <TableCell className="text-right">
          <span className={cn("text-sm font-medium", burnRateColor)}>
            {row.burn_rate.toFixed(2)}x
          </span>
        </TableCell>

        {/* Status */}
        <TableCell>
          {row.breach ? (
            <Badge variant="destructive" className="text-2xs">
              Breached
            </Badge>
          ) : healthStatus === "degraded" ? (
            <Badge variant="warning" className="text-2xs">
              At Risk
            </Badge>
          ) : (
            <Badge variant="success" className="text-2xs">
              Healthy
            </Badge>
          )}
        </TableCell>

        {/* Trend */}
        <TableCell>
          <div className={cn("flex items-center gap-1", trendColor)}>
            <TrendIcon className="h-3.5 w-3.5" />
            <span className="text-2xs font-medium">
              {row.trend === "up"
                ? "Improving"
                : row.trend === "down"
                  ? "Declining"
                  : "Stable"}
            </span>
          </div>
        </TableCell>
      </TableRow>
    </TooltipProvider>
  )
}

// ============================================================
// ErrorBudgetSummaryBadges Component
// ============================================================

interface ErrorBudgetSummaryBadgesProps {
  rows: ErrorBudgetRow[]
}

/**
 * Compact summary badges for the table footer.
 */
function ErrorBudgetSummaryBadges({ rows }: ErrorBudgetSummaryBadgesProps) {
  const breachedCount = rows.filter((r) => r.breach).length
  const atRiskCount = rows.filter(
    (r) => !r.breach && (r.budget_remaining_pct <= 20 || r.burn_rate >= 1.0)
  ).length
  const healthyCount = rows.length - breachedCount - atRiskCount

  const tier1Breached = rows.filter(
    (r) => r.breach && r.tier === "Tier-1"
  ).length

  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs text-muted-foreground">
        {rows.length} service{rows.length !== 1 ? "s" : ""}
      </span>
      {breachedCount > 0 && (
        <Badge variant="destructive" className="text-2xs">
          {breachedCount} breached
        </Badge>
      )}
      {tier1Breached > 0 && (
        <Badge variant="tier1" className="text-2xs">
          {tier1Breached} Tier 1
        </Badge>
      )}
      {atRiskCount > 0 && (
        <Badge variant="warning" className="text-2xs">
          {atRiskCount} at risk
        </Badge>
      )}
      {healthyCount > 0 && breachedCount === 0 && atRiskCount === 0 && (
        <Badge variant="success" className="text-2xs">
          All healthy
        </Badge>
      )}
    </div>
  )
}

// ============================================================
// Wrapped Export with Error Boundary
// ============================================================

export interface ErrorBudgetTableWithBoundaryProps
  extends ErrorBudgetTableProps {}

/**
 * ErrorBudgetTable wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function ErrorBudgetTableWithBoundary(
  props: ErrorBudgetTableWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Error Budget Table">
      <ErrorBudgetTable {...props} />
    </ModuleErrorBoundary>
  )
}

export default ErrorBudgetTable