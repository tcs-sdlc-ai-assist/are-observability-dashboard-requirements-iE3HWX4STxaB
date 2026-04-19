"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { FilterBar } from "@/components/shared/filter-bar"
import { PageSkeleton } from "@/components/shared/loading-skeleton"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { AvailabilitySnapshotWithBoundary } from "@/components/dashboard/executive/availability-snapshot"
import { DegradedServicesWithBoundary } from "@/components/dashboard/executive/degraded-services"
import { SLOComplianceViewWithBoundary } from "@/components/dashboard/executive/slo-compliance-view"
import { ErrorBudgetBurndownWithBoundary } from "@/components/dashboard/executive/error-budget-burndown"
import { ErrorBudgetTableWithBoundary } from "@/components/dashboard/executive/error-budget-table"
import { IncidentSummaryWithBoundary } from "@/components/dashboard/incidents/incident-summary"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { DashboardFilters } from "@/types"

// ============================================================
// Constants
// ============================================================

const AVAILABLE_DOMAINS = [
  "Payments",
  "Identity",
  "Platform",
  "Claims",
  "Enrollment",
]

const AVAILABLE_APPLICATIONS = [
  "Checkout API",
  "Auth Service",
  "API Gateway",
  "Claims API",
  "Eligibility API",
  "Billing Service",
  "Notification Service",
  "User Service",
]

const DEFAULT_FILTERS: DashboardFilters = {
  period: "24h",
}

// ============================================================
// Executive Overview Dashboard Page
// ============================================================

/**
 * Executive Overview dashboard page — the primary landing page for
 * authenticated users. Composes availability snapshots, degraded services,
 * SLO compliance heatmap, error budget table, incident summary, and
 * optional error budget burn-down into a unified executive view.
 *
 * Supports global filtering by domain, tier, environment, and time period
 * via the shared FilterBar component. All child modules react to filter
 * changes and re-fetch data accordingly.
 *
 * Restricted to authenticated users (enforced by the dashboard layout).
 */
export default function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth()

  const [filters, setFilters] = React.useState<DashboardFilters>(DEFAULT_FILTERS)

  // Track a selected service for the error budget burn-down detail view
  const [selectedServiceId, setSelectedServiceId] = React.useState<string | null>(null)
  const [selectedServiceName, setSelectedServiceName] = React.useState<string | null>(null)

  /**
   * Handles filter changes from the FilterBar component.
   * Resets the selected service when filters change to avoid stale state.
   */
  const handleFiltersChange = React.useCallback(
    (newFilters: DashboardFilters) => {
      setFilters(newFilters)
      setSelectedServiceId(null)
      setSelectedServiceName(null)
    },
    []
  )

  /**
   * Handles refresh across all dashboard modules by toggling a key.
   */
  const [refreshKey, setRefreshKey] = React.useState(0)
  const handleRefresh = React.useCallback(() => {
    setRefreshKey((prev) => prev + 1)
  }, [])

  // Show loading skeleton while auth state is resolving
  if (isAuthLoading) {
    return (
      <PageSkeleton
        showFilterBar
        metricCards={4}
        showChart
        showTable
      />
    )
  }

  const greeting = user?.name
    ? `Welcome back, ${user.name.split(" ")[0]}`
    : "Executive Overview"

  return (
    <div className="space-y-6" key={refreshKey}>
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {greeting}
            </h1>
            <p className="text-sm text-muted-foreground">
              Application Reliability Engineering — Executive Overview
            </p>
          </div>
          <div className="flex items-center gap-2">
            {filters.domain && (
              <Badge variant="secondary" className="text-xs">
                {filters.domain}
              </Badge>
            )}
            {filters.tier && (
              <Badge variant="secondary" className="text-xs">
                {filters.tier}
              </Badge>
            )}
            {filters.environment && (
              <Badge variant="secondary" className="text-xs">
                {filters.environment}
              </Badge>
            )}
            {filters.period && (
              <Badge variant="info" className="text-xs">
                {filters.period}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Global Filter Bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onRefresh={handleRefresh}
        domains={AVAILABLE_DOMAINS}
        applications={AVAILABLE_APPLICATIONS}
        visibleFilters={["domain", "tier", "environment", "period"]}
      />

      {/* Section 1: Availability Snapshot — Metric Cards + Domain/Tier Grid */}
      <section>
        <AvailabilitySnapshotWithBoundary
          filters={filters}
          showDegradedServices={false}
          showSLACompliance={false}
        />
      </section>

      {/* Section 2: Top Degraded Services + Incident Summary (side by side on large screens) */}
      <section className="grid gap-4 grid-cols-1 xl:grid-cols-2">
        <DegradedServicesWithBoundary
          filters={filters}
          maxServices={5}
          showPeriodSelector={false}
          defaultPeriod={filters.period || "24h"}
          showViewAll
        />

        <IncidentSummaryWithBoundary
          filters={filters}
          showSummary
          showResponseMetrics={false}
          showRootCauses
          showRepeatFailures
          defaultPeriod={filters.period || "24h"}
          tier={filters.tier}
        />
      </section>

      <Separator />

      {/* Section 3: SLO Compliance Heatmap */}
      <section>
        <SLOComplianceViewWithBoundary
          filters={filters}
          showSummary
          showHeatmap
          showTable
          maxServices={20}
        />
      </section>

      <Separator />

      {/* Section 4: Error Budget Summary Table */}
      <section>
        <ErrorBudgetTableWithBoundary
          filters={filters}
          maxServices={10}
          showPeriodSelector={false}
          defaultPeriod={filters.period || "30d"}
          showSummary
          showViewAll
        />
      </section>

      {/* Section 5: Error Budget Burn-down (shown when a service is selected or as default) */}
      {selectedServiceId && (
        <>
          <Separator />
          <section>
            <ErrorBudgetBurndownWithBoundary
              serviceId={selectedServiceId}
              serviceName={selectedServiceName || undefined}
              filters={filters}
              showSummary
              showChart
              showRecommendations
              defaultPeriod={filters.period || "30d"}
              chartHeight={300}
            />
          </section>
        </>
      )}
    </div>
  )
}