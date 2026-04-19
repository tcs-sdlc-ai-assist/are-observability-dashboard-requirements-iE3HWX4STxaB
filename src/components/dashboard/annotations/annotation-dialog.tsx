"use client"

import * as React from "react"
import {
  AlertTriangle,
  FileText,
  Loader2,
  MessageSquare,
  Save,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { useAnnotationMutations } from "@/hooks/use-admin-data"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { RoleGuard } from "@/components/shared/role-guard"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "@/components/ui/toast"
import type { Annotation, EntityType } from "@/types"

// ============================================================
// Types
// ============================================================

export type AnnotationCategory =
  | "risk_note"
  | "manual_override"
  | "observation"
  | "corrective_action"
  | "general"

export interface AnnotationDialogProps {
  /** The entity type to annotate */
  entityType: EntityType
  /** The entity ID to annotate */
  entityId: string
  /** Optional entity display name for the dialog header */
  entityName?: string
  /** Whether the dialog is open (controlled mode) */
  open?: boolean
  /** Callback when the dialog open state changes */
  onOpenChange?: (open: boolean) => void
  /** Existing annotation to edit (null for create mode) */
  annotation?: Annotation | null
  /** Callback invoked after a successful create or update */
  onSuccess?: (annotation: Annotation) => void
  /** Callback invoked on error */
  onError?: (error: string) => void
  /** Optional trigger element. If not provided, a default button is rendered. */
  trigger?: React.ReactNode
  /** Whether to show the manual override fields */
  showManualOverride?: boolean
  /** Additional CSS class names */
  className?: string
}

interface ManualOverrideFields {
  field: string
  originalValue: string
  overrideValue: string
}

// ============================================================
// Constants
// ============================================================

const ANNOTATION_CATEGORIES: Array<{
  value: AnnotationCategory
  label: string
  description: string
}> = [
  {
    value: "risk_note",
    label: "Risk Note",
    description: "Flag a risk or concern related to this entity",
  },
  {
    value: "manual_override",
    label: "Manual Override",
    description: "Override a computed value with a documented reason",
  },
  {
    value: "observation",
    label: "Observation",
    description: "Record an observation or finding",
  },
  {
    value: "corrective_action",
    label: "Corrective Action",
    description: "Document a corrective action taken or planned",
  },
  {
    value: "general",
    label: "General Note",
    description: "Add a general annotation or comment",
  },
]

const CATEGORY_BADGE_VARIANTS: Record<
  AnnotationCategory,
  "destructive" | "warning" | "info" | "success" | "secondary"
> = {
  risk_note: "destructive",
  manual_override: "warning",
  observation: "info",
  corrective_action: "success",
  general: "secondary",
}

const CATEGORY_LABELS: Record<AnnotationCategory, string> = {
  risk_note: "Risk Note",
  manual_override: "Manual Override",
  observation: "Observation",
  corrective_action: "Corrective Action",
  general: "General Note",
}

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  incident: "Incident",
  metric: "Metric",
  service: "Service",
  deployment: "Deployment",
}

const MAX_ANNOTATION_LENGTH = 5000

// ============================================================
// Helpers
// ============================================================

/**
 * Detects the annotation category from existing annotation text.
 */
function detectCategoryFromText(text: string): AnnotationCategory {
  if (text.startsWith("[MANUAL OVERRIDE]")) return "manual_override"
  if (text.startsWith("[RISK NOTE]")) return "risk_note"
  if (text.startsWith("[OBSERVATION]")) return "observation"
  if (text.startsWith("[CORRECTIVE ACTION]")) return "corrective_action"
  return "general"
}

/**
 * Strips the category prefix from annotation text for editing.
 */
function stripCategoryPrefix(text: string): string {
  const prefixes = [
    "[MANUAL OVERRIDE]",
    "[RISK NOTE]",
    "[OBSERVATION]",
    "[CORRECTIVE ACTION]",
    "[GENERAL NOTE]",
  ]

  for (const prefix of prefixes) {
    if (text.startsWith(prefix)) {
      return text.substring(prefix.length).trim()
    }
  }

  return text
}

/**
 * Builds the full annotation text with category prefix.
 */
function buildAnnotationText(
  category: AnnotationCategory,
  text: string,
  overrideFields?: ManualOverrideFields
): string {
  const trimmedText = text.trim()

  if (category === "manual_override" && overrideFields) {
    const lines = [
      `[MANUAL OVERRIDE] Field: ${overrideFields.field}`,
      `Original Value: ${overrideFields.originalValue}`,
      `Override Value: ${overrideFields.overrideValue}`,
      `Reason: ${trimmedText}`,
    ]
    return lines.join("\n")
  }

  const prefixMap: Record<AnnotationCategory, string> = {
    risk_note: "[RISK NOTE]",
    manual_override: "[MANUAL OVERRIDE]",
    observation: "[OBSERVATION]",
    corrective_action: "[CORRECTIVE ACTION]",
    general: "",
  }

  const prefix = prefixMap[category]
  return prefix ? `${prefix} ${trimmedText}` : trimmedText
}

/**
 * Parses manual override fields from existing annotation text.
 */
function parseManualOverrideFields(
  text: string
): ManualOverrideFields | null {
  if (!text.startsWith("[MANUAL OVERRIDE]")) return null

  const fieldMatch = text.match(/Field:\s*(.+?)(?:\n|$)/)
  const originalMatch = text.match(/Original Value:\s*(.+?)(?:\n|$)/)
  const overrideMatch = text.match(/Override Value:\s*(.+?)(?:\n|$)/)

  if (!fieldMatch) return null

  return {
    field: fieldMatch[1]?.trim() || "",
    originalValue: originalMatch?.[1]?.trim() || "",
    overrideValue: overrideMatch?.[1]?.trim() || "",
  }
}

/**
 * Extracts the reason text from a manual override annotation.
 */
function extractOverrideReason(text: string): string {
  const reasonMatch = text.match(/Reason:\s*([\s\S]*)$/)
  return reasonMatch?.[1]?.trim() || ""
}

// ============================================================
// AnnotationDialog Component
// ============================================================

/**
 * Annotation creation/edit dialog for ARE Leads and authorized users.
 * Supports adding risk notes, manual overrides, observations, corrective
 * actions, and general annotations on incidents, metrics, services, and
 * deployments. All actions are audit-logged for compliance.
 *
 * Includes a text area, category selector, optional manual override fields,
 * character count, and submit with loading state.
 *
 * @example
 * ```tsx
 * // Create mode with default trigger button
 * <AnnotationDialog
 *   entityType="incident"
 *   entityId="inc-123"
 *   entityName="Checkout API Outage"
 *   onSuccess={(annotation) => console.log("Created:", annotation)}
 * />
 *
 * // Edit mode with existing annotation
 * <AnnotationDialog
 *   entityType="service"
 *   entityId="svc-456"
 *   annotation={existingAnnotation}
 *   onSuccess={(annotation) => console.log("Updated:", annotation)}
 * />
 *
 * // Controlled mode with custom trigger
 * <AnnotationDialog
 *   entityType="metric"
 *   entityId="metric-789"
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   trigger={<Button size="sm">Add Note</Button>}
 *   showManualOverride
 * />
 * ```
 */
export function AnnotationDialog({
  entityType,
  entityId,
  entityName,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  annotation,
  onSuccess,
  onError,
  trigger,
  showManualOverride = false,
  className,
}: AnnotationDialogProps) {
  const { user } = useAuth()
  const { createAnnotation, updateAnnotation } = useAnnotationMutations()

  const isEditMode = !!annotation
  const dialogTitle = isEditMode ? "Edit Annotation" : "Add Annotation"
  const dialogDescription = isEditMode
    ? `Update annotation on ${ENTITY_TYPE_LABELS[entityType]}${entityName ? `: ${entityName}` : ""}`
    : `Add a new annotation to ${ENTITY_TYPE_LABELS[entityType]}${entityName ? `: ${entityName}` : ""}`

  // Internal open state for uncontrolled mode
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setIsOpen = controlledOnOpenChange || setInternalOpen

  // Form state
  const [category, setCategory] = React.useState<AnnotationCategory>("general")
  const [annotationText, setAnnotationText] = React.useState("")
  const [overrideFields, setOverrideFields] =
    React.useState<ManualOverrideFields>({
      field: "",
      originalValue: "",
      overrideValue: "",
    })
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  // Initialize form state when dialog opens or annotation changes
  React.useEffect(() => {
    if (isOpen) {
      setSubmitError(null)

      if (annotation) {
        const detectedCategory = detectCategoryFromText(annotation.annotation)
        setCategory(detectedCategory)

        if (detectedCategory === "manual_override") {
          const parsed = parseManualOverrideFields(annotation.annotation)
          if (parsed) {
            setOverrideFields(parsed)
            setAnnotationText(extractOverrideReason(annotation.annotation))
          } else {
            setAnnotationText(stripCategoryPrefix(annotation.annotation))
          }
        } else {
          setAnnotationText(stripCategoryPrefix(annotation.annotation))
        }
      } else {
        setCategory("general")
        setAnnotationText("")
        setOverrideFields({ field: "", originalValue: "", overrideValue: "" })
      }
    }
  }, [isOpen, annotation])

  const characterCount = annotationText.length
  const isOverLimit = characterCount > MAX_ANNOTATION_LENGTH

  const isManualOverrideCategory = category === "manual_override"
  const showOverrideFields =
    (showManualOverride || isManualOverrideCategory) &&
    isManualOverrideCategory

  /**
   * Validates the form before submission.
   */
  const validateForm = React.useCallback((): string | null => {
    if (!annotationText.trim()) {
      return "Annotation text is required."
    }

    if (isOverLimit) {
      return `Annotation text cannot exceed ${MAX_ANNOTATION_LENGTH} characters.`
    }

    if (showOverrideFields) {
      if (!overrideFields.field.trim()) {
        return "Field name is required for manual overrides."
      }
      if (!overrideFields.overrideValue.trim()) {
        return "Override value is required for manual overrides."
      }
    }

    return null
  }, [annotationText, isOverLimit, showOverrideFields, overrideFields])

  /**
   * Handles form submission for create or update.
   */
  const handleSubmit = React.useCallback(async () => {
    const validationError = validateForm()
    if (validationError) {
      setSubmitError(validationError)
      return
    }

    if (!user) {
      setSubmitError("You must be signed in to add annotations.")
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    const fullText = buildAnnotationText(
      category,
      annotationText,
      showOverrideFields ? overrideFields : undefined
    )

    try {
      if (isEditMode && annotation) {
        // Update existing annotation
        const result = await updateAnnotation({
          annotation_id: annotation.id,
          annotation: fullText,
        })

        if (result.success && result.data) {
          toast.success({
            title: "Annotation Updated",
            description: "Your annotation has been updated successfully.",
          })
          onSuccess?.(result.data)
          setIsOpen(false)
        } else {
          const errorMsg = result.error || "Failed to update annotation."
          setSubmitError(errorMsg)
          onError?.(errorMsg)
          toast.error({
            title: "Update Failed",
            description: errorMsg,
          })
        }
      } else {
        // Create new annotation
        const result = await createAnnotation({
          entity_type: entityType,
          entity_id: entityId,
          annotation: fullText,
        })

        if (result.success && result.data) {
          toast.success({
            title: "Annotation Added",
            description: `${CATEGORY_LABELS[category]} has been added successfully.`,
          })
          onSuccess?.(result.data)
          setIsOpen(false)
        } else {
          const errorMsg = result.error || "Failed to create annotation."
          setSubmitError(errorMsg)
          onError?.(errorMsg)
          toast.error({
            title: "Creation Failed",
            description: errorMsg,
          })
        }
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred."
      setSubmitError(errorMsg)
      onError?.(errorMsg)
      toast.error({
        title: "Error",
        description: errorMsg,
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    validateForm,
    user,
    category,
    annotationText,
    showOverrideFields,
    overrideFields,
    isEditMode,
    annotation,
    entityType,
    entityId,
    createAnnotation,
    updateAnnotation,
    onSuccess,
    onError,
    setIsOpen,
  ])

  const handleCategoryChange = React.useCallback((value: string) => {
    setCategory(value as AnnotationCategory)
    setSubmitError(null)
  }, [])

  const handleAnnotationTextChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setAnnotationText(e.target.value)
      setSubmitError(null)
    },
    []
  )

  const handleOverrideFieldChange = React.useCallback(
    (field: keyof ManualOverrideFields, value: string) => {
      setOverrideFields((prev) => ({ ...prev, [field]: value }))
      setSubmitError(null)
    },
    []
  )

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      // Submit on Ctrl+Enter or Cmd+Enter
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  const defaultTrigger = (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 text-xs"
    >
      <MessageSquare className="h-3.5 w-3.5" />
      {isEditMode ? "Edit Note" : "Add Note"}
    </Button>
  )

  return (
    <RoleGuard
      allowedRoles={["admin", "are_lead", "sre_engineer", "platform_engineer"]}
      fallback={null}
    >
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          {trigger || defaultTrigger}
        </DialogTrigger>
        <DialogContent
          className={cn("sm:max-w-[560px]", className)}
          onKeyDown={handleKeyDown}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {dialogTitle}
            </DialogTitle>
            <DialogDescription>
              {dialogDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Entity Info */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-2xs">
                {ENTITY_TYPE_LABELS[entityType]}
              </Badge>
              <span className="text-2xs text-muted-foreground font-mono truncate max-w-[200px]">
                {entityId}
              </span>
              {entityName && (
                <>
                  <span className="text-2xs text-muted-foreground">·</span>
                  <span className="text-2xs text-muted-foreground truncate max-w-[200px]">
                    {entityName}
                  </span>
                </>
              )}
            </div>

            {/* Category Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="annotation-category" className="text-sm">
                Category
              </Label>
              <Select
                value={category}
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger id="annotation-category" className="h-9 text-sm">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {ANNOTATION_CATEGORIES.map((cat) => (
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

            {/* Manual Override Fields */}
            {showOverrideFields && (
              <div className="space-y-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-2xs font-semibold text-yellow-700 dark:text-yellow-400">
                    Manual Override Details
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label htmlFor="override-field" className="text-2xs">
                      Field Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="override-field"
                      placeholder="e.g., availability_pct, latency_p95"
                      value={overrideFields.field}
                      onChange={(e) =>
                        handleOverrideFieldChange("field", e.target.value)
                      }
                      className="h-8 text-sm"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label
                        htmlFor="override-original"
                        className="text-2xs"
                      >
                        Original Value
                      </Label>
                      <Input
                        id="override-original"
                        placeholder="e.g., 99.5"
                        value={overrideFields.originalValue}
                        onChange={(e) =>
                          handleOverrideFieldChange(
                            "originalValue",
                            e.target.value
                          )
                        }
                        className="h-8 text-sm"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="override-value"
                        className="text-2xs"
                      >
                        Override Value{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="override-value"
                        placeholder="e.g., 99.9"
                        value={overrideFields.overrideValue}
                        onChange={(e) =>
                          handleOverrideFieldChange(
                            "overrideValue",
                            e.target.value
                          )
                        }
                        className="h-8 text-sm"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Annotation Text */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="annotation-text" className="text-sm">
                  {showOverrideFields ? "Reason" : "Annotation"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
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
              <Textarea
                id="annotation-text"
                placeholder={
                  showOverrideFields
                    ? "Provide a reason for this manual override..."
                    : category === "risk_note"
                      ? "Describe the risk or concern..."
                      : category === "corrective_action"
                        ? "Document the corrective action taken or planned..."
                        : category === "observation"
                          ? "Record your observation or finding..."
                          : "Enter your annotation..."
                }
                value={annotationText}
                onChange={handleAnnotationTextChange}
                className={cn(
                  "min-h-[120px] text-sm resize-y",
                  isOverLimit && "border-destructive focus-visible:ring-destructive"
                )}
                disabled={isSubmitting}
              />
              <p className="text-2xs text-muted-foreground">
                {isEditMode
                  ? "Update the annotation text. The change will be recorded in the audit log."
                  : "This annotation will be visible to all dashboard users and recorded in the audit trail."}
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
                {isManualOverrideCategory &&
                  " Manual overrides require documented justification."}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={isSubmitting}
              >
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
                    disabled={
                      isSubmitting ||
                      !annotationText.trim() ||
                      isOverLimit
                    }
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {isEditMode ? "Updating…" : "Saving…"}
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        {isEditMode ? "Update" : "Save"}
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  <p className="text-xs">
                    {isSubmitting
                      ? "Submitting…"
                      : "Save annotation (Ctrl+Enter)"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  )
}

// ============================================================
// Wrapped Export with Error Boundary
// ============================================================

export interface AnnotationDialogWithBoundaryProps
  extends AnnotationDialogProps {}

/**
 * AnnotationDialog wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function AnnotationDialogWithBoundary(
  props: AnnotationDialogWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Annotation Dialog">
      <AnnotationDialog {...props} />
    </ModuleErrorBoundary>
  )
}

export default AnnotationDialog