"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { PageSkeleton } from "@/components/shared/loading-skeleton"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { RoleGuard } from "@/components/shared/role-guard"
import { DataUploadFormWithBoundary } from "@/components/admin/data-upload-form"
import { MetricsConfigFormWithBoundary } from "@/components/admin/metrics-config-form"
import { AuditLogViewerWithBoundary } from "@/components/admin/audit-log-viewer"
import { DocumentationLinksWithBoundary } from "@/components/dashboard/compliance/documentation-links"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertTriangle,
  BookOpen,
  FileText,
  Settings,
  Shield,
  Upload,
} from "lucide-react"

// ============================================================
// Constants
// ============================================================

const DEFAULT_TAB = "upload"

const ADMIN_TABS = [
  {
    value: "upload",
    label: "Data Upload",
    icon: Upload,
    description: "Upload interim data files (CSV, Excel, JSON) for ingestion",
    requiredRoles: ["admin", "are_lead", "sre_engineer", "platform_engineer"] as const,
  },
  {
    value: "metrics-config",
    label: "Metrics Config",
    icon: Settings,
    description: "Configure metric thresholds per domain and application",
    requiredRoles: ["admin", "are_lead"] as const,
  },
  {
    value: "audit-log",
    label: "Audit Log",
    icon: Shield,
    description: "Immutable record of all administrative actions",
    requiredRoles: ["admin", "are_lead"] as const,
  },
  {
    value: "documentation",
    label: "Documentation",
    icon: BookOpen,
    description: "Manage playbooks, runbooks, SOPs & architecture docs",
    requiredRoles: ["admin", "are_lead", "sre_engineer", "platform_engineer"] as const,
  },
] as const

// ============================================================
// Admin Panel Page
// ============================================================

/**
 * Admin panel page with tabs for Data Upload, Metrics Configuration,
 * Audit Logs, and Documentation Links management. Restricted to users
 * with admin or are_lead roles (enforced by the dashboard layout and
 * RoleGuard component).
 *
 * Each tab renders a fully featured admin module:
 * - Data Upload: DataUploadForm with drag-and-drop, validation, and upload history
 * - Metrics Config: MetricsConfigForm with threshold management and existing configs table
 * - Audit Log: AuditLogViewer with filterable, searchable, paginated audit trail
 * - Documentation: DocumentationLinks with CRUD, category filtering, and search
 *
 * All actions performed on this page are recorded in the audit log for compliance.
 */
export default function AdminPage() {
  const { user, isLoading: isAuthLoading, isAdmin, isARELead, role } = useAuth()

  const [activeTab, setActiveTab] = React.useState<string>(DEFAULT_TAB)

  // Show loading skeleton while auth state is resolving
  if (isAuthLoading) {
    return (
      <PageSkeleton
        showFilterBar={false}
        metricCards={0}
        showChart={false}
        showTable
      />
    )
  }

  return (
    <RoleGuard
      allowedRoles={["admin", "are_lead", "sre_engineer", "platform_engineer"]}
      fallback={
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">
              Access Denied
            </h2>
            <p className="text-sm text-muted-foreground mt-2 text-center max-w-sm">
              You do not have permission to access the admin panel.
              Contact your administrator to request access.
            </p>
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Admin Panel
              </h1>
              <p className="text-sm text-muted-foreground">
                Data upload, metrics configuration, audit logs &amp; documentation management
              </p>
            </div>
            <div className="flex items-center gap-2">
              {role && (
                <Badge variant="secondary" className="text-xs">
                  {role === "admin"
                    ? "Admin"
                    : role === "are_lead"
                      ? "ARE Lead"
                      : role === "sre_engineer"
                        ? "SRE Engineer"
                        : role === "platform_engineer"
                          ? "Platform Engineer"
                          : role}
                </Badge>
              )}
              {isAdmin && (
                <Badge variant="info" className="text-xs">
                  Full Access
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Tabbed Admin Modules */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {ADMIN_TABS.map((tab) => {
              const TabIcon = tab.icon
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="text-xs gap-1.5"
                >
                  <TabIcon className="h-3.5 w-3.5" />
                  {tab.label}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {/* Data Upload Tab */}
          <TabsContent value="upload" className="mt-4">
            <RoleGuard
              allowedRoles={["admin", "are_lead", "sre_engineer", "platform_engineer"]}
              fallback={
                <AdminTabAccessDenied tabLabel="Data Upload" />
              }
            >
              <DataUploadFormWithBoundary
                showHistory
                maxHistoryRecords={10}
                onUploadSuccess={(result) => {
                  // Tab stays on upload — history refreshes automatically via SWR
                }}
              />
            </RoleGuard>
          </TabsContent>

          {/* Metrics Configuration Tab */}
          <TabsContent value="metrics-config" className="mt-4">
            <RoleGuard
              allowedRoles={["admin", "are_lead"]}
              fallback={
                <AdminTabAccessDenied tabLabel="Metrics Configuration" />
              }
            >
              <MetricsConfigFormWithBoundary
                showExistingConfigs
                showSummary
                maxConfigRecords={20}
              />
            </RoleGuard>
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit-log" className="mt-4">
            <RoleGuard
              allowedRoles={["admin", "are_lead"]}
              fallback={
                <AdminTabAccessDenied tabLabel="Audit Log" />
              }
            >
              <AuditLogViewerWithBoundary
                showSummary
                showSearch
                showActionFilter
                showEntityTypeFilter
                showUserFilter
                showTimeRangeFilter
                showExport
                pageSize={20}
              />
            </RoleGuard>
          </TabsContent>

          {/* Documentation Links Tab */}
          <TabsContent value="documentation" className="mt-4">
            <RoleGuard
              allowedRoles={["admin", "are_lead", "sre_engineer", "platform_engineer"]}
              fallback={
                <AdminTabAccessDenied tabLabel="Documentation Links" />
              }
            >
              <DocumentationLinksWithBoundary
                showHeader
                showAddButton
                allowEdit
                allowDelete
                showSearch
                showCategoryFilter
                maxVisible={20}
                maxHeight={600}
                showEmptyState
                viewMode="list"
              />
            </RoleGuard>
          </TabsContent>
        </Tabs>

        {/* Admin Audit Trail Notice */}
        <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2">
          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-2xs text-muted-foreground leading-relaxed">
            All administrative actions performed on this page — including data uploads,
            metrics configuration changes, documentation link updates, and audit log exports —
            are recorded in the immutable audit trail for regulatory compliance.
          </p>
        </div>
      </div>
    </RoleGuard>
  )
}

// ============================================================
// AdminTabAccessDenied Component
// ============================================================

interface AdminTabAccessDeniedProps {
  tabLabel: string
}

/**
 * Fallback component displayed when a user does not have permission
 * to access a specific admin tab.
 */
function AdminTabAccessDenied({ tabLabel }: AdminTabAccessDeniedProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          Access Denied
        </p>
        <p className="text-2xs text-muted-foreground mt-1 text-center max-w-sm">
          You do not have permission to access the {tabLabel} module.
          This feature requires admin or ARE lead privileges.
        </p>
      </CardContent>
    </Card>
  )
}