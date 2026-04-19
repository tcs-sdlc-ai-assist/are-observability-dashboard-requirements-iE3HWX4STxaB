"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  BookOpen,
  Check,
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
} from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDateTime, formatRelativeTime } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import {
  useDocumentationLinks,
  useDocumentationLinksForService,
  useDocumentationLinkMutations,
} from "@/hooks/use-admin-data"
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
import type { DocumentationLink } from "@/types"

// ============================================================
// Types
// ============================================================

export type DocumentationLinkCategory = DocumentationLink["category"]

export interface DocumentationLinksProps {
  /** Optional service ID to scope links to a specific service */
  serviceId?: string
  /** Optional domain ID to scope links to a specific domain */
  domainId?: string
  /** Optional service name for the header */
  serviceName?: string
  /** Whether to show the card header (default: true) */
  showHeader?: boolean
  /** Whether to show the "Add Link" button (default: true) */
  showAddButton?: boolean
  /** Whether to allow editing/deleting links (default: true) */
  allowEdit?: boolean
  /** Whether to allow deletion (default: true) */
  allowDelete?: boolean
  /** Whether to show the search bar (default: true) */
  showSearch?: boolean
  /** Whether to show the category filter (default: true) */
  showCategoryFilter?: boolean
  /** Maximum number of links to display before scrolling (default: 20) */
  maxVisible?: number
  /** Maximum height of the scroll area in pixels (default: 500) */
  maxHeight?: number
  /** Whether to show the empty state illustration (default: true) */
  showEmptyState?: boolean
  /** View mode: list or table (default: "list") */
  viewMode?: "list" | "table"
  /** Callback invoked when a link is added, updated, or removed */
  onLinkChange?: () => void
  /** Additional CSS class names */
  className?: string
}

interface AddEditLinkFormState {
  title: string
  url: string
  category: DocumentationLinkCategory
  description: string
}

// ============================================================
// Constants
// ============================================================

const DOCUMENTATION_LINK_CATEGORIES: Array<{
  value: DocumentationLinkCategory
  label: string
  description: string
}> = [
  {
    value: "runbook",
    label: "Runbook",
    description: "Operational runbook for incident response",
  },
  {
    value: "architecture",
    label: "Architecture",
    description: "Architecture diagrams and design documents",
  },
  {
    value: "sop",
    label: "SOP",
    description: "Standard Operating Procedure",
  },
  {
    value: "postmortem",
    label: "Post-Mortem",
    description: "Incident post-mortem reports",
  },
  {
    value: "sla",
    label: "SLA Document",
    description: "Service Level Agreement documentation",
  },
  {
    value: "other",
    label: "Other",
    description: "Other documentation or reference links",
  },
]

const CATEGORY_BADGE_VARIANTS: Record<
  DocumentationLinkCategory,
  "info" | "success" | "warning" | "destructive" | "secondary"
> = {
  runbook: "info",
  architecture: "success",
  sop: "warning",
  postmortem: "destructive",
  sla: "info",
  other: "secondary",
}

const CATEGORY_LABELS: Record<DocumentationLinkCategory, string> = {
  runbook: "Runbook",
  architecture: "Architecture",
  sop: "SOP",
  postmortem: "Post-Mortem",
  sla: "SLA Document",
  other: "Other",
}

const CATEGORY_ICONS: Record<DocumentationLinkCategory, React.ElementType> = {
  runbook: BookOpen,
  architecture: FileText,
  sop: Shield,
  postmortem: AlertTriangle,
  sla: FileText,
  other: Link2,
}

const MAX_TITLE_LENGTH = 256
const MAX_DESCRIPTION_LENGTH = 2000
const MAX_URL_LENGTH = 2048

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
 * Groups documentation links by category.
 */
function groupByCategory(
  links: DocumentationLink[]
): Map<DocumentationLinkCategory, DocumentationLink[]> {
  const map = new Map<DocumentationLinkCategory, DocumentationLink[]>()

  for (const link of links) {
    const existing = map.get(link.category) || []
    existing.push(link)
    map.set(link.category, existing)
  }

  return map
}

/**
 * Computes summary statistics from documentation links.
 */
function computeLinkSummary(links: DocumentationLink[]): {
  total: number
  byCategory: Map<DocumentationLinkCategory, number>
} {
  const byCategory = new Map<DocumentationLinkCategory, number>()

  for (const link of links) {
    byCategory.set(link.category, (byCategory.get(link.category) || 0) + 1)
  }

  return {
    total: links.length,
    byCategory,
  }
}

// ============================================================
// DocumentationLinks Component
// ============================================================

/**
 * Documentation links component displaying playbooks, runbooks, escalation
 * SOPs, architecture docs, post-mortems, and SLA documents with links to
 * Confluence or other documentation platforms. Admin-editable with add,
 * edit, and delete capabilities. All changes are audit-logged for compliance.
 *
 * Supports filtering by category and search text, grouping by category,
 * and both list and table view modes.
 *
 * @example
 * ```tsx
 * // Basic usage — all documentation links
 * <DocumentationLinks
 *   showHeader
 *   showAddButton
 *   showSearch
 *   showCategoryFilter
 * />
 *
 * // Scoped to a specific service
 * <DocumentationLinks
 *   serviceId="svc-123"
 *   serviceName="Checkout API"
 *   showHeader
 *   showAddButton
 * />
 *
 * // Read-only mode for compliance reports
 * <DocumentationLinks
 *   serviceId="svc-456"
 *   showAddButton={false}
 *   allowEdit={false}
 *   allowDelete={false}
 * />
 *
 * // Table view mode
 * <DocumentationLinks viewMode="table" />
 * ```
 */
export function DocumentationLinks({
  serviceId,
  domainId,
  serviceName,
  showHeader = true,
  showAddButton = true,
  allowEdit = true,
  allowDelete = true,
  showSearch = true,
  showCategoryFilter = true,
  maxVisible = 20,
  maxHeight = 500,
  showEmptyState = true,
  viewMode = "list",
  onLinkChange,
  className,
}: DocumentationLinksProps) {
  const { user } = useAuth()

  const [searchText, setSearchText] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState<
    DocumentationLinkCategory | "all"
  >("all")
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  // Fetch documentation links — scoped to service if provided
  const {
    data: paginatedData,
    isLoading,
    error,
    mutate,
  } = useDocumentationLinks({
    service_id: serviceId,
    domain_id: domainId,
    category:
      categoryFilter !== "all" ? categoryFilter : undefined,
    search: searchText.trim().length > 0 ? searchText.trim() : undefined,
  })

  const links = paginatedData?.data || []

  const { deleteLink } = useDocumentationLinkMutations()

  // Apply client-side filtering for immediate feedback
  const filteredLinks = React.useMemo(() => {
    let filtered = links

    if (searchText.trim().length > 0) {
      const lower = searchText.toLowerCase().trim()
      filtered = filtered.filter(
        (link) =>
          link.title.toLowerCase().includes(lower) ||
          link.url.toLowerCase().includes(lower) ||
          link.category.toLowerCase().includes(lower) ||
          (link.description && link.description.toLowerCase().includes(lower))
      )
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter((link) => link.category === categoryFilter)
    }

    return filtered
  }, [links, searchText, categoryFilter])

  const summary = React.useMemo(
    () => computeLinkSummary(links),
    [links]
  )

  const groupedLinks = React.useMemo(
    () => groupByCategory(filteredLinks),
    [filteredLinks]
  )

  const linkCount = links.length

  /**
   * Handles deletion of a documentation link.
   */
  const handleDelete = React.useCallback(
    async (linkId: string) => {
      setDeletingId(linkId)

      try {
        const result = await deleteLink(linkId)

        if (result.success) {
          toast.success({
            title: "Link Removed",
            description: "The documentation link has been removed.",
          })
          mutate()
          onLinkChange?.()
        } else {
          const errorMsg = result.error || "Failed to remove link."
          toast.error({
            title: "Removal Failed",
            description: errorMsg,
          })
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "An unexpected error occurred."
        toast.error({
          title: "Error",
          description: errorMsg,
        })
      } finally {
        setDeletingId(null)
      }
    },
    [deleteLink, mutate, onLinkChange]
  )

  /**
   * Callback when a new link is added or updated via the dialog.
   */
  const handleLinkChanged = React.useCallback(() => {
    mutate()
    onLinkChange?.()
  }, [mutate, onLinkChange])

  const handleSearchChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchText(e.target.value)
    },
    []
  )

  const handleCategoryFilterChange = React.useCallback((value: string) => {
    setCategoryFilter(value as DocumentationLinkCategory | "all")
  }, [])

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        {showHeader && (
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-40" />
            </div>
            <Skeleton className="h-8 w-28 rounded-md" />
          </CardHeader>
        )}
        <CardContent className={cn(!showHeader && "pt-4")}>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-64" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        {showHeader && (
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Documentation Links
              </CardTitle>
              <CardDescription>
                Failed to load documentation links.
              </CardDescription>
            </div>
          </CardHeader>
        )}
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

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      {showHeader && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Documentation Links
              </CardTitle>
              {linkCount > 0 && (
                <Badge
                  variant="secondary"
                  className="text-2xs h-5 min-w-5 justify-center"
                >
                  {linkCount}
                </Badge>
              )}
            </div>
            <CardDescription className="mt-0.5">
              {serviceName
                ? `Playbooks, runbooks & SOPs for ${serviceName}`
                : "Playbooks, runbooks, escalation SOPs & architecture docs"}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
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
                  Refresh links
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Add Link Button */}
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
                <AddEditDocumentationLinkDialog
                  serviceId={serviceId}
                  domainId={domainId}
                  onSuccess={handleLinkChanged}
                />
              </RoleGuard>
            )}
          </div>
        </CardHeader>
      )}

      <CardContent className={cn(!showHeader && "pt-4")}>
        {/* Empty State */}
        {links.length === 0 && showEmptyState && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No documentation links
            </p>
            <p className="text-2xs text-muted-foreground mt-1 text-center max-w-[280px]">
              Add playbooks, runbooks, escalation SOPs, and architecture
              documents to support incident response and compliance.
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
                  <AddEditDocumentationLinkDialog
                    serviceId={serviceId}
                    domainId={domainId}
                    onSuccess={handleLinkChanged}
                    trigger={
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add First Link
                      </Button>
                    }
                  />
                </div>
              </RoleGuard>
            )}
          </div>
        )}

        {/* Filter Bar */}
        {links.length > 0 && (showSearch || showCategoryFilter) && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {showSearch && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search documentation..."
                  value={searchText}
                  onChange={handleSearchChange}
                  className="h-8 w-[200px] pl-8 text-xs"
                />
              </div>
            )}
            {showCategoryFilter && (
              <Select
                value={categoryFilter}
                onValueChange={handleCategoryFilterChange}
              >
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {DOCUMENTATION_LINK_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Links Content */}
        {filteredLinks.length > 0 && (
          <>
            {viewMode === "table" ? (
              <DocumentationLinksTableView
                links={filteredLinks}
                allowEdit={allowEdit}
                allowDelete={allowDelete}
                deletingId={deletingId}
                serviceId={serviceId}
                domainId={domainId}
                onDelete={handleDelete}
                onLinkChanged={handleLinkChanged}
              />
            ) : (
              <ScrollArea
                className="w-full"
                style={{
                  maxHeight:
                    filteredLinks.length > maxVisible ? maxHeight : undefined,
                }}
              >
                <div className="space-y-4">
                  {Array.from(groupedLinks.entries()).map(
                    ([category, categoryLinks]) => (
                      <DocumentationLinkCategoryGroup
                        key={category}
                        category={category}
                        links={categoryLinks}
                        allowEdit={allowEdit}
                        allowDelete={allowDelete}
                        deletingId={deletingId}
                        serviceId={serviceId}
                        domainId={domainId}
                        onDelete={handleDelete}
                        onLinkChanged={handleLinkChanged}
                      />
                    )
                  )}
                </div>
              </ScrollArea>
            )}
          </>
        )}

        {/* No results after filtering */}
        {links.length > 0 && filteredLinks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6">
            <Search className="h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No documentation links match the current filter
            </p>
          </div>
        )}

        {/* Summary Footer */}
        {links.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between">
              <DocumentationLinkSummaryBadges summary={summary} />
              <div className="flex items-center gap-2">
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
                        All documentation link changes are recorded in the audit
                        log for compliance.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        )}

        {/* Footer with add button when not in header */}
        {!showHeader && showAddButton && links.length > 0 && (
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
              <AddEditDocumentationLinkDialog
                serviceId={serviceId}
                domainId={domainId}
                onSuccess={handleLinkChanged}
              />
            </div>
          </RoleGuard>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// DocumentationLinkCategoryGroup Component
// ============================================================

interface DocumentationLinkCategoryGroupProps {
  category: DocumentationLinkCategory
  links: DocumentationLink[]
  allowEdit: boolean
  allowDelete: boolean
  deletingId: string | null
  serviceId?: string
  domainId?: string
  onDelete: (linkId: string) => void
  onLinkChanged: () => void
}

/**
 * Group of documentation links under a single category heading.
 */
function DocumentationLinkCategoryGroup({
  category,
  links,
  allowEdit,
  allowDelete,
  deletingId,
  serviceId,
  domainId,
  onDelete,
  onLinkChanged,
}: DocumentationLinkCategoryGroupProps) {
  const CategoryIcon = CATEGORY_ICONS[category] || Link2

  return (
    <div className="space-y-1.5">
      {/* Category Header */}
      <div className="flex items-center gap-2">
        <CategoryIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
          {CATEGORY_LABELS[category]}
        </span>
        <span className="text-2xs text-muted-foreground">
          ({links.length})
        </span>
      </div>

      {/* Link Items */}
      <div className="space-y-1.5">
        {links.map((link) => (
          <DocumentationLinkRow
            key={link.id}
            link={link}
            isDeleting={deletingId === link.id}
            allowEdit={allowEdit}
            allowDelete={allowDelete}
            serviceId={serviceId}
            domainId={domainId}
            onDelete={() => onDelete(link.id)}
            onLinkChanged={onLinkChanged}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================
// DocumentationLinkRow Component
// ============================================================

interface DocumentationLinkRowProps {
  link: DocumentationLink
  isDeleting: boolean
  allowEdit: boolean
  allowDelete: boolean
  serviceId?: string
  domainId?: string
  onDelete: () => void
  onLinkChanged: () => void
}

/**
 * Individual documentation link row displaying title, URL, category badge,
 * description, and action buttons.
 */
function DocumentationLinkRow({
  link,
  isDeleting,
  allowEdit,
  allowDelete,
  serviceId,
  domainId,
  onDelete,
  onLinkChanged,
}: DocumentationLinkRowProps) {
  const typeBadgeVariant = CATEGORY_BADGE_VARIANTS[link.category]
  const CategoryIcon = CATEGORY_ICONS[link.category] || Link2

  return (
    <div
      className={cn(
        "group rounded-md border px-3 py-2.5 transition-colors hover:bg-accent/30",
        isDeleting && "opacity-50 pointer-events-none"
      )}
    >
      {/* Header: Title, Category, Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Category Icon */}
          <CategoryIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

          {/* Title */}
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium truncate max-w-[250px] hover:text-primary transition-colors"
          >
            {link.title}
          </a>

          {/* Category Badge */}
          <Badge
            variant={typeBadgeVariant}
            className="text-2xs h-3.5 px-1 shrink-0"
          >
            {CATEGORY_LABELS[link.category]}
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

          {/* Edit Button */}
          {allowEdit && (
            <RoleGuard
              allowedRoles={[
                "admin",
                "are_lead",
                "sre_engineer",
                "platform_engineer",
              ]}
              fallback={null}
            >
              <AddEditDocumentationLinkDialog
                existingLink={link}
                serviceId={serviceId}
                domainId={domainId}
                onSuccess={onLinkChanged}
                trigger={
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={4}>
                        <p className="text-xs">Edit link</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                }
              />
            </RoleGuard>
          )}

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
                      <p className="text-xs">Remove link</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove Documentation Link</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove &ldquo;{link.title}&rdquo;?
                      This action will be recorded in the audit log.
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

      {/* Description */}
      {link.description && (
        <p className="mt-1 text-2xs text-muted-foreground leading-relaxed line-clamp-2">
          {link.description}
        </p>
      )}

      {/* Metadata Row */}
      <div className="mt-1 flex items-center gap-3">
        {/* Hostname */}
        <span className="text-2xs text-muted-foreground">
          {extractHostname(link.url)}
        </span>

        {/* Created By */}
        {link.created_by && (
          <>
            <span className="text-2xs text-muted-foreground">·</span>
            <span className="text-2xs text-muted-foreground">
              Added by {link.created_by}
            </span>
          </>
        )}

        {/* Updated At */}
        {link.updated_at && (
          <>
            <span className="text-2xs text-muted-foreground">·</span>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-2xs text-muted-foreground flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {formatRelativeTime(link.updated_at)}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  <p className="text-xs">
                    Updated: {formatDateTime(link.updated_at)}
                  </p>
                  {link.created_at && (
                    <p className="text-2xs text-muted-foreground">
                      Created: {formatDateTime(link.created_at)}
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
// DocumentationLinksTableView Component
// ============================================================

interface DocumentationLinksTableViewProps {
  links: DocumentationLink[]
  allowEdit: boolean
  allowDelete: boolean
  deletingId: string | null
  serviceId?: string
  domainId?: string
  onDelete: (linkId: string) => void
  onLinkChanged: () => void
}

/**
 * Table view of documentation links for compact display.
 */
function DocumentationLinksTableView({
  links,
  allowEdit,
  allowDelete,
  deletingId,
  serviceId,
  domainId,
  onDelete,
  onLinkChanged,
}: DocumentationLinksTableViewProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>URL</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {links.map((link) => {
            const isDeleting = deletingId === link.id
            const CategoryIcon = CATEGORY_ICONS[link.category] || Link2

            return (
              <TableRow
                key={link.id}
                className={cn(isDeleting && "opacity-50 pointer-events-none")}
              >
                {/* Title */}
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <CategoryIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate max-w-[200px] hover:text-primary transition-colors"
                    >
                      {link.title}
                    </a>
                  </div>
                </TableCell>

                {/* Category */}
                <TableCell>
                  <Badge
                    variant={CATEGORY_BADGE_VARIANTS[link.category]}
                    className="text-2xs"
                  >
                    {CATEGORY_LABELS[link.category]}
                  </Badge>
                </TableCell>

                {/* URL */}
                <TableCell>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-2xs text-primary hover:underline truncate max-w-[200px] inline-block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {extractHostname(link.url)}
                  </a>
                </TableCell>

                {/* Updated */}
                <TableCell>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-2xs text-muted-foreground">
                          {formatRelativeTime(link.updated_at)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={4}>
                        <p className="text-xs">
                          {formatDateTime(link.updated_at)}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>

                {/* Actions */}
                <TableCell>
                  <div className="flex items-center gap-0.5">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>

                    {allowEdit && (
                      <RoleGuard
                        allowedRoles={[
                          "admin",
                          "are_lead",
                          "sre_engineer",
                          "platform_engineer",
                        ]}
                        fallback={null}
                      >
                        <AddEditDocumentationLinkDialog
                          existingLink={link}
                          serviceId={serviceId}
                          domainId={domainId}
                          onSuccess={onLinkChanged}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          }
                        />
                      </RoleGuard>
                    )}

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
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Remove Documentation Link
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove &ldquo;
                                {link.title}&rdquo;? This action will be
                                recorded in the audit log.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onDelete(link.id)}
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
// AddEditDocumentationLinkDialog Component
// ============================================================

interface AddEditDocumentationLinkDialogProps {
  /** Existing link to edit (null for create mode) */
  existingLink?: DocumentationLink | null
  /** Optional service ID to associate the link with */
  serviceId?: string
  /** Optional domain ID to associate the link with */
  domainId?: string
  /** Callback invoked after a successful create or update */
  onSuccess?: () => void
  /** Optional trigger element */
  trigger?: React.ReactNode
}

/**
 * Dialog for adding or editing a documentation link.
 * Includes URL validation, category selection, and audit trail logging.
 */
function AddEditDocumentationLinkDialog({
  existingLink,
  serviceId,
  domainId,
  onSuccess,
  trigger,
}: AddEditDocumentationLinkDialogProps) {
  const { user } = useAuth()
  const { createLink, updateLink } = useDocumentationLinkMutations()

  const isEditMode = !!existingLink
  const dialogTitle = isEditMode
    ? "Edit Documentation Link"
    : "Add Documentation Link"
  const dialogDescription = isEditMode
    ? "Update the documentation link details."
    : "Add a new playbook, runbook, SOP, or documentation link."

  const [isOpen, setIsOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const [formState, setFormState] = React.useState<AddEditLinkFormState>({
    title: "",
    url: "",
    category: "runbook",
    description: "",
  })

  // Initialize form state when dialog opens or existing link changes
  React.useEffect(() => {
    if (isOpen) {
      setSubmitError(null)

      if (existingLink) {
        setFormState({
          title: existingLink.title,
          url: existingLink.url,
          category: existingLink.category,
          description: existingLink.description || "",
        })
      } else {
        setFormState({
          title: "",
          url: "",
          category: "runbook",
          description: "",
        })
      }
    }
  }, [isOpen, existingLink])

  const isUrlValid =
    formState.url.trim().length > 0 && isValidUrl(formState.url.trim())
  const isTitleValid = formState.title.trim().length > 0
  const canSubmit = isUrlValid && isTitleValid && !isSubmitting

  const handleFieldChange = React.useCallback(
    (field: keyof AddEditLinkFormState, value: string) => {
      setFormState((prev) => ({ ...prev, [field]: value }))
      setSubmitError(null)
    },
    []
  )

  const handleCategoryChange = React.useCallback((value: string) => {
    setFormState((prev) => ({
      ...prev,
      category: value as DocumentationLinkCategory,
    }))
    setSubmitError(null)
  }, [])

  const handleSubmit = React.useCallback(async () => {
    if (!canSubmit || !user) return

    const trimmedTitle = formState.title.trim()
    const trimmedUrl = formState.url.trim()
    const trimmedDescription = formState.description.trim()

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

    if (
      trimmedDescription.length > 0 &&
      trimmedDescription.length > MAX_DESCRIPTION_LENGTH
    ) {
      setSubmitError(
        `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`
      )
      return
    }

    if (!isValidUrl(trimmedUrl)) {
      setSubmitError("Please enter a valid HTTP or HTTPS URL.")
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      if (isEditMode && existingLink) {
        const result = await updateLink({
          link_id: existingLink.id,
          title: trimmedTitle,
          url: trimmedUrl,
          category: formState.category,
          service_id: serviceId,
          domain_id: domainId,
          description: trimmedDescription || undefined,
        })

        if (result.success) {
          toast.success({
            title: "Link Updated",
            description: `"${trimmedTitle}" has been updated.`,
          })
          onSuccess?.()
          setIsOpen(false)
        } else {
          const errorMsg = result.error || "Failed to update link."
          setSubmitError(errorMsg)
          toast.error({
            title: "Update Failed",
            description: errorMsg,
          })
        }
      } else {
        const result = await createLink({
          title: trimmedTitle,
          url: trimmedUrl,
          category: formState.category,
          service_id: serviceId,
          domain_id: domainId,
          description: trimmedDescription || undefined,
        })

        if (result.success) {
          toast.success({
            title: "Link Added",
            description: `"${trimmedTitle}" has been added.`,
          })
          onSuccess?.()
          setIsOpen(false)
        } else {
          const errorMsg = result.error || "Failed to add link."
          setSubmitError(errorMsg)
          toast.error({
            title: "Creation Failed",
            description: errorMsg,
          })
        }
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred."
      setSubmitError(errorMsg)
      toast.error({
        title: "Error",
        description: errorMsg,
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    canSubmit,
    user,
    formState,
    isEditMode,
    existingLink,
    serviceId,
    domainId,
    createLink,
    updateLink,
    onSuccess,
  ])

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
      {isEditMode ? "Edit Link" : "Add Link"}
    </Button>
  )

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent
        className="sm:max-w-[520px]"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="doc-link-title" className="text-sm">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="doc-link-title"
              placeholder="e.g., Checkout API Runbook"
              value={formState.title}
              onChange={(e) => handleFieldChange("title", e.target.value)}
              className="h-9 text-sm"
              disabled={isSubmitting}
              maxLength={MAX_TITLE_LENGTH}
            />
            <p className="text-2xs text-muted-foreground">
              A descriptive title for the documentation resource.
            </p>
          </div>

          {/* URL */}
          <div className="space-y-1.5">
            <Label htmlFor="doc-link-url" className="text-sm">
              URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="doc-link-url"
              placeholder="https://confluence.example.com/..."
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

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="doc-link-category" className="text-sm">
              Category
            </Label>
            <Select
              value={formState.category}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger
                id="doc-link-category"
                className="h-9 text-sm"
              >
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENTATION_LINK_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={CATEGORY_BADGE_VARIANTS[cat.value]}
                        className="text-2xs h-4 px-1.5"
                      >
                        {cat.label}
                      </Badge>
                      <span className="text-2xs text-muted-foreground hidden sm:inline">
                        {cat.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="doc-link-description" className="text-sm">
                Description
              </Label>
              <span className="text-2xs text-muted-foreground">
                {formState.description.length}/{MAX_DESCRIPTION_LENGTH}
              </span>
            </div>
            <Textarea
              id="doc-link-description"
              placeholder="Brief description of this documentation resource..."
              value={formState.description}
              onChange={(e) =>
                handleFieldChange("description", e.target.value)
              }
              className="min-h-[80px] text-sm resize-y"
              disabled={isSubmitting}
            />
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
                      {isEditMode ? "Updating…" : "Adding…"}
                    </>
                  ) : (
                    <>
                      {isEditMode ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      {isEditMode ? "Update" : "Add Link"}
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                <p className="text-xs">
                  {isSubmitting
                    ? "Submitting…"
                    : isEditMode
                      ? "Update link (Ctrl+Enter)"
                      : "Add link (Ctrl+Enter)"}
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
// DocumentationLinkSummaryBadges Component
// ============================================================

interface DocumentationLinkSummaryBadgesProps {
  summary: ReturnType<typeof computeLinkSummary>
}

/**
 * Compact summary badges for the documentation links footer.
 */
function DocumentationLinkSummaryBadges({
  summary,
}: DocumentationLinkSummaryBadgesProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-2xs text-muted-foreground">
        {summary.total} link{summary.total !== 1 ? "s" : ""}
      </span>
      {Array.from(summary.byCategory.entries()).map(([category, count]) => (
        <Badge
          key={category}
          variant={CATEGORY_BADGE_VARIANTS[category]}
          className="text-2xs"
        >
          {count} {CATEGORY_LABELS[category].toLowerCase()}
        </Badge>
      ))}
    </div>
  )
}

// ============================================================
// DocumentationLinksCompact Component
// ============================================================

export interface DocumentationLinksCompactProps {
  /** Documentation links to display */
  links: DocumentationLink[]
  /** Maximum number of links to show inline (default: 3) */
  maxInline?: number
  /** Additional CSS class names */
  className?: string
}

/**
 * Compact inline display of documentation links for use in table cells
 * or summary cards. Shows link icons with tooltips.
 */
export function DocumentationLinksCompact({
  links,
  maxInline = 3,
  className,
}: DocumentationLinksCompactProps) {
  if (links.length === 0) {
    return (
      <span className="text-2xs text-muted-foreground">—</span>
    )
  }

  const displayedLinks = links.slice(0, maxInline)
  const remainingCount = links.length - maxInline

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <BookOpen className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-2xs text-muted-foreground">
        {links.length}
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
                  [{CATEGORY_LABELS[link.category]}]{" "}
                  {extractHostname(link.url)}
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

export interface DocumentationLinksWithBoundaryProps
  extends DocumentationLinksProps {}

/**
 * DocumentationLinks wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function DocumentationLinksWithBoundary(
  props: DocumentationLinksWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Documentation Links">
      <DocumentationLinks {...props} />
    </ModuleErrorBoundary>
  )
}

export default DocumentationLinks