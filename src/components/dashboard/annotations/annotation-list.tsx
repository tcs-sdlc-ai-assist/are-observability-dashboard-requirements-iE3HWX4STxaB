"use client"

import * as React from "react"
import {
  AlertTriangle,
  Check,
  Clock,
  Edit2,
  FileText,
  Loader2,
  MessageSquare,
  Trash2,
  User,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { formatRelativeTime, formatDateTime } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { useAnnotationsForEntity, useAnnotationMutations } from "@/hooks/use-admin-data"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { RoleGuard } from "@/components/shared/role-guard"
import { AnnotationDialog } from "@/components/dashboard/annotations/annotation-dialog"
import { InlineLoadingSkeleton } from "@/components/shared/loading-skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/components/ui/toast"
import type { Annotation, EntityType } from "@/types"

// ============================================================
// Types
// ============================================================

export interface AnnotationListProps {
  /** The entity type to display annotations for */
  entityType: EntityType
  /** The entity ID to display annotations for */
  entityId: string
  /** Optional entity display name for the header */
  entityName?: string
  /** Whether to show the card header (default: true) */
  showHeader?: boolean
  /** Whether to show the "Add Annotation" button (default: true) */
  showAddButton?: boolean
  /** Whether to allow inline editing (default: true) */
  allowInlineEdit?: boolean
  /** Whether to allow deletion (default: true) */
  allowDelete?: boolean
  /** Maximum number of annotations to display before scrolling (default: 10) */
  maxVisible?: number
  /** Maximum height of the scroll area in pixels (default: 400) */
  maxHeight?: number
  /** Whether to show the empty state illustration (default: true) */
  showEmptyState?: boolean
  /** Callback invoked when an annotation is created or updated */
  onAnnotationChange?: () => void
  /** Additional CSS class names */
  className?: string
}

interface EditState {
  annotationId: string
  text: string
  isSubmitting: boolean
  error: string | null
}

// ============================================================
// Constants
// ============================================================

const MAX_ANNOTATION_LENGTH = 5000

const ANNOTATION_CATEGORY_PREFIXES: Array<{
  prefix: string
  label: string
  badgeVariant: "destructive" | "warning" | "info" | "success" | "secondary"
}> = [
  { prefix: "[RISK NOTE]", label: "Risk Note", badgeVariant: "destructive" },
  { prefix: "[MANUAL OVERRIDE]", label: "Manual Override", badgeVariant: "warning" },
  { prefix: "[OBSERVATION]", label: "Observation", badgeVariant: "info" },
  { prefix: "[CORRECTIVE ACTION]", label: "Corrective Action", badgeVariant: "success" },
]

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  incident: "Incident",
  metric: "Metric",
  service: "Service",
  deployment: "Deployment",
}

// ============================================================
// Helpers
// ============================================================

/**
 * Detects the annotation category from the annotation text prefix.
 */
function detectCategory(
  text: string
): { label: string; badgeVariant: "destructive" | "warning" | "info" | "success" | "secondary" } | null {
  for (const cat of ANNOTATION_CATEGORY_PREFIXES) {
    if (text.startsWith(cat.prefix)) {
      return { label: cat.label, badgeVariant: cat.badgeVariant }
    }
  }
  return null
}

/**
 * Strips the category prefix from annotation text for display.
 */
function stripPrefix(text: string): string {
  for (const cat of ANNOTATION_CATEGORY_PREFIXES) {
    if (text.startsWith(cat.prefix)) {
      return text.substring(cat.prefix.length).trim()
    }
  }
  return text
}

/**
 * Checks if the annotation is a manual override by inspecting the prefix.
 */
function isManualOverride(text: string): boolean {
  return text.startsWith("[MANUAL OVERRIDE]")
}

/**
 * Parses manual override fields from annotation text.
 */
function parseOverrideDetails(
  text: string
): { field: string; originalValue: string; overrideValue: string; reason: string } | null {
  if (!isManualOverride(text)) return null

  const fieldMatch = text.match(/Field:\s*(.+?)(?:\n|$)/)
  const originalMatch = text.match(/Original Value:\s*(.+?)(?:\n|$)/)
  const overrideMatch = text.match(/Override Value:\s*(.+?)(?:\n|$)/)
  const reasonMatch = text.match(/Reason:\s*([\s\S]*)$/)

  if (!fieldMatch) return null

  return {
    field: fieldMatch[1]?.trim() || "",
    originalValue: originalMatch?.[1]?.trim() || "",
    overrideValue: overrideMatch?.[1]?.trim() || "",
    reason: reasonMatch?.[1]?.trim() || "",
  }
}

// ============================================================
// AnnotationList Component
// ============================================================

/**
 * Annotation list component displaying existing annotations on a
 * service, metric, incident, or deployment entity. Shows author,
 * timestamp, category badge, and annotation content. Supports
 * inline editing for ARE Leads and authorized users, with delete
 * confirmation dialog and audit trail logging.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <AnnotationList
 *   entityType="incident"
 *   entityId="inc-123"
 *   entityName="Checkout API Outage"
 * />
 *
 * // Compact mode without header
 * <AnnotationList
 *   entityType="service"
 *   entityId="svc-456"
 *   showHeader={false}
 *   maxVisible={5}
 *   maxHeight={300}
 * />
 *
 * // Read-only mode
 * <AnnotationList
 *   entityType="metric"
 *   entityId="metric-789"
 *   allowInlineEdit={false}
 *   allowDelete={false}
 * />
 * ```
 */
export function AnnotationList({
  entityType,
  entityId,
  entityName,
  showHeader = true,
  showAddButton = true,
  allowInlineEdit = true,
  allowDelete = true,
  maxVisible = 10,
  maxHeight = 400,
  showEmptyState = true,
  onAnnotationChange,
  className,
}: AnnotationListProps) {
  const { user } = useAuth()
  const { data: annotations, isLoading, error, mutate } = useAnnotationsForEntity(
    entityType,
    entityId
  )
  const { updateAnnotation, deleteAnnotation } = useAnnotationMutations()

  const [editState, setEditState] = React.useState<EditState | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const editTextareaRef = React.useRef<HTMLTextAreaElement>(null)

  // Focus the textarea when entering edit mode
  React.useEffect(() => {
    if (editState && editTextareaRef.current) {
      editTextareaRef.current.focus()
      editTextareaRef.current.setSelectionRange(
        editTextareaRef.current.value.length,
        editTextareaRef.current.value.length
      )
    }
  }, [editState?.annotationId])

  const annotationCount = annotations?.length || 0

  /**
   * Enters inline edit mode for a specific annotation.
   */
  const handleStartEdit = React.useCallback((annotation: Annotation) => {
    setEditState({
      annotationId: annotation.id,
      text: annotation.annotation,
      isSubmitting: false,
      error: null,
    })
  }, [])

  /**
   * Cancels inline editing and resets the edit state.
   */
  const handleCancelEdit = React.useCallback(() => {
    setEditState(null)
  }, [])

  /**
   * Updates the edit text as the user types.
   */
  const handleEditTextChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditState((prev) => {
        if (!prev) return null
        return { ...prev, text: e.target.value, error: null }
      })
    },
    []
  )

  /**
   * Submits the inline edit update.
   */
  const handleSaveEdit = React.useCallback(async () => {
    if (!editState || !user) return

    const trimmedText = editState.text.trim()
    if (!trimmedText) {
      setEditState((prev) =>
        prev ? { ...prev, error: "Annotation text cannot be empty." } : null
      )
      return
    }

    if (trimmedText.length > MAX_ANNOTATION_LENGTH) {
      setEditState((prev) =>
        prev
          ? {
              ...prev,
              error: `Annotation text cannot exceed ${MAX_ANNOTATION_LENGTH} characters.`,
            }
          : null
      )
      return
    }

    setEditState((prev) => (prev ? { ...prev, isSubmitting: true, error: null } : null))

    try {
      const result = await updateAnnotation({
        annotation_id: editState.annotationId,
        annotation: trimmedText,
      })

      if (result.success) {
        toast.success({
          title: "Annotation Updated",
          description: "Your annotation has been updated successfully.",
        })
        setEditState(null)
        mutate()
        onAnnotationChange?.()
      } else {
        const errorMsg = result.error || "Failed to update annotation."
        setEditState((prev) =>
          prev ? { ...prev, isSubmitting: false, error: errorMsg } : null
        )
        toast.error({
          title: "Update Failed",
          description: errorMsg,
        })
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "An unexpected error occurred."
      setEditState((prev) =>
        prev ? { ...prev, isSubmitting: false, error: errorMsg } : null
      )
      toast.error({
        title: "Error",
        description: errorMsg,
      })
    }
  }, [editState, user, updateAnnotation, mutate, onAnnotationChange])

  /**
   * Handles keyboard shortcuts in the edit textarea.
   */
  const handleEditKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault()
        handleSaveEdit()
      }
      if (e.key === "Escape") {
        e.preventDefault()
        handleCancelEdit()
      }
    },
    [handleSaveEdit, handleCancelEdit]
  )

  /**
   * Deletes an annotation after confirmation.
   */
  const handleDelete = React.useCallback(
    async (annotationId: string) => {
      if (!user) return

      setDeletingId(annotationId)

      try {
        const result = await deleteAnnotation(annotationId)

        if (result.success) {
          toast.success({
            title: "Annotation Deleted",
            description: "The annotation has been removed.",
          })
          mutate()
          onAnnotationChange?.()
        } else {
          const errorMsg = result.error || "Failed to delete annotation."
          toast.error({
            title: "Deletion Failed",
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
    [user, deleteAnnotation, mutate, onAnnotationChange]
  )

  /**
   * Callback when a new annotation is created via the dialog.
   */
  const handleAnnotationCreated = React.useCallback(() => {
    mutate()
    onAnnotationChange?.()
  }, [mutate, onAnnotationChange])

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
              <CardTitle className="text-base font-semibold">Annotations</CardTitle>
              <CardDescription>Failed to load annotations.</CardDescription>
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

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        {showHeader && (
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Skeleton className="h-8 w-24 rounded-md" />
          </CardHeader>
        )}
        <CardContent className={cn(!showHeader && "pt-4")}>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const displayedAnnotations = annotations || []

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      {showHeader && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">Annotations</CardTitle>
              {annotationCount > 0 && (
                <Badge variant="secondary" className="text-2xs h-5 min-w-5 justify-center">
                  {annotationCount}
                </Badge>
              )}
            </div>
            <CardDescription className="mt-0.5">
              {entityName
                ? `Notes on ${ENTITY_TYPE_LABELS[entityType]}: ${entityName}`
                : `Notes on this ${ENTITY_TYPE_LABELS[entityType].toLowerCase()}`}
            </CardDescription>
          </div>

          {/* Add Annotation Button */}
          {showAddButton && (
            <RoleGuard
              allowedRoles={["admin", "are_lead", "sre_engineer", "platform_engineer"]}
              fallback={null}
            >
              <AnnotationDialog
                entityType={entityType}
                entityId={entityId}
                entityName={entityName}
                onSuccess={handleAnnotationCreated}
              />
            </RoleGuard>
          )}
        </CardHeader>
      )}

      <CardContent className={cn(!showHeader && "pt-4")}>
        {/* Empty State */}
        {displayedAnnotations.length === 0 && showEmptyState && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No annotations yet
            </p>
            <p className="text-2xs text-muted-foreground mt-1 text-center max-w-[240px]">
              Annotations help document observations, risks, and corrective actions
              for audit compliance.
            </p>
            {showAddButton && (
              <RoleGuard
                allowedRoles={["admin", "are_lead", "sre_engineer", "platform_engineer"]}
                fallback={null}
              >
                <div className="mt-4">
                  <AnnotationDialog
                    entityType={entityType}
                    entityId={entityId}
                    entityName={entityName}
                    onSuccess={handleAnnotationCreated}
                    trigger={
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Add First Annotation
                      </Button>
                    }
                  />
                </div>
              </RoleGuard>
            )}
          </div>
        )}

        {/* Annotation List */}
        {displayedAnnotations.length > 0 && (
          <ScrollArea
            className="w-full"
            style={{
              maxHeight:
                displayedAnnotations.length > maxVisible ? maxHeight : undefined,
            }}
          >
            <div className="space-y-2">
              {displayedAnnotations.map((annotation, index) => {
                const isEditing = editState?.annotationId === annotation.id
                const isDeleting = deletingId === annotation.id
                const isOwnAnnotation = user?.id === annotation.user_id

                return (
                  <React.Fragment key={annotation.id}>
                    {isEditing ? (
                      <AnnotationEditRow
                        annotation={annotation}
                        editText={editState.text}
                        isSubmitting={editState.isSubmitting}
                        error={editState.error}
                        onTextChange={handleEditTextChange}
                        onSave={handleSaveEdit}
                        onCancel={handleCancelEdit}
                        onKeyDown={handleEditKeyDown}
                        textareaRef={editTextareaRef}
                      />
                    ) : (
                      <AnnotationRow
                        annotation={annotation}
                        isOwnAnnotation={isOwnAnnotation}
                        isDeleting={isDeleting}
                        allowInlineEdit={allowInlineEdit}
                        allowDelete={allowDelete}
                        onEdit={() => handleStartEdit(annotation)}
                        onDelete={() => handleDelete(annotation.id)}
                      />
                    )}
                    {index < displayedAnnotations.length - 1 && (
                      <Separator className="my-0" />
                    )}
                  </React.Fragment>
                )
              })}
            </div>
          </ScrollArea>
        )}

        {/* Footer with add button when not in header */}
        {!showHeader && showAddButton && displayedAnnotations.length > 0 && (
          <RoleGuard
            allowedRoles={["admin", "are_lead", "sre_engineer", "platform_engineer"]}
            fallback={null}
          >
            <div className="mt-3 pt-3 border-t">
              <AnnotationDialog
                entityType={entityType}
                entityId={entityId}
                entityName={entityName}
                onSuccess={handleAnnotationCreated}
              />
            </div>
          </RoleGuard>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// AnnotationRow Component
// ============================================================

interface AnnotationRowProps {
  annotation: Annotation
  isOwnAnnotation: boolean
  isDeleting: boolean
  allowInlineEdit: boolean
  allowDelete: boolean
  onEdit: () => void
  onDelete: () => void
}

/**
 * Individual annotation row displaying author, timestamp, category badge,
 * and annotation content with edit/delete actions.
 */
function AnnotationRow({
  annotation,
  isOwnAnnotation,
  isDeleting,
  allowInlineEdit,
  allowDelete,
  onEdit,
  onDelete,
}: AnnotationRowProps) {
  const category = detectCategory(annotation.annotation)
  const displayText = stripPrefix(annotation.annotation)
  const overrideDetails = parseOverrideDetails(annotation.annotation)
  const isOverride = isManualOverride(annotation.annotation)

  return (
    <div
      className={cn(
        "group rounded-md border px-3 py-2.5 transition-colors hover:bg-accent/30",
        isOverride && "border-yellow-500/20 bg-yellow-500/5",
        isDeleting && "opacity-50 pointer-events-none"
      )}
    >
      {/* Header: Author, Category, Timestamp, Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Author Avatar */}
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-2xs font-medium shrink-0">
            {annotation.user_name
              ? annotation.user_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              : <User className="h-3 w-3" />}
          </div>

          {/* Author Name */}
          <span className="text-2xs font-medium text-foreground truncate max-w-[120px]">
            {annotation.user_name || annotation.user_id}
          </span>

          {/* Category Badge */}
          {category && (
            <Badge variant={category.badgeVariant} className="text-2xs h-3.5 px-1 shrink-0">
              {category.label}
            </Badge>
          )}

          {/* Timestamp */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-2xs text-muted-foreground shrink-0 flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {formatRelativeTime(annotation.timestamp)}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                <div className="space-y-0.5">
                  <p className="text-xs">
                    Created: {formatDateTime(annotation.timestamp)}
                  </p>
                  {annotation.updated_at &&
                    annotation.updated_at !== annotation.timestamp && (
                      <p className="text-2xs text-muted-foreground">
                        Updated: {formatDateTime(annotation.updated_at)}
                      </p>
                    )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Edited indicator */}
          {annotation.updated_at &&
            annotation.updated_at !== annotation.timestamp && (
              <span className="text-2xs text-muted-foreground italic shrink-0">
                (edited)
              </span>
            )}
        </div>

        {/* Action Buttons */}
        <RoleGuard
          allowedRoles={["admin", "are_lead", "sre_engineer", "platform_engineer"]}
          fallback={null}
        >
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {/* Edit Button */}
            {allowInlineEdit && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={onEdit}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    <p className="text-xs">Edit annotation</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Delete Button */}
            {allowDelete && (
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
                      <p className="text-xs">Delete annotation</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Annotation</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this annotation? This action
                      will be recorded in the audit log and cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </RoleGuard>
      </div>

      {/* Manual Override Details */}
      {overrideDetails && (
        <div className="mt-2 space-y-1 rounded-md border border-yellow-500/20 bg-yellow-500/5 px-2.5 py-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-yellow-600 dark:text-yellow-400 shrink-0" />
            <span className="text-2xs font-semibold text-yellow-700 dark:text-yellow-400">
              Manual Override
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-2xs">
            <div>
              <span className="text-muted-foreground">Field:</span>{" "}
              <span className="font-medium">{overrideDetails.field}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Original:</span>{" "}
              <span className="font-medium">{overrideDetails.originalValue || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Override:</span>{" "}
              <span className="font-medium">{overrideDetails.overrideValue}</span>
            </div>
          </div>
          {overrideDetails.reason && (
            <p className="text-2xs text-muted-foreground leading-relaxed mt-1">
              <span className="font-medium">Reason:</span> {overrideDetails.reason}
            </p>
          )}
        </div>
      )}

      {/* Annotation Content */}
      {!overrideDetails && (
        <p className="mt-1.5 text-2xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
          {displayText}
        </p>
      )}
    </div>
  )
}

// ============================================================
// AnnotationEditRow Component
// ============================================================

interface AnnotationEditRowProps {
  annotation: Annotation
  editText: string
  isSubmitting: boolean
  error: string | null
  onTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSave: () => void
  onCancel: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  textareaRef: React.RefObject<HTMLTextAreaElement>
}

/**
 * Inline edit row for modifying an annotation's text.
 */
function AnnotationEditRow({
  annotation,
  editText,
  isSubmitting,
  error,
  onTextChange,
  onSave,
  onCancel,
  onKeyDown,
  textareaRef,
}: AnnotationEditRowProps) {
  const characterCount = editText.length
  const isOverLimit = characterCount > MAX_ANNOTATION_LENGTH
  const isEmpty = editText.trim().length === 0

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-2xs font-medium shrink-0">
          {annotation.user_name
            ? annotation.user_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)
            : <User className="h-3 w-3" />}
        </div>
        <span className="text-2xs font-medium text-foreground">
          Editing annotation
        </span>
      </div>

      {/* Textarea */}
      <div className="space-y-1">
        <Textarea
          ref={textareaRef}
          value={editText}
          onChange={onTextChange}
          onKeyDown={onKeyDown}
          className={cn(
            "min-h-[80px] text-sm resize-y",
            isOverLimit && "border-destructive focus-visible:ring-destructive"
          )}
          disabled={isSubmitting}
          placeholder="Enter annotation text..."
        />
        <div className="flex items-center justify-between">
          <p className="text-2xs text-muted-foreground">
            Ctrl+Enter to save · Escape to cancel
          </p>
          <span
            className={cn(
              "text-2xs",
              isOverLimit
                ? "text-destructive font-medium"
                : "text-muted-foreground"
            )}
          >
            {characterCount}/{MAX_ANNOTATION_LENGTH}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          <X className="h-3 w-3 mr-1" />
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onSave}
          disabled={isSubmitting || isEmpty || isOverLimit}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Check className="h-3 w-3" />
              Save
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// Wrapped Export with Error Boundary
// ============================================================

export interface AnnotationListWithBoundaryProps
  extends AnnotationListProps {}

/**
 * AnnotationList wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function AnnotationListWithBoundary(
  props: AnnotationListWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Annotation List">
      <AnnotationList {...props} />
    </ModuleErrorBoundary>
  )
}

export default AnnotationList