import { createServerClient } from "@/lib/supabase";
import { getAuditLogs, getAuditLogsByAction, AUDIT_ACTIONS } from "@/lib/services/audit-logger";
import { computeAvailability, computeSLOCompliance, incidentTrends } from "@/lib/services/analytics-engine";
import { PAGINATION, DEFAULT_THRESHOLDS, TIME_PERIOD_MS } from "@/constants/constants";
import type {
  CriticalityTier,
  Environment,
  IncidentSeverity,
  TimePeriod,
  PaginatedResponse,
  Incident,
  AuditLog,
  SLACompliance,
  EvidenceLink,
  EntityType,
} from "@/types";

// ============================================================
// Types
// ============================================================

export interface ComplianceReportParams {
  domain?: string;
  service_id?: string;
  tier?: CriticalityTier;
  environment?: Environment;
  period?: TimePeriod;
  from?: string;
  to?: string;
}

export interface SLAReport {
  service_id: string;
  service_name: string;
  domain: string;
  tier: CriticalityTier;
  availability_pct: number;
  sla_target: number;
  sla_met: boolean;
  slo_met: boolean;
  breaches: number;
  downtime_minutes: number;
  period: string;
}

export interface IncidentAuditRecord {
  incident_id: string;
  title: string;
  service_id: string;
  service_name: string;
  domain: string;
  severity: IncidentSeverity;
  status: string;
  start_time: string;
  end_time: string | null;
  mttr: number | null;
  mttd: number | null;
  root_cause: string | null;
  root_cause_details: string | null;
  repeat_failure: boolean;
  resolved: boolean;
  evidence_links: EvidenceLink[];
  annotations_count: number;
}

export interface ComplianceReport {
  report_id: string;
  generated_at: string;
  period: string;
  from: string;
  to: string;
  filters: {
    domain?: string;
    service_id?: string;
    tier?: string;
    environment?: string;
  };
  summary: ComplianceSummary;
  sla_reports: SLAReport[];
  incident_audits: IncidentAuditRecord[];
  audit_trail: AuditLog[];
  upload_activity: UploadActivityRecord[];
  recommendations: string[];
}

export interface ComplianceSummary {
  total_services: number;
  services_meeting_sla: number;
  services_breaching_sla: number;
  overall_availability_pct: number;
  total_incidents: number;
  critical_incidents: number;
  major_incidents: number;
  avg_mttr_minutes: number;
  avg_mttd_minutes: number;
  repeat_failure_count: number;
  total_deployments: number;
  failed_deployments: number;
  change_failure_rate_pct: number;
}

export interface UploadActivityRecord {
  upload_id: string;
  file_name: string;
  data_type: string;
  uploader: string;
  uploader_name: string | null;
  records_ingested: number;
  records_failed: number | null;
  status: string;
  timestamp: string;
}

export interface CSVExportResult {
  csv_content: string;
  file_name: string;
  record_count: number;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Generates a unique report ID.
 */
function generateReportId(): string {
  return `rpt-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Computes the start time for a given time period relative to now.
 */
function getStartTimeForPeriod(period: TimePeriod): string {
  const ms = TIME_PERIOD_MS[period];
  return new Date(Date.now() - ms).toISOString();
}

/**
 * Computes the average of an array of numbers.
 * Returns 0 if the array is empty.
 */
function average(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

/**
 * Escapes a value for CSV output.
 * Wraps in double quotes if the value contains commas, quotes, or newlines.
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Converts an array of objects to CSV string.
 */
function objectsToCSV(
  rows: Array<Record<string, unknown>>,
  columns: string[]
): string {
  const header = columns.map(escapeCSVValue).join(",");
  const dataRows = rows.map((row) =>
    columns.map((col) => escapeCSVValue(row[col])).join(",")
  );

  return [header, ...dataRows].join("\n");
}

// ============================================================
// Core Report Generation
// ============================================================

/**
 * Generates a comprehensive compliance report including SLA/uptime reports,
 * incident audit records, audit trail activity, and upload activity.
 * Aggregates data from multiple Supabase tables and formats as structured JSON.
 *
 * @param params - Report generation parameters including filters and time range
 * @returns Complete compliance report with all sections
 */
export async function generateComplianceReport(
  params: ComplianceReportParams
): Promise<ComplianceReport> {
  const period = params.period || "30d";
  const from = params.from || getStartTimeForPeriod(period);
  const to = params.to || new Date().toISOString();

  // Generate all report sections in parallel
  const [
    slaReports,
    incidentAudits,
    auditTrail,
    uploadActivity,
    deploymentStats,
  ] = await Promise.all([
    generateSLAReports(params, from, to),
    generateIncidentAudits(params, from, to),
    fetchAuditTrail(params, from, to),
    fetchUploadActivity(from, to),
    fetchDeploymentStats(params, from, to),
  ]);

  // Compute summary
  const summary = computeComplianceSummary(
    slaReports,
    incidentAudits,
    deploymentStats
  );

  // Generate recommendations based on the report data
  const recommendations = generateComplianceRecommendations(
    summary,
    slaReports,
    incidentAudits
  );

  return {
    report_id: generateReportId(),
    generated_at: new Date().toISOString(),
    period,
    from,
    to,
    filters: {
      domain: params.domain,
      service_id: params.service_id,
      tier: params.tier,
      environment: params.environment,
    },
    summary,
    sla_reports: slaReports,
    incident_audits: incidentAudits,
    audit_trail: auditTrail,
    upload_activity: uploadActivity,
    recommendations,
  };
}

/**
 * Generates SLA reports for all services matching the filter criteria.
 * Evaluates availability against tier-based SLA targets.
 *
 * @param params - Filter parameters
 * @param from - Start of the time range (ISO8601)
 * @param to - End of the time range (ISO8601)
 * @returns Array of SLA report records
 */
async function generateSLAReports(
  params: ComplianceReportParams,
  from: string,
  to: string
): Promise<SLAReport[]> {
  const supabase = createServerClient();

  // Fetch services with optional filters
  let serviceQuery = supabase
    .from("services")
    .select("id, name, domain, tier, environment");

  if (params.domain) {
    serviceQuery = serviceQuery.eq("domain", params.domain);
  }

  if (params.tier) {
    serviceQuery = serviceQuery.eq("tier", params.tier);
  }

  if (params.environment) {
    serviceQuery = serviceQuery.eq("environment", params.environment);
  }

  if (params.service_id) {
    serviceQuery = serviceQuery.eq("id", params.service_id);
  }

  const { data: services, error: servicesError } = await serviceQuery;

  if (servicesError) {
    console.error("Error fetching services for SLA report:", servicesError);
    throw new Error(
      `Failed to fetch services for SLA report: ${servicesError.message}`
    );
  }

  if (!services || services.length === 0) {
    return [];
  }

  const slaReports: SLAReport[] = [];

  // Fetch availability metrics for all services in the period
  const serviceIds = services.map((s) => s.id);
  const { data: metrics } = await supabase
    .from("metrics")
    .select("service_id, value, timestamp")
    .in("service_id", serviceIds)
    .eq("metric_type", "availability")
    .gte("timestamp", from)
    .lte("timestamp", to)
    .order("timestamp", { ascending: true });

  // Group metrics by service
  const metricsByService = new Map<string, number[]>();
  for (const metric of metrics || []) {
    const existing = metricsByService.get(metric.service_id) || [];
    existing.push(metric.value);
    metricsByService.set(metric.service_id, existing);
  }

  // Fetch incidents for breach counting
  const { data: incidents } = await supabase
    .from("incidents")
    .select("service_id, severity, start_time, end_time")
    .in("service_id", serviceIds)
    .gte("start_time", from)
    .lte("start_time", to);

  // Count breaches per service (critical + major incidents)
  const breachesByService = new Map<string, number>();
  for (const incident of incidents || []) {
    if (incident.severity === "critical" || incident.severity === "major") {
      const current = breachesByService.get(incident.service_id) || 0;
      breachesByService.set(incident.service_id, current + 1);
    }
  }

  for (const service of services) {
    const tier = service.tier as CriticalityTier;
    const slaTarget = DEFAULT_THRESHOLDS.availability[tier] || 99.9;
    const serviceMetrics = metricsByService.get(service.id) || [];
    const avgAvailability =
      serviceMetrics.length > 0 ? average(serviceMetrics) : 100;

    const slaMet = avgAvailability >= slaTarget;

    // Estimate downtime in minutes based on availability gap
    const periodMs = new Date(to).getTime() - new Date(from).getTime();
    const periodMinutes = periodMs / 60000;
    const downtimeMinutes =
      avgAvailability < 100
        ? Math.round(((100 - avgAvailability) / 100) * periodMinutes * 100) / 100
        : 0;

    const breaches = breachesByService.get(service.id) || 0;

    slaReports.push({
      service_id: service.id,
      service_name: service.name,
      domain: service.domain,
      tier,
      availability_pct: Math.round(avgAvailability * 100) / 100,
      sla_target: slaTarget,
      sla_met: slaMet,
      slo_met: slaMet, // SLO is evaluated same as SLA for compliance
      breaches,
      downtime_minutes: downtimeMinutes,
      period: `${from} to ${to}`,
    });
  }

  // Sort by availability ascending (worst first)
  slaReports.sort((a, b) => a.availability_pct - b.availability_pct);

  return slaReports;
}

/**
 * Generates incident audit records for all incidents in the time range.
 * Includes evidence links and annotation counts for each incident.
 *
 * @param params - Filter parameters
 * @param from - Start of the time range (ISO8601)
 * @param to - End of the time range (ISO8601)
 * @returns Array of incident audit records
 */
async function generateIncidentAudits(
  params: ComplianceReportParams,
  from: string,
  to: string
): Promise<IncidentAuditRecord[]> {
  const supabase = createServerClient();

  // Build incident query
  let query = supabase
    .from("incidents")
    .select("*")
    .gte("start_time", from)
    .lte("start_time", to);

  if (params.domain) {
    query = query.eq("domain", params.domain);
  }

  if (params.service_id) {
    query = query.eq("service_id", params.service_id);
  }

  query = query.order("start_time", { ascending: false });

  const { data: incidentData, error: incidentError } = await query;

  if (incidentError) {
    console.error("Error fetching incidents for audit:", incidentError);
    throw new Error(
      `Failed to fetch incidents for audit: ${incidentError.message}`
    );
  }

  const incidents = (incidentData || []) as Incident[];

  if (incidents.length === 0) {
    return [];
  }

  // Fetch annotation counts for all incidents
  const incidentIds = incidents.map((i) => i.id);
  const { data: annotationData } = await supabase
    .from("annotations")
    .select("entity_id")
    .eq("entity_type", "incident")
    .in("entity_id", incidentIds);

  // Count annotations per incident
  const annotationCountMap = new Map<string, number>();
  for (const row of annotationData || []) {
    const current = annotationCountMap.get(row.entity_id) || 0;
    annotationCountMap.set(row.entity_id, current + 1);
  }

  // Build audit records
  const auditRecords: IncidentAuditRecord[] = incidents.map((incident) => {
    const resolved =
      incident.status === "resolved" || incident.status === "closed";

    // Evidence links from the incident record (if available)
    const evidenceLinks: EvidenceLink[] = incident.evidence_links || [];

    return {
      incident_id: incident.id,
      title: incident.title,
      service_id: incident.service_id,
      service_name: incident.service_name || "",
      domain: incident.domain || "",
      severity: incident.severity,
      status: incident.status,
      start_time: incident.start_time,
      end_time: incident.end_time || null,
      mttr: incident.mttr || null,
      mttd: incident.mttd || null,
      root_cause: incident.root_cause || null,
      root_cause_details: incident.root_cause_details || null,
      repeat_failure: incident.repeat_failure,
      resolved,
      evidence_links: evidenceLinks,
      annotations_count: annotationCountMap.get(incident.id) || 0,
    };
  });

  return auditRecords;
}

/**
 * Fetches the audit trail for the compliance report time range.
 * Includes all admin actions, uploads, and configuration changes.
 *
 * @param params - Filter parameters
 * @param from - Start of the time range (ISO8601)
 * @param to - End of the time range (ISO8601)
 * @returns Array of audit log entries
 */
async function fetchAuditTrail(
  params: ComplianceReportParams,
  from: string,
  to: string
): Promise<AuditLog[]> {
  const result = await getAuditLogs({
    from,
    to,
    page: 1,
    page_size: PAGINATION.MAX_PAGE_SIZE,
  });

  return result.data;
}

/**
 * Fetches upload activity records for the compliance report time range.
 *
 * @param from - Start of the time range (ISO8601)
 * @param to - End of the time range (ISO8601)
 * @returns Array of upload activity records
 */
async function fetchUploadActivity(
  from: string,
  to: string
): Promise<UploadActivityRecord[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("upload_logs")
    .select("*")
    .gte("timestamp", from)
    .lte("timestamp", to)
    .order("timestamp", { ascending: false })
    .limit(PAGINATION.MAX_PAGE_SIZE);

  if (error) {
    console.error("Error fetching upload activity:", error);
    throw new Error(
      `Failed to fetch upload activity: ${error.message}`
    );
  }

  return (data || []).map((row) => ({
    upload_id: row.id,
    file_name: row.file_name,
    data_type: row.data_type,
    uploader: row.uploader,
    uploader_name: row.uploader_name || null,
    records_ingested: row.records_ingested,
    records_failed: row.records_failed || null,
    status: row.status,
    timestamp: row.timestamp,
  }));
}

/**
 * Fetches deployment statistics for the compliance report.
 *
 * @param params - Filter parameters
 * @param from - Start of the time range (ISO8601)
 * @param to - End of the time range (ISO8601)
 * @returns Deployment statistics
 */
async function fetchDeploymentStats(
  params: ComplianceReportParams,
  from: string,
  to: string
): Promise<{ total: number; failed: number }> {
  const supabase = createServerClient();

  let query = supabase
    .from("deployments")
    .select("id, status, service_id")
    .gte("deployed_at", from)
    .lte("deployed_at", to);

  if (params.service_id) {
    query = query.eq("service_id", params.service_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching deployment stats:", error);
    // Non-critical — return zeros rather than failing the entire report
    return { total: 0, failed: 0 };
  }

  const deployments = data || [];
  const total = deployments.length;
  const failed = deployments.filter(
    (d) => d.status === "failed" || d.status === "rolled_back"
  ).length;

  return { total, failed };
}

// ============================================================
// Summary Computation
// ============================================================

/**
 * Computes the compliance summary from SLA reports, incident audits,
 * and deployment statistics.
 */
function computeComplianceSummary(
  slaReports: SLAReport[],
  incidentAudits: IncidentAuditRecord[],
  deploymentStats: { total: number; failed: number }
): ComplianceSummary {
  const totalServices = slaReports.length;
  const servicesMeetingSLA = slaReports.filter((r) => r.sla_met).length;
  const servicesBreachingSLA = totalServices - servicesMeetingSLA;

  const availabilities = slaReports.map((r) => r.availability_pct);
  const overallAvailability =
    availabilities.length > 0 ? average(availabilities) : 100;

  const totalIncidents = incidentAudits.length;
  const criticalIncidents = incidentAudits.filter(
    (i) => i.severity === "critical"
  ).length;
  const majorIncidents = incidentAudits.filter(
    (i) => i.severity === "major"
  ).length;

  const mttrValues = incidentAudits
    .filter((i) => i.mttr != null)
    .map((i) => i.mttr as number);
  const mttdValues = incidentAudits
    .filter((i) => i.mttd != null)
    .map((i) => i.mttd as number);

  const avgMttr = average(mttrValues);
  const avgMttd = average(mttdValues);

  const repeatFailureCount = incidentAudits.filter(
    (i) => i.repeat_failure
  ).length;

  const changeFailureRate =
    deploymentStats.total > 0
      ? Math.round(
          (deploymentStats.failed / deploymentStats.total) * 10000
        ) / 100
      : 0;

  return {
    total_services: totalServices,
    services_meeting_sla: servicesMeetingSLA,
    services_breaching_sla: servicesBreachingSLA,
    overall_availability_pct: overallAvailability,
    total_incidents: totalIncidents,
    critical_incidents: criticalIncidents,
    major_incidents: majorIncidents,
    avg_mttr_minutes: avgMttr,
    avg_mttd_minutes: avgMttd,
    repeat_failure_count: repeatFailureCount,
    total_deployments: deploymentStats.total,
    failed_deployments: deploymentStats.failed,
    change_failure_rate_pct: changeFailureRate,
  };
}

// ============================================================
// Recommendations
// ============================================================

/**
 * Generates compliance recommendations based on report data.
 */
function generateComplianceRecommendations(
  summary: ComplianceSummary,
  slaReports: SLAReport[],
  incidentAudits: IncidentAuditRecord[]
): string[] {
  const recommendations: string[] = [];

  // SLA breach recommendations
  if (summary.services_breaching_sla > 0) {
    const breachingServices = slaReports
      .filter((r) => !r.sla_met)
      .map((r) => r.service_name)
      .slice(0, 5);

    recommendations.push(
      `${summary.services_breaching_sla} service(s) are breaching SLA targets. Priority services: ${breachingServices.join(", ")}.`
    );
  }

  // Availability recommendations
  if (summary.overall_availability_pct < 99.9) {
    recommendations.push(
      `Overall availability (${summary.overall_availability_pct}%) is below 99.9%. Review infrastructure and deployment practices.`
    );
  }

  // MTTR recommendations
  if (summary.avg_mttr_minutes > 60) {
    recommendations.push(
      `Average MTTR (${summary.avg_mttr_minutes} minutes) exceeds 60 minutes. Consider improving incident response runbooks and automation.`
    );
  }

  // MTTD recommendations
  if (summary.avg_mttd_minutes > 15) {
    recommendations.push(
      `Average MTTD (${summary.avg_mttd_minutes} minutes) exceeds 15 minutes. Review alerting thresholds and monitoring coverage.`
    );
  }

  // Repeat failure recommendations
  if (summary.repeat_failure_count > 0) {
    const repeatRate =
      summary.total_incidents > 0
        ? Math.round(
            (summary.repeat_failure_count / summary.total_incidents) * 100
          )
        : 0;

    recommendations.push(
      `${summary.repeat_failure_count} repeat failure(s) detected (${repeatRate}% of incidents). Conduct root cause analysis to address systemic issues.`
    );
  }

  // Change failure rate recommendations
  if (summary.change_failure_rate_pct > 15) {
    recommendations.push(
      `Change failure rate (${summary.change_failure_rate_pct}%) exceeds 15%. Review deployment pipelines, testing coverage, and rollback procedures.`
    );
  }

  // Critical incident recommendations
  if (summary.critical_incidents > 0) {
    recommendations.push(
      `${summary.critical_incidents} critical incident(s) occurred during the reporting period. Ensure post-incident reviews are completed with corrective actions documented.`
    );
  }

  // Unresolved incident recommendations
  const unresolvedIncidents = incidentAudits.filter((i) => !i.resolved);
  if (unresolvedIncidents.length > 0) {
    recommendations.push(
      `${unresolvedIncidents.length} incident(s) remain unresolved. Prioritize resolution to maintain compliance posture.`
    );
  }

  // Missing evidence recommendations
  const incidentsWithoutEvidence = incidentAudits.filter(
    (i) =>
      i.severity === "critical" &&
      i.evidence_links.length === 0 &&
      i.annotations_count === 0
  );
  if (incidentsWithoutEvidence.length > 0) {
    recommendations.push(
      `${incidentsWithoutEvidence.length} critical incident(s) lack evidence links or annotations. Ensure all critical incidents have documented evidence for audit compliance.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "All compliance metrics are within acceptable thresholds. Continue current operational practices."
    );
  }

  return recommendations;
}

// ============================================================
// CSV Export Functions
// ============================================================

/**
 * Exports the SLA reports section of a compliance report as CSV.
 *
 * @param slaReports - Array of SLA report records
 * @returns CSV export result with content and metadata
 */
export function exportSLAReportsToCSV(
  slaReports: SLAReport[]
): CSVExportResult {
  const columns = [
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
  ];

  const rows = slaReports.map((r) => ({
    service_id: r.service_id,
    service_name: r.service_name,
    domain: r.domain,
    tier: r.tier,
    availability_pct: r.availability_pct,
    sla_target: r.sla_target,
    sla_met: r.sla_met,
    slo_met: r.slo_met,
    breaches: r.breaches,
    downtime_minutes: r.downtime_minutes,
    period: r.period,
  }));

  const csvContent = objectsToCSV(rows, columns);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return {
    csv_content: csvContent,
    file_name: `sla-compliance-report-${timestamp}.csv`,
    record_count: slaReports.length,
  };
}

/**
 * Exports the incident audit section of a compliance report as CSV.
 *
 * @param incidentAudits - Array of incident audit records
 * @returns CSV export result with content and metadata
 */
export function exportIncidentAuditsToCSV(
  incidentAudits: IncidentAuditRecord[]
): CSVExportResult {
  const columns = [
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
  ];

  const rows = incidentAudits.map((i) => ({
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
  }));

  const csvContent = objectsToCSV(rows, columns);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return {
    csv_content: csvContent,
    file_name: `incident-audit-report-${timestamp}.csv`,
    record_count: incidentAudits.length,
  };
}

/**
 * Exports the audit trail section of a compliance report as CSV.
 *
 * @param auditLogs - Array of audit log entries
 * @returns CSV export result with content and metadata
 */
export function exportAuditTrailToCSV(
  auditLogs: AuditLog[]
): CSVExportResult {
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
  ];

  const rows = auditLogs.map((log) => ({
    id: log.id,
    timestamp: log.timestamp,
    user_id: log.user_id,
    user_name: log.user_name || "",
    action: log.action,
    entity_type: log.entity_type,
    entity_id: log.entity_id,
    correlation_id: log.correlation_id || "",
    ip_address: log.ip_address || "",
    details: log.details ? JSON.stringify(log.details) : "",
  }));

  const csvContent = objectsToCSV(rows, columns);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return {
    csv_content: csvContent,
    file_name: `audit-trail-${timestamp}.csv`,
    record_count: auditLogs.length,
  };
}

/**
 * Exports the full compliance report as a combined CSV.
 * Includes a summary section followed by SLA reports and incident audits.
 *
 * @param report - The full compliance report
 * @returns CSV export result with content and metadata
 */
export function exportFullComplianceReportToCSV(
  report: ComplianceReport
): CSVExportResult {
  const sections: string[] = [];

  // Summary section
  sections.push("=== COMPLIANCE REPORT SUMMARY ===");
  sections.push(`Report ID,${escapeCSVValue(report.report_id)}`);
  sections.push(`Generated At,${escapeCSVValue(report.generated_at)}`);
  sections.push(`Period,${escapeCSVValue(report.period)}`);
  sections.push(`From,${escapeCSVValue(report.from)}`);
  sections.push(`To,${escapeCSVValue(report.to)}`);
  sections.push(`Total Services,${report.summary.total_services}`);
  sections.push(`Services Meeting SLA,${report.summary.services_meeting_sla}`);
  sections.push(`Services Breaching SLA,${report.summary.services_breaching_sla}`);
  sections.push(`Overall Availability %,${report.summary.overall_availability_pct}`);
  sections.push(`Total Incidents,${report.summary.total_incidents}`);
  sections.push(`Critical Incidents,${report.summary.critical_incidents}`);
  sections.push(`Major Incidents,${report.summary.major_incidents}`);
  sections.push(`Avg MTTR (minutes),${report.summary.avg_mttr_minutes}`);
  sections.push(`Avg MTTD (minutes),${report.summary.avg_mttd_minutes}`);
  sections.push(`Repeat Failures,${report.summary.repeat_failure_count}`);
  sections.push(`Total Deployments,${report.summary.total_deployments}`);
  sections.push(`Failed Deployments,${report.summary.failed_deployments}`);
  sections.push(`Change Failure Rate %,${report.summary.change_failure_rate_pct}`);
  sections.push("");

  // SLA Reports section
  if (report.sla_reports.length > 0) {
    sections.push("=== SLA REPORTS ===");
    const slaCSV = exportSLAReportsToCSV(report.sla_reports);
    sections.push(slaCSV.csv_content);
    sections.push("");
  }

  // Incident Audits section
  if (report.incident_audits.length > 0) {
    sections.push("=== INCIDENT AUDITS ===");
    const incidentCSV = exportIncidentAuditsToCSV(report.incident_audits);
    sections.push(incidentCSV.csv_content);
    sections.push("");
  }

  // Recommendations section
  if (report.recommendations.length > 0) {
    sections.push("=== RECOMMENDATIONS ===");
    report.recommendations.forEach((rec, index) => {
      sections.push(`${index + 1},${escapeCSVValue(rec)}`);
    });
    sections.push("");
  }

  const csvContent = sections.join("\n");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const totalRecords =
    report.sla_reports.length + report.incident_audits.length;

  return {
    csv_content: csvContent,
    file_name: `compliance-report-${timestamp}.csv`,
    record_count: totalRecords,
  };
}

// ============================================================
// Convenience Query Functions
// ============================================================

/**
 * Retrieves a quick SLA compliance summary for a specific domain.
 * Lighter-weight than the full compliance report.
 *
 * @param domain - The domain to query
 * @param period - The time period for evaluation
 * @returns Array of SLA compliance records
 */
export async function getSLAComplianceForDomain(
  domain: string,
  period: TimePeriod = "30d"
): Promise<SLAReport[]> {
  const from = getStartTimeForPeriod(period);
  const to = new Date().toISOString();

  return generateSLAReports({ domain }, from, to);
}

/**
 * Retrieves incident audit records for a specific service.
 *
 * @param serviceId - The service ID
 * @param period - The time period
 * @returns Array of incident audit records
 */
export async function getIncidentAuditsForService(
  serviceId: string,
  period: TimePeriod = "30d"
): Promise<IncidentAuditRecord[]> {
  const from = getStartTimeForPeriod(period);
  const to = new Date().toISOString();

  return generateIncidentAudits({ service_id: serviceId }, from, to);
}

/**
 * Retrieves a compliance summary without the full report details.
 * Useful for dashboard overview cards.
 *
 * @param params - Filter parameters
 * @returns Compliance summary
 */
export async function getComplianceSummary(
  params: ComplianceReportParams
): Promise<ComplianceSummary> {
  const period = params.period || "30d";
  const from = params.from || getStartTimeForPeriod(period);
  const to = params.to || new Date().toISOString();

  const [slaReports, incidentAudits, deploymentStats] = await Promise.all([
    generateSLAReports(params, from, to),
    generateIncidentAudits(params, from, to),
    fetchDeploymentStats(params, from, to),
  ]);

  return computeComplianceSummary(slaReports, incidentAudits, deploymentStats);
}

/**
 * Retrieves evidence links for a specific incident.
 * Queries annotations that contain evidence link references.
 *
 * @param incidentId - The incident ID
 * @returns Array of evidence links
 */
export async function getEvidenceLinksForIncident(
  incidentId: string
): Promise<EvidenceLink[]> {
  if (!incidentId || incidentId.trim().length === 0) {
    throw new Error("Incident ID is required.");
  }

  const supabase = createServerClient();

  // Check if the incident has evidence_links stored directly
  const { data: incident, error: incidentError } = await supabase
    .from("incidents")
    .select("id, external_id")
    .eq("id", incidentId)
    .single();

  if (incidentError) {
    if (incidentError.code === "PGRST116") {
      return [];
    }
    console.error("Error fetching incident for evidence links:", incidentError);
    throw new Error(
      `Failed to fetch incident: ${incidentError.message}`
    );
  }

  // Fetch annotations that may contain evidence links
  const { data: annotations } = await supabase
    .from("annotations")
    .select("id, annotation, user_id, timestamp")
    .eq("entity_type", "incident")
    .eq("entity_id", incidentId)
    .order("timestamp", { ascending: false });

  const evidenceLinks: EvidenceLink[] = [];

  // Parse annotations for URL references
  const urlRegex = /https?:\/\/[^\s)]+/g;

  for (const annotation of annotations || []) {
    const urls = annotation.annotation.match(urlRegex);
    if (urls) {
      for (const url of urls) {
        // Determine link type from URL patterns
        let linkType: EvidenceLink["type"] = "other";
        const lowerUrl = url.toLowerCase();

        if (lowerUrl.includes("runbook") || lowerUrl.includes("playbook")) {
          linkType = "runbook";
        } else if (lowerUrl.includes("dashboard") || lowerUrl.includes("grafana") || lowerUrl.includes("dynatrace")) {
          linkType = "dashboard";
        } else if (lowerUrl.includes("log") || lowerUrl.includes("kibana") || lowerUrl.includes("elastic")) {
          linkType = "log";
        } else if (lowerUrl.includes("trace") || lowerUrl.includes("jaeger") || lowerUrl.includes("zipkin")) {
          linkType = "trace";
        } else if (lowerUrl.includes("ticket") || lowerUrl.includes("jira") || lowerUrl.includes("servicenow")) {
          linkType = "ticket";
        }

        evidenceLinks.push({
          id: `${annotation.id}-${evidenceLinks.length}`,
          incident_id: incidentId,
          url,
          title: `Evidence from annotation`,
          type: linkType,
          added_by: annotation.user_id,
          added_at: annotation.timestamp,
        });
      }
    }
  }

  return evidenceLinks;
}