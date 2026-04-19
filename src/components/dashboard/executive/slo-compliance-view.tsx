"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Filter,
  RefreshCw,
  XCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useAvailability } from "@/hooks/use-dashboard-data"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { StatusBadge, availabilityToHealthStatus } from "@/components/shared/status-badge"
import { TierBadge, SLOStatusBadge } from "@/components/shared/status-badge"
import { MetricCardGridSkeleton } from "@/components/shared/loading-skeleton"
import { MetricCard, MetricCardGrid } from "@/components/shared/metric-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROUTES, DEFAULT_THRESHOLDS } from "@/constants/constants"
import type {
  CriticalityTier,
  DashboardFilters,
  SLACompliance,
  TimePeriod,
} from "@/types"

// ============================================================
// Types
// ============================================================

export interface SLOComplianceViewProps {
  /** Dashboard-level filters to apply */
  filters?: DashboardFilters
  /** Whether to show the summary metric cards */
  showSummary?: boolean
  /** Whether to show the heatmap view */
  showHeatmap?: boolean
  /** Whether to show the detailed table view */
  showTable?: boolean
  /** Maximum number of services to display in the table */
  maxServices?: number
  /** Additional CSS class names */
  className?: string
}

type ComplianceStatus = "met" | "at-risk" | "breached"

interface HeatmapCell {
  service_id: string
  service_name: string
  domain: string
  tier: CriticalityTier
  availability_pct: number
  target_pct: number
  sla_met: boolean
  slo_met: boolean
  status: ComplianceStatus
}

interface DomainGroup {
  domain: string
  services: HeatmapCell[]
  met_count: number
  at_risk_count: number
  breached_count: number
  total_count: number
  avg_availability: number
}

type ViewMode = "heatmap" | "table"

// ============================================================
// Constants
// ============================================================

const PERIOD_OPTIONS: Array<{ value: TimePeriod; label: string }> = [
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "14d", label: "Last 14 Days" },
  { value: "30d", label: "Last 30 Days" },
]

const AT_RISK_BUFFER_PCT = 0.5

// ============================================================
// Helpers
// ============================================================

/**
 * Determines the compliance status for a service based on its availability
 * relative to its SLA target.
 */
function getComplianceStatus(
  availability_pct: number,
  target_pct: number
): ComplianceStatus {
  if (availability_pct >= target_pct) {
    // Check if within the at-risk buffer
    if (availability_pct - target_pct < AT_RISK_BUFFER_PCT) {
      return "at-risk"
    }
    return "met"
  }
  return "breached"
}

/**
 * Returns the CSS classes for a compliance status cell.
 */
function getComplianceCellClasses(status: ComplianceStatus): string {
  switch (status) {
    case "met":
      return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
    case "at-risk":
      return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20"
    case "breached":
      return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
    default:
      return "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20"
  }
}

/**
 * Returns the label for a compliance status.
 */
function getComplianceLabel(status: ComplianceStatus): string {
  switch (status) {
    case "met":
      return "Met"
    case "at-risk":
      return "At Risk"
    case "breached":
      return "Breached"
    default:
      return "Unknown"
  }
}

/**
 * Returns the icon for a compliance status.
 */
function getComplianceIcon(status: ComplianceStatus): React.ElementType {
  switch (status) {
    case "met":
      return CheckCircle
    case "at-risk":
      return AlertTriangle
    case "breached":
      return XCircle
    default:
      return AlertTriangle
  }
}

/**
 * Builds heatmap cells from SLA compliance data.
 */
function buildHeatmapCells(compliance: SLACompliance[]): HeatmapCell[] {
  return compliance.map((sla) => {
    const status = getComplianceStatus(sla.availability_pct, sla.target_pct)

    // Infer tier from target_pct
    let tier: CriticalityTier = "Tier-3"
    if (sla.target_pct >= 99.99) tier = "Tier-1"
    else if (sla.target_pct >= 99.95) tier = "Tier-2"
    else if (sla.target_pct >= 99.9) tier = "Tier-3"
    else tier = "Tier-4"

    return {
      service_id: sla.service_id,
      service_name: sla.service_name,
      domain: "Default",
      tier,
      availability_pct: sla.availability_pct,
      target_pct: sla.target_pct,
      sla_met: sla.sla_met,
      slo_met: sla.slo_met,
      status,
    }
  })
}

/**
 * Groups heatmap cells by domain.
 */
function groupByDomain(cells: HeatmapCell[]): DomainGroup[] {
  const domainMap = new Map<string, HeatmapCell[]>()

  for (const cell of cells) {
    const existing = domainMap.get(cell.domain) || []
    existing.push(cell)
    domainMap.set(cell.domain, existing)
  }

  return Array.from(domainMap.entries())
    .map(([domain, services]) => {
      const met_count = services.filter((s) => s.status === "met").length
      const at_risk_count = services.filter((s) => s.status === "at-risk").length
      const breached_count = services.filter((s) => s.status === "breached").length
      const total_count = services.length
      const avg_availability =
        total_count > 0
          ? Math.round(
              (services.reduce((sum, s) => sum + s.availability_pct, 0) /
                total_count) *
                100
            ) / 100
          : 0

      return {
        domain,
        services: services.sort((a, b) => a.availability_pct - b.availability_pct),
        met_count,
        at_risk_count,
        breached_count,
        total_count,
        avg_availability,
      }
    })
    .sort((a, b) => a.avg_availability - b.avg_availability)
}

// ============================================================
// SLOComplianceView Component
// ============================================================

/**
 * SLA/SLO Compliance visualization component with a heatmap/table showing
 * compliance status per domain/service. Color-coded cells indicate
 * met/at-risk/breached states.
 *
 * Supports drill-down navigation to the detailed availability dashboard
 * and individual service detail pages.
 *
 * @example
 * ```tsx
 * <SLOComplianceView
 *   filters={{ domain: "payments", period: "30d" }}
 *   showSummary
 *   showHeatmap
 *   showTable
 * />
 * ```
 */
export function SLOComplianceView({
  filters,
  showSummary = true,
  showHeatmap = true,
  showTable = true,
  maxServices = 20,
  className,
}: SLOComplianceViewProps) {
  const router = useRouter()

  const [period, setPeriod] = React.useState<TimePeriod>(
    filters?.period || "30d"
  )
  const [viewMode, setViewMode] = React.useState<ViewMode>("heatmap")
  const [statusFilter, setStatusFilter] = React.useState<
    ComplianceStatus | "all"
  >("all")

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

  // Build heatmap data
  const heatmapCells = React.useMemo(
    () => buildHeatmapCells(slaCompliance),
    [slaCompliance]
  )

  // Apply status filter
  const filteredCells = React.useMemo(() => {
    if (statusFilter === "all") return heatmapCells
    return heatmapCells.filter((cell) => cell.status === statusFilter)
  }, [heatmapCells, statusFilter])

  const domainGroups = React.useMemo(
    () => groupByDomain(filteredCells),
    [filteredCells]
  )

  // Compute summary metrics
  const totalServices = heatmapCells.length
  const metCount = heatmapCells.filter((c) => c.status === "met").length
  const atRiskCount = heatmapCells.filter((c) => c.status === "at-risk").length
  const breachedCount = heatmapCells.filter(
    (c) => c.status === "breached"
  ).length
  const overallComplianceRate =
    totalServices > 0
      ? Math.round((metCount / totalServices) * 10000) / 100
      : 0
  const overallAvailability =
    totalServices > 0
      ? Math.round(
          (heatmapCells.reduce((sum, c) => sum + c.availability_pct, 0) /
            totalServices) *
            100
        ) / 100
      : 0

  const handleDrillDown = React.useCallback(() => {
    router.push(ROUTES.DASHBOARD_AVAILABILITY)
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

  const handleStatusFilterChange = React.useCallback((value: string) => {
    setStatusFilter(value as ComplianceStatus | "all")
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
              SLO Compliance
            </CardTitle>
            <CardDescription>
              Failed to load compliance data.
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
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-1.5">
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
              <div className="h-3 w-56 animate-pulse rounded bg-muted" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded bg-muted/30"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Empty state
  if (slaCompliance.length === 0) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No SLO compliance data available
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
            label="SLO Compliance Rate"
            value={overallComplianceRate}
            format="percentage"
            decimals={1}
            trendUpIsGood={true}
            threshold={100}
            thresholdExceededIsBad={false}
            icon={<CheckCircle className="h-4 w-4" />}
            description="Percentage of services meeting their SLO targets"
            onClick={handleDrillDown}
          />

          <MetricCard
            label="Overall Availability"
            value={overallAvailability}
            format="percentage"
            decimals={2}
            trendUpIsGood={true}
            threshold={99.9}
            thresholdExceededIsBad={false}
            icon={
              <span className="text-muted-foreground text-xs font-medium">
                %
              </span>
            }
            description="Weighted average availability across all services"
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
            description="Services within 0.5% of their SLO target"
          />

          <MetricCard
            label="SLA Breached"
            value={breachedCount}
            format="number"
            decimals={0}
            trendUpIsGood={false}
            threshold={0}
            thresholdExceededIsBad={true}
            icon={<XCircle className="h-4 w-4" />}
            description="Services currently below their SLA target"
            onClick={breachedCount > 0 ? handleDrillDown : undefined}
          />
        </MetricCardGrid>
      )}

      {/* Heatmap / Table View */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              SLA/SLO Compliance
            </CardTitle>
            <CardDescription>
              {totalServices} service{totalServices !== 1 ? "s" : ""} —{" "}
              {metCount} met, {atRiskCount} at risk, {breachedCount} breached
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={handleStatusFilterChange}
            >
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="met">Met</SelectItem>
                <SelectItem value="at-risk">At Risk</SelectItem>
                <SelectItem value="breached">Breached</SelectItem>
              </SelectContent>
            </Select>

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

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-md border">
              <Button
                variant={viewMode === "heatmap" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 rounded-r-none text-xs px-3"
                onClick={() => setViewMode("heatmap")}
              >
                Heatmap
              </Button>
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 rounded-l-none text-xs px-3"
                onClick={() => setViewMode("table")}
              >
                Table
              </Button>
            </div>

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
          {/* Legend */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-green-500/30 border border-green-500/40" />
              <span className="text-2xs text-muted-foreground">Met</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-yellow-500/30 border border-yellow-500/40" />
              <span className="text-2xs text-muted-foreground">At Risk</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-red-500/30 border border-red-500/40" />
              <span className="text-2xs text-muted-foreground">Breached</span>
            </div>
          </div>

          {viewMode === "heatmap" && showHeatmap ? (
            <ComplianceHeatmap
              domainGroups={domainGroups}
              onServiceClick={handleServiceClick}
            />
          ) : (
            showTable && (
              <ComplianceTable
                cells={filteredCells}
                maxServices={maxServices}
                onServiceClick={handleServiceClick}
                onViewAll={handleDrillDown}
              />
            )
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// ComplianceHeatmap Component
// ============================================================

interface ComplianceHeatmapProps {
  domainGroups: DomainGroup[]
  onServiceClick?: (serviceId: string) => void
}

/**
 * Heatmap visualization of SLO compliance grouped by domain.
 * Each cell represents a service, color-coded by compliance status.
 */
function ComplianceHeatmap({
  domainGroups,
  onServiceClick,
}: ComplianceHeatmapProps) {
  if (domainGroups.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">
          No services match the current filter.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {domainGroups.map((group) => (
        <div key={group.domain} className="space-y-2">
          {/* Domain Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{group.domain}</span>
              <span className="text-2xs text-muted-foreground">
                ({group.total_count} service{group.total_count !== 1 ? "s" : ""})
              </span>
            </div>
            <div className="flex items-center gap-2">
              {group.met_count > 0 && (
                <Badge variant="success" className="text-2xs">
                  {group.met_count} Met
                </Badge>
              )}
              {group.at_risk_count > 0 && (
                <Badge variant="warning" className="text-2xs">
                  {group.at_risk_count} At Risk
                </Badge>
              )}
              {group.breached_count > 0 && (
                <Badge variant="destructive" className="text-2xs">
                  {group.breached_count} Breached
                </Badge>
              )}
            </div>
          </div>

          {/* Heatmap Grid */}
          <div className="grid gap-1.5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {group.services.map((cell) => (
              <ComplianceHeatmapCell
                key={cell.service_id}
                cell={cell}
                onClick={() => onServiceClick?.(cell.service_id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// ComplianceHeatmapCell Component
// ============================================================

interface ComplianceHeatmapCellProps {
  cell: HeatmapCell
  onClick?: () => void
}

/**
 * Individual heatmap cell representing a service's compliance status.
 */
function ComplianceHeatmapCell({ cell, onClick }: ComplianceHeatmapCellProps) {
  const StatusIcon = getComplianceIcon(cell.status)
  const cellClasses = getComplianceCellClasses(cell.status)

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-md border p-2 text-center transition-colors hover:opacity-80",
              cellClasses,
              onClick && "cursor-pointer"
            )}
            onClick={onClick}
          >
            <StatusIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="text-2xs font-medium truncate w-full leading-tight">
              {cell.service_name}
            </span>
            <span className="text-2xs font-bold leading-none">
              {cell.availability_pct.toFixed(2)}%
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4} className="max-w-xs">
          <div className="space-y-1">
            <p className="text-xs font-medium">{cell.service_name}</p>
            <div className="flex items-center gap-1.5">
              <TierBadge tier={cell.tier} size="sm" />
              <SLOStatusBadge met={cell.sla_met} size="sm" />
            </div>
            <p className="text-2xs text-muted-foreground">
              Target: {cell.target_pct}%
            </p>
            <p className="text-2xs text-muted-foreground">
              Current: {cell.availability_pct.toFixed(2)}%
            </p>
            <p className="text-2xs text-muted-foreground">
              Gap:{" "}
              <span
                className={cn(
                  cell.status === "breached"
                    ? "text-red-600 dark:text-red-400"
                    : cell.status === "at-risk"
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-green-600 dark:text-green-400"
                )}
              >
                {cell.availability_pct >= cell.target_pct ? "+" : ""}
                {(cell.availability_pct - cell.target_pct).toFixed(3)}%
              </span>
            </p>
            <p className="text-2xs font-medium">
              Status: {getComplianceLabel(cell.status)}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================
// ComplianceTable Component
// ============================================================

interface ComplianceTableProps {
  cells: HeatmapCell[]
  maxServices: number
  onServiceClick?: (serviceId: string) => void
  onViewAll?: () => void
}

/**
 * Detailed table view of SLO compliance per service.
 */
function ComplianceTable({
  cells,
  maxServices,
  onServiceClick,
  onViewAll,
}: ComplianceTableProps) {
  const sortedCells = React.useMemo(
    () =>
      [...cells].sort((a, b) => {
        // Sort breached first, then at-risk, then met
        const statusOrder: Record<ComplianceStatus, number> = {
          breached: 0,
          "at-risk": 1,
          met: 2,
        }
        const statusDiff = statusOrder[a.status] - statusOrder[b.status]
        if (statusDiff !== 0) return statusDiff
        return a.availability_pct - b.availability_pct
      }),
    [cells]
  )

  const displayedCells = sortedCells.slice(0, maxServices)
  const hasMore = sortedCells.length > maxServices

  if (cells.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">
          No services match the current filter.
        </p>
      </div>
    )
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Service</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead className="text-right">Target</TableHead>
            <TableHead className="text-right">Current</TableHead>
            <TableHead className="text-right">Gap</TableHead>
            <TableHead>SLO</TableHead>
            <TableHead>SLA</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayedCells.map((cell) => {
            const gap = cell.availability_pct - cell.target_pct
            const gapColor =
              cell.status === "breached"
                ? "text-red-600 dark:text-red-400"
                : cell.status === "at-risk"
                  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-green-600 dark:text-green-400"

            return (
              <TableRow
                key={cell.service_id}
                className={cn(onServiceClick && "cursor-pointer")}
                onClick={() => onServiceClick?.(cell.service_id)}
              >
                <TableCell className="font-medium">
                  <span className="truncate max-w-[200px] inline-block">
                    {cell.service_name}
                  </span>
                </TableCell>
                <TableCell>
                  <TierBadge tier={cell.tier} size="sm" />
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-sm text-muted-foreground">
                    {cell.target_pct}%
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      cell.status === "breached" &&
                        "text-red-600 dark:text-red-400",
                      cell.status === "at-risk" &&
                        "text-yellow-600 dark:text-yellow-400",
                      cell.status === "met" &&
                        "text-green-600 dark:text-green-400"
                    )}
                  >
                    {cell.availability_pct.toFixed(2)}%
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className={cn("text-sm font-medium", gapColor)}>
                    {gap >= 0 ? "+" : ""}
                    {gap.toFixed(3)}%
                  </span>
                </TableCell>
                <TableCell>
                  <SLOStatusBadge
                    met={cell.slo_met}
                    size="sm"
                    label={cell.slo_met ? "Met" : "Breached"}
                  />
                </TableCell>
                <TableCell>
                  <SLOStatusBadge
                    met={cell.sla_met}
                    size="sm"
                    label={cell.sla_met ? "Met" : "Breached"}
                  />
                </TableCell>
                <TableCell>
                  <ComplianceStatusBadge status={cell.status} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {/* Footer */}
      {hasMore && onViewAll && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <span className="text-2xs text-muted-foreground">
            Showing {displayedCells.length} of {sortedCells.length} services
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={onViewAll}
          >
            View All ({sortedCells.length})
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// ComplianceStatusBadge Component
// ============================================================

interface ComplianceStatusBadgeProps {
  status: ComplianceStatus
  className?: string
}

/**
 * Compact badge for compliance status display.
 */
function ComplianceStatusBadge({
  status,
  className,
}: ComplianceStatusBadgeProps) {
  const Icon = getComplianceIcon(status)
  const label = getComplianceLabel(status)
  const cellClasses = getComplianceCellClasses(status)

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border px-1.5 text-2xs h-4 font-semibold transition-colors",
        cellClasses,
        className
      )}
    >
      <Icon className="h-2.5 w-2.5 shrink-0" />
      <span>{label}</span>
    </div>
  )
}

// ============================================================
// Wrapped Export with Error Boundary
// ============================================================

export interface SLOComplianceViewWithBoundaryProps
  extends SLOComplianceViewProps {}

/**
 * SLOComplianceView wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function SLOComplianceViewWithBoundary(
  props: SLOComplianceViewWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="SLO Compliance">
      <SLOComplianceView {...props} />
    </ModuleErrorBoundary>
  )
}

export default SLOComplianceView