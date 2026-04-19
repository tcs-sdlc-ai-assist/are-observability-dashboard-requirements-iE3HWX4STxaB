"use client"

import * as React from "react"
import {
  AlertTriangle,
  Check,
  CheckCircle,
  Clock,
  Download,
  File,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { formatRelativeTime, formatDateTime, formatCompactNumber } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { useUploadHistory, useUploadData } from "@/hooks/use-admin-data"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { RoleGuard } from "@/components/shared/role-guard"
import { InlineLoadingSkeleton } from "@/components/shared/loading-skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "@/components/ui/toast"
import {
  UPLOAD,
  DATA_TYPES,
} from "@/constants/constants"
import type { DataType } from "@/types"

// ============================================================
// Types
// ============================================================

export interface DataUploadFormProps {
  /** Whether to show the upload history section (default: true) */
  showHistory?: boolean
  /** Maximum number of history records to display (default: 10) */
  maxHistoryRecords?: number
  /** Default data type selection */
  defaultDataType?: DataType
  /** Callback invoked after a successful upload */
  onUploadSuccess?: (result: UploadResult) => void
  /** Callback invoked on upload error */
  onUploadError?: (error: string) => void
  /** Additional CSS class names */
  className?: string
}

interface UploadResult {
  status: string
  records_ingested: number
  records_failed: number
  errors: string[]
  file_name: string
  data_type: string
  upload_log_id?: string
}

interface ValidationResult {
  valid: boolean
  total_rows: number
  valid_rows: number
  invalid_rows: number
  errors: string[]
}

type UploadPhase =
  | "idle"
  | "selected"
  | "validating"
  | "validated"
  | "uploading"
  | "success"
  | "error"

// ============================================================
// Constants
// ============================================================

const DATA_TYPE_OPTIONS: Array<{
  value: DataType
  label: string
  description: string
  icon: React.ElementType
}> = [
  {
    value: "incident",
    label: "Incidents",
    description: "Incident records with severity, status, and root cause",
    icon: AlertTriangle,
  },
  {
    value: "metric",
    label: "Metrics",
    description: "Service metrics (latency, errors, traffic, saturation)",
    icon: FileSpreadsheet,
  },
  {
    value: "service_map",
    label: "Service Map",
    description: "Dependency edges between services",
    icon: FileText,
  },
  {
    value: "deployment",
    label: "Deployments",
    description: "Deployment records with version and status",
    icon: FileText,
  },
  {
    value: "error_budget",
    label: "Error Budgets",
    description: "Error budget snapshots per service",
    icon: FileSpreadsheet,
  },
]

const DATA_TYPE_LABELS: Record<DataType, string> = {
  incident: "Incidents",
  metric: "Metrics",
  service_map: "Service Map",
  deployment: "Deployments",
  error_budget: "Error Budgets",
}

const UPLOAD_STATUS_CONFIG: Record<
  string,
  {
    label: string
    icon: React.ElementType
    badgeVariant: "success" | "destructive" | "warning" | "secondary"
    color: string
  }
> = {
  success: {
    label: "Success",
    icon: CheckCircle,
    badgeVariant: "success",
    color: "text-green-600 dark:text-green-400",
  },
  partial: {
    label: "Partial",
    icon: AlertTriangle,
    badgeVariant: "warning",
    color: "text-yellow-600 dark:text-yellow-400",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    badgeVariant: "destructive",
    color: "text-red-600 dark:text-red-400",
  },
  processing: {
    label: "Processing",
    icon: Loader2,
    badgeVariant: "secondary",
    color: "text-muted-foreground",
  },
}

const ACCEPTED_EXTENSIONS = UPLOAD.ACCEPTED_FILE_TYPES.join(", ")
const MAX_FILE_SIZE_MB = Math.round(UPLOAD.MAX_FILE_SIZE_BYTES / (1024 * 1024))

// ============================================================
// Helpers
// ============================================================

/**
 * Formats a file size in bytes to a human-readable string.
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Determines the file type icon based on the file name extension.
 */
function getFileIcon(fileName: string): React.ElementType {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".csv")) return FileText
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return FileSpreadsheet
  if (lower.endsWith(".json")) return FileText
  return File
}

/**
 * Validates that a file has an accepted extension and size.
 */
function validateFileSelection(file: File): string | null {
  const lower = file.name.toLowerCase()
  const hasValidExtension = UPLOAD.ACCEPTED_FILE_TYPES.some((ext) =>
    lower.endsWith(ext)
  )

  if (!hasValidExtension) {
    return `Unsupported file type. Accepted types: ${ACCEPTED_EXTENSIONS}`
  }

  if (file.size > UPLOAD.MAX_FILE_SIZE_BYTES) {
    return `File size (${formatFileSize(file.size)}) exceeds the maximum of ${MAX_FILE_SIZE_MB} MB.`
  }

  if (file.size === 0) {
    return "File is empty. Please select a file with data."
  }

  return null
}

// ============================================================
// DataUploadForm Component
// ============================================================

/**
 * Admin data upload form with drag-and-drop file zone, file type selector
 * (CSV/Excel/JSON), validation feedback, progress indicator, and upload
 * history. Triggers the ingestion service for interim data uploads.
 *
 * Restricted to users with upload:data permission (admin, are_lead,
 * sre_engineer, platform_engineer roles).
 *
 * All uploads are recorded in the audit log for compliance.
 *
 * @example
 * ```tsx
 * <DataUploadForm
 *   showHistory
 *   defaultDataType="metric"
 *   onUploadSuccess={(result) => console.log("Uploaded:", result)}
 * />
 * ```
 */
export function DataUploadForm({
  showHistory = true,
  maxHistoryRecords = 10,
  defaultDataType,
  onUploadSuccess,
  onUploadError,
  className,
}: DataUploadFormProps) {
  const { user } = useAuth()
  const { uploadFile, validateFile } = useUploadData()
  const {
    data: uploadHistory,
    isLoading: isHistoryLoading,
    error: historyError,
    mutate: mutateHistory,
  } = useUploadHistory({ limit: maxHistoryRecords })

  // Form state
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [dataType, setDataType] = React.useState<DataType>(
    defaultDataType || "metric"
  )
  const [phase, setPhase] = React.useState<UploadPhase>("idle")
  const [progress, setProgress] = React.useState(0)
  const [fileError, setFileError] = React.useState<string | null>(null)
  const [validationResult, setValidationResult] =
    React.useState<ValidationResult | null>(null)
  const [uploadResult, setUploadResult] = React.useState<UploadResult | null>(
    null
  )
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const [isDragOver, setIsDragOver] = React.useState(false)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const dropZoneRef = React.useRef<HTMLDivElement>(null)

  /**
   * Resets the form to its initial state.
   */
  const resetForm = React.useCallback(() => {
    setSelectedFile(null)
    setPhase("idle")
    setProgress(0)
    setFileError(null)
    setValidationResult(null)
    setUploadResult(null)
    setUploadError(null)
    setIsDragOver(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  /**
   * Handles file selection from the file input or drag-and-drop.
   */
  const handleFileSelect = React.useCallback(
    (file: File) => {
      resetForm()

      const error = validateFileSelection(file)
      if (error) {
        setFileError(error)
        setPhase("idle")
        return
      }

      setSelectedFile(file)
      setPhase("selected")
      setFileError(null)
    },
    [resetForm]
  )

  /**
   * Handles the file input change event.
   */
  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFileSelect(file)
      }
    },
    [handleFileSelect]
  )

  /**
   * Handles drag over events on the drop zone.
   */
  const handleDragOver = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(true)
    },
    []
  )

  /**
   * Handles drag leave events on the drop zone.
   */
  const handleDragLeave = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
    },
    []
  )

  /**
   * Handles drop events on the drop zone.
   */
  const handleDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const file = e.dataTransfer.files?.[0]
      if (file) {
        handleFileSelect(file)
      }
    },
    [handleFileSelect]
  )

  /**
   * Opens the file input dialog.
   */
  const handleBrowseClick = React.useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  /**
   * Handles data type selection change.
   */
  const handleDataTypeChange = React.useCallback((value: string) => {
    setDataType(value as DataType)
  }, [])

  /**
   * Validates the selected file without uploading.
   */
  const handleValidate = React.useCallback(async () => {
    if (!selectedFile || !user) return

    setPhase("validating")
    setProgress(20)
    setValidationResult(null)
    setUploadError(null)

    try {
      const result = await validateFile({
        file: selectedFile,
        data_type: dataType,
      })

      setProgress(100)

      if (result.success && result.data) {
        setValidationResult(result.data)
        setPhase("validated")

        if (result.data.valid) {
          toast.success({
            title: "Validation Passed",
            description: `${result.data.valid_rows} of ${result.data.total_rows} rows are valid.`,
          })
        } else {
          toast.warning({
            title: "Validation Issues",
            description: `${result.data.invalid_rows} of ${result.data.total_rows} rows have errors.`,
          })
        }
      } else {
        const errorMsg = result.error || "Validation failed."
        setUploadError(errorMsg)
        setPhase("error")
        toast.error({
          title: "Validation Failed",
          description: errorMsg,
        })
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "An unexpected error occurred."
      setUploadError(errorMsg)
      setPhase("error")
      toast.error({
        title: "Validation Error",
        description: errorMsg,
      })
    }
  }, [selectedFile, user, dataType, validateFile])

  /**
   * Uploads the selected file to the ingestion service.
   */
  const handleUpload = React.useCallback(async () => {
    if (!selectedFile || !user) return

    setPhase("uploading")
    setProgress(10)
    setUploadResult(null)
    setUploadError(null)

    // Simulate progress increments
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) {
          clearInterval(progressInterval)
          return prev
        }
        return prev + Math.random() * 15
      })
    }, 500)

    try {
      const result = await uploadFile({
        file: selectedFile,
        data_type: dataType,
      })

      clearInterval(progressInterval)
      setProgress(100)

      if (result.success && result.data) {
        setUploadResult(result.data)
        setPhase("success")
        mutateHistory()
        onUploadSuccess?.(result.data)

        if (result.data.status === "success") {
          toast.success({
            title: "Upload Complete",
            description: `${result.data.records_ingested} records ingested successfully.`,
          })
        } else if (result.data.status === "partial") {
          toast.warning({
            title: "Partial Upload",
            description: `${result.data.records_ingested} ingested, ${result.data.records_failed} failed.`,
          })
        } else {
          toast.error({
            title: "Upload Failed",
            description:
              result.data.errors?.[0] || "No records were ingested.",
          })
        }
      } else {
        const errorMsg = result.error || "Upload failed."
        setUploadError(errorMsg)
        setPhase("error")
        onUploadError?.(errorMsg)
        toast.error({
          title: "Upload Failed",
          description: errorMsg,
        })
      }
    } catch (err) {
      clearInterval(progressInterval)
      const errorMsg =
        err instanceof Error ? err.message : "An unexpected error occurred."
      setUploadError(errorMsg)
      setPhase("error")
      onUploadError?.(errorMsg)
      toast.error({
        title: "Upload Error",
        description: errorMsg,
      })
    }
  }, [
    selectedFile,
    user,
    dataType,
    uploadFile,
    mutateHistory,
    onUploadSuccess,
    onUploadError,
  ])

  /**
   * Removes the selected file and resets the form.
   */
  const handleRemoveFile = React.useCallback(() => {
    resetForm()
  }, [resetForm])

  const isUploading = phase === "uploading"
  const isValidating = phase === "validating"
  const isBusy = isUploading || isValidating
  const canValidate =
    phase === "selected" || phase === "validated" || phase === "error"
  const canUpload =
    phase === "selected" || phase === "validated" || phase === "error"

  const FileIcon = selectedFile ? getFileIcon(selectedFile.name) : File

  return (
    <RoleGuard
      allowedRoles={["admin", "are_lead", "sre_engineer", "platform_engineer"]}
      fallback={
        <Card className={cn("overflow-hidden", className)}>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              Access Denied
            </p>
            <p className="text-2xs text-muted-foreground mt-1">
              You do not have permission to upload data.
            </p>
          </CardContent>
        </Card>
      }
    >
      <div className={cn("space-y-4", className)}>
        {/* Upload Form Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">
                  Data Upload
                </CardTitle>
              </div>
              <CardDescription className="mt-0.5">
                Upload interim data files (CSV, Excel, JSON) for ingestion into
                the dashboard.
              </CardDescription>
            </div>
            {phase !== "idle" && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={resetForm}
                disabled={isBusy}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Data Type Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="data-type-select" className="text-sm">
                Data Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={dataType}
                onValueChange={handleDataTypeChange}
                disabled={isBusy}
              >
                <SelectTrigger id="data-type-select" className="h-9 text-sm">
                  <SelectValue placeholder="Select data type" />
                </SelectTrigger>
                <SelectContent>
                  {DATA_TYPE_OPTIONS.map((option) => {
                    const OptionIcon = option.icon
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <OptionIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{option.label}</span>
                          <span className="text-2xs text-muted-foreground hidden sm:inline">
                            — {option.description}
                          </span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <p className="text-2xs text-muted-foreground">
                Select the type of data contained in the file.
              </p>
            </div>

            {/* Drag & Drop Zone */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                File <span className="text-destructive">*</span>
              </Label>
              <div
                ref={dropZoneRef}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors cursor-pointer",
                  isDragOver
                    ? "border-primary bg-primary/5"
                    : selectedFile
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-accent/30",
                  isBusy && "pointer-events-none opacity-60"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={!selectedFile ? handleBrowseClick : undefined}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={UPLOAD.ACCEPTED_MIME_TYPES.join(",")}
                  onChange={handleInputChange}
                  className="hidden"
                  disabled={isBusy}
                />

                {!selectedFile ? (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {isDragOver
                        ? "Drop file here"
                        : "Drag & drop a file here"}
                    </p>
                    <p className="text-2xs text-muted-foreground mt-1">
                      or{" "}
                      <button
                        type="button"
                        className="text-primary underline-offset-2 hover:underline font-medium"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleBrowseClick()
                        }}
                      >
                        browse files
                      </button>
                    </p>
                    <p className="text-2xs text-muted-foreground mt-2">
                      Accepted: {ACCEPTED_EXTENSIONS} · Max size: {MAX_FILE_SIZE_MB}{" "}
                      MB · Max records: {UPLOAD.MAX_RECORDS_PER_FILE.toLocaleString()}
                    </p>
                  </>
                ) : (
                  <div className="flex items-center gap-3 w-full">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-green-500/10 shrink-0">
                      <FileIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {selectedFile.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-2xs text-muted-foreground">
                          {formatFileSize(selectedFile.size)}
                        </span>
                        <span className="text-2xs text-muted-foreground">·</span>
                        <Badge variant="secondary" className="text-2xs">
                          {DATA_TYPE_LABELS[dataType]}
                        </Badge>
                      </div>
                    </div>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveFile()
                            }}
                            disabled={isBusy}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={4}>
                          Remove file
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </div>

              {/* File Error */}
              {fileError && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Invalid File</AlertTitle>
                  <AlertDescription className="text-sm">
                    {fileError}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Progress Bar */}
            {(isValidating || isUploading) && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-2xs text-muted-foreground">
                    {isValidating ? "Validating…" : "Uploading…"}
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    {Math.round(progress)}%
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* Validation Result */}
            {validationResult && phase === "validated" && (
              <ValidationResultPanel result={validationResult} />
            )}

            {/* Upload Result */}
            {uploadResult && phase === "success" && (
              <UploadResultPanel result={uploadResult} />
            )}

            {/* Upload Error */}
            {uploadError && phase === "error" && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="text-sm">
                  {uploadError}
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                {/* Validate Button */}
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={handleValidate}
                        disabled={!canValidate || !selectedFile || isBusy}
                      >
                        {isValidating ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Validating…
                          </>
                        ) : (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Validate
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>
                      <p className="text-xs">
                        Validate the file without uploading
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Upload Button */}
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={handleUpload}
                        disabled={!canUpload || !selectedFile || isBusy}
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Uploading…
                          </>
                        ) : (
                          <>
                            <Upload className="h-3.5 w-3.5" />
                            Upload
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>
                      <p className="text-xs">
                        Upload and ingest the file data
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Audit Notice */}
              <div className="flex items-start gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-2xs text-muted-foreground leading-relaxed max-w-[280px]">
                  This upload will be recorded in the audit log with your
                  identity ({user?.name || "Unknown"}).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload History */}
        {showHistory && (
          <UploadHistorySection
            history={uploadHistory}
            isLoading={isHistoryLoading}
            error={historyError}
            maxRecords={maxHistoryRecords}
            onRefresh={mutateHistory}
          />
        )}
      </div>
    </RoleGuard>
  )
}

// ============================================================
// ValidationResultPanel Component
// ============================================================

interface ValidationResultPanelProps {
  result: ValidationResult
}

/**
 * Displays the validation result with row counts and error details.
 */
function ValidationResultPanel({ result }: ValidationResultPanelProps) {
  const isValid = result.valid
  const hasErrors = result.errors.length > 0

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2.5 space-y-2",
        isValid
          ? "border-green-500/30 bg-green-500/5"
          : "border-yellow-500/30 bg-yellow-500/5"
      )}
    >
      <div className="flex items-center gap-2">
        {isValid ? (
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
        )}
        <span
          className={cn(
            "text-2xs font-semibold",
            isValid
              ? "text-green-700 dark:text-green-400"
              : "text-yellow-700 dark:text-yellow-400"
          )}
        >
          {isValid ? "Validation Passed" : "Validation Issues Found"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center rounded-md border bg-background/50 px-2 py-1.5">
          <span className="text-sm font-bold text-foreground">
            {result.total_rows}
          </span>
          <span className="text-2xs text-muted-foreground">Total Rows</span>
        </div>
        <div className="flex flex-col items-center rounded-md border bg-background/50 px-2 py-1.5">
          <span className="text-sm font-bold text-green-600 dark:text-green-400">
            {result.valid_rows}
          </span>
          <span className="text-2xs text-muted-foreground">Valid</span>
        </div>
        <div className="flex flex-col items-center rounded-md border bg-background/50 px-2 py-1.5">
          <span
            className={cn(
              "text-sm font-bold",
              result.invalid_rows > 0
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground"
            )}
          >
            {result.invalid_rows}
          </span>
          <span className="text-2xs text-muted-foreground">Invalid</span>
        </div>
      </div>

      {hasErrors && (
        <div className="space-y-1">
          <span className="text-2xs text-muted-foreground font-medium">
            Errors ({result.errors.length}):
          </span>
          <ScrollArea className="max-h-[120px]">
            <div className="space-y-0.5">
              {result.errors.slice(0, 20).map((error, index) => (
                <p
                  key={index}
                  className="text-2xs text-red-600 dark:text-red-400 font-mono leading-relaxed"
                >
                  {error}
                </p>
              ))}
              {result.errors.length > 20 && (
                <p className="text-2xs text-muted-foreground">
                  … and {result.errors.length - 20} more errors
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}

// ============================================================
// UploadResultPanel Component
// ============================================================

interface UploadResultPanelProps {
  result: UploadResult
}

/**
 * Displays the upload result with ingestion counts and error details.
 */
function UploadResultPanel({ result }: UploadResultPanelProps) {
  const statusConfig =
    UPLOAD_STATUS_CONFIG[result.status] || UPLOAD_STATUS_CONFIG.failed
  const StatusIcon = statusConfig.icon
  const hasErrors = result.errors && result.errors.length > 0

  const borderClass =
    result.status === "success"
      ? "border-green-500/30 bg-green-500/5"
      : result.status === "partial"
        ? "border-yellow-500/30 bg-yellow-500/5"
        : "border-red-500/30 bg-red-500/5"

  return (
    <div className={cn("rounded-md border px-3 py-2.5 space-y-2", borderClass)}>
      <div className="flex items-center gap-2">
        <StatusIcon
          className={cn("h-4 w-4 shrink-0", statusConfig.color)}
        />
        <span className={cn("text-2xs font-semibold", statusConfig.color)}>
          Upload {statusConfig.label}
        </span>
        {result.upload_log_id && (
          <span className="text-2xs text-muted-foreground font-mono">
            ID: {result.upload_log_id}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center rounded-md border bg-background/50 px-2 py-1.5">
          <span className="text-sm font-bold text-foreground">
            {result.file_name.length > 20
              ? `${result.file_name.substring(0, 20)}…`
              : result.file_name}
          </span>
          <span className="text-2xs text-muted-foreground">File</span>
        </div>
        <div className="flex flex-col items-center rounded-md border bg-background/50 px-2 py-1.5">
          <span className="text-sm font-bold text-green-600 dark:text-green-400">
            {result.records_ingested}
          </span>
          <span className="text-2xs text-muted-foreground">Ingested</span>
        </div>
        <div className="flex flex-col items-center rounded-md border bg-background/50 px-2 py-1.5">
          <span
            className={cn(
              "text-sm font-bold",
              result.records_failed > 0
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground"
            )}
          >
            {result.records_failed}
          </span>
          <span className="text-2xs text-muted-foreground">Failed</span>
        </div>
      </div>

      {hasErrors && (
        <div className="space-y-1">
          <span className="text-2xs text-muted-foreground font-medium">
            Errors ({result.errors.length}):
          </span>
          <ScrollArea className="max-h-[100px]">
            <div className="space-y-0.5">
              {result.errors.slice(0, 10).map((error, index) => (
                <p
                  key={index}
                  className="text-2xs text-red-600 dark:text-red-400 font-mono leading-relaxed"
                >
                  {error}
                </p>
              ))}
              {result.errors.length > 10 && (
                <p className="text-2xs text-muted-foreground">
                  … and {result.errors.length - 10} more errors
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}

// ============================================================
// UploadHistorySection Component
// ============================================================

interface UploadHistorySectionProps {
  history:
    | Array<{
        id: string
        file_name: string
        data_type: string
        uploader: string
        uploader_name: string | null
        records_ingested: number
        records_failed: number | null
        errors: string[] | null
        status: string
        file_size_bytes: number | null
        timestamp: string
      }>
    | undefined
  isLoading: boolean
  error: Error | undefined
  maxRecords: number
  onRefresh: () => void
}

/**
 * Displays the upload history table with status badges and metadata.
 */
function UploadHistorySection({
  history,
  isLoading,
  error,
  maxRecords,
  onRefresh,
}: UploadHistorySectionProps) {
  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              Upload History
            </CardTitle>
            <CardDescription>
              Failed to load upload history.
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
            onClick={onRefresh}
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-8 w-8 rounded-md" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-md border p-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const records = history || []

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold">
              Upload History
            </CardTitle>
            {records.length > 0 && (
              <Badge
                variant="secondary"
                className="text-2xs h-5 min-w-5 justify-center"
              >
                {records.length}
              </Badge>
            )}
          </div>
          <CardDescription className="mt-0.5">
            Recent data uploads and their ingestion status
          </CardDescription>
        </div>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onRefresh}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              Refresh history
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No upload history
            </p>
            <p className="text-2xs text-muted-foreground mt-1">
              Upload a file to see it appear here.
            </p>
          </div>
        ) : (
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <TableHead>Uploader</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.slice(0, maxRecords).map((record) => (
                  <UploadHistoryRow key={record.id} record={record} />
                ))}
              </TableBody>
            </Table>

            {/* Footer */}
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-2xs text-muted-foreground">
                Showing {Math.min(records.length, maxRecords)} of{" "}
                {records.length} upload{records.length !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-1 text-2xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                <span>Audit tracked</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// UploadHistoryRow Component
// ============================================================

interface UploadHistoryRowProps {
  record: {
    id: string
    file_name: string
    data_type: string
    uploader: string
    uploader_name: string | null
    records_ingested: number
    records_failed: number | null
    errors: string[] | null
    status: string
    file_size_bytes: number | null
    timestamp: string
  }
}

/**
 * Individual row in the upload history table.
 */
function UploadHistoryRow({ record }: UploadHistoryRowProps) {
  const statusConfig =
    UPLOAD_STATUS_CONFIG[record.status] || UPLOAD_STATUS_CONFIG.failed
  const StatusIcon = statusConfig.icon
  const RecordFileIcon = getFileIcon(record.file_name)

  const totalRecords =
    record.records_ingested + (record.records_failed || 0)

  return (
    <TooltipProvider delayDuration={200}>
      <TableRow>
        {/* File */}
        <TableCell>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 min-w-0">
                <RecordFileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium truncate max-w-[160px]">
                  {record.file_name}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-xs">
              <div className="space-y-1">
                <p className="text-xs font-medium">{record.file_name}</p>
                {record.file_size_bytes && (
                  <p className="text-2xs text-muted-foreground">
                    Size: {formatFileSize(record.file_size_bytes)}
                  </p>
                )}
                <p className="text-2xs text-muted-foreground">
                  Upload ID: {record.id}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TableCell>

        {/* Type */}
        <TableCell>
          <Badge variant="secondary" className="text-2xs">
            {DATA_TYPE_LABELS[record.data_type as DataType] || record.data_type}
          </Badge>
        </TableCell>

        {/* Status */}
        <TableCell>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <StatusIcon
                  className={cn(
                    "h-3 w-3 shrink-0",
                    statusConfig.color,
                    record.status === "processing" && "animate-spin"
                  )}
                />
                <Badge
                  variant={statusConfig.badgeVariant}
                  className="text-2xs"
                >
                  {statusConfig.label}
                </Badge>
              </div>
            </TooltipTrigger>
            {record.errors && record.errors.length > 0 && (
              <TooltipContent side="top" sideOffset={4} className="max-w-sm">
                <div className="space-y-1">
                  <p className="text-xs font-medium">
                    {record.errors.length} error
                    {record.errors.length !== 1 ? "s" : ""}
                  </p>
                  {record.errors.slice(0, 3).map((err, idx) => (
                    <p
                      key={idx}
                      className="text-2xs text-muted-foreground font-mono"
                    >
                      {err}
                    </p>
                  ))}
                  {record.errors.length > 3 && (
                    <p className="text-2xs text-muted-foreground">
                      +{record.errors.length - 3} more
                    </p>
                  )}
                </div>
              </TooltipContent>
            )}
          </Tooltip>
        </TableCell>

        {/* Records */}
        <TableCell className="text-right">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-end gap-1">
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  {record.records_ingested}
                </span>
                {record.records_failed != null && record.records_failed > 0 && (
                  <>
                    <span className="text-2xs text-muted-foreground">/</span>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      {record.records_failed}
                    </span>
                  </>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              <p className="text-xs">
                {record.records_ingested} ingested
                {record.records_failed != null && record.records_failed > 0
                  ? `, ${record.records_failed} failed`
                  : ""}
                {totalRecords > 0 ? ` (${totalRecords} total)` : ""}
              </p>
            </TooltipContent>
          </Tooltip>
        </TableCell>

        {/* Uploader */}
        <TableCell>
          <span className="text-2xs text-muted-foreground truncate max-w-[100px] inline-block">
            {record.uploader_name || record.uploader}
          </span>
        </TableCell>

        {/* Time */}
        <TableCell>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-2xs text-muted-foreground">
                {formatRelativeTime(record.timestamp)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              <p className="text-xs">{formatDateTime(record.timestamp)}</p>
            </TooltipContent>
          </Tooltip>
        </TableCell>
      </TableRow>
    </TooltipProvider>
  )
}

// ============================================================
// Wrapped Export with Error Boundary
// ============================================================

export interface DataUploadFormWithBoundaryProps
  extends DataUploadFormProps {}

/**
 * DataUploadForm wrapped with a module-level error boundary.
 * Use this export for safe rendering in admin layouts.
 */
export function DataUploadFormWithBoundary(
  props: DataUploadFormWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Data Upload">
      <DataUploadForm {...props} />
    </ModuleErrorBoundary>
  )
}

export default DataUploadForm