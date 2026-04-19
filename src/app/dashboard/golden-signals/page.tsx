"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { FilterBar } from "@/components/shared/filter-bar"
import { PageSkeleton } from "@/components/shared/loading-skeleton"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { LatencyChartWithBoundary } from "@/components/dashboard/golden-signals/latency-chart"
import { TrafficChartWithBoundary } from "@/components/dashboard/golden-signals/traffic-chart"
import { ErrorRateChartWithBoundary } from "@/components/dashboard/golden-signals/error-rate-chart"
import { SaturationChartWithBoundary } from "@/components/dashboard/golden-signals/saturation-chart"
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
// Golden Signals Dashboard Page
// ============================================================

/**
 * Golden Signals dashboard page composing LatencyChart, TrafficChart,
 * ErrorRateChart, and SaturationChart with a shared FilterBar for
 * domain, application, environment, and time period selection.
 *
 * Displays the four golden signals of monitoring (latency, traffic,
 * errors, saturation) in a structured layout with summary metric cards
 * and time-series charts for each signal category.
 *
 * Restricted to authenticated users (enforced by the dashboard layout).
 */
export default function GoldenSignalsPage() {
  const { user, isLoading: isAuthLoading } = useAuth()

  const [filters, setFilters] = React.useState<DashboardFilters>(DEFAULT_FILTERS)

  /**
   * Handles filter changes from the FilterBar component.
   */
  const handleFiltersChange = React.useCallback(
    (newFilters: DashboardFilters) => {
      setFilters(newFilters)
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
        showTable={false}
      />
    )
  }

  return (
    <div className="space-y-6" key={refreshKey}>
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Golden Signals
            </h1>
            <p className="text-sm text-muted-foreground">
              Latency, Traffic, Errors &amp; Saturation — the four golden signals of monitoring
            </p>
          </div>
          <div className="flex items-center gap-2">
            {filters.domain && (
              <Badge variant="secondary" className="text-xs">
                {filters.domain}
              </Badge>
            )}
            {filters.application && (
              <Badge variant="secondary" className="text-xs">
                {filters.application}
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
        visibleFilters={["domain", "application", "environment", "period"]}
      />

      {/* Section 1: Latency (P95 / P99) */}
      <section>
        <LatencyChartWithBoundary
          filters={filters}
          showSummary
          showChart
          showP50={false}
          defaultPeriod={filters.period || "24h"}
          chartHeight={300}
          tier={filters.tier}
        />
      </section>

      <Separator />

      {/* Section 2: Traffic (RPS) */}
      <section>
        <TrafficChartWithBoundary
          filters={filters}
          showSummary
          showChart
          defaultPeriod={filters.period || "24h"}
          chartHeight={300}
          tier={filters.tier}
        />
      </section>

      <Separator />

      {/* Section 3: Error Rate (5xx / 4xx) */}
      <section>
        <ErrorRateChartWithBoundary
          filters={filters}
          showSummary
          showChart
          show4xx
          defaultPeriod={filters.period || "24h"}
          chartHeight={300}
          tier={filters.tier}
        />
      </section>

      <Separator />

      {/* Section 4: Saturation (CPU / Memory / Disk) */}
      <section>
        <SaturationChartWithBoundary
          filters={filters}
          showSummary
          showChart
          showDisk
          defaultPeriod={filters.period || "24h"}
          chartHeight={300}
          tier={filters.tier}
        />
      </section>
    </div>
  )
}