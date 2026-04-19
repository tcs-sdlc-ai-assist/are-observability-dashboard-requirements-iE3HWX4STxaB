"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { FilterBar } from "@/components/shared/filter-bar"
import { PageSkeleton } from "@/components/shared/loading-skeleton"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { ComplianceReportViewWithBoundary } from "@/components/dashboard/compliance/compliance-report-view"
import { DocumentationLinksWithBoundary } from "@/components/dashboard/compliance/documentation-links"
import { EvidenceLinksWithBoundary } from "@/components/dashboard/compliance/evidence-links"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  AlertTriangle,
  BookOpen,
  FileText,
  Search,
  Shield,
  X,
} from "lucide-react"
import type { DashboardFilters, TimePeriod } from "@/types"

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

const INCIDENT_ID_PLACEHOLDER = "e.g., inc-0001"

// ============================================================
// Compliance & Governance Page
// ============================================================

/**
 * Compliance & Governance page composing ComplianceReportView,
 * EvidenceLinks, and DocumentationLinks components with a shared
 * FilterBar for domain, tier, environment, and time period selection.
 *
 * Provides:
 * - SLA/SLO compliance report with summary metrics, SLA reports table,
 *   incident audit table, and recommendations
 * - Evidence links viewer for a selected incident with add/edit/delete
 * - Documentation links (playbooks, runbooks, SOPs, architecture docs)
 *   with category filtering and search
 * - CSV export functionality for compliance reports
 *
 * Restricted to authenticated users (enforced by the dashboard layout).
 */
export default function CompliancePage() {
  const { user, isLoading: isAuthLoading } = useAuth()

  const [filters, setFilters] = React.useState<DashboardFilters>(DEFAULT_FILTERS)

  // Evidence links: incident ID input
  const [incidentIdInput, setIncidentIdInput] = React.useState<string>("")
  const [activeIncidentId, setActiveIncidentId] = React.useState<string | undefined>(undefined)

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

  /**
   * Handles applying the incident ID for evidence links.
   */
  const handleApplyIncidentId = React.useCallback(() => {
    const trimmed = incidentIdInput.trim()
    if (trimmed.length > 0) {
      setActiveIncidentId(trimmed)
    }
  }, [incidentIdInput])

  /**
   * Handles clearing the incident ID selection.
   */
  const handleClearIncidentId = React.useCallback(() => {
    setIncidentIdInput("")
    setActiveIncidentId(undefined)
  }, [])

  /**
   * Handles incident ID input keydown for Enter key submission.
   */
  const handleIncidentIdKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleApplyIncidentId()
      }
    },
    [handleApplyIncidentId]
  )

  // Show loading skeleton while auth state is resolving
  if (isAuthLoading) {
    return (
      <PageSkeleton
        showFilterBar
        metricCards={4}
        showChart={false}
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
              Compliance &amp; Governance
            </h1>
            <p className="text-sm text-muted-foreground">
              SLA/SLO compliance reports, incident audit evidence, documentation links &amp; export
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
            {activeIncidentId && (
              <Badge variant="destructive" className="text-xs">
                Incident: {activeIncidentId}
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

      {/* Section 1: Compliance Report */}
      <section>
        <ComplianceReportViewWithBoundary
          filters={filters}
          showSummary
          showSLAReports
          showIncidentAudits
          showRecommendations
          showExport
          defaultPeriod={(filters.period as TimePeriod) || "30d"}
        />
      </section>

      <Separator />

      {/* Section 2: Evidence Links for a Specific Incident */}
      <section>
        <div className="space-y-4">
          {/* Incident ID Selector Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    Incident Evidence
                  </CardTitle>
                </div>
                <CardDescription className="mt-0.5">
                  Enter an incident ID to view and manage audit evidence links for regulatory compliance.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap items-end gap-4">
                {/* Incident ID Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="compliance-incident-id-input" className="text-sm">
                    Incident ID
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="compliance-incident-id-input"
                        type="text"
                        placeholder={INCIDENT_ID_PLACEHOLDER}
                        value={incidentIdInput}
                        onChange={(e) => setIncidentIdInput(e.target.value)}
                        onKeyDown={handleIncidentIdKeyDown}
                        className="h-9 w-[220px] pl-8 text-sm"
                      />
                    </div>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            className="h-9 gap-1.5"
                            onClick={handleApplyIncidentId}
                            disabled={incidentIdInput.trim().length === 0}
                          >
                            <Shield className="h-3.5 w-3.5" />
                            Load Evidence
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={4}>
                          <p className="text-xs">
                            Load evidence links for this incident (Enter)
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {activeIncidentId && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={handleClearIncidentId}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" sideOffset={4}>
                            Clear incident selection
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <p className="text-2xs text-muted-foreground">
                    Enter an incident ID to view associated evidence links, dashboards, logs, and tickets.
                  </p>
                </div>

                {/* Active Incident Info */}
                {activeIncidentId && (
                  <div className="flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2">
                    <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-2xs font-medium text-blue-700 dark:text-blue-400">
                        Viewing evidence for incident: {activeIncidentId}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Evidence Links Component */}
          {activeIncidentId && (
            <EvidenceLinksWithBoundary
              incidentId={activeIncidentId}
              incidentTitle={`Incident ${activeIncidentId}`}
              evidenceLinks={[]}
              isLoading={false}
              showHeader
              showAddButton
              allowEdit
              allowDelete
              maxVisible={10}
              maxHeight={400}
              showEmptyState
            />
          )}

          {/* Prompt when no incident is selected */}
          {!activeIncidentId && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                  <Shield className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  No incident selected
                </p>
                <p className="text-2xs text-muted-foreground mt-1 text-center max-w-[320px]">
                  Enter an incident ID above to view and manage audit evidence links.
                  Evidence links document runbooks, dashboards, logs, traces, and tickets
                  for regulatory compliance.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <Separator />

      {/* Section 3: Documentation Links */}
      <section>
        <DocumentationLinksWithBoundary
          showHeader
          showAddButton
          allowEdit
          allowDelete
          showSearch
          showCategoryFilter
          maxVisible={20}
          maxHeight={500}
          showEmptyState
          viewMode="list"
        />
      </section>

      {/* Compliance Audit Trail Notice */}
      <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-2xs text-muted-foreground leading-relaxed">
          All compliance report generation, evidence link changes, documentation updates,
          and CSV exports are recorded in the audit log for regulatory compliance.
          Reports are generated from audited data sources and reflect the current state
          of SLA/SLO compliance, incident history, and deployment activity.
        </p>
      </div>
    </div>
  )
}