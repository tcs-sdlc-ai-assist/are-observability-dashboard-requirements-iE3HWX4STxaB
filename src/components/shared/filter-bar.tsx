"use client"

import * as React from "react"
import { Filter, RefreshCw, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  CRITICALITY_TIERS,
  CRITICALITY_TIER_LABELS,
  ENVIRONMENTS,
  ENVIRONMENT_LABELS,
  TIME_PERIODS,
  TIME_PERIOD_LABELS,
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_STATUSES,
  INCIDENT_STATUS_LABELS,
} from "@/constants/constants"
import type {
  CriticalityTier,
  DashboardFilters,
  Environment,
  IncidentSeverity,
  IncidentStatus,
  TimePeriod,
} from "@/types"

// ============================================================
// Types
// ============================================================

export interface FilterBarProps {
  /** Current filter values */
  filters: DashboardFilters
  /** Callback when any filter value changes */
  onFiltersChange: (filters: DashboardFilters) => void
  /** Optional callback for the refresh button */
  onRefresh?: () => void
  /** Whether data is currently loading/refreshing */
  isLoading?: boolean
  /** List of available domains for the domain selector */
  domains?: string[]
  /** List of available applications for the application selector */
  applications?: string[]
  /** Which filter controls to show (defaults to all) */
  visibleFilters?: Array<
    "domain" | "application" | "tier" | "environment" | "period" | "severity" | "status"
  >
  /** Additional CSS class names */
  className?: string
}

// ============================================================
// Constants
// ============================================================

const ALL_VALUE = "__all__"

const DEFAULT_VISIBLE_FILTERS: FilterBarProps["visibleFilters"] = [
  "domain",
  "tier",
  "environment",
  "period",
]

// ============================================================
// FilterBar Component
// ============================================================

/**
 * Reusable filter bar component used across all dashboard modules.
 * Provides domain, application, tier, environment, time period,
 * severity, and status selectors with consistent styling and behavior.
 *
 * Supports controlled filter state via `filters` and `onFiltersChange` props.
 * Includes a refresh button and active filter count badge.
 *
 * @example
 * ```tsx
 * const [filters, setFilters] = useState<DashboardFilters>({ period: "24h" });
 *
 * <FilterBar
 *   filters={filters}
 *   onFiltersChange={setFilters}
 *   onRefresh={() => mutateAll()}
 *   isLoading={isLoading}
 *   domains={["payments", "identity", "platform"]}
 *   visibleFilters={["domain", "tier", "environment", "period"]}
 * />
 * ```
 */
export function FilterBar({
  filters,
  onFiltersChange,
  onRefresh,
  isLoading = false,
  domains = [],
  applications = [],
  visibleFilters = DEFAULT_VISIBLE_FILTERS,
  className,
}: FilterBarProps) {
  /**
   * Updates a single filter key, preserving other filter values.
   * If the value is the "all" sentinel, the key is removed from filters.
   */
  const handleFilterChange = React.useCallback(
    (key: keyof DashboardFilters, value: string) => {
      const updated = { ...filters }

      if (value === ALL_VALUE || value === "") {
        delete updated[key]
      } else {
        // Type-safe assignment based on key
        switch (key) {
          case "domain":
          case "application":
          case "service":
            ;(updated as Record<string, unknown>)[key] = value
            break
          case "tier":
            updated.tier = value as CriticalityTier
            break
          case "environment":
            updated.environment = value as Environment
            break
          case "period":
            updated.period = value as TimePeriod
            break
          case "severity":
            updated.severity = value as IncidentSeverity
            break
          case "status":
            updated.status = value as IncidentStatus
            break
        }
      }

      // If domain changes, clear application since it may no longer be valid
      if (key === "domain") {
        delete updated.application
      }

      onFiltersChange(updated)
    },
    [filters, onFiltersChange]
  )

  /**
   * Clears all active filters.
   */
  const handleClearAll = React.useCallback(() => {
    onFiltersChange({})
  }, [onFiltersChange])

  /**
   * Counts the number of active (non-empty) filters.
   */
  const activeFilterCount = React.useMemo(() => {
    let count = 0
    if (filters.domain) count++
    if (filters.application) count++
    if (filters.tier) count++
    if (filters.environment) count++
    if (filters.period) count++
    if (filters.severity) count++
    if (filters.status) count++
    return count
  }, [filters])

  const isFilterVisible = React.useCallback(
    (filterKey: string): boolean => {
      return visibleFilters?.includes(filterKey as never) ?? false
    },
    [visibleFilters]
  )

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 shadow-dashboard",
          className
        )}
      >
        {/* Filter Icon & Label */}
        <div className="flex items-center gap-1.5 text-muted-foreground mr-1">
          <Filter className="h-4 w-4" />
          <span className="hidden text-sm font-medium sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="text-2xs h-5 min-w-5 justify-center">
              {activeFilterCount}
            </Badge>
          )}
        </div>

        {/* Domain Selector */}
        {isFilterVisible("domain") && (
          <Select
            value={filters.domain || ALL_VALUE}
            onValueChange={(value) => handleFilterChange("domain", value)}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="All Domains" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Domains</SelectItem>
              {domains.map((domain) => (
                <SelectItem key={domain} value={domain}>
                  {domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Application Selector */}
        {isFilterVisible("application") && (
          <Select
            value={filters.application || ALL_VALUE}
            onValueChange={(value) => handleFilterChange("application", value)}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="All Applications" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Applications</SelectItem>
              {applications.map((app) => (
                <SelectItem key={app} value={app}>
                  {app}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Criticality Tier Selector */}
        {isFilterVisible("tier") && (
          <Select
            value={filters.tier || ALL_VALUE}
            onValueChange={(value) => handleFilterChange("tier", value)}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="All Tiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Tiers</SelectItem>
              {CRITICALITY_TIERS.map((tier) => (
                <SelectItem key={tier} value={tier}>
                  {CRITICALITY_TIER_LABELS[tier]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Environment Selector */}
        {isFilterVisible("environment") && (
          <Select
            value={filters.environment || ALL_VALUE}
            onValueChange={(value) => handleFilterChange("environment", value)}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="All Environments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Environments</SelectItem>
              {ENVIRONMENTS.map((env) => (
                <SelectItem key={env} value={env}>
                  {ENVIRONMENT_LABELS[env]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Time Period Selector */}
        {isFilterVisible("period") && (
          <Select
            value={filters.period || ALL_VALUE}
            onValueChange={(value) => handleFilterChange("period", value)}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Time</SelectItem>
              {TIME_PERIODS.map((period) => (
                <SelectItem key={period} value={period}>
                  {TIME_PERIOD_LABELS[period]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Severity Selector */}
        {isFilterVisible("severity") && (
          <Select
            value={filters.severity || ALL_VALUE}
            onValueChange={(value) => handleFilterChange("severity", value)}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue placeholder="All Severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Severities</SelectItem>
              {INCIDENT_SEVERITIES.map((severity) => (
                <SelectItem key={severity} value={severity}>
                  {INCIDENT_SEVERITY_LABELS[severity]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Status Selector */}
        {isFilterVisible("status") && (
          <Select
            value={filters.status || ALL_VALUE}
            onValueChange={(value) => handleFilterChange("status", value)}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Statuses</SelectItem>
              {INCIDENT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {INCIDENT_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Clear Filters */}
          {activeFilterCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleClearAll}
                  aria-label="Clear all filters"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                Clear all filters
              </TooltipContent>
            </Tooltip>
          )}

          {/* Refresh Button */}
          {onRefresh && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onRefresh}
                  disabled={isLoading}
                  aria-label="Refresh data"
                >
                  <RefreshCw
                    className={cn(
                      "h-4 w-4",
                      isLoading && "animate-spin"
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                Refresh data
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

export default FilterBar