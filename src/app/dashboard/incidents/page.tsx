"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { FilterBar } from "@/components/shared/filter-bar"
import { PageSkeleton } from "@/components/shared/loading-skeleton"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { IncidentSummaryWithBoundary } from "@/components/dashboard/incidents/incident-summary"
import { MTTRMTTDChartWithBoundary } from "@/components/dashboard/incidents/mttr-mttd-chart"
import { IncidentTableWithBoundary } from "@/components/dashboard/incidents/incident-table"
import { RCABreakdownWithBoundary } from "@/components/dashboard/incidents/rca-breakdown"
import { FailurePatternsWithBoundary } from "@/components/dashboard/incidents/failure-patterns"
import { ChangeFailureCorrelationWithBoundary } from "@/components/dashboard/incidents/change-failure-correlation"
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
  period: "30d",
}

// ============================================================
// Incident Analytics Dashboard Page
// ============================================================

/**
 * Incident Analytics & RCA dashboard page composing IncidentSummary,
 * MttrMttdChart, IncidentTable, RcaBreakdown, FailurePatterns, and
 * ChangeFailureCorrelation with a shared FilterBar for domain,
 * application, tier, environment, severity, status, and time period
 * selection.
 *
 * Displays incident counts by severity (P1-P4), MTTR/MTTD response
 * metrics, root cause analysis breakdown, repeat failure pattern
 * detection, change failure correlation analysis, and a detailed
 * incident analytics table.
 *
 * Restricted to authenticated users (enforced by the dashboard layout).
 */
export default function IncidentsPage() {
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
        metricCards={5}
        showChart
        showTable
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
              Incident Analytics
            </h1>
            <p className="text-sm text-muted-foreground">
              Incident counts, MTTR/MTTD trends, root cause analysis, failure patterns &amp; change failure correlation
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
            {filters.severity && (
              <Badge variant="warning" className="text-xs">
                {filters.severity}
              </Badge>
            )}
            {filters.status && (
              <Badge variant="info" className="text-xs">
                {filters.status}
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
        visibleFilters={["domain", "application", "tier", "environment", "severity", "status", "period"]}
      />

      {/* Section 1: Incident Summary — Severity Counts, MTTR/MTTD, Root Causes, Repeat Failures */}
      <section>
        <IncidentSummaryWithBoundary
          filters={filters}
          showSummary
          showResponseMetrics
          showRootCauses
          showRepeatFailures
          defaultPeriod={filters.period || "30d"}
          tier={filters.tier}
        />
      </section>

      <Separator />

      {/* Section 2: MTTR / MTTD Trends Chart */}
      <section>
        <MTTRMTTDChartWithBoundary
          filters={filters}
          showSummary
          showChart
          defaultPeriod={filters.period || "30d"}
          chartHeight={300}
          tier={filters.tier}
        />
      </section>

      <Separator />

      {/* Section 3: Root Cause Analysis Breakdown */}
      <section>
        <RCABreakdownWithBoundary
          filters={filters}
          showSummary
          showChart
          showRepeatFailures
          showCategoryList
          defaultPeriod={filters.period || "30d"}
          chartHeight={300}
          tier={filters.tier}
        />
      </section>

      <Separator />

      {/* Section 4: Failure Patterns */}
      <section>
        <FailurePatternsWithBoundary
          filters={filters}
          showSummary
          showPatternList
          showAffectedServices
          showRecommendations
          defaultPeriod={filters.period || "30d"}
          tier={filters.tier}
        />
      </section>

      <Separator />

      {/* Section 5: Change Failure Correlation */}
      <section>
        <ChangeFailureCorrelationWithBoundary
          filters={filters}
          showSummary
          showChart
          showTable
          showRecommendations
          defaultPeriod={filters.period || "30d"}
          chartHeight={300}
          tier={filters.tier}
        />
      </section>

      <Separator />

      {/* Section 6: Detailed Incident Analytics Table */}
      <section>
        <IncidentTableWithBoundary
          filters={filters}
          pageSize={20}
          showSummary
          showSearch
          showSeverityFilter
          showStatusFilter
          showRootCauseFilter
          showPeriodSelector={false}
          defaultPeriod={filters.period || "30d"}
          tier={filters.tier}
        />
      </section>
    </div>
  )
}