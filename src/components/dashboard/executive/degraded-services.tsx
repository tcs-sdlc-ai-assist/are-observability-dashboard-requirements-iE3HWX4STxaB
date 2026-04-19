"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useAvailability } from "@/hooks/use-dashboard-data"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { StatusBadge, availabilityToHealthStatus } from "@/components/shared/status-badge"
import { TierBadge } from "@/components/shared/status-badge"
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
import { ROUTES, DEFAULT_THRESHOLDS } from "@/constants/constants"
import type {
  CriticalityTier,
  DashboardFilters,
  DegradedService,
  TimePeriod,
  TrendDirection,
} from "@/types"

// ============================================================
// Types
// ============================================================

export interface DegradedServicesProps {
  /** Dashboard-level filters to apply */
  filters?: DashboardFilters
  /** Maximum number of services to display (default: 10) */
  maxServices?: number
  /** Whether to show the period selector (default: true) */
  showPeriodSelector?: boolean
  /** Default time period (default: "24h") */
  defaultPeriod?: TimePeriod
  /** Whether to show the view all button (default: true) */
  showViewAll?: boolean
  /** Additional CSS class names */
  className?: string
}

type SortField = "service" | "domain" | "tier" | "degradation" | "status"
type SortDirection = "asc" | "desc"

interface SortState {
  field: SortField
  direction: SortDirection
}

// ============================================================
// Constants
// ============================================================

const PERIOD_OPTIONS: Array<{ value: TimePeriod; label: string }> = [
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "14d", label: "Last 14 Days" },
  { value: "30d", label: "Last 30 Days" },
]

// ============================================================
// Helpers
// ============================================================

/**
 * Returns the SLO target for a given tier.
 */
function getSLOTarget(tier: CriticalityTier): number {
  return DEFAULT_THRESHOLDS.availability[tier] || 99.9
}

/**
 * Computes the current availability from degradation percentage and tier.
 */
function computeCurrentAvailability(
  tier: CriticalityTier,
  degradationPct: number
): number {
  const target = getSLOTarget(tier)
  return Math.round((target - degradationPct) * 100) / 100
}

/**
 * Sorts degraded services based on the current sort state.
 */
function sortServices(
  services: DegradedService[],
  sort: SortState
): DegradedService[] {
  const sorted = [...services]

  sorted.sort((a, b) => {
    let comparison = 0

    switch (sort.field) {
      case "service":
        comparison = a.service.localeCompare(b.service)
        break
      case "domain":
        comparison = a.domain.localeCompare(b.domain)
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
      case "degradation":
        comparison = a.degradation_pct - b.degradation_pct
        break
      case "status": {
        const statusOrder = { critical: 1, degraded: 2, healthy: 3, unknown: 4 }
        const statusA = availabilityToHealthStatus(
          computeCurrentAvailability(a.tier, a.degradation_pct)
        )
        const statusB = availabilityToHealthStatus(
          computeCurrentAvailability(b.tier, b.degradation_pct)
        )
        comparison =
          (statusOrder[statusA] || 99) - (statusOrder[statusB] || 99)
        break
      }
      default:
        comparison = 0
    }

    return sort.direction === "asc" ? comparison : -comparison
  })

  return sorted
}

// ============================================================
// DegradedServices Component
// ============================================================

/**
 * Top Degraded Services component listing services with the highest
 * availability degradation. Displays a sortable table with severity badges,
 * domain, tier, degradation percentage, and health status.
 *
 * Supports drill-down navigation to service detail pages and the
 * availability dashboard.
 *
 * @example
 * ```tsx
 * <DegradedServices
 *   filters={{ domain: "payments", period: "24h" }}
 *   maxServices={10}
 *   showPeriodSelector
 * />
 * ```
 */
export function DegradedServices({
  filters,
  maxServices = 10,
  showPeriodSelector = true,
  defaultPeriod = "24h",
  showViewAll = true,
  className,
}: DegradedServicesProps) {
  const router = useRouter()

  const [period, setPeriod] = React.useState<TimePeriod>(
    filters?.period || defaultPeriod
  )

  const [sort, setSort] = React.useState<SortState>({
    field: "degradation",
    direction: "desc",
  })

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

  const degradedServices = data?.top_degraded_services || []

  const sortedServices = React.useMemo(
    () => sortServices(degradedServices, sort),
    [degradedServices, sort]
  )

  const displayedServices = sortedServices.slice(0, maxServices)
  const hasMore = sortedServices.length > maxServices

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
        return { field, direction: "desc" }
      })
    },
    []
  )

  const handleViewAll = React.useCallback(() => {
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
              Top Degraded Services
            </CardTitle>
            <CardDescription>
              Failed to load degraded services data.
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
      <TableSkeleton
        rows={5}
        columns={6}
        showHeader
        className={className}
      />
    )
  }

  // Empty state
  if (degradedServices.length === 0) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Top Degraded Services
            </CardTitle>
            <CardDescription>
              Services with the highest availability degradation
            </CardDescription>
          </div>
          {showPeriodSelector && (
            <Select value={period} onValueChange={handlePeriodChange}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
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
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 mb-3">
            <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            All services are meeting their SLO targets
          </p>
          <p className="text-2xs text-muted-foreground mt-1">
            No degraded services detected in the selected period.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold">
            Top Degraded Services
          </CardTitle>
          <CardDescription>
            {degradedServices.length} service{degradedServices.length !== 1 ? "s" : ""}{" "}
            below SLO availability targets
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {showPeriodSelector && (
            <Select value={period} onValueChange={handlePeriodChange}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
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
          {showViewAll && hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={handleViewAll}
            >
              View All ({degradedServices.length})
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
                  label="Domain"
                  field="domain"
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
                  label="Degradation"
                  field="degradation"
                  currentSort={sort}
                  onSort={handleSort}
                  align="right"
                />
              </TableHead>
              <TableHead>
                <SortableHeader
                  label="Status"
                  field="status"
                  currentSort={sort}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead>Issue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedServices.map((service) => (
              <DegradedServiceRow
                key={service.service_id}
                service={service}
                onClick={() => handleServiceClick(service.service_id)}
              />
            ))}
          </TableBody>
        </Table>

        {/* Summary footer */}
        {degradedServices.length > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <div className="flex items-center gap-3">
              <DegradationSummary services={degradedServices} />
            </div>
            {showViewAll && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={handleViewAll}
              >
                Availability Dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
// DegradedServiceRow Component
// ============================================================

interface DegradedServiceRowProps {
  service: DegradedService
  onClick?: () => void
}

/**
 * Table row for a single degraded service with health status,
 * tier badge, degradation percentage, and issue description.
 */
function DegradedServiceRow({ service, onClick }: DegradedServiceRowProps) {
  const currentAvailability = computeCurrentAvailability(
    service.tier,
    service.degradation_pct
  )
  const healthStatus = availabilityToHealthStatus(currentAvailability)
  const sloTarget = getSLOTarget(service.tier)

  return (
    <TooltipProvider delayDuration={200}>
      <TableRow
        className={cn(onClick && "cursor-pointer")}
        onClick={onClick}
      >
        <TableCell className="font-medium">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="truncate max-w-[200px] inline-block">
                {service.service}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-xs">
              <div className="space-y-1">
                <p className="text-xs font-medium">{service.service}</p>
                <p className="text-2xs text-muted-foreground">
                  SLO Target: {sloTarget}%
                </p>
                <p className="text-2xs text-muted-foreground">
                  Current: {currentAvailability.toFixed(2)}%
                </p>
                <p className="text-2xs text-destructive">
                  Gap: -{service.degradation_pct.toFixed(2)}%
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TableCell>
        <TableCell>
          <span className="text-sm text-muted-foreground">
            {service.domain}
          </span>
        </TableCell>
        <TableCell>
          <TierBadge tier={service.tier} size="sm" />
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1.5">
            <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              -{service.degradation_pct.toFixed(2)}%
            </span>
          </div>
        </TableCell>
        <TableCell>
          <StatusBadge status={healthStatus} size="sm" />
        </TableCell>
        <TableCell>
          <span className="text-2xs text-muted-foreground truncate max-w-[180px] inline-block">
            {service.primary_issue || "Below SLO target"}
          </span>
        </TableCell>
      </TableRow>
    </TooltipProvider>
  )
}

// ============================================================
// DegradationSummary Component
// ============================================================

interface DegradationSummaryProps {
  services: DegradedService[]
}

/**
 * Compact summary of degraded services by tier.
 */
function DegradationSummary({ services }: DegradationSummaryProps) {
  const tierCounts = React.useMemo(() => {
    const counts: Partial<Record<CriticalityTier, number>> = {}
    for (const service of services) {
      counts[service.tier] = (counts[service.tier] || 0) + 1
    }
    return counts
  }, [services])

  const criticalCount = services.filter(
    (s) =>
      availabilityToHealthStatus(
        computeCurrentAvailability(s.tier, s.degradation_pct)
      ) === "critical"
  ).length

  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs text-muted-foreground">
        {services.length} degraded
      </span>
      {criticalCount > 0 && (
        <Badge variant="destructive" className="text-2xs">
          {criticalCount} critical
        </Badge>
      )}
      {tierCounts["Tier-1"] && tierCounts["Tier-1"] > 0 && (
        <Badge variant="tier1" className="text-2xs">
          {tierCounts["Tier-1"]} Tier 1
        </Badge>
      )}
      {tierCounts["Tier-2"] && tierCounts["Tier-2"] > 0 && (
        <Badge variant="tier2" className="text-2xs">
          {tierCounts["Tier-2"]} Tier 2
        </Badge>
      )}
    </div>
  )
}

// ============================================================
// Wrapped Export with Error Boundary
// ============================================================

export interface DegradedServicesWithBoundaryProps
  extends DegradedServicesProps {}

/**
 * DegradedServices wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function DegradedServicesWithBoundary(
  props: DegradedServicesWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Degraded Services">
      <DegradedServices {...props} />
    </ModuleErrorBoundary>
  )
}

export default DegradedServices