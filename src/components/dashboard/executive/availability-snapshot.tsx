"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Activity, AlertTriangle, ArrowRight, TrendingDown, TrendingUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { useAvailability } from "@/hooks/use-dashboard-data"
import { MetricCard, MetricCardGrid } from "@/components/shared/metric-card"
import { StatusBadge, availabilityToHealthStatus } from "@/components/shared/status-badge"
import { TierBadge } from "@/components/shared/status-badge"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { MetricCardGridSkeleton, ChartSkeleton } from "@/components/shared/loading-skeleton"
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
import { ROUTES, DEFAULT_THRESHOLDS } from "@/constants/constants"
import type {
  AvailabilitySnapshot as AvailabilitySnapshotType,
  CriticalityTier,
  DashboardFilters,
  DegradedService,
  SLACompliance,
  TrendDirection,
} from "@/types"

// ============================================================
// Types
// ============================================================

export interface AvailabilitySnapshotProps {
  /** Dashboard-level filters to apply */
  filters?: DashboardFilters
  /** Whether to show the degraded services table */
  showDegradedServices?: boolean
  /** Whether to show the SLA compliance summary */
  showSLACompliance?: boolean
  /** Maximum number of degraded services to display */
  maxDegradedServices?: number
  /** Additional CSS class names */
  className?: string
}

// ============================================================
// Constants
// ============================================================

const TREND_ICON_MAP: Record<TrendDirection, React.ElementType> = {
  up: TrendingUp,
  down: TrendingDown,
  stable: ArrowRight,
}

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
 * Computes the overall availability from an array of snapshots.
 */
function computeOverallAvailability(
  snapshots: AvailabilitySnapshotType[]
): number | null {
  if (!snapshots || snapshots.length === 0) return null

  const totalServices = snapshots.reduce(
    (sum, s) => sum + s.services_total,
    0
  )
  if (totalServices === 0) return null

  const weightedSum = snapshots.reduce(
    (sum, s) => sum + s.availability_pct * s.services_total,
    0
  )

  return Math.round((weightedSum / totalServices) * 100) / 100
}

/**
 * Computes the overall trend from an array of snapshots.
 */
function computeOverallTrend(
  snapshots: AvailabilitySnapshotType[]
): TrendDirection {
  if (!snapshots || snapshots.length === 0) return "stable"

  const upCount = snapshots.filter((s) => s.trend === "up").length
  const downCount = snapshots.filter((s) => s.trend === "down").length

  if (upCount > downCount) return "up"
  if (downCount > upCount) return "down"
  return "stable"
}

/**
 * Computes the total degraded service count.
 */
function computeTotalDegraded(
  snapshots: AvailabilitySnapshotType[]
): number {
  if (!snapshots || snapshots.length === 0) return 0
  return snapshots.reduce((sum, s) => sum + s.services_degraded, 0)
}

/**
 * Computes the total service count.
 */
function computeTotalServices(
  snapshots: AvailabilitySnapshotType[]
): number {
  if (!snapshots || snapshots.length === 0) return 0
  return snapshots.reduce((sum, s) => sum + s.services_total, 0)
}

// ============================================================
// AvailabilitySnapshot Component
// ============================================================

/**
 * Enterprise Availability Snapshot component showing availability % by
 * domain/tier in a grid of metric cards, with color-coded status indicators,
 * degraded services table, and SLA compliance summary.
 *
 * Supports drill-down navigation to the detailed availability dashboard.
 *
 * @example
 * ```tsx
 * <AvailabilitySnapshot
 *   filters={{ domain: "payments", period: "24h" }}
 *   showDegradedServices
 *   showSLACompliance
 * />
 * ```
 */
export function AvailabilitySnapshot({
  filters,
  showDegradedServices = true,
  showSLACompliance = true,
  maxDegradedServices = 5,
  className,
}: AvailabilitySnapshotProps) {
  const router = useRouter()

  const { data, isLoading, error, mutate } = useAvailability({
    domain: filters?.domain,
    tier: filters?.tier,
    period: filters?.period,
    environment: filters?.environment,
  })

  const snapshots = data?.availability || []
  const degradedServices = data?.top_degraded_services || []
  const slaCompliance = data?.sla_slo_compliance || []

  const overallAvailability = computeOverallAvailability(snapshots)
  const overallTrend = computeOverallTrend(snapshots)
  const totalDegraded = computeTotalDegraded(snapshots)
  const totalServices = computeTotalServices(snapshots)

  const handleDrillDown = React.useCallback(() => {
    router.push(ROUTES.DASHBOARD_AVAILABILITY)
  }, [router])

  const handleServiceClick = React.useCallback(
    (serviceId: string) => {
      router.push(ROUTES.SERVICE_DETAIL(serviceId))
    },
    [router]
  )

  if (error) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              Availability Snapshot
            </CardTitle>
            <CardDescription>
              Failed to load availability data.
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

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <MetricCardGridSkeleton cards={4} columns={4} />
        {showDegradedServices && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-1.5">
                <div className="h-5 w-40 animate-pulse rounded bg-muted" />
                <div className="h-3 w-56 animate-pulse rounded bg-muted" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-muted/30" />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary Metric Cards */}
      <MetricCardGrid columns={4}>
        {/* Overall Availability */}
        <MetricCard
          label="Overall Availability"
          value={overallAvailability}
          format="percentage"
          decimals={2}
          trend={overallTrend}
          trendUpIsGood={true}
          threshold={99.9}
          thresholdExceededIsBad={false}
          icon={<Activity className="h-4 w-4" />}
          description="Weighted average availability across all monitored services"
          onClick={handleDrillDown}
        />

        {/* Total Services */}
        <MetricCard
          label="Total Services"
          value={totalServices}
          format="number"
          decimals={0}
          icon={
            <span className="text-muted-foreground text-xs font-medium">
              #
            </span>
          }
          description="Total number of services being monitored"
        />

        {/* Degraded Services */}
        <MetricCard
          label="Degraded Services"
          value={totalDegraded}
          format="number"
          decimals={0}
          trend={totalDegraded > 0 ? "up" : "stable"}
          trendUpIsGood={false}
          threshold={0}
          thresholdExceededIsBad={true}
          icon={<AlertTriangle className="h-4 w-4" />}
          description="Services currently below their SLO availability target"
          onClick={
            totalDegraded > 0 ? handleDrillDown : undefined
          }
        />

        {/* SLA Compliance Rate */}
        <MetricCard
          label="SLA Compliance"
          value={
            slaCompliance.length > 0
              ? Math.round(
                  (slaCompliance.filter((s) => s.sla_met).length /
                    slaCompliance.length) *
                    10000
                ) / 100
              : null
          }
          format="percentage"
          decimals={1}
          trendUpIsGood={true}
          threshold={100}
          thresholdExceededIsBad={false}
          icon={
            <span className="text-muted-foreground text-xs font-medium">
              SLA
            </span>
          }
          description="Percentage of services meeting their SLA targets"
          onClick={handleDrillDown}
        />
      </MetricCardGrid>

      {/* Availability by Domain/Tier Grid */}
      {snapshots.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">
                Availability by Domain &amp; Tier
              </CardTitle>
              <CardDescription>
                Service availability grouped by domain and criticality tier
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={handleDrillDown}
            >
              View Details
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {snapshots.map((snapshot) => (
                <AvailabilityTile
                  key={`${snapshot.domain}-${snapshot.tier}`}
                  snapshot={snapshot}
                  onClick={handleDrillDown}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Degraded Services Table */}
      {showDegradedServices && degradedServices.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">
                Top Degraded Services
              </CardTitle>
              <CardDescription>
                Services with the highest availability degradation
              </CardDescription>
            </div>
            {degradedServices.length > maxDegradedServices && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={handleDrillDown}
              >
                View All ({degradedServices.length})
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Degradation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {degradedServices
                  .slice(0, maxDegradedServices)
                  .map((service) => (
                    <DegradedServiceRow
                      key={service.service_id}
                      service={service}
                      onClick={() =>
                        handleServiceClick(service.service_id)
                      }
                    />
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* SLA Compliance Summary */}
      {showSLACompliance && slaCompliance.length > 0 && (
        <SLAComplianceSummary
          compliance={slaCompliance}
          onServiceClick={handleServiceClick}
          onViewAll={handleDrillDown}
        />
      )}

      {/* Empty State */}
      {!isLoading &&
        snapshots.length === 0 &&
        degradedServices.length === 0 && (
          <Card className={cn("overflow-hidden", className)}>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Activity className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No availability data available
              </p>
              <p className="text-2xs text-muted-foreground mt-1">
                Adjust your filters or check that services are configured.
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  )
}

// ============================================================
// AvailabilityTile Component
// ============================================================

interface AvailabilityTileProps {
  snapshot: AvailabilitySnapshotType
  onClick?: () => void
}

/**
 * Individual availability tile for a domain/tier combination.
 * Displays availability percentage with color-coded status indicator.
 */
function AvailabilityTile({ snapshot, onClick }: AvailabilityTileProps) {
  const healthStatus = availabilityToHealthStatus(snapshot.availability_pct)
  const sloTarget = getSLOTarget(snapshot.tier)
  const TrendIcon = TREND_ICON_MAP[snapshot.trend] || ArrowRight

  const trendColor =
    snapshot.trend === "up"
      ? "text-green-600 dark:text-green-400"
      : snapshot.trend === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground"

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50",
              healthStatus === "critical" && "border-red-500/30",
              healthStatus === "degraded" && "border-yellow-500/30",
              onClick && "cursor-pointer"
            )}
            onClick={onClick}
          >
            {/* Header: Domain + Tier */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium truncate">
                {snapshot.domain}
              </span>
              <TierBadge tier={snapshot.tier} size="sm" />
            </div>

            {/* Availability Value */}
            <div className="flex items-end gap-2">
              <span
                className={cn(
                  "text-xl font-bold tracking-tight leading-none",
                  healthStatus === "critical" &&
                    "text-red-600 dark:text-red-400",
                  healthStatus === "degraded" &&
                    "text-yellow-600 dark:text-yellow-400",
                  healthStatus === "healthy" &&
                    "text-green-600 dark:text-green-400"
                )}
              >
                {snapshot.availability_pct.toFixed(2)}%
              </span>
              <div className={cn("flex items-center gap-0.5 mb-0.5", trendColor)}>
                <TrendIcon className="h-3 w-3" />
              </div>
            </div>

            {/* Footer: Service counts + Status */}
            <div className="flex items-center justify-between">
              <span className="text-2xs text-muted-foreground">
                {snapshot.services_degraded > 0
                  ? `${snapshot.services_degraded}/${snapshot.services_total} degraded`
                  : `${snapshot.services_total} services`}
              </span>
              <StatusBadge status={healthStatus} size="sm" showIcon={false} />
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4} className="max-w-xs">
          <div className="space-y-1">
            <p className="text-xs font-medium">
              {snapshot.domain} — {snapshot.tier}
            </p>
            <p className="text-2xs text-muted-foreground">
              SLO Target: {sloTarget}%
            </p>
            <p className="text-2xs text-muted-foreground">
              Current: {snapshot.availability_pct.toFixed(2)}%
            </p>
            {snapshot.services_degraded > 0 && (
              <p className="text-2xs text-destructive">
                {snapshot.services_degraded} service(s) below target
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
 * Table row for a degraded service in the top degraded services table.
 */
function DegradedServiceRow({ service, onClick }: DegradedServiceRowProps) {
  const healthStatus = availabilityToHealthStatus(
    getSLOTarget(service.tier) - service.degradation_pct
  )

  return (
    <TableRow
      className={cn(onClick && "cursor-pointer")}
      onClick={onClick}
    >
      <TableCell className="font-medium">
        <span className="truncate max-w-[200px] inline-block">
          {service.service}
        </span>
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
        <span className="text-sm font-medium text-red-600 dark:text-red-400">
          -{service.degradation_pct.toFixed(2)}%
        </span>
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
  )
}

// ============================================================
// SLAComplianceSummary Component
// ============================================================

interface SLAComplianceSummaryProps {
  compliance: SLACompliance[]
  onServiceClick?: (serviceId: string) => void
  onViewAll?: () => void
}

/**
 * SLA compliance summary card showing met/breached counts and
 * a compact list of non-compliant services.
 */
function SLAComplianceSummary({
  compliance,
  onServiceClick,
  onViewAll,
}: SLAComplianceSummaryProps) {
  const metCount = compliance.filter((s) => s.sla_met).length
  const breachedCount = compliance.length - metCount
  const breachedServices = compliance
    .filter((s) => !s.sla_met)
    .sort((a, b) => a.availability_pct - b.availability_pct)
    .slice(0, 5)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold">
            SLA Compliance
          </CardTitle>
          <CardDescription>
            {metCount} of {compliance.length} services meeting SLA targets
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" className="text-2xs">
            {metCount} Met
          </Badge>
          {breachedCount > 0 && (
            <Badge variant="destructive" className="text-2xs">
              {breachedCount} Breached
            </Badge>
          )}
          {onViewAll && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={onViewAll}
            >
              Details
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>

      {breachedServices.length > 0 && (
        <CardContent className="pt-0">
          <div className="space-y-1.5">
            {breachedServices.map((service) => (
              <button
                key={service.service_id}
                type="button"
                className={cn(
                  "flex items-center justify-between w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent/50",
                  "border-red-500/20",
                  onServiceClick && "cursor-pointer"
                )}
                onClick={() => onServiceClick?.(service.service_id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <StatusBadge
                    status={availabilityToHealthStatus(
                      service.availability_pct
                    )}
                    size="sm"
                    showIcon
                    label=""
                  />
                  <span className="text-sm font-medium truncate">
                    {service.service_name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-2xs text-muted-foreground">
                    Target: {service.target_pct}%
                  </span>
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    {service.availability_pct.toFixed(2)}%
                  </span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// ============================================================
// Wrapped Export with Error Boundary
// ============================================================

export interface AvailabilitySnapshotWithBoundaryProps
  extends AvailabilitySnapshotProps {}

/**
 * AvailabilitySnapshot wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function AvailabilitySnapshotWithBoundary(
  props: AvailabilitySnapshotWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Availability Snapshot">
      <AvailabilitySnapshot {...props} />
    </ModuleErrorBoundary>
  )
}

export default AvailabilitySnapshot