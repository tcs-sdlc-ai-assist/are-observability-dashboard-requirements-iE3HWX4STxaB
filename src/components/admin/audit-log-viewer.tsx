"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Clock,
  Download,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  User,
  X,
  XCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDateTime, formatRelativeTime } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { useAuditLogs } from "@/hooks/use-admin-data"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { RoleGuard } from "@/components/shared/role-guard"
import { MetricCard, MetricCardGrid } from "@/components/shared/metric-card"
import { MetricCardGridSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "@/components/ui/toast"
import {
  PAGINATION,
  ENTITY_TYPES,
} from "@/constants/constants"
import type { AuditLog, EntityType } from "@/types"

// ============================================================
// Types
// ============================================================

export interface AuditLogViewerProps {
  /** Whether to show the summary metric cards (default: true) */
  showSummary?: boolean
  /** Whether to show the search bar (default: true) */
  showSearch?: boolean
  /** Whether to show the action type filter (default: true) */
  showActionFilter?: boolean
  /** Whether to show the entity type filter (default: true) */
  showEntityTypeFilter?: boolean
  /** Whether to show the user filter (default: true) */
  showUserFilter?: boolean
  /** Whether to show the time range filter (default: true) */
  showTimeRangeFilter?: boolean
  /** Whether to show the export button (default: true) */
  showExport?: boolean
  /** Maximum number of logs per page (default: 20) */
  pageSize?: number
  /** Optional entity type to pre-filter */
  defaultEntityType?: EntityType
  /** Optional entity ID to pre-filter */
  defaultEntityId?: string
  /** Optional user ID to pre-filter */
  defaultUserId?: string
  /** Optional action type to pre-filter */
  defaultAction?: string
  /** Callback invoked when a log entry is clicked */
  onLogClick?: (log: AuditLog) => void
  /** Additional CSS class names */
  className?: string
}

type SortField = "timestamp" | "action" | "entity_type" | "user_name"
type SortDirection = "asc" | "desc"

interface SortState {
  field: SortField
  direction: SortDirection
}

// ============================================================
// Constants
// ============================================================

const ALL_VALUE = "__all__"

const TIME_RANGE_OPTIONS = [
  { value: "1h", label: "Last 1 Hour" },
  { value: "6h", label: "Last 6 Hours" },
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "14d", label: "Last 14 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "all", label: "All Time" },
]

const TIME_RANGE_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "14d": 14 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
}

const ACTION_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "UPLOAD_INTERIM_DATA", label: "Upload Data" },
  { value: "UPLOAD_FAILED", label: "Upload Failed" },
  { value: "CONFIGURE_METRICS", label: "Configure Metrics" },
  { value: "UPDATE_METRICS_CONFIG", label: "Update Metrics Config" },
  { value: "DELETE_METRICS_CONFIG", label: "Delete Metrics Config" },
  { value: "CREATE_SERVICE", label: "Create Service" },
  { value: "UPDATE_SERVICE", label: "Update Service" },
  { value: "DELETE_SERVICE", label: "Delete Service" },
  { value: "CREATE_DOMAIN", label: "Create Domain" },
  { value: "UPDATE_DOMAIN", label: "Update Domain" },
  { value: "DELETE_DOMAIN", label: "Delete Domain" },
  { value: "CREATE_INCIDENT", label: "Create Incident" },
  { value: "UPDATE_INCIDENT", label: "Update Incident" },
  { value: "RESOLVE_INCIDENT", label: "Resolve Incident" },
  { value: "CLOSE_INCIDENT", label: "Close Incident" },
  { value: "CREATE_DEPLOYMENT", label: "Create Deployment" },
  { value: "ROLLBACK_DEPLOYMENT", label: "Rollback Deployment" },
  { value: "CREATE_ANNOTATION", label: "Create Annotation" },
  { value: "UPDATE_ANNOTATION", label: "Update Annotation" },
  { value: "DELETE_ANNOTATION", label: "Delete Annotation" },
  { value: "CREATE_DOCUMENTATION_LINK", label: "Create Doc Link" },
  { value: "UPDATE_DOCUMENTATION_LINK", label: "Update Doc Link" },
  { value: "DELETE_DOCUMENTATION_LINK", label: "Delete Doc Link" },
  { value: "CREATE_USER", label: "Create User" },
  { value: "UPDATE_USER", label: "Update User" },
  { value: "DEACTIVATE_USER", label: "Deactivate User" },
  { value: "REACTIVATE_USER", label: "Reactivate User" },
  { value: "CHANGE_USER_ROLE", label: "Change User Role" },
  { value: "USER_LOGIN", label: "User Login" },
  { value: "USER_LOGOUT", label: "User Logout" },
  { value: "LOGIN_FAILED", label: "Login Failed" },
  { value: "GENERATE_COMPLIANCE_REPORT", label: "Generate Report" },
  { value: "EXPORT_AUDIT_LOGS", label: "Export Audit Logs" },
]

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  incident: "Incident",
  metric: "Metric",
  service: "Service",
  deployment: "Deployment",
}

const ACTION_CATEGORY_CONFIG: Record<
  string,
  {
    label: string
    badgeVariant: "destructive" | "warning" | "success" | "info" | "secondary"
  }
> = {
  UPLOAD: { label: "Upload", badgeVariant: "info" },
  CONFIGURE: { label: "Config", badgeVariant: "warning" },
  UPDATE: { label: "Update", badgeVariant: "warning" },
  DELETE: { label: "Delete", badgeVariant: "destructive" },
  CREATE: { label: "Create", badgeVariant: "success" },
  RESOLVE: { label: "Resolve", badgeVariant: "success" },
  CLOSE: { label: "Close", badgeVariant: "secondary" },
  ROLLBACK: { label: "Rollback", badgeVariant: "destructive" },
  DEACTIVATE: { label: "Deactivate", badgeVariant: "destructive" },
  REACTIVATE: { label: "Reactivate", badgeVariant: "success" },
  CHANGE: { label: "Change", badgeVariant: "warning" },
  USER_LOGIN: { label: "Login", badgeVariant: "info" },
  USER_LOGOUT: { label: "Logout", badgeVariant: "secondary" },
  LOGIN_FAILED: { label: "Login Failed", badgeVariant: "destructive" },
  GENERATE: { label: "Generate", badgeVariant: "info" },
  EXPORT: { label: "Export", badgeVariant: "info" },
}

// ============================================================
// Helpers
// ============================================================

/**
 * Determines the action category from the action string for badge display.
 */
function getActionCategory(action: string): {
  label: string
  badgeVariant: "destructive" | "warning" | "success" | "info" | "secondary"
} {
  for (const [prefix, config] of Object.entries(ACTION_CATEGORY_CONFIG)) {
    if (action.startsWith(prefix)) {
      return config
    }
  }
  return { label: "Action", badgeVariant: "secondary" }
}

/**
 * Formats the action string into a human-readable label.
 */
function formatActionLabel(action: string): string {
  const found = ACTION_TYPE_OPTIONS.find((opt) => opt.value === action)
  if (found) return found.label

  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(?:^|\s)\w/g, (match) => match.toUpperCase())
}

/**
 * Summarizes the details JSON into a compact display string.
 */
function summarizeDetails(details: Record<string, unknown> | null | undefined): string {
  if (!details) return "—"

  const entries = Object.entries(details)
  if (entries.length === 0) return "—"

  const summaryParts: string[] = []

  for (const [key, value] of entries.slice(0, 4)) {
    if (value === null || value === undefined) continue

    const displayKey = key.replace(/_/g, " ")

    if (typeof value === "string") {
      const truncated = value.length > 40 ? `${value.substring(0, 40)}…` : value
      summaryParts.push(`${displayKey}: ${truncated}`)
    } else if (typeof value === "number") {
      summaryParts.push(`${displayKey}: ${value}`)
    } else if (typeof value === "boolean") {
      summaryParts.push(`${displayKey}: ${value ? "yes" : "no"}`)
    } else if (Array.isArray(value)) {
      summaryParts.push(`${displayKey}: [${value.length} items]`)
    } else if (typeof value === "object") {
      summaryParts.push(`${displayKey}: {…}`)
    }
  }

  if (entries.length > 4) {
    summaryParts.push(`+${entries.length - 4} more`)
  }

  return summaryParts.join(" · ")
}

/**
 * Computes the from timestamp for a given time range string.
 */
function computeFromTimestamp(timeRange: string): string | undefined {
  if (timeRange === "all") return undefined
  const ms = TIME_RANGE_MS[timeRange]
  if (!ms) return undefined
  return new Date(Date.now() - ms).toISOString()
}

/**
 * Escapes a value for CSV output.
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Exports audit logs to CSV and triggers a browser download.
 */
function exportAuditLogsToCSV(logs: AuditLog[]): void {
  const columns = [
    "id",
    "timestamp",
    "user_id",
    "user_name",
    "action",
    "entity_type",
    "entity_id",
    "correlation_id",
    "ip_address",
    "details",
  ]

  const header = columns.map(escapeCSVValue).join(",")
  const rows = logs.map((log) =>
    columns
      .map((col) => {
        const value = col === "details"
          ? log.details ? JSON.stringify(log.details) : ""
          : (log as Record<string, unknown>)[col]
        return escapeCSVValue(value)
      })
      .join(",")
  )

  const csvContent = [header, ...rows].join("\n")
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  link.setAttribute("download", `audit-logs-${timestamp}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ============================================================
// AuditLogViewer Component
// ============================================================

/**
 * Audit log viewer component with filterable, searchable, paginated table
 * of all admin actions. Shows timestamp, actor, action type, entity,
 * payload summary, IP address, and correlation ID. Supports CSV export
 * and drill-down to entity detail pages.
 *
 * Restricted to users with view:audit_log permission (admin, are_lead roles).
 *
 * @example
 * ```tsx
 * <AuditLogViewer
 *   showSummary
 *   showSearch
 *   showActionFilter
 *   showEntityTypeFilter
 *   showExport
 *   pageSize={20}
 * />
 *
 * // Pre-filtered to a specific entity
 * <AuditLogViewer
 *   defaultEntityType="incident"
 *   defaultEntityId="inc-123"
 *   showSummary={false}
 * />
 * ```
 */
export function AuditLogViewer({
  showSummary = true,
  showSearch = true,
  showActionFilter = true,
  showEntityTypeFilter = true,
  showUserFilter = true,
  showTimeRangeFilter = true,
  showExport = true,
  pageSize = PAGINATION.DEFAULT_PAGE_SIZE,
  defaultEntityType,
  defaultEntityId,
  defaultUserId,
  defaultAction,
  onLogClick,
  className,
}: AuditLogViewerProps) {
  const router = useRouter()
  const { user } = useAuth()

  // Filter state
  const [searchText, setSearchText] = React.useState("")
  const [actionFilter, setActionFilter] = React.useState<string | null>(
    defaultAction || null
  )
  const [entityTypeFilter, setEntityTypeFilter] = React.useState<EntityType | null>(
    defaultEntityType || null
  )
  const [entityIdFilter] = React.useState<string | undefined>(defaultEntityId)
  const [userIdFilter, setUserIdFilter] = React.useState<string | null>(
    defaultUserId || null
  )
  const [timeRange, setTimeRange] = React.useState<string>("30d")
  const [currentPage, setCurrentPage] = React.useState(1)
  const [sort, setSort] = React.useState<SortState>({
    field: "timestamp",
    direction: "desc",
  })
  const [isExporting, setIsExporting] = React.useState(false)

  // Compute from timestamp based on time range
  const fromTimestamp = React.useMemo(
    () => computeFromTimestamp(timeRange),
    [timeRange]
  )

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchText, actionFilter, entityTypeFilter, userIdFilter, timeRange])

  // Fetch audit logs
  const { data, isLoading, error, mutate } = useAuditLogs({
    action: actionFilter || undefined,
    entity_type: entityTypeFilter || undefined,
    entity_id: entityIdFilter,
    user_id: userIdFilter || undefined,
    from: fromTimestamp,
    page: currentPage,
    page_size: pageSize,
  })

  const logs = data?.data || []
  const totalLogs = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(totalLogs / pageSize))
  const hasNext = data?.has_next || false
  const hasPrevious = data?.has_previous || false

  // Client-side search filtering (for immediate feedback on search text)
  const filteredLogs = React.useMemo(() => {
    if (!searchText.trim()) return logs

    const lower = searchText.toLowerCase().trim()
    return logs.filter(
      (log) =>
        log.id.toLowerCase().includes(lower) ||
        log.action.toLowerCase().includes(lower) ||
        log.entity_type.toLowerCase().includes(lower) ||
        log.entity_id.toLowerCase().includes(lower) ||
        (log.user_name && log.user_name.toLowerCase().includes(lower)) ||
        log.user_id.toLowerCase().includes(lower) ||
        (log.correlation_id && log.correlation_id.toLowerCase().includes(lower)) ||
        (log.ip_address && log.ip_address.toLowerCase().includes(lower)) ||
        (log.details && JSON.stringify(log.details).toLowerCase().includes(lower))
    )
  }, [logs, searchText])

  // Client-side sorting
  const sortedLogs = React.useMemo(() => {
    const sorted = [...filteredLogs]

    sorted.sort((a, b) => {
      let comparison = 0

      switch (sort.field) {
        case "timestamp":
          comparison =
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          break
        case "action":
          comparison = a.action.localeCompare(b.action)
          break
        case "entity_type":
          comparison = a.entity_type.localeCompare(b.entity_type)
          break
        case "user_name": {
          const nameA = a.user_name || a.user_id
          const nameB = b.user_name || b.user_id
          comparison = nameA.localeCompare(nameB)
          break
        }
        default:
          comparison = 0
      }

      return sort.direction === "asc" ? comparison : -comparison
    })

    return sorted
  }, [filteredLogs, sort])

  // Active filter count
  const activeFilterCount = React.useMemo(() => {
    let count = 0
    if (searchText.trim().length > 0) count++
    if (actionFilter) count++
    if (entityTypeFilter) count++
    if (userIdFilter) count++
    if (timeRange !== "all") count++
    return count
  }, [searchText, actionFilter, entityTypeFilter, userIdFilter, timeRange])

  // Summary metrics
  const summaryMetrics = React.useMemo(() => {
    const uniqueUsers = new Set(logs.map((l) => l.user_id)).size
    const uniqueActions = new Set(logs.map((l) => l.action)).size
    const failedActions = logs.filter(
      (l) =>
        l.action.includes("FAILED") ||
        l.action.includes("DELETE") ||
        l.action.includes("DEACTIVATE")
    ).length

    return {
      totalLogs,
      uniqueUsers,
      uniqueActions,
      failedActions,
    }
  }, [logs, totalLogs])

  /**
   * Toggles the sort direction for a field, or sets a new sort field.
   */
  const handleSort = React.useCallback((field: SortField) => {
    setSort((prev) => {
      if (prev.field === field) {
        return {
          field,
          direction: prev.direction === "asc" ? "desc" : "asc",
        }
      }
      return { field, direction: "desc" }
    })
  }, [])

  const handleSearchChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchText(e.target.value)
    },
    []
  )

  const handleActionFilterChange = React.useCallback((value: string) => {
    setActionFilter(value === ALL_VALUE ? null : value)
  }, [])

  const handleEntityTypeFilterChange = React.useCallback((value: string) => {
    setEntityTypeFilter(
      value === ALL_VALUE ? null : (value as EntityType)
    )
  }, [])

  const handleUserIdFilterChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.trim()
      setUserIdFilter(val.length > 0 ? val : null)
    },
    []
  )

  const handleTimeRangeChange = React.useCallback((value: string) => {
    setTimeRange(value)
  }, [])

  const handleClearFilters = React.useCallback(() => {
    setSearchText("")
    setActionFilter(defaultAction || null)
    setEntityTypeFilter(defaultEntityType || null)
    setUserIdFilter(defaultUserId || null)
    setTimeRange("30d")
  }, [defaultAction, defaultEntityType, defaultUserId])

  const handlePreviousPage = React.useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1))
  }, [])

  const handleNextPage = React.useCallback(() => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
  }, [totalPages])

  const handleExportCSV = React.useCallback(() => {
    if (sortedLogs.length === 0) return

    setIsExporting(true)

    try {
      exportAuditLogsToCSV(sortedLogs)
      toast.success({
        title: "Export Complete",
        description: `${sortedLogs.length} audit log entries exported as CSV.`,
      })
    } catch (exportError) {
      const errorMsg =
        exportError instanceof Error
          ? exportError.message
          : "An unexpected error occurred during export."
      toast.error({
        title: "Export Failed",
        description: errorMsg,
      })
    } finally {
      setIsExporting(false)
    }
  }, [sortedLogs])

  const handleLogClick = React.useCallback(
    (log: AuditLog) => {
      if (onLogClick) {
        onLogClick(log)
      }
    },
    [onLogClick]
  )

  return (
    <RoleGuard
      allowedRoles={["admin", "are_lead"]}
      fallback={
        <Card className={cn("overflow-hidden", className)}>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              Access Denied
            </p>
            <p className="text-2xs text-muted-foreground mt-1">
              You do not have permission to view the audit log.
            </p>
          </CardContent>
        </Card>
      }
    >
      <div className={cn("space-y-4", className)}>
        {/* Summary Metric Cards */}
        {showSummary && !isLoading && (
          <MetricCardGrid columns={4}>
            <MetricCard
              label="Total Log Entries"
              value={summaryMetrics.totalLogs}
              format="number"
              decimals={0}
              icon={<FileText className="h-4 w-4" />}
              description="Total audit log entries matching the current filters"
            />

            <MetricCard
              label="Unique Users"
              value={summaryMetrics.uniqueUsers}
              format="number"
              decimals={0}
              icon={<User className="h-4 w-4" />}
              description="Number of distinct users who performed actions in the current view"
            />

            <MetricCard
              label="Action Types"
              value={summaryMetrics.uniqueActions}
              format="number"
              decimals={0}
              icon={<Shield className="h-4 w-4" />}
              description="Number of distinct action types in the current view"
            />

            <MetricCard
              label="Critical Actions"
              value={summaryMetrics.failedActions}
              format="number"
              decimals={0}
              trendUpIsGood={false}
              threshold={0}
              thresholdExceededIsBad={true}
              icon={<AlertTriangle className="h-4 w-4" />}
              description="Number of failed, delete, or deactivation actions in the current view"
            />
          </MetricCardGrid>
        )}

        {showSummary && isLoading && (
          <MetricCardGridSkeleton cards={4} columns={4} />
        )}

        {/* Audit Log Table */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">
                  Audit Log
                </CardTitle>
                {totalLogs > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-2xs h-5 min-w-5 justify-center"
                  >
                    {totalLogs}
                  </Badge>
                )}
              </div>
              <CardDescription className="mt-0.5">
                Immutable record of all administrative actions for compliance and audit purposes
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Export CSV */}
              {showExport && (
                <RoleGuard
                  allowedRoles={["admin", "are_lead"]}
                  fallback={null}
                >
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={handleExportCSV}
                          disabled={isExporting || sortedLogs.length === 0}
                        >
                          {isExporting ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Exporting…
                            </>
                          ) : (
                            <>
                              <Download className="h-3.5 w-3.5" />
                              Export CSV
                            </>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={4}>
                        Export current view as CSV
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </RoleGuard>
              )}

              {/* Refresh */}
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => mutate()}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4}>
                    Refresh audit logs
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 border-t border-b px-4 py-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mr-1">
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <Badge
                  variant="secondary"
                  className="text-2xs h-5 min-w-5 justify-center"
                >
                  {activeFilterCount}
                </Badge>
              )}
            </div>

            {/* Search */}
            {showSearch && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search logs..."
                  value={searchText}
                  onChange={handleSearchChange}
                  className="h-8 w-[200px] pl-8 text-xs"
                />
              </div>
            )}

            {/* Action Type Filter */}
            {showActionFilter && (
              <Select
                value={actionFilter || ALL_VALUE}
                onValueChange={handleActionFilterChange}
              >
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All Actions</SelectItem>
                  {ACTION_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Entity Type Filter */}
            {showEntityTypeFilter && (
              <Select
                value={entityTypeFilter || ALL_VALUE}
                onValueChange={handleEntityTypeFilterChange}
              >
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="All Entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All Entities</SelectItem>
                  {ENTITY_TYPES.map((entityType) => (
                    <SelectItem key={entityType} value={entityType}>
                      {ENTITY_TYPE_LABELS[entityType]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* User Filter */}
            {showUserFilter && (
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="User ID..."
                  value={userIdFilter || ""}
                  onChange={handleUserIdFilterChange}
                  className="h-8 w-[140px] pl-8 text-xs"
                />
              </div>
            )}

            {/* Time Range Filter */}
            {showTimeRangeFilter && (
              <Select value={timeRange} onValueChange={handleTimeRangeChange}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Clear Filters */}
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={handleClearFilters}
              >
                <XCircle className="h-3.5 w-3.5" />
                Clear Filters
              </Button>
            )}
          </div>

          {/* Table Content */}
          <CardContent className="px-0 pb-0">
            {/* Error State */}
            {error && (
              <div className="px-4 py-6">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Failed to Load Audit Logs</AlertTitle>
                  <AlertDescription>
                    {error.message || "An unexpected error occurred."}
                  </AlertDescription>
                </Alert>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => mutate()}
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Loading State */}
            {isLoading && !error && (
              <div className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Correlation ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-48" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && sortedLogs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  No audit log entries found
                </p>
                <p className="text-2xs text-muted-foreground mt-1">
                  {activeFilterCount > 0
                    ? "Try adjusting your search or filter criteria."
                    : "No actions have been recorded yet."}
                </p>
                {activeFilterCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-1 text-xs"
                    onClick={handleClearFilters}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Clear Filters
                  </Button>
                )}
              </div>
            )}

            {/* Data Table */}
            {!isLoading && !error && sortedLogs.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortableHeader
                        label="Timestamp"
                        field="timestamp"
                        currentSort={sort}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHeader
                        label="User"
                        field="user_name"
                        currentSort={sort}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Action"
                        field="action"
                        currentSort={sort}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Entity"
                        field="entity_type"
                        currentSort={sort}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Correlation ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLogs.map((log) => (
                    <AuditLogRow
                      key={log.id}
                      log={log}
                      onClick={() => handleLogClick(log)}
                      isClickable={!!onLogClick}
                    />
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Pagination Footer */}
            {!isLoading && !error && totalLogs > 0 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xs text-muted-foreground">
                    Showing {(currentPage - 1) * pageSize + 1}–
                    {Math.min(currentPage * pageSize, totalLogs)} of{" "}
                    {totalLogs} entr{totalLogs !== 1 ? "ies" : "y"}
                  </span>
                  <AuditLogSummaryBadges logs={logs} />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handlePreviousPage}
                    disabled={!hasPrevious}
                  >
                    <ArrowUp className="h-3.5 w-3.5 rotate-[-90deg]" />
                  </Button>
                  <span className="text-2xs text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleNextPage}
                    disabled={!hasNext}
                  >
                    <ArrowDown className="h-3.5 w-3.5 rotate-[-90deg]" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Trail Notice */}
        <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2">
          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-2xs text-muted-foreground leading-relaxed">
            Audit logs are immutable and retained for regulatory compliance.
            All administrative actions, configuration changes, data uploads,
            and user management operations are recorded with actor identity,
            timestamp, and action details.
          </p>
        </div>
      </div>
    </RoleGuard>
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
// AuditLogRow Component
// ============================================================

interface AuditLogRowProps {
  log: AuditLog
  onClick?: () => void
  isClickable: boolean
}

/**
 * Individual audit log table row displaying timestamp, user, action,
 * entity, details summary, IP address, and correlation ID.
 */
function AuditLogRow({ log, onClick, isClickable }: AuditLogRowProps) {
  const actionCategory = getActionCategory(log.action)
  const detailsSummary = summarizeDetails(log.details)

  return (
    <TooltipProvider delayDuration={200}>
      <TableRow
        className={cn(isClickable && "cursor-pointer")}
        onClick={onClick}
      >
        {/* Timestamp */}
        <TableCell>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-2xs text-muted-foreground whitespace-nowrap">
                {formatRelativeTime(log.timestamp)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              <p className="text-xs">{formatDateTime(log.timestamp)}</p>
            </TooltipContent>
          </Tooltip>
        </TableCell>

        {/* User */}
        <TableCell>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-2xs font-medium shrink-0">
                  {log.user_name
                    ? log.user_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : <User className="h-2.5 w-2.5" />}
                </div>
                <span className="text-2xs font-medium truncate max-w-[100px]">
                  {log.user_name || log.user_id}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-xs">
              <div className="space-y-0.5">
                {log.user_name && (
                  <p className="text-xs font-medium">{log.user_name}</p>
                )}
                <p className="text-2xs text-muted-foreground font-mono">
                  {log.user_id}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TableCell>

        {/* Action */}
        <TableCell>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant={actionCategory.badgeVariant}
                  className="text-2xs h-3.5 px-1 shrink-0"
                >
                  {actionCategory.label}
                </Badge>
                <span className="text-2xs text-muted-foreground truncate max-w-[120px]">
                  {formatActionLabel(log.action)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              <p className="text-xs font-mono">{log.action}</p>
            </TooltipContent>
          </Tooltip>
        </TableCell>

        {/* Entity */}
        <TableCell>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="min-w-0">
                <Badge variant="secondary" className="text-2xs">
                  {ENTITY_TYPE_LABELS[log.entity_type as EntityType] ||
                    log.entity_type}
                </Badge>
                <span className="text-2xs text-muted-foreground font-mono block truncate max-w-[100px] mt-0.5">
                  {log.entity_id}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-xs">
              <div className="space-y-0.5">
                <p className="text-xs">
                  Type: {log.entity_type}
                </p>
                <p className="text-2xs text-muted-foreground font-mono">
                  ID: {log.entity_id}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TableCell>

        {/* Details */}
        <TableCell className="max-w-[250px]">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-2xs text-muted-foreground truncate block max-w-[250px]">
                {detailsSummary}
              </span>
            </TooltipTrigger>
            {log.details && Object.keys(log.details).length > 0 && (
              <TooltipContent
                side="top"
                sideOffset={4}
                className="max-w-sm"
              >
                <div className="space-y-1">
                  <p className="text-xs font-medium">Action Details</p>
                  <ScrollArea className="max-h-[200px]">
                    <pre className="text-2xs text-muted-foreground font-mono whitespace-pre-wrap break-words">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              </TooltipContent>
            )}
          </Tooltip>
        </TableCell>

        {/* IP Address */}
        <TableCell>
          <span className="text-2xs text-muted-foreground font-mono">
            {log.ip_address || "—"}
          </span>
        </TableCell>

        {/* Correlation ID */}
        <TableCell>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-2xs text-muted-foreground font-mono truncate max-w-[80px] block">
                {log.correlation_id
                  ? log.correlation_id.substring(0, 12) + "…"
                  : "—"}
              </span>
            </TooltipTrigger>
            {log.correlation_id && (
              <TooltipContent side="top" sideOffset={4}>
                <p className="text-xs font-mono">{log.correlation_id}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TableCell>
      </TableRow>
    </TooltipProvider>
  )
}

// ============================================================
// AuditLogSummaryBadges Component
// ============================================================

interface AuditLogSummaryBadgesProps {
  logs: AuditLog[]
}

/**
 * Compact summary badges for the table footer.
 */
function AuditLogSummaryBadges({ logs }: AuditLogSummaryBadgesProps) {
  const uploadCount = logs.filter((l) =>
    l.action.startsWith("UPLOAD")
  ).length
  const configCount = logs.filter(
    (l) =>
      l.action.startsWith("CONFIGURE") ||
      l.action.startsWith("UPDATE_METRICS")
  ).length
  const deleteCount = logs.filter((l) =>
    l.action.startsWith("DELETE")
  ).length
  const authCount = logs.filter(
    (l) =>
      l.action.startsWith("USER_LOGIN") ||
      l.action.startsWith("USER_LOGOUT") ||
      l.action.startsWith("LOGIN_FAILED")
  ).length

  return (
    <div className="flex items-center gap-2">
      {uploadCount > 0 && (
        <Badge variant="info" className="text-2xs">
          {uploadCount} upload{uploadCount !== 1 ? "s" : ""}
        </Badge>
      )}
      {configCount > 0 && (
        <Badge variant="warning" className="text-2xs">
          {configCount} config
        </Badge>
      )}
      {deleteCount > 0 && (
        <Badge variant="destructive" className="text-2xs">
          {deleteCount} delete{deleteCount !== 1 ? "s" : ""}
        </Badge>
      )}
      {authCount > 0 && (
        <Badge variant="secondary" className="text-2xs">
          {authCount} auth
        </Badge>
      )}
    </div>
  )
}

// ============================================================
// Wrapped Export with Error Boundary
// ============================================================

export interface AuditLogViewerWithBoundaryProps
  extends AuditLogViewerProps {}

/**
 * AuditLogViewer wrapped with a module-level error boundary.
 * Use this export for safe rendering in admin layouts.
 */
export function AuditLogViewerWithBoundary(
  props: AuditLogViewerWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Audit Log Viewer">
      <AuditLogViewer {...props} />
    </ModuleErrorBoundary>
  )
}

export default AuditLogViewer