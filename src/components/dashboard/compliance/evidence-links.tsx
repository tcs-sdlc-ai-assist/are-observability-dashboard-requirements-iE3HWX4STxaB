"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  Check,
  CheckCircle,
  Clock,
  Edit2,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  X,
  XCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDateTime, formatRelativeTime } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { RoleGuard } from "@/components/shared/role-guard"
import { InlineLoadingSkeleton } from "@/components/shared/loading-skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { ROUTES } from "@/constants/constants"
import type { EvidenceLink, EntityType } from "@/types"

// ============================================================
// Types
// ============================================================

export type EvidenceLinkType = EvidenceLink["type"]

export type EvidenceLinkStatus = "valid" | "invalid" | "pending" | "expired"

export interface EvidenceLinkDisplay extends EvidenceLink {
  status: EvidenceLinkStatus
  last_validated?: string
  description?: string
}

export interface EvidenceLinksProps {
  /** The incident ID to display evidence links for */
  incidentId: string
  /** Optional incident title for the header */
  incidentTitle?: string
  /** Initial evidence links data */
  evidenceLinks?: EvidenceLink[]
  /** Whether the data is currently loading */
  isLoading?: boolean
  /** Whether to show the card header (default: true) */
  showHeader?: boolean
  /** Whether to show the "Add Evidence" button (default: true) */
  showAddButton?: boolean
  /** Whether to allow editing/deleting links (default: true) */
  allowEdit?: boolean
  /** Whether to allow deletion (default: true) */
  allowDelete?: boolean
  /** Maximum number of links to display before scrolling (default: 10) */
  maxVisible?: number
  /** Maximum height of the scroll area in pixels (default: 400) */
  maxHeight?: number
  /** Whether to show the empty state illustration (default: true) */
  showEmptyState?: boolean
  /** Callback invoked when an evidence link is added */
  onLinkAdded?: (link: EvidenceLink) => void
  /** Callback invoked when an evidence link is removed */
  onLinkRemoved?: (linkId: string) => void
  /** Callback invoked when an evidence link is updated */
  onLinkUpdated?: (link: EvidenceLink) => void
  /** Additional CSS class names */
  className?: string
}

interface AddEvidenceLinkFormState {
  title: string
  url: string
  type: EvidenceLinkType
  description: string
}

// ============================================================
// Constants
// ============================================================

const EVIDENCE_LINK_TYPES: Array<{
  value: EvidenceLinkType
  label: string
  description: string
}> = [
  {
    value: "runbook",
    label: "Runbook",
    description: "Operational runbook or playbook reference",
  },
  {
    value: "dashboard",
    label: "Dashboard",
    description: "Monitoring dashboard (Dynatrace, Grafana, etc.)",
  },
  {
    value: "log",
    label: "Log",
    description: "Log query or log aggregation link (Elastic, Kibana, etc.)",
  },
  {
    value: "trace",
    label: "Trace",
    description: "Distributed trace link (Jaeger, Zipkin, etc.)",
  },
  {
    value: "ticket",
    label: "Ticket",
    description: "Issue tracker ticket (Jira, ServiceNow, etc.)",
  },
  {
    value: "other",
    label: "Other",
    description: "Other evidence or documentation link",
  },
]

const LINK_TYPE_BADGE_VARIANTS: Record<
  EvidenceLinkType,
  "info" | "success" | "warning" | "destructive" | "secondary"
> = {
  runbook: "info",
  dashboard: "success",
  log: "warning",
  trace: "info",
  ticket: "secondary",
  other: "secondary",
}

const LINK_TYPE_LABELS: Record<EvidenceLinkType, string> = {
  runbook: "Runbook",
  dashboard: "Dashboard",
  log: "Log",
  trace: "Trace",
  ticket: "Ticket",
  other: "Other",
}

const STATUS_CONFIG: Record<
  EvidenceLinkStatus,
  {
    label: string
    icon: React.ElementType
    badgeVariant: "success" | "destructive" | "warning" | "secondary"
    color: string
  }
> = {
  valid: {
    label: "Valid",
    icon: CheckCircle,
    badgeVariant: "success",
    color: "text-green-600 dark:text-green-400",
  },
  invalid: {
    label: "Invalid",
    icon: XCircle,
    badgeVariant: "destructive",
    color: "text-red-600 dark:text-red-400",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    badgeVariant: "warning",
    color: "text-yellow-600 dark:text-yellow-400",
  },
  expired: {
    label: "Expired",
    icon: AlertTriangle,
    badgeVariant: "warning",
    color: "text-yellow-600 dark:text-yellow-400",
  },
}

const MAX_URL_LENGTH = 2048
const MAX_TITLE_LENGTH = 256
const MAX_DESCRIPTION_LENGTH = 1000

// ============================================================
// Helpers
// ============================================================

/**
 * Validates that a URL is a valid HTTP/HTTPS URL.
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ["http:", "https:"].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * Extracts the hostname from a URL for display purposes.
 */
function extractHostname(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return url
  }
}

/**
 * Infers the evidence link type from a URL pattern.
 */
function inferLinkType(url: string): EvidenceLinkType {
  const lowerUrl = url.toLowerCase()

  if (lowerUrl.includes("runbook") || lowerUrl.includes("playbook")) {
    return "runbook"
  }
  if (
    lowerUrl.includes("dashboard") ||
    lowerUrl.includes("grafana") ||
    lowerUrl.includes("dynatrace") ||
    lowerUrl.includes("datadog")
  ) {
    return "dashboard"
  }
  if (
    lowerUrl.includes("log") ||
    lowerUrl.includes("kibana") ||
    lowerUrl.includes("elastic") ||
    lowerUrl.includes("splunk")
  ) {
    return "log"
  }
  if (
    lowerUrl.includes("trace") ||
    lowerUrl.includes("jaeger") ||
    lowerUrl.includes("zipkin")
  ) {
    return "trace"
  }
  if (
    lowerUrl.includes("ticket") ||
    lowerUrl.includes("jira") ||
    lowerUrl.includes("servicenow") ||
    lowerUrl.includes("snow")
  ) {
    return "ticket"
  }

  return "other"
}

/**
 * Determines the validation status of an evidence link.
 * In production, this would check link accessibility; here we simulate.
 */
function determineStatus(link: EvidenceLink): EvidenceLinkStatus {
  if (!link.url || !isValidUrl(link.url)) {
    return "invalid"
  }

  // Simulate: links added more than 30 days ago are "expired"
  if (link.added_at) {
    const addedDate = new Date(link.added_at)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    if (addedDate < thirtyDaysAgo) {
      return "expired"
    }
  }

  return "valid"
}

/**
 * Enriches raw evidence links with display metadata.
 */
function enrichEvidenceLinks(
  links: EvidenceLink[]
): EvidenceLinkDisplay[] {
  return links.map((link) => ({
    ...link,
    status: determineStatus(link),
    last_validated: link.added_at,
    description: undefined,
  }))
}

/**
 * Computes summary statistics from evidence links.
 */
function computeLinkSummary(links: EvidenceLinkDisplay[]): {
  total: number
  valid: number
  invalid: number
  pending: number
  expired: number
  byType: Map<EvidenceLinkType, number>
} {
  const byType = new Map<EvidenceLinkType, number>()
  let valid = 0
  let invalid = 0
  let pending = 0
  let expired = 0

  for (const link of links) {
    byType.set(link.type, (byType.get(link.type) || 0) + 1)

    switch (link.status) {
      case "valid":
        valid++
        break
      case "invalid":
        invalid++
        break
      case "pending":
        pending++
        break
      case "expired":
        expired++
        break
    }
  }

  return {
    total: links.length,
    valid,
    invalid,
    pending,
    expired,
    byType,
  }
}

// ============================================================
// EvidenceLinks Component
// ============================================================

/**
 * Evidence links component displaying and managing regulatory audit evidence
 * URLs for incidents. Shows link title, URL, type badge, last validated date,
 * and validation status. Supports adding, editing, and removing evidence links
 * with audit trail logging for compliance.
 *
 * Used in incident detail pages and compliance report views to ensure all
 * critical incidents have documented evidence for audit purposes.
 *
 * @example
 * ```tsx
 * // Basic usage with incident evidence
 * <EvidenceLinks
 *   incidentId="inc-123"
 *   incidentTitle="Checkout API Outage"
 *   evidenceLinks={incident.evidence_links}
 *   onLinkAdded={(link) => mutate()}
 *   onLinkRemoved={(id) => mutate()}
 * />
 *
 * // Read-only mode for compliance reports
 * <EvidenceLinks
 *   incidentId="inc-456"
 *   evidenceLinks={auditRecord.evidence_links}
 *   showAddButton={false}
 *   allowEdit={false}
 *   allowDelete={false}
 * />
 *
 * // Compact mode without header
 * <EvidenceLinks
 *   incidentId="inc-789"
 *   evidenceLinks={links}
 *   showHeader={false}
 *   maxVisible={5}
 *   maxHeight={300}
 * />
 * ```
 */
export function EvidenceLinks({
  incidentId,
  incidentTitle,
  evidenceLinks = [],
  isLoading = false,
  showHeader = true,
  showAddButton = true,
  allowEdit = true,
  allowDelete = true,
  maxVisible = 10,
  maxHeight = 400,
  showEmptyState = true,
  onLinkAdded,
  onLinkRemoved,
  onLinkUpdated,
  className,
}: EvidenceLinksProps) {
  const router = useRouter()
  const { user } = useAuth()

  const [searchText, setSearchText] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState<EvidenceLinkType | "all">(
    "all"
  )
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  // Enrich evidence links with display metadata
  const enrichedLinks = React.useMemo(
    () => enrichEvidenceLinks(evidenceLinks),
    [evidenceLinks]
  )

  // Apply filters
  const filteredLinks = React.useMemo(() => {
    let filtered = enrichedLinks

    if (searchText.trim().length > 0) {
      const lower = searchText.toLowerCase().trim()
      filtered = filtered.filter(
        (link) =>
          link.title.toLowerCase().includes(lower) ||
          link.url.toLowerCase().includes(lower) ||
          link.type.toLowerCase().includes(lower)
      )
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((link) => link.type === typeFilter)
    }

    return filtered
  }, [enrichedLinks, searchText, typeFilter])

  const summary = React.useMemo(
    () => computeLinkSummary(enrichedLinks),
    [enrichedLinks]
  )

  const linkCount = enrichedLinks.length
  const hasInvalidLinks = summary.invalid > 0
  const hasExpiredLinks = summary.expired > 0
  const isCriticalWithoutEvidence = linkCount === 0

  /**
   * Handles deletion of an evidence link.
   */
  const handleDelete = React.useCallback(
    async (linkId: string) => {
      setDeletingId(linkId)

      try {
        onLinkRemoved?.(linkId)
        toast.success({
          title: "Evidence Link Removed",
          description: "The evidence link has been removed.",
        })
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "An unexpected error occurred."
        toast.error({
          title: "Removal Failed",
          description: errorMsg,
        })
      } finally {
        setDeletingId(null)
      }
    },
    [onLinkRemoved]
  )

  /**
   * Callback when a new evidence link is added via the dialog.
   */
  const handleLinkAdded = React.useCallback(
    (link: EvidenceLink) => {
      onLinkAdded?.(link)
    },
    [onLinkAdded]
  )

  const handleSearchChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchText(e.target.value)
    },
    []
  )

  const handleTypeFilterChange = React.useCallback((value: string) => {
    setTypeFilter(value as EvidenceLinkType | "all")
  }, [])

  const handleViewIncident = React.useCallback(() => {
    if (incidentId) {
      router.push(ROUTES.INCIDENT_DETAIL(incidentId))
    }
  }, [router, incidentId])

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        {showHeader && (
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-8 w-28 rounded-md" />
          </CardHeader>
        )}
        <CardContent className={cn(!showHeader && "pt-4")}>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-56" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      {showHeader && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Evidence Links
              </CardTitle>
              {linkCount > 0 && (
                <Badge
                  variant="secondary"
                  className="text-2xs h-5 min-w-5 justify-center"
                >
                  {linkCount}
                </Badge>
              )}
              {hasInvalidLinks && (
                <Badge variant="destructive" className="text-2xs">
                  {summary.invalid} Invalid
                </Badge>
              )}
              {hasExpiredLinks && (
                <Badge variant="warning" className="text-2xs">
                  {summary.expired} Expired
                </Badge>
              )}
            </div>
            <CardDescription className="mt-0.5">
              {incidentTitle
                ? `Audit evidence for incident: ${incidentTitle}`
                : `Regulatory audit evidence for incident ${incidentId}`}
            </CardDescription>
          </div>

          {/* Add Evidence Button */}
          {showAddButton && (
            <RoleGuard
              allowedRoles={[
                "admin",
                "are_lead",
                "sre_engineer",
                "platform_engineer",
              ]}
              fallback={null}
            >
              <AddEvidenceLinkDialog
                incidentId={incidentId}
                onSuccess={handleLinkAdded}
              />
            </RoleGuard>
          )}
        </CardHeader>
      )}

      <CardContent className={cn(!showHeader && "pt-4")}>
        {/* Empty State */}
        {enrichedLinks.length === 0 && showEmptyState && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
              <Link2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No evidence links
            </p>
            <p className="text-2xs text-muted-foreground mt-1 text-center max-w-[280px]">
              Evidence links document audit artifacts such as runbooks,
              dashboards, logs, traces, and tickets for compliance purposes.
            </p>
            {showAddButton && (
              <RoleGuard
                allowedRoles={[
                  "admin",
                  "are_lead",
                  "sre_engineer",
                  "platform_engineer",
                ]}
                fallback={null}
              >
                <div className="mt-4">
                  <AddEvidenceLinkDialog
                    incidentId={incidentId}
                    onSuccess={handleLinkAdded}
                    trigger={
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add First Evidence Link
                      </Button>
                    }
                  />
                </div>
              </RoleGuard>
            )}

            {/* Missing Evidence Warning */}
            {isCriticalWithoutEvidence && (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 max-w-sm">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p className="text-2xs text-red-700 dark:text-red-400">
                  Critical incidents require documented evidence for audit
                  compliance. Add evidence links to satisfy regulatory
                  requirements.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Filter Bar */}
        {enrichedLinks.length > 3 && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search evidence..."
                value={searchText}
                onChange={handleSearchChange}
                className="h-8 w-[180px] pl-8 text-xs"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={handleTypeFilterChange}
            >
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {EVIDENCE_LINK_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Evidence Links List */}
        {filteredLinks.length > 0 && (
          <ScrollArea
            className="w-full"
            style={{
              maxHeight:
                filteredLinks.length > maxVisible ? maxHeight : undefined,
            }}
          >
            <div className="space-y-2">
              {filteredLinks.map((link) => {
                const isDeleting = deletingId === link.id

                return (
                  <EvidenceLinkRow
                    key={link.id}
                    link={link}
                    isDeleting={isDeleting}
                    allowEdit={allowEdit}
                    allowDelete={allowDelete}
                    onDelete={() => handleDelete(link.id)}
                    onUpdate={onLinkUpdated}
                  />
                )
              })}
            </div>
          </ScrollArea>
        )}

        {/* No results after filtering */}
        {enrichedLinks.length > 0 && filteredLinks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6">
            <Search className="h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No evidence links match the current filter
            </p>
          </div>
        )}

        {/* Summary Footer */}
        {enrichedLinks.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between">
              <EvidenceLinkSummaryBadges summary={summary} />
              <div className="flex items-center gap-2">
                {/* Audit Notice */}
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-2xs text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        <span>Audit tracked</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>
                      <p className="text-xs">
                        All evidence link changes are recorded in the audit log
                        for compliance.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Invalid/Expired Links Warning */}
            {(hasInvalidLinks || hasExpiredLinks) && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-2xs text-yellow-700 dark:text-yellow-400">
                  {hasInvalidLinks &&
                    `${summary.invalid} evidence link(s) have invalid URLs. `}
                  {hasExpiredLinks &&
                    `${summary.expired} evidence link(s) may be expired and should be re-validated. `}
                  Review and update links to maintain audit compliance.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer with add button when not in header */}
        {!showHeader &&
          showAddButton &&
          enrichedLinks.length > 0 && (
            <RoleGuard
              allowedRoles={[
                "admin",
                "are_lead",
                "sre_engineer",
                "platform_engineer",
              ]}
              fallback={null}
            >
              <div className="mt-3 pt-3 border-t">
                <AddEvidenceLinkDialog
                  incidentId={incidentId}
                  onSuccess={handleLinkAdded}
                />
              </div>
            </RoleGuard>
          )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// EvidenceLinkRow Component
// ============================================================

interface EvidenceLinkRowProps {
  link: EvidenceLinkDisplay
  isDeleting: boolean
  allowEdit: boolean
  allowDelete: boolean
  onDelete: () => void
  onUpdate?: (link: EvidenceLink) => void
}

/**
 * Individual evidence link row displaying title, URL, type badge,
 * validation status, and action buttons.
 */
function EvidenceLinkRow({
  link,
  isDeleting,
  allowEdit,
  allowDelete,
  onDelete,
  onUpdate,
}: EvidenceLinkRowProps) {
  const statusConfig = STATUS_CONFIG[link.status]
  const StatusIcon = statusConfig.icon
  const typeBadgeVariant = LINK_TYPE_BADGE_VARIANTS[link.type]

  return (
    <div
      className={cn(
        "group rounded-md border px-3 py-2.5 transition-colors hover:bg-accent/30",
        link.status === "invalid" && "border-red-500/20 bg-red-500/5",
        link.status === "expired" && "border-yellow-500/20 bg-yellow-500/5",
        isDeleting && "opacity-50 pointer-events-none"
      )}
    >
      {/* Header: Title, Type, Status, Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Status Icon */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <StatusIcon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    statusConfig.color
                  )}
                />
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                <p className="text-xs">Status: {statusConfig.label}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Title */}
          <span className="text-sm font-medium truncate max-w-[200px]">
            {link.title}
          </span>

          {/* Type Badge */}
          <Badge
            variant={typeBadgeVariant}
            className="text-2xs h-3.5 px-1 shrink-0"
          >
            {LINK_TYPE_LABELS[link.type]}
          </Badge>

          {/* Status Badge */}
          <Badge
            variant={statusConfig.badgeVariant}
            className="text-2xs h-3.5 px-1 shrink-0"
          >
            {statusConfig.label}
          </Badge>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {/* Open in New Tab */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                <p className="text-xs">Open in new tab</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Delete Button */}
          {allowDelete && (
            <RoleGuard
              allowedRoles={[
                "admin",
                "are_lead",
                "sre_engineer",
                "platform_engineer",
              ]}
              fallback={null}
            >
              <AlertDialog>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>
                      <p className="text-xs">Remove evidence link</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove Evidence Link</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove this evidence link? This
                      action will be recorded in the audit log. Removing
                      evidence may affect compliance posture.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </RoleGuard>
          )}
        </div>
      </div>

      {/* URL */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-2xs text-primary hover:underline truncate max-w-[400px]"
          onClick={(e) => e.stopPropagation()}
        >
          {link.url}
        </a>
      </div>

      {/* Metadata Row */}
      <div className="mt-1 flex items-center gap-3">
        {/* Hostname */}
        <span className="text-2xs text-muted-foreground">
          {extractHostname(link.url)}
        </span>

        {/* Added By */}
        {link.added_by && (
          <>
            <span className="text-2xs text-muted-foreground">·</span>
            <span className="text-2xs text-muted-foreground">
              Added by {link.added_by}
            </span>
          </>
        )}

        {/* Added At */}
        {link.added_at && (
          <>
            <span className="text-2xs text-muted-foreground">·</span>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-2xs text-muted-foreground flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {formatRelativeTime(link.added_at)}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  <p className="text-xs">
                    Added: {formatDateTime(link.added_at)}
                  </p>
                  {link.last_validated && (
                    <p className="text-2xs text-muted-foreground">
                      Last validated: {formatDateTime(link.last_validated)}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================
// AddEvidenceLinkDialog Component
// ============================================================

interface AddEvidenceLinkDialogProps {
  incidentId: string
  onSuccess?: (link: EvidenceLink) => void
  trigger?: React.ReactNode
}

/**
 * Dialog for adding a new evidence link to an incident.
 * Includes URL validation, type inference, and audit trail logging.
 */
function AddEvidenceLinkDialog({
  incidentId,
  onSuccess,
  trigger,
}: AddEvidenceLinkDialogProps) {
  const { user } = useAuth()

  const [isOpen, setIsOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const [formState, setFormState] = React.useState<AddEvidenceLinkFormState>({
    title: "",
    url: "",
    type: "other",
    description: "",
  })

  // Reset form when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setFormState({
        title: "",
        url: "",
        type: "other",
        description: "",
      })
      setSubmitError(null)
    }
  }, [isOpen])

  // Auto-infer link type when URL changes
  React.useEffect(() => {
    if (formState.url.trim().length > 10) {
      const inferred = inferLinkType(formState.url)
      if (inferred !== "other") {
        setFormState((prev) => ({ ...prev, type: inferred }))
      }
    }
  }, [formState.url])

  const isUrlValid =
    formState.url.trim().length > 0 && isValidUrl(formState.url.trim())
  const isTitleValid = formState.title.trim().length > 0
  const canSubmit = isUrlValid && isTitleValid && !isSubmitting

  const handleFieldChange = React.useCallback(
    (field: keyof AddEvidenceLinkFormState, value: string) => {
      setFormState((prev) => ({ ...prev, [field]: value }))
      setSubmitError(null)
    },
    []
  )

  const handleTypeChange = React.useCallback((value: string) => {
    setFormState((prev) => ({
      ...prev,
      type: value as EvidenceLinkType,
    }))
    setSubmitError(null)
  }, [])

  const handleSubmit = React.useCallback(async () => {
    if (!canSubmit || !user) return

    const trimmedTitle = formState.title.trim()
    const trimmedUrl = formState.url.trim()

    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      setSubmitError(
        `Title cannot exceed ${MAX_TITLE_LENGTH} characters.`
      )
      return
    }

    if (trimmedUrl.length > MAX_URL_LENGTH) {
      setSubmitError(`URL cannot exceed ${MAX_URL_LENGTH} characters.`)
      return
    }

    if (!isValidUrl(trimmedUrl)) {
      setSubmitError("Please enter a valid HTTP or HTTPS URL.")
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const newLink: EvidenceLink = {
        id: `evl-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        incident_id: incidentId,
        url: trimmedUrl,
        title: trimmedTitle,
        type: formState.type,
        added_by: user.id,
        added_at: new Date().toISOString(),
      }

      onSuccess?.(newLink)

      toast.success({
        title: "Evidence Link Added",
        description: `"${trimmedTitle}" has been added as evidence.`,
      })

      setIsOpen(false)
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred."
      setSubmitError(errorMsg)
      toast.error({
        title: "Failed to Add Evidence",
        description: errorMsg,
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [canSubmit, user, formState, incidentId, onSuccess])

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
      <Plus className="h-3.5 w-3.5" />
      Add Evidence
    </Button>
  )

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent
        className="sm:max-w-[500px]"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Add Evidence Link
          </DialogTitle>
          <DialogDescription>
            Add an audit evidence link for incident {incidentId}. All
            changes are recorded in the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="evidence-title" className="text-sm">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="evidence-title"
              placeholder="e.g., Grafana Dashboard — Checkout Latency"
              value={formState.title}
              onChange={(e) => handleFieldChange("title", e.target.value)}
              className="h-9 text-sm"
              disabled={isSubmitting}
              maxLength={MAX_TITLE_LENGTH}
            />
            <p className="text-2xs text-muted-foreground">
              A descriptive title for the evidence artifact.
            </p>
          </div>

          {/* URL */}
          <div className="space-y-1.5">
            <Label htmlFor="evidence-url" className="text-sm">
              URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="evidence-url"
              placeholder="https://..."
              value={formState.url}
              onChange={(e) => handleFieldChange("url", e.target.value)}
              className={cn(
                "h-9 text-sm",
                formState.url.trim().length > 0 &&
                  !isUrlValid &&
                  "border-destructive focus-visible:ring-destructive"
              )}
              disabled={isSubmitting}
              maxLength={MAX_URL_LENGTH}
            />
            {formState.url.trim().length > 0 && !isUrlValid && (
              <p className="text-2xs text-destructive">
                Please enter a valid HTTP or HTTPS URL.
              </p>
            )}
            {formState.url.trim().length > 0 && isUrlValid && (
              <p className="text-2xs text-green-600 dark:text-green-400">
                ✓ {extractHostname(formState.url)}
              </p>
            )}
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label htmlFor="evidence-type" className="text-sm">
              Type
            </Label>
            <Select
              value={formState.type}
              onValueChange={handleTypeChange}
            >
              <SelectTrigger
                id="evidence-type"
                className="h-9 text-sm"
              >
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {EVIDENCE_LINK_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={LINK_TYPE_BADGE_VARIANTS[type.value]}
                        className="text-2xs h-4 px-1.5"
                      >
                        {type.label}
                      </Badge>
                      <span className="text-2xs text-muted-foreground hidden sm:inline">
                        {type.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-2xs text-muted-foreground">
              The type is auto-detected from the URL when possible.
            </p>
          </div>

          {/* Submission Error */}
          {submitError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="text-sm">
                {submitError}
              </AlertDescription>
            </Alert>
          )}

          {/* Audit Notice */}
          <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-2xs text-muted-foreground leading-relaxed">
              This action will be recorded in the audit log with your user
              identity ({user?.name || "Unknown"}) for compliance purposes.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="ghost" size="sm" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Adding…
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      Add Evidence
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                <p className="text-xs">
                  {isSubmitting
                    ? "Submitting…"
                    : "Add evidence link (Ctrl+Enter)"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// EvidenceLinkSummaryBadges Component
// ============================================================

interface EvidenceLinkSummaryBadgesProps {
  summary: ReturnType<typeof computeLinkSummary>
}

/**
 * Compact summary badges for the evidence links footer.
 */
function EvidenceLinkSummaryBadges({
  summary,
}: EvidenceLinkSummaryBadgesProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs text-muted-foreground">
        {summary.total} link{summary.total !== 1 ? "s" : ""}
      </span>
      {summary.valid > 0 && (
        <Badge variant="success" className="text-2xs">
          {summary.valid} valid
        </Badge>
      )}
      {summary.invalid > 0 && (
        <Badge variant="destructive" className="text-2xs">
          {summary.invalid} invalid
        </Badge>
      )}
      {summary.expired > 0 && (
        <Badge variant="warning" className="text-2xs">
          {summary.expired} expired
        </Badge>
      )}
      {summary.pending > 0 && (
        <Badge variant="secondary" className="text-2xs">
          {summary.pending} pending
        </Badge>
      )}
    </div>
  )
}

// ============================================================
// EvidenceLinksTable Component
// ============================================================

export interface EvidenceLinksTableProps {
  /** Evidence links to display in table format */
  evidenceLinks: EvidenceLink[]
  /** Whether to show the status column (default: true) */
  showStatus?: boolean
  /** Whether to show the added by column (default: true) */
  showAddedBy?: boolean
  /** Callback when a link row is clicked */
  onLinkClick?: (link: EvidenceLink) => void
  /** Additional CSS class names */
  className?: string
}

/**
 * Table view of evidence links for compliance report views.
 * Displays links in a structured table with sortable columns.
 */
export function EvidenceLinksTable({
  evidenceLinks,
  showStatus = true,
  showAddedBy = true,
  onLinkClick,
  className,
}: EvidenceLinksTableProps) {
  const enrichedLinks = React.useMemo(
    () => enrichEvidenceLinks(evidenceLinks),
    [evidenceLinks]
  )

  if (enrichedLinks.length === 0) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-sm text-muted-foreground">
          No evidence links available.
        </p>
      </div>
    )
  }

  return (
    <div className={cn("rounded-md border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>URL</TableHead>
            {showStatus && <TableHead>Status</TableHead>}
            {showAddedBy && <TableHead>Added By</TableHead>}
            <TableHead>Added</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {enrichedLinks.map((link) => {
            const statusConfig = STATUS_CONFIG[link.status]
            const StatusIcon = statusConfig.icon

            return (
              <TableRow
                key={link.id}
                className={cn(onLinkClick && "cursor-pointer")}
                onClick={() => onLinkClick?.(link)}
              >
                {/* Title */}
                <TableCell className="font-medium">
                  <span className="truncate max-w-[200px] inline-block">
                    {link.title}
                  </span>
                </TableCell>

                {/* Type */}
                <TableCell>
                  <Badge
                    variant={LINK_TYPE_BADGE_VARIANTS[link.type]}
                    className="text-2xs"
                  >
                    {LINK_TYPE_LABELS[link.type]}
                  </Badge>
                </TableCell>

                {/* URL */}
                <TableCell>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-2xs text-primary hover:underline truncate max-w-[250px] inline-block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {extractHostname(link.url)}
                  </a>
                </TableCell>

                {/* Status */}
                {showStatus && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <StatusIcon
                        className={cn(
                          "h-3 w-3",
                          statusConfig.color
                        )}
                      />
                      <span className="text-2xs">{statusConfig.label}</span>
                    </div>
                  </TableCell>
                )}

                {/* Added By */}
                {showAddedBy && (
                  <TableCell>
                    <span className="text-2xs text-muted-foreground">
                      {link.added_by || "—"}
                    </span>
                  </TableCell>
                )}

                {/* Added */}
                <TableCell>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-2xs text-muted-foreground">
                          {formatRelativeTime(link.added_at)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={4}>
                        <p className="text-xs">
                          {formatDateTime(link.added_at)}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// ============================================================
// EvidenceLinkCompact Component
// ============================================================

export interface EvidenceLinkCompactProps {
  /** Evidence links to display */
  evidenceLinks: EvidenceLink[]
  /** Maximum number of links to show inline (default: 3) */
  maxInline?: number
  /** Additional CSS class names */
  className?: string
}

/**
 * Compact inline display of evidence links for use in table cells
 * or summary cards. Shows link icons with tooltips.
 */
export function EvidenceLinkCompact({
  evidenceLinks,
  maxInline = 3,
  className,
}: EvidenceLinkCompactProps) {
  if (evidenceLinks.length === 0) {
    return (
      <span className="text-2xs text-muted-foreground">—</span>
    )
  }

  const displayedLinks = evidenceLinks.slice(0, maxInline)
  const remainingCount = evidenceLinks.length - maxInline

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />
      <span className="text-2xs text-muted-foreground">
        {evidenceLinks.length}
      </span>
      {displayedLinks.map((link, idx) => (
        <TooltipProvider key={link.id || idx} delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-xs">
              <div className="space-y-0.5">
                <p className="text-xs font-medium">{link.title}</p>
                <p className="text-2xs text-muted-foreground">
                  [{LINK_TYPE_LABELS[link.type]}] {extractHostname(link.url)}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
      {remainingCount > 0 && (
        <span className="text-2xs text-muted-foreground">
          +{remainingCount}
        </span>
      )}
    </div>
  )
}

// ============================================================
// Wrapped Export with Error Boundary
// ============================================================

export interface EvidenceLinksWithBoundaryProps extends EvidenceLinksProps {}

/**
 * EvidenceLinks wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function EvidenceLinksWithBoundary(
  props: EvidenceLinksWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Evidence Links">
      <EvidenceLinks {...props} />
    </ModuleErrorBoundary>
  )
}

export default EvidenceLinks