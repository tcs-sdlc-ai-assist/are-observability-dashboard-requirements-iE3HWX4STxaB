"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDate, formatDateTime, formatDuration, formatRelativeTime, formatPercentage, formatNumber } from "@/lib/utils"
import { useComplianceReport } from "@/hooks/use-admin-data"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { MetricCard, MetricCardGrid } from "@/components/shared/metric-card"
import { StatusBadge, availabilityToHealthStatus } from "@/components/shared/status-badge"
import { TierBadge, SeverityBadge, IncidentStatusBadge, SLOStatusBadge } from "@/components/shared/status-badge"
import { MetricCardGridSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"
import { RoleGuard } from "@/components/shared/role-guard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "@/components/ui/toast"
import { ROUTES, DEFAULT_THRESHOLDS } from "@/constants/constants"
import type {
  CriticalityTier,
  DashboardFilters,
  IncidentSeverity,
  TimePeriod,
} from "@/types"

// ============================================================
// Types
// ============================================================

export interface ComplianceReportViewProps {
  /** Dashboard-level filters to apply */
  filters?: DashboardFilters
  /** Whether to show the summary metric cards (default: true) */
  showSummary?: boolean
  /** Whether to show the SLA reports table (default: true) */
  showSLAReports?: boolean
  /** Whether to show the incident audits table (default: true) */
  showIncidentAudits?: boolean
  /** Whether to show the recommendations section (default: true) */
  showRecommendations?: boolean
  /** Whether to show the export button (default: true) */
  showExport?: boolean
  /** Default time period (default: "30d") */
  defaultPeriod?: TimePeriod
  /** Additional CSS class names */
  className?: string
}

interface SLAReportRow {
  service_id: string
  service_name: string
  domain: string
  tier: string
  availability_pct: number
  sla_target: number
  sla_met: boolean
  slo_met: boolean
  breaches: number
  downtime_minutes: number
  period: string
}

interface IncidentAuditRow {
  incident_id: string
  title: string
  service_id: string
  service_name: string
  domain: string
  severity: IncidentSeverity
  status: string
  start_time: string
  end_time: string | null
  mttr: number | null
  mttd: number | null
  root_cause: string | null
  root_cause_details: string | null
  repeat_failure: boolean
  resolved: boolean
  evidence_links: Array<{ url: string; title: string; type: string }>
  annotations_count: number
}

interface ComplianceSummary {
  total_services: number
  services_meeting_sla: number
  services_breaching_sla: number
  overall_availability_pct: number
  total_incidents: number
  critical_incidents: number
  major_incidents: number
  avg_mttr_minutes: number
  avg_mttd_minutes: number
  repeat_failure_count: number
  total_deployments: number
  failed_deployments: number
  change_failure_rate_pct: number
}

// ============================================================
// Constants
// ============================================================

const PERIOD_OPTIONS: Array<{ value: TimePeriod; label: string }> = [
  { value: "7d", label: "Last 7 Days" },
  { value: "14d", label: "Last 14 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
]

// ============================================================
// Helpers
// ============================================================

/**
 * Escapes a value for CSV output.
 * Wraps in double quotes if the value contains commas, quotes, or newlines.
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }

  const str = String(value)

  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`
  }

  return str
}

/**
 * Converts an array of objects to CSV string.
 */
function objectsToCSV(
  rows: Array<Record<string, unknown>>,
  columns: string[]
): string {
  const header = columns.map(escapeCSVValue).join(",")
  const dataRows = rows.map((row) =>
    columns.map((col) => escapeCSVValue(row[col])).join(",")
  )

  return [header, ...dataRows].join("\n")
}

/**
 * Triggers a browser download of a CSV string.
 */
function downloadCSV(csvContent: string, fileName: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", fileName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Builds the full compliance CSV export from report data.
 */
function buildComplianceCSV(
  summary: ComplianceSummary,
  slaReports: SLAReportRow[],
  incidentAudits: IncidentAuditRow[],
  recommendations: string[],
  reportId: string,
  generatedAt: string,
  period: string,
  from: string,
  to: string
): string {
  const sections: string[] = []

  // Summary section
  sections.push("=== COMPLIANCE REPORT SUMMARY ===")
  sections.push(`Report ID,${escapeCSVValue(reportId)}`)
  sections.push(`Generated At,${escapeCSVValue(generatedAt)}`)
  sections.push(`Period,${escapeCSVValue(period)}`)
  sections.push(`From,${escapeCSVValue(from)}`)
  sections.push(`To,${escapeCSVValue(to)}`)
  sections.push(`Total Services,${summary.total_services}`)
  sections.push(`Services Meeting SLA,${summary.services_meeting_sla}`)
  sections.push(`Services Breaching SLA,${summary.services_breaching_sla}`)
  sections.push(
    `Overall Availability %,${summary.overall_availability_pct}`
  )
  sections.push(`Total Incidents,${summary.total_incidents}`)
  sections.push(`Critical Incidents,${summary.critical_incidents}`)
  sections.push(`Major Incidents,${summary.major_incidents}`)
  sections.push(`Avg MTTR (minutes),${summary.avg_mttr_minutes}`)
  sections.push(`Avg MTTD (minutes),${summary.avg_mttd_minutes}`)
  sections.push(`Repeat Failures,${summary.repeat_failure_count}`)
  sections.push(`Total Deployments,${summary.total_deployments}`)
  sections.push(`Failed Deployments,${summary.failed_deployments}`)
  sections.push(
    `Change Failure Rate %,${summary.change_failure_rate_pct}`
  )
  sections.push("")

  // SLA Reports section
  if (slaReports.length > 0) {
    sections.push("=== SLA REPORTS ===")
    const slaColumns = [
      "service_id",
      "service_name",
      "domain",
      "tier",
      "availability_pct",
      "sla_target",
      "sla_met",
      "slo_met",
      "breaches",
      "downtime_minutes",
      "period",
    ]
    const slaCSV = objectsToCSV(
      slaReports.map((r) => ({ ...r })),
      slaColumns
    )
    sections.push(slaCSV)
    sections.push("")
  }

  // Incident Audits section
  if (incidentAudits.length > 0) {
    sections.push("=== INCIDENT AUDITS ===")
    const incidentColumns = [
      "incident_id",
      "title",
      "service_id",
      "service_name",
      "domain",
      "severity",
      "status",
      "start_time",
      "end_time",
      "mttr",
      "mttd",
      "root_cause",
      "root_cause_details",
      "repeat_failure",
      "resolved",
      "evidence_links_count",
      "annotations_count",
    ]
    const incidentRows = incidentAudits.map((i) => ({
      incident_id: i.incident_id,
      title: i.title,
      service_id: i.service_id,
      service_name: i.service_name,
      domain: i.domain,
      severity: i.severity,
      status: i.status,
      start_time: i.start_time,
      end_time: i.end_time || "",
      mttr: i.mttr !== null ? i.mttr : "",
      mttd: i.mttd !== null ? i.mttd : "",
      root_cause: i.root_cause || "",
      root_cause_details: i.root_cause_details || "",
      repeat_failure: i.repeat_failure,
      resolved: i.resolved,
      evidence_links_count: i.evidence_links.length,
      annotations_count: i.annotations_count,
    }))
    const incidentCSV = objectsToCSV(incidentRows, incidentColumns)
    sections.push(incidentCSV)
    sections.push("")
  }

  // Recommendations section
  if (recommendations.length > 0) {
    sections.push("=== RECOMMENDATIONS ===")
    recommendations.forEach((rec, index) => {
      sections.push(`${index + 1},${escapeCSVValue(rec)}`)
    })
    sections.push("")
  }

  return sections.join("\n")
}

// ============================================================
// ComplianceReportView Component
// ============================================================

/**
 * Compliance report viewer component displaying SLA/uptime/incident audit
 * data in structured tables with evidence links. Includes summary metric
 * cards, SLA compliance table, incident audit table, recommendations,
 * and export to CSV functionality.
 *
 * Integrates with the compliance report API to fetch aggregated data
 * for the selected time period and filters.
 *
 * @example
 * ```tsx
 * <ComplianceReportView
 *   filters={{ domain: "payments", period: "30d" }}
 *   showSummary
 *   showSLAReports
 *   showIncidentAudits
 *   showRecommendations
 *   showExport
 * />
 * ```
 */
export function ComplianceReportView({
  filters,
  showSummary = true,
  showSLAReports = true,
  showIncidentAudits = true,
  showRecommendations = true,
  showExport = true,
  defaultPeriod = "30d",
  className,
}: ComplianceReportViewProps) {
  const router = useRouter()

  const [period, setPeriod] = React.useState<TimePeriod>(
    filters?.period || defaultPeriod
  )
  const [activeTab, setActiveTab] = React.useState<string>("sla")
  const [isExporting, setIsExporting] = React.useState(false)

  // Sync period with external filter changes
  React.useEffect(() => {
    if (filters?.period) {
      setPeriod(filters.period)
    }
  }, [filters?.period])

  const { data, isLoading, error, mutate } = useComplianceReport({
    domain: filters?.domain,
    service_id: filters?.service,
    tier: filters?.tier,
    environment: filters?.environment,
    period,
  })

  // Extract report sections
  const reportId = data?.report_id || ""
  const generatedAt = data?.generated_at || ""
  const reportPeriod = data?.period || period
  const reportFrom = data?.from || ""
  const reportTo = data?.to || ""

  const summary = (data?.summary || null) as ComplianceSummary | null
  const slaReports = (data?.sla_reports || []) as SLAReportRow[]
  const incidentAudits = (data?.incident_audits || []) as IncidentAuditRow[]
  const recommendations = (data?.recommendations || []) as string[]

  const handlePeriodChange = React.useCallback((value: string) => {
    setPeriod(value as TimePeriod)
  }, [])

  const handleServiceClick = React.useCallback(
    (serviceId: string) => {
      router.push(ROUTES.SERVICE_DETAIL(serviceId))
    },
    [router]
  )

  const handleIncidentClick = React.useCallback(
    (incidentId: string) => {
      router.push(ROUTES.INCIDENT_DETAIL(incidentId))
    },
    [router]
  )

  const handleViewAuditLog = React.useCallback(() => {
    router.push(ROUTES.ADMIN_AUDIT_LOG)
  }, [router])

  const handleExportCSV = React.useCallback(() => {
    if (!data || !summary) return

    setIsExporting(true)

    try {
      const csvContent = buildComplianceCSV(
        summary,
        slaReports,
        incidentAudits,
        recommendations,
        reportId,
        generatedAt,
        reportPeriod,
        reportFrom,
        reportTo
      )

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const fileName = `compliance-report-${timestamp}.csv`

      downloadCSV(csvContent, fileName)

      toast.success({
        title: "Export Complete",
        description: `Compliance report exported as ${fileName}.`,
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
  }, [
    data,
    summary,
    slaReports,
    incidentAudits,
    recommendations,
    reportId,
    generatedAt,
    reportPeriod,
    reportFrom,
    reportTo,
  ])

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
              Compliance Report
            </CardTitle>
            <CardDescription>
              Failed to load compliance report data.
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
        <TableSkeleton rows={6} columns={8} showHeader />
      </div>
    )
  }

  // Empty state
  if (!data || !summary) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Compliance Report
            </CardTitle>
            <CardDescription>
              SLA/SLO compliance and incident audit report
            </CardDescription>
          </div>
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
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Shield className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No compliance data available
          </p>
          <p className="text-2xs text-muted-foreground mt-1">
            Adjust your filters or check that services are configured.
          </p>
        </CardContent>
      </Card>
    )
  }

  const slaComplianceRate =
    summary.total_services > 0
      ? Math.round(
          (summary.services_meeting_sla / summary.total_services) * 10000
        ) / 100
      : 100

  const hasBreaches = summary.services_breaching_sla > 0
  const hasCriticalIncidents = summary.critical_incidents > 0
  const hasRepeatFailures = summary.repeat_failure_count > 0

  return (
    <div className={cn("space-y-4", className)}>
      {/* Report Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">
                Compliance Report
              </CardTitle>
              {hasBreaches ? (
                <Badge variant="destructive" className="text-2xs">
                  {summary.services_breaching_sla} SLA Breach
                  {summary.services_breaching_sla !== 1 ? "es" : ""}
                </Badge>
              ) : (
                <Badge variant="success" className="text-2xs">
                  All SLAs Met
                </Badge>
              )}
            </div>
            <CardDescription className="mt-0.5">
              <span className="flex items-center gap-2">
                <span>
                  Report ID: {reportId}
                </span>
                <span>·</span>
                <span>
                  Generated: {formatDateTime(generatedAt)}
                </span>
                <span>·</span>
                <span>
                  Period: {formatDate(reportFrom)} — {formatDate(reportTo)}
                </span>
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
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
                  Refresh report
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Export CSV */}
            {showExport && (
              <RoleGuard
                allowedRoles={["admin", "are_lead", "sre_engineer", "executive"]}
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
                        disabled={isExporting}
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
                      Export full compliance report as CSV
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </RoleGuard>
            )}

            {/* Audit Log Link */}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={handleViewAuditLog}
            >
              Audit Log
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Metric Cards */}
      {showSummary && (
        <MetricCardGrid columns={4}>
          {/* SLA Compliance Rate */}
          <MetricCard
            label="SLA Compliance Rate"
            value={slaComplianceRate}
            format="percentage"
            decimals={1}
            trendUpIsGood={true}
            threshold={100}
            thresholdExceededIsBad={false}
            icon={<CheckCircle className="h-4 w-4" />}
            description={`${summary.services_meeting_sla} of ${summary.total_services} services meeting SLA targets`}
          />

          {/* Overall Availability */}
          <MetricCard
            label="Overall Availability"
            value={summary.overall_availability_pct}
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
            description="Weighted average availability across all services in the report period"
          />

          {/* Avg MTTR */}
          <MetricCard
            label="Avg MTTR"
            value={summary.avg_mttr_minutes}
            format="duration"
            trendUpIsGood={false}
            icon={<Clock className="h-4 w-4" />}
            description="Average mean time to resolve incidents during the report period"
          />

          {/* Change Failure Rate */}
          <MetricCard
            label="Change Failure Rate"
            value={summary.change_failure_rate_pct}
            format="raw"
            decimals={1}
            unit="%"
            trendUpIsGood={false}
            threshold={15}
            thresholdExceededIsBad={true}
            icon={
              <span className="text-muted-foreground text-xs font-medium">
                CFR
              </span>
            }
            description={`${summary.failed_deployments} of ${summary.total_deployments} deployments failed or rolled back`}
          />
        </MetricCardGrid>
      )}

      {/* Secondary Summary Row */}
      {showSummary && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <ComplianceSummaryTile
            label="Total Incidents"
            value={summary.total_incidents}
            variant={summary.total_incidents > 0 ? "warning" : "success"}
          />
          <ComplianceSummaryTile
            label="Critical Incidents"
            value={summary.critical_incidents}
            variant={summary.critical_incidents > 0 ? "destructive" : "success"}
          />
          <ComplianceSummaryTile
            label="Repeat Failures"
            value={summary.repeat_failure_count}
            variant={summary.repeat_failure_count > 0 ? "destructive" : "success"}
          />
          <ComplianceSummaryTile
            label="SLA Breaches"
            value={summary.services_breaching_sla}
            variant={summary.services_breaching_sla > 0 ? "destructive" : "success"}
          />
        </div>
      )}

      {/* Tabbed Content: SLA Reports & Incident Audits */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
            <TabsList>
              {showSLAReports && (
                <TabsTrigger value="sla" className="text-xs">
                  SLA Reports ({slaReports.length})
                </TabsTrigger>
              )}
              {showIncidentAudits && (
                <TabsTrigger value="incidents" className="text-xs">
                  Incident Audits ({incidentAudits.length})
                </TabsTrigger>
              )}
              {showRecommendations && recommendations.length > 0 && (
                <TabsTrigger value="recommendations" className="text-xs">
                  Recommendations ({recommendations.length})
                </TabsTrigger>
              )}
            </TabsList>
          </CardHeader>

          {/* SLA Reports Tab */}
          {showSLAReports && (
            <TabsContent value="sla" className="mt-0">
              <CardContent className="px-0 pb-0 pt-3">
                {slaReports.length > 0 ? (
                  <div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service</TableHead>
                          <TableHead>Domain</TableHead>
                          <TableHead>Tier</TableHead>
                          <TableHead className="text-right">
                            Availability
                          </TableHead>
                          <TableHead className="text-right">
                            SLA Target
                          </TableHead>
                          <TableHead>SLA</TableHead>
                          <TableHead>SLO</TableHead>
                          <TableHead className="text-right">
                            Breaches
                          </TableHead>
                          <TableHead className="text-right">
                            Downtime
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {slaReports.map((report) => (
                          <SLAReportTableRow
                            key={report.service_id}
                            report={report}
                            onServiceClick={() =>
                              handleServiceClick(report.service_id)
                            }
                          />
                        ))}
                      </TableBody>
                    </Table>

                    {/* SLA Footer */}
                    <div className="flex items-center justify-between border-t px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xs text-muted-foreground">
                          {slaReports.length} service
                          {slaReports.length !== 1 ? "s" : ""}
                        </span>
                        {summary.services_meeting_sla > 0 && (
                          <Badge variant="success" className="text-2xs">
                            {summary.services_meeting_sla} Met
                          </Badge>
                        )}
                        {summary.services_breaching_sla > 0 && (
                          <Badge variant="destructive" className="text-2xs">
                            {summary.services_breaching_sla} Breached
                          </Badge>
                        )}
                      </div>
                      <span className="text-2xs text-muted-foreground">
                        Overall: {summary.overall_availability_pct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <CheckCircle className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No SLA report data available for the selected period.
                    </p>
                  </div>
                )}
              </CardContent>
            </TabsContent>
          )}

          {/* Incident Audits Tab */}
          {showIncidentAudits && (
            <TabsContent value="incidents" className="mt-0">
              <CardContent className="px-0 pb-0 pt-3">
                {incidentAudits.length > 0 ? (
                  <div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Root Cause</TableHead>
                          <TableHead className="text-right">MTTR</TableHead>
                          <TableHead>Evidence</TableHead>
                          <TableHead>Started</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {incidentAudits.map((audit) => (
                          <IncidentAuditTableRow
                            key={audit.incident_id}
                            audit={audit}
                            onIncidentClick={() =>
                              handleIncidentClick(audit.incident_id)
                            }
                            onServiceClick={() =>
                              handleServiceClick(audit.service_id)
                            }
                          />
                        ))}
                      </TableBody>
                    </Table>

                    {/* Incident Audit Footer */}
                    <div className="flex items-center justify-between border-t px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xs text-muted-foreground">
                          {incidentAudits.length} incident
                          {incidentAudits.length !== 1 ? "s" : ""}
                        </span>
                        {hasCriticalIncidents && (
                          <Badge variant="critical" className="text-2xs">
                            {summary.critical_incidents} critical
                          </Badge>
                        )}
                        {summary.major_incidents > 0 && (
                          <Badge variant="major" className="text-2xs">
                            {summary.major_incidents} major
                          </Badge>
                        )}
                        {hasRepeatFailures && (
                          <Badge variant="destructive" className="text-2xs">
                            {summary.repeat_failure_count} repeat
                          </Badge>
                        )}
                      </div>
                      <span className="text-2xs text-muted-foreground">
                        Avg MTTR: {formatDuration(summary.avg_mttr_minutes)} ·
                        Avg MTTD: {formatDuration(summary.avg_mttd_minutes)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No incidents recorded in the selected period.
                    </p>
                  </div>
                )}
              </CardContent>
            </TabsContent>
          )}

          {/* Recommendations Tab */}
          {showRecommendations && recommendations.length > 0 && (
            <TabsContent value="recommendations" className="mt-0">
              <CardContent className="pt-3">
                <div className="space-y-2">
                  {recommendations.map((recommendation, index) => (
                    <ComplianceRecommendationItem
                      key={index}
                      index={index + 1}
                      text={recommendation}
                      isCritical={
                        recommendation.toLowerCase().includes("critical") ||
                        recommendation.toLowerCase().includes("breach") ||
                        recommendation.toLowerCase().includes("immediate")
                      }
                      isWarning={
                        recommendation.toLowerCase().includes("warning") ||
                        recommendation.toLowerCase().includes("monitor") ||
                        recommendation.toLowerCase().includes("exceed") ||
                        recommendation.toLowerCase().includes("repeat")
                      }
                    />
                  ))}
                </div>
              </CardContent>
            </TabsContent>
          )}
        </Tabs>
      </Card>

      {/* Compliance Alerts */}
      {hasBreaches && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>SLA Breaches Detected</AlertTitle>
          <AlertDescription>
            {summary.services_breaching_sla} service
            {summary.services_breaching_sla !== 1 ? "s are" : " is"} currently
            breaching SLA targets. Review the SLA Reports tab for details and
            prioritize remediation for affected services.
          </AlertDescription>
        </Alert>
      )}

      {hasRepeatFailures && !hasBreaches && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Repeat Failures Detected</AlertTitle>
          <AlertDescription>
            {summary.repeat_failure_count} repeat failure pattern
            {summary.repeat_failure_count !== 1 ? "s" : ""} identified during
            the report period. Conduct root cause analysis to address systemic
            issues.
          </AlertDescription>
        </Alert>
      )}

      {/* Audit Trail Notice */}
      <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-2xs text-muted-foreground leading-relaxed">
          This compliance report is generated from audited data sources. All
          actions, uploads, and configuration changes are recorded in the{" "}
          <button
            type="button"
            className="text-primary underline-offset-2 hover:underline"
            onClick={handleViewAuditLog}
          >
            audit log
          </button>
          . Report exports are tracked for compliance purposes.
        </p>
      </div>
    </div>
  )
}

// ============================================================
// ComplianceSummaryTile Component
// ============================================================

interface ComplianceSummaryTileProps {
  label: string
  value: number
  variant: "success" | "warning" | "destructive"
}

/**
 * Compact summary tile for secondary compliance metrics.
 */
function ComplianceSummaryTile({
  label,
  value,
  variant,
}: ComplianceSummaryTileProps) {
  const bgClass =
    variant === "destructive"
      ? "border-red-500/20 bg-red-500/5"
      : variant === "warning"
        ? "border-yellow-500/20 bg-yellow-500/5"
        : "border-green-500/20 bg-green-500/5"

  const textClass =
    variant === "destructive"
      ? "text-red-700 dark:text-red-400"
      : variant === "warning"
        ? "text-yellow-700 dark:text-yellow-400"
        : "text-green-700 dark:text-green-400"

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md border px-3 py-2",
        bgClass
      )}
    >
      <span className="text-2xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-bold", textClass)}>{value}</span>
    </div>
  )
}

// ============================================================
// SLAReportTableRow Component
// ============================================================

interface SLAReportTableRowProps {
  report: SLAReportRow
  onServiceClick?: () => void
}

/**
 * Individual table row for an SLA report entry.
 */
function SLAReportTableRow({
  report,
  onServiceClick,
}: SLAReportTableRowProps) {
  const healthStatus = availabilityToHealthStatus(report.availability_pct)

  const availabilityColor =
    report.availability_pct >= report.sla_target
      ? "text-green-600 dark:text-green-400"
      : report.availability_pct >= report.sla_target - 0.5
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400"

  return (
    <TooltipProvider delayDuration={200}>
      <TableRow
        className={cn(onServiceClick && "cursor-pointer")}
        onClick={onServiceClick}
      >
        {/* Service Name */}
        <TableCell className="font-medium">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="truncate max-w-[200px] inline-block">
                {report.service_name}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-xs">
              <div className="space-y-1">
                <p className="text-xs font-medium">{report.service_name}</p>
                <p className="text-2xs text-muted-foreground">
                  ID: {report.service_id}
                </p>
                <p className="text-2xs text-muted-foreground">
                  Target: {report.sla_target}% | Current:{" "}
                  {report.availability_pct.toFixed(2)}%
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TableCell>

        {/* Domain */}
        <TableCell>
          <span className="text-sm text-muted-foreground">
            {report.domain}
          </span>
        </TableCell>

        {/* Tier */}
        <TableCell>
          {report.tier ? (
            <TierBadge tier={report.tier as CriticalityTier} size="sm" />
          ) : (
            <span className="text-2xs text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Availability */}
        <TableCell className="text-right">
          <span className={cn("text-sm font-medium", availabilityColor)}>
            {report.availability_pct.toFixed(2)}%
          </span>
        </TableCell>

        {/* SLA Target */}
        <TableCell className="text-right">
          <span className="text-sm text-muted-foreground">
            {report.sla_target}%
          </span>
        </TableCell>

        {/* SLA Status */}
        <TableCell>
          <SLOStatusBadge
            met={report.sla_met}
            size="sm"
            label={report.sla_met ? "Met" : "Breached"}
          />
        </TableCell>

        {/* SLO Status */}
        <TableCell>
          <SLOStatusBadge
            met={report.slo_met}
            size="sm"
            label={report.slo_met ? "Met" : "Breached"}
          />
        </TableCell>

        {/* Breaches */}
        <TableCell className="text-right">
          {report.breaches > 0 ? (
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              {report.breaches}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">0</span>
          )}
        </TableCell>

        {/* Downtime */}
        <TableCell className="text-right">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm text-muted-foreground">
                {formatDuration(report.downtime_minutes)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              <p className="text-xs">
                {report.downtime_minutes.toFixed(1)} minutes of downtime
              </p>
            </TooltipContent>
          </Tooltip>
        </TableCell>
      </TableRow>
    </TooltipProvider>
  )
}

// ============================================================
// IncidentAuditTableRow Component
// ============================================================

interface IncidentAuditTableRowProps {
  audit: IncidentAuditRow
  onIncidentClick?: () => void
  onServiceClick?: () => void
}

/**
 * Individual table row for an incident audit entry.
 */
function IncidentAuditTableRow({
  audit,
  onIncidentClick,
  onServiceClick,
}: IncidentAuditTableRowProps) {
  const mttrColor =
    audit.mttr !== null && audit.mttr > 60
      ? "text-red-600 dark:text-red-400"
      : audit.mttr !== null && audit.mttr > 30
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-foreground"

  const evidenceCount = audit.evidence_links.length + audit.annotations_count
  const hasEvidence = evidenceCount > 0
  const isCriticalWithoutEvidence =
    audit.severity === "critical" && !hasEvidence

  return (
    <TooltipProvider delayDuration={200}>
      <TableRow
        className={cn(onIncidentClick && "cursor-pointer")}
        onClick={onIncidentClick}
      >
        {/* ID */}
        <TableCell>
          <span className="text-2xs font-mono text-muted-foreground">
            {audit.incident_id}
          </span>
        </TableCell>

        {/* Severity */}
        <TableCell>
          <div className="flex items-center gap-1">
            <SeverityBadge severity={audit.severity} size="sm" />
            {audit.repeat_failure && (
              <Badge variant="destructive" className="text-2xs h-3.5 px-1">
                Repeat
              </Badge>
            )}
          </div>
        </TableCell>

        {/* Title */}
        <TableCell className="max-w-[200px]">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm font-medium truncate block">
                {audit.title}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-sm">
              <div className="space-y-1">
                <p className="text-xs font-medium">{audit.title}</p>
                {audit.root_cause_details && (
                  <p className="text-2xs text-muted-foreground">
                    {audit.root_cause_details}
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TableCell>

        {/* Service */}
        <TableCell>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate max-w-[120px] block text-left"
            onClick={(e) => {
              e.stopPropagation()
              onServiceClick?.()
            }}
          >
            {audit.service_name}
          </button>
        </TableCell>

        {/* Status */}
        <TableCell>
          {audit.resolved ? (
            <Badge variant="success" className="text-2xs">
              Resolved
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-2xs">
              {audit.status}
            </Badge>
          )}
        </TableCell>

        {/* Root Cause */}
        <TableCell>
          {audit.root_cause ? (
            <Badge variant="secondary" className="text-2xs">
              {audit.root_cause}
            </Badge>
          ) : (
            <span className="text-2xs text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* MTTR */}
        <TableCell className="text-right">
          {audit.mttr !== null ? (
            <span className={cn("text-sm font-medium", mttrColor)}>
              {formatDuration(audit.mttr)}
            </span>
          ) : (
            <span className="text-2xs text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Evidence */}
        <TableCell>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                {hasEvidence ? (
                  <>
                    <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                    <span className="text-2xs text-muted-foreground">
                      {evidenceCount}
                    </span>
                  </>
                ) : isCriticalWithoutEvidence ? (
                  <>
                    <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
                    <span className="text-2xs text-red-600 dark:text-red-400">
                      Missing
                    </span>
                  </>
                ) : (
                  <span className="text-2xs text-muted-foreground">—</span>
                )}

                {/* Evidence links */}
                {audit.evidence_links.length > 0 && (
                  <div className="flex items-center gap-0.5 ml-1">
                    {audit.evidence_links.slice(0, 2).map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ))}
                    {audit.evidence_links.length > 2 && (
                      <span className="text-2xs text-muted-foreground">
                        +{audit.evidence_links.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-xs">
              <div className="space-y-1">
                <p className="text-xs font-medium">
                  Evidence: {audit.evidence_links.length} link
                  {audit.evidence_links.length !== 1 ? "s" : ""},{" "}
                  {audit.annotations_count} annotation
                  {audit.annotations_count !== 1 ? "s" : ""}
                </p>
                {audit.evidence_links.length > 0 && (
                  <div className="space-y-0.5">
                    {audit.evidence_links.slice(0, 5).map((link, idx) => (
                      <p key={idx} className="text-2xs text-muted-foreground">
                        [{link.type}] {link.title}
                      </p>
                    ))}
                  </div>
                )}
                {isCriticalWithoutEvidence && (
                  <p className="text-2xs text-red-600 dark:text-red-400">
                    Critical incidents require documented evidence for audit
                    compliance.
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TableCell>

        {/* Started */}
        <TableCell>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-2xs text-muted-foreground">
                {formatRelativeTime(audit.start_time)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              <p className="text-xs">
                {formatDateTime(audit.start_time)}
              </p>
            </TooltipContent>
          </Tooltip>
        </TableCell>
      </TableRow>
    </TooltipProvider>
  )
}

// ============================================================
// ComplianceRecommendationItem Component
// ============================================================

interface ComplianceRecommendationItemProps {
  index: number
  text: string
  isCritical?: boolean
  isWarning?: boolean
}

/**
 * Individual recommendation item with priority-based styling.
 */
function ComplianceRecommendationItem({
  index,
  text,
  isCritical = false,
  isWarning = false,
}: ComplianceRecommendationItemProps) {
  const borderClass = isCritical
    ? "border-red-500/20"
    : isWarning
      ? "border-yellow-500/20"
      : "border-border"

  const bgClass = isCritical
    ? "bg-red-500/5"
    : isWarning
      ? "bg-yellow-500/5"
      : "bg-transparent"

  const indexBgClass = isCritical
    ? "bg-red-500/10 text-red-700 dark:text-red-400"
    : isWarning
      ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
      : "bg-muted text-muted-foreground"

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border px-3 py-2",
        borderClass,
        bgClass
      )}
    >
      <div
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-bold mt-0.5",
          indexBgClass
        )}
      >
        {index}
      </div>
      <p className="text-2xs text-muted-foreground leading-relaxed">{text}</p>
    </div>
  )
}

// ============================================================
// Wrapped Export with Error Boundary
// ============================================================

export interface ComplianceReportViewWithBoundaryProps
  extends ComplianceReportViewProps {}

/**
 * ComplianceReportView wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function ComplianceReportViewWithBoundary(
  props: ComplianceReportViewWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Compliance Report">
      <ComplianceReportView {...props} />
    </ModuleErrorBoundary>
  )
}

export default ComplianceReportView