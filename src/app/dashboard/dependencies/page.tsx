"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { FilterBar } from "@/components/shared/filter-bar"
import { PageSkeleton } from "@/components/shared/loading-skeleton"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { DependencyGraphWithBoundary } from "@/components/dashboard/dependencies/dependency-graph"
import { BlastRadiusPanelWithBoundary } from "@/components/dashboard/dependencies/blast-radius-panel"
import { useDependencyMap } from "@/hooks/use-dashboard-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  Network,
  Search,
  X,
  Zap,
} from "lucide-react"
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

const DEFAULT_FILTERS: DashboardFilters = {}

const DEPTH_OPTIONS = [
  { value: "1", label: "Depth 1" },
  { value: "2", label: "Depth 2" },
  { value: "3", label: "Depth 3" },
  { value: "4", label: "Depth 4" },
  { value: "5", label: "Depth 5" },
]

// ============================================================
// Service Dependencies Page
// ============================================================

/**
 * Service Dependencies page composing DependencyGraph, ServiceNode,
 * and BlastRadiusPanel with an incident selector for blast radius
 * highlighting. Provides a shared FilterBar for domain, tier,
 * environment selection and an incident ID input for blast radius
 * computation.
 *
 * Displays an interactive service topology graph with color-coded
 * health status indicators, dependency edges, and blast radius
 * highlighting when an incident is selected.
 *
 * Restricted to authenticated users (enforced by the dashboard layout).
 */
export default function DependenciesPage() {
  const { user, isLoading: isAuthLoading } = useAuth()

  const [filters, setFilters] = React.useState<DashboardFilters>(DEFAULT_FILTERS)
  const [incidentId, setIncidentId] = React.useState<string>("")
  const [activeIncidentId, setActiveIncidentId] = React.useState<string | undefined>(undefined)
  const [serviceId, setServiceId] = React.useState<string | undefined>(undefined)
  const [depth, setDepth] = React.useState<number>(3)
  const [showBlastRadius, setShowBlastRadius] = React.useState(false)

  // Fetch dependency map data for the blast radius panel
  const { data: dependencyMapData } = useDependencyMap({
    incident_id: activeIncidentId,
    service_id: serviceId,
    domain: filters?.domain,
    tier: filters?.tier,
    environment: filters?.environment,
    depth,
  })

  // Determine root service ID from the dependency map data
  const rootServiceId = React.useMemo(() => {
    if (serviceId) return serviceId
    if (dependencyMapData && activeIncidentId) {
      // The dependency map service returns root_service_id when scoped to an incident
      return (dependencyMapData as { root_service_id?: string }).root_service_id || undefined
    }
    return undefined
  }, [serviceId, dependencyMapData, activeIncidentId])

  // Show blast radius panel when an incident is active and there's blast radius data
  React.useEffect(() => {
    if (activeIncidentId && dependencyMapData && dependencyMapData.blast_radius.length > 0) {
      setShowBlastRadius(true)
    }
  }, [activeIncidentId, dependencyMapData])

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
   * Handles applying the incident ID for blast radius computation.
   */
  const handleApplyIncident = React.useCallback(() => {
    const trimmed = incidentId.trim()
    if (trimmed.length > 0) {
      setActiveIncidentId(trimmed)
      setServiceId(undefined)
    }
  }, [incidentId])

  /**
   * Handles clearing the incident selection.
   */
  const handleClearIncident = React.useCallback(() => {
    setIncidentId("")
    setActiveIncidentId(undefined)
    setShowBlastRadius(false)
  }, [])

  /**
   * Handles incident ID input keydown for Enter key submission.
   */
  const handleIncidentKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleApplyIncident()
      }
    },
    [handleApplyIncident]
  )

  /**
   * Handles depth change from the depth selector.
   */
  const handleDepthChange = React.useCallback((value: string) => {
    setDepth(Number(value))
  }, [])

  /**
   * Handles service click from the blast radius panel for navigation.
   */
  const handleServiceClick = React.useCallback((clickedServiceId: string) => {
    setServiceId(clickedServiceId)
    setActiveIncidentId(undefined)
  }, [])

  /**
   * Handles closing the blast radius panel.
   */
  const handleCloseBlastRadius = React.useCallback(() => {
    setShowBlastRadius(false)
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

  const hasActiveIncident = !!activeIncidentId
  const hasBlastRadius =
    dependencyMapData && dependencyMapData.blast_radius.length > 0

  return (
    <div className="space-y-6" key={refreshKey}>
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Service Dependency Map
            </h1>
            <p className="text-sm text-muted-foreground">
              Interactive service topology with health status, dependency edges &amp; blast radius analysis
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
            {hasActiveIncident && (
              <Badge variant="destructive" className="text-xs">
                Incident: {activeIncidentId}
              </Badge>
            )}
            {hasBlastRadius && (
              <Badge variant="warning" className="text-xs">
                {dependencyMapData!.blast_radius.length} Affected
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
        visibleFilters={["domain", "tier", "environment"]}
      />

      {/* Incident Selector & Depth Controls */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Blast Radius Analysis
              </CardTitle>
            </div>
            <CardDescription className="mt-0.5">
              Enter an incident ID to highlight the blast radius on the dependency graph, or select a depth for traversal.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-end gap-4">
            {/* Incident ID Input */}
            <div className="space-y-1.5">
              <Label htmlFor="incident-id-input" className="text-sm">
                Incident ID
              </Label>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="incident-id-input"
                    type="text"
                    placeholder="e.g., inc-0001"
                    value={incidentId}
                    onChange={(e) => setIncidentId(e.target.value)}
                    onKeyDown={handleIncidentKeyDown}
                    className="h-9 w-[220px] pl-8 text-sm"
                  />
                </div>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        className="h-9 gap-1.5"
                        onClick={handleApplyIncident}
                        disabled={incidentId.trim().length === 0}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Analyze
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>
                      <p className="text-xs">
                        Compute blast radius for this incident (Enter)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {hasActiveIncident && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={handleClearIncident}
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
                Enter an incident ID to visualize the blast radius on the graph.
              </p>
            </div>

            {/* Depth Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="depth-select" className="text-sm">
                Traversal Depth
              </Label>
              <Select value={String(depth)} onValueChange={handleDepthChange}>
                <SelectTrigger id="depth-select" className="h-9 w-[130px] text-sm">
                  <SelectValue placeholder="Depth" />
                </SelectTrigger>
                <SelectContent>
                  {DEPTH_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-2xs text-muted-foreground">
                Maximum hops from the root service.
              </p>
            </div>

            {/* Active Incident Info */}
            {hasActiveIncident && (
              <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-2xs font-medium text-red-700 dark:text-red-400">
                    Blast radius active for incident: {activeIncidentId}
                  </p>
                  {hasBlastRadius && (
                    <p className="text-2xs text-red-600/80 dark:text-red-400/80">
                      {dependencyMapData!.blast_radius.length} downstream service
                      {dependencyMapData!.blast_radius.length !== 1 ? "s" : ""} affected
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dependency Graph + Blast Radius Panel */}
      <div className="flex gap-4">
        {/* Main Graph Area */}
        <div className="flex-1 min-w-0">
          <DependencyGraphWithBoundary
            incidentId={activeIncidentId}
            serviceId={serviceId}
            filters={filters}
            showSummary
            showMinimap
            showControls
            graphHeight={600}
            depth={depth}
          />
        </div>

        {/* Blast Radius Side Panel */}
        {showBlastRadius && hasActiveIncident && (
          <div className="shrink-0">
            <BlastRadiusPanelWithBoundary
              dependencyMap={dependencyMapData}
              incidentId={activeIncidentId}
              rootServiceId={rootServiceId}
              isOpen={showBlastRadius}
              onClose={handleCloseBlastRadius}
              onServiceClick={handleServiceClick}
              isLoading={false}
            />
          </div>
        )}
      </div>
    </div>
  )
}