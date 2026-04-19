import { NextRequest, NextResponse } from "next/server";
import { withRBAC, type RBACContext } from "@/lib/services/rbac";
import {
  generateComplianceReport,
  exportFullComplianceReportToCSV,
  getComplianceSummary,
} from "@/lib/services/compliance-report-service";
import { logAction, AUDIT_ACTIONS } from "@/lib/services/audit-logger";
import {
  sanitizeString,
  sanitizePaginationParams,
} from "@/lib/validators";
import { generateCorrelationId } from "@/lib/utils";
import type { CriticalityTier, Environment, TimePeriod } from "@/types";

// ============================================================
// Constants
// ============================================================

const VALID_TIERS: CriticalityTier[] = ["Tier-1", "Tier-2", "Tier-3", "Tier-4"];
const VALID_ENVIRONMENTS: Environment[] = ["Prod", "Staging", "QA", "Dev"];
const VALID_PERIODS: TimePeriod[] = [
  "1h",
  "6h",
  "12h",
  "24h",
  "7d",
  "14d",
  "30d",
  "90d",
];
const VALID_FORMATS = ["json", "csv"];

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/admin/compliance-report
 *
 * Generates a comprehensive SLA/uptime/incident audit compliance report
 * with evidence links. Supports filtering by domain, service, tier,
 * environment, and time period. Supports JSON and CSV output formats.
 *
 * Restricted to users with view:audit_log permission (admin, are_lead roles).
 *
 * Query Parameters:
 * - domain (string, optional): Filter by business domain
 * - service_id (string, optional): Filter by service ID
 * - tier (CriticalityTier, optional): Filter by criticality tier
 * - environment (Environment, optional): Filter by environment
 * - period (TimePeriod, optional): Time range for the report (default: "30d")
 * - from (string, optional): Custom start time (ISO8601)
 * - to (string, optional): Custom end time (ISO8601)
 * - format (string, optional): Output format — "json" (default) or "csv"
 * - summary (string, optional): If "true", returns only the summary without full report
 *
 * Response (JSON format):
 * ```json
 * {
 *   "data": {
 *     "report_id": "rpt-...",
 *     "generated_at": "ISO8601",
 *     "period": "30d",
 *     "from": "ISO8601",
 *     "to": "ISO8601",
 *     "filters": { ... },
 *     "summary": { ... },
 *     "sla_reports": [...],
 *     "incident_audits": [...],
 *     "audit_trail": [...],
 *     "upload_activity": [...],
 *     "recommendations": [...]
 *   },
 *   "status": "success",
 *   "correlation_id": "compliance-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 *
 * Response (CSV format):
 * Returns a CSV file download with Content-Disposition header.
 *
 * Response (summary mode):
 * ```json
 * {
 *   "data": {
 *     "total_services": 10,
 *     "services_meeting_sla": 8,
 *     "services_breaching_sla": 2,
 *     "overall_availability_pct": 99.85,
 *     "total_incidents": 5,
 *     "critical_incidents": 1,
 *     "major_incidents": 2,
 *     "avg_mttr_minutes": 45.5,
 *     "avg_mttd_minutes": 12.3,
 *     "repeat_failure_count": 1,
 *     "total_deployments": 20,
 *     "failed_deployments": 2,
 *     "change_failure_rate_pct": 10.0
 *   },
 *   "status": "success",
 *   "correlation_id": "compliance-...",
 *   "timestamp": "ISO8601"
 * }
 * ```
 */
export const GET = withRBAC(
  async (req: NextRequest, context: RBACContext): Promise<NextResponse> => {
    const correlationId = generateCorrelationId("compliance");
    const timestamp = new Date().toISOString();

    try {
      const { searchParams } = new URL(req.url);

      // Extract and sanitize query parameters
      const domain = sanitizeString(searchParams.get("domain"));
      const serviceId = sanitizeString(searchParams.get("service_id"));
      const tierParam = sanitizeString(searchParams.get("tier"));
      const environmentParam = sanitizeString(searchParams.get("environment"));
      const periodParam = sanitizeString(searchParams.get("period"));
      const from = sanitizeString(searchParams.get("from"));
      const to = sanitizeString(searchParams.get("to"));
      const formatParam = sanitizeString(searchParams.get("format"));
      const summaryParam = sanitizeString(searchParams.get("summary"));

      // Validate tier parameter
      if (tierParam && !VALID_TIERS.includes(tierParam as CriticalityTier)) {
        return NextResponse.json(
          {
            status: "error",
            message: `Invalid tier parameter: "${tierParam}". Must be one of: ${VALID_TIERS.join(", ")}.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Validate environment parameter
      if (environmentParam && !VALID_ENVIRONMENTS.includes(environmentParam as Environment)) {
        return NextResponse.json(
          {
            status: "error",
            message: `Invalid environment parameter: "${environmentParam}". Must be one of: ${VALID_ENVIRONMENTS.join(", ")}.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Validate period parameter
      if (periodParam && !VALID_PERIODS.includes(periodParam as TimePeriod)) {
        return NextResponse.json(
          {
            status: "error",
            message: `Invalid period parameter: "${periodParam}". Must be one of: ${VALID_PERIODS.join(", ")}.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Validate format parameter
      if (formatParam && !VALID_FORMATS.includes(formatParam)) {
        return NextResponse.json(
          {
            status: "error",
            message: `Invalid format parameter: "${formatParam}". Must be one of: ${VALID_FORMATS.join(", ")}.`,
            correlation_id: correlationId,
            timestamp,
          },
          { status: 400 }
        );
      }

      // Validate from parameter if provided
      if (from) {
        const parsedFrom = new Date(from);
        if (isNaN(parsedFrom.getTime())) {
          return NextResponse.json(
            {
              status: "error",
              message: `Invalid from parameter: "${from}". Must be a valid ISO8601 date string.`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
      }

      // Validate to parameter if provided
      if (to) {
        const parsedTo = new Date(to);
        if (isNaN(parsedTo.getTime())) {
          return NextResponse.json(
            {
              status: "error",
              message: `Invalid to parameter: "${to}". Must be a valid ISO8601 date string.`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
      }

      // Validate from/to ordering if both are provided
      if (from && to) {
        const parsedFrom = new Date(from);
        const parsedTo = new Date(to);
        if (parsedFrom.getTime() > parsedTo.getTime()) {
          return NextResponse.json(
            {
              status: "error",
              message: `Invalid time range: "from" (${from}) must be before "to" (${to}).`,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 400 }
          );
        }
      }

      // Build report parameters
      const reportParams = {
        domain: domain || undefined,
        service_id: serviceId || undefined,
        tier: tierParam ? (tierParam as CriticalityTier) : undefined,
        environment: environmentParam ? (environmentParam as Environment) : undefined,
        period: periodParam ? (periodParam as TimePeriod) : undefined,
        from: from || undefined,
        to: to || undefined,
      };

      // Summary-only mode
      if (summaryParam === "true") {
        try {
          const summaryData = await getComplianceSummary(reportParams);

          return NextResponse.json(
            {
              data: summaryData,
              status: "success",
              correlation_id: correlationId,
              timestamp,
            },
            { status: 200 }
          );
        } catch (summaryError) {
          console.error("Error generating compliance summary:", summaryError);

          const errorMessage =
            summaryError instanceof Error
              ? summaryError.message
              : "An unexpected error occurred while generating the compliance summary.";

          return NextResponse.json(
            {
              status: "error",
              message: errorMessage,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 500 }
          );
        }
      }

      // Generate the full compliance report
      const report = await generateComplianceReport(reportParams);

      // Log the report generation to the audit trail
      try {
        await logAction({
          action: AUDIT_ACTIONS.GENERATE_COMPLIANCE_REPORT,
          entity_type: "service",
          entity_id: report.report_id,
          user_id: context.userId,
          user_name: context.userName,
          details: {
            report_id: report.report_id,
            period: report.period,
            from: report.from,
            to: report.to,
            filters: report.filters,
            format: formatParam || "json",
            total_services: report.summary.total_services,
            total_incidents: report.summary.total_incidents,
            services_breaching_sla: report.summary.services_breaching_sla,
          },
          correlation_id: correlationId,
        });
      } catch (auditError) {
        console.error("Audit log failed for compliance report generation:", auditError);
      }

      // CSV format response
      if (formatParam === "csv") {
        try {
          const csvResult = exportFullComplianceReportToCSV(report);

          // Log the CSV export to the audit trail
          try {
            await logAction({
              action: AUDIT_ACTIONS.EXPORT_AUDIT_LOGS,
              entity_type: "service",
              entity_id: report.report_id,
              user_id: context.userId,
              user_name: context.userName,
              details: {
                report_id: report.report_id,
                export_format: "csv",
                file_name: csvResult.file_name,
                record_count: csvResult.record_count,
              },
              correlation_id: correlationId,
            });
          } catch (auditError) {
            console.error("Audit log failed for compliance CSV export:", auditError);
          }

          return new NextResponse(csvResult.csv_content, {
            status: 200,
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": `attachment; filename="${csvResult.file_name}"`,
              "X-Correlation-Id": correlationId,
              "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            },
          });
        } catch (csvError) {
          console.error("Error exporting compliance report as CSV:", csvError);

          const errorMessage =
            csvError instanceof Error
              ? csvError.message
              : "An unexpected error occurred while exporting the compliance report as CSV.";

          return NextResponse.json(
            {
              status: "error",
              message: errorMessage,
              correlation_id: correlationId,
              timestamp,
            },
            { status: 500 }
          );
        }
      }

      // JSON format response (default)
      return NextResponse.json(
        {
          data: report,
          status: "success",
          correlation_id: correlationId,
          timestamp,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error in GET /api/admin/compliance-report:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while generating the compliance report.";

      return NextResponse.json(
        {
          status: "error",
          message: errorMessage,
          correlation_id: correlationId,
          timestamp,
        },
        { status: 500 }
      );
    }
  },
  { requiredPermission: "view:audit_log" }
);