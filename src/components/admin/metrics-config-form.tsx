"use client"

import * as React from "react"
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { formatRelativeTime, formatDateTime } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import {
  useMetricsConfig,
  useMetricsConfigMutations,
  useMetricsConfigSummary,
} from "@/hooks/use-admin-data"
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
import { toast } from "@/components/ui/toast"
import {
  Switch,
} from "@/components/ui/switch"
import {
  CRITICALITY_TIERS,
  CRITICALITY_TIER_LABELS,
  ENVIRONMENTS,
  ENVIRONMENT_LABELS,
  METRIC_TYPE_LABELS,
  DEFAULT_THRESHOLDS,
} from "@/constants/constants"
import type { CriticalityTier, MetricType } from "@/types"

// ============================================================
// Types
// ============================================================

export interface MetricsConfigFormProps {
  /** Whether to show the existing configurations table (default: true) */
  showExistingConfigs?: boolean
  /** Whether to show the summary section (default: true) */
  showSummary?: boolean
  /** Maximum number of existing config records to display (default: 20) */
  maxConfigRecords?: number
  /** Default domain selection */
  defaultDomain?: string
  /** Default application selection */
  defaultApplication?: string
  /** Callback invoked after a successful save */
  onSaveSuccess?: () => void
  /** Callback invoked on save error */
  onSaveError?: (error: string) => void
  /** Additional CSS class names */
  className?: string
}

interface MetricEntry {
  id: string
  name: MetricType | ""
  threshold: string
  tier: CriticalityTier | ""
  environment: string
  enabled: boolean
}

// ============================================================
// Constants
// ============================================================

const VALID_METRIC_NAMES: Array<{
  value: MetricType
  label: string
  defaultUnit: string
  description: string
}> = [
  {
    value: "latency_p50",
    label: "Latency (P50)",
    defaultUnit: "ms",
    description: "50th percentile latency threshold",
  },
  {
    value: "latency_p95",
    label: "Latency (P95)",
    defaultUnit: "ms",
    description: "95th percentile latency threshold",
  },
  {
    value: "latency_p99",
    label: "Latency (P99)",
    defaultUnit: "ms",
    description: "99th percentile latency threshold",
  },
  {
    value: "errors_4xx",
    label: "4xx Errors",
    defaultUnit: "%",
    description: "Client error rate threshold",
  },
  {
    value: "errors_5xx",
    label: "5xx Errors",
    defaultUnit: "%",
    description: "Server error rate threshold",
  },
  {
    value: "traffic_rps",
    label: "Traffic (RPS)",
    defaultUnit: "rps",
    description: "Requests per second threshold",
  },
  {
    value: "saturation_cpu",
    label: "CPU Saturation",
    defaultUnit: "%",
    description: "CPU utilization threshold",
  },
  {
    value: "saturation_memory",
    label: "Memory Saturation",
    defaultUnit: "%",
    description: "Memory utilization threshold",
  },
  {
    value: "saturation_disk",
    label: "Disk Saturation",
    defaultUnit: "%",
    description: "Disk utilization threshold",
  },
  {
    value: "availability",
    label: "Availability",
    defaultUnit: "%",
    description: "Availability percentage threshold",
  },
]

const CONFIG_STATUS_CONFIG: Record<
  string,
  {
    label: string
    badgeVariant: "success" | "secondary" | "destructive"
  }
> = {
  enabled: {
    label: "Enabled",
    badgeVariant: "success",
  },
  disabled: {
    label: "Disabled",
    badgeVariant: "secondary",
  },
}

// ============================================================
// Helpers
// ============================================================

/**
 * Creates a new empty metric entry with a unique ID.
 */
function createEmptyMetricEntry(): MetricEntry {
  return {
    id: `entry-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    name: "",
    threshold: "",
    tier: "",
    environment: "",
    enabled: true,
  }
}

/**
 * Returns the default threshold for a given metric type and tier.
 */
function getDefaultThreshold(
  metricName: MetricType,
  tier: CriticalityTier | ""
): number | null {
  if (!tier) return null

  switch (metricName) {
    case "latency_p95":
      return DEFAULT_THRESHOLDS.latency_p95_ms[tier as CriticalityTier] ?? null
    case "latency_p99":
      return DEFAULT_THRESHOLDS.latency_p99_ms[tier as CriticalityTier] ?? null
    case "errors_5xx":
      return DEFAULT_THRESHOLDS.error_rate_5xx[tier as CriticalityTier] ?? null
    case "availability":
      return DEFAULT_THRESHOLDS.availability[tier as CriticalityTier] ?? null
    case "saturation_cpu":
      return DEFAULT_THRESHOLDS.saturation.cpu_critical
    case "saturation_memory":
      return DEFAULT_THRESHOLDS.saturation.memory_critical
    case "saturation_disk":
      return DEFAULT_THRESHOLDS.saturation.disk_critical
    default:
      return null
  }
}

/**
 * Returns the unit label for a given metric type.
 */
function getMetricUnit(metricName: MetricType | ""): string {
  if (!metricName) return ""
  const found = VALID_METRIC_NAMES.find((m) => m.value === metricName)
  return found?.defaultUnit || ""
}

/**
 * Validates a single metric entry and returns error messages.
 */
function validateMetricEntry(entry: MetricEntry): string[] {
  const errors: string[] = []

  if (!entry.name) {
    errors.push("Metric type is required.")
  }

  if (!entry.threshold || entry.threshold.trim() === "") {
    errors.push("Threshold value is required.")
  } else {
    const num = Number(entry.threshold)
    if (isNaN(num) || num <= 0) {
      errors.push("Threshold must be a positive number.")
    }
  }

  return errors
}

// ============================================================
// MetricsConfigForm Component
// ============================================================

/**
 * Metrics configuration form for admins to set/update thresholds per
 * domain/application. Includes metric type selector, threshold inputs,
 * tier and environment selectors, enable/disable toggle, and save with
 * audit logging. Shows existing configurations in a table with inline
 * edit and delete capabilities.
 *
 * Restricted to users with admin or are_lead roles.
 *
 * All configuration changes are recorded in the audit log for compliance.
 *
 * @example
 * ```tsx
 * <MetricsConfigForm
 *   showExistingConfigs
 *   showSummary
 *   defaultDomain="payments"
 *   defaultApplication="checkout-api"
 *   onSaveSuccess={() => console.log("Saved!")}
 * />
 * ```
 */
export function MetricsConfigForm({
  showExistingConfigs = true,
  showSummary = true,
  maxConfigRecords = 20,
  defaultDomain,
  defaultApplication,
  onSaveSuccess,
  onSaveError,
  className,
}: MetricsConfigFormProps) {
  const { user } = useAuth()
  const { createConfig, updateConfig, deleteConfig, toggleConfig } =
    useMetricsConfigMutations()

  // Form state
  const [domain, setDomain] = React.useState(defaultDomain || "")
  const [application, setApplication] = React.useState(
    defaultApplication || ""
  )
  const [metricEntries, setMetricEntries] = React.useState<MetricEntry[]>([
    createEmptyMetricEntry(),
  ])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [formErrors, setFormErrors] = React.useState<string[]>([])

  // Existing configs
  const {
    data: existingConfigsData,
    isLoading: isConfigsLoading,
    error: configsError,
    mutate: mutateConfigs,
  } = useMetricsConfig({
    domain: domain.trim().length > 0 ? domain.trim() : undefined,
    application:
      application.trim().length > 0 ? application.trim() : undefined,
    page_size: maxConfigRecords,
  })

  // Summary
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    error: summaryError,
    mutate: mutateSummary,
  } = useMetricsConfigSummary()

  const existingConfigs = existingConfigsData?.data || []
  const totalConfigs = existingConfigsData?.total || 0

  // Toggling / deleting state
  const [togglingId, setTogglingId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  /**
   * Resets the form to its initial state.
   */
  const resetForm = React.useCallback(() => {
    setMetricEntries([createEmptyMetricEntry()])
    setSubmitError(null)
    setFormErrors([])
  }, [])

  /**
   * Adds a new empty metric entry to the form.
   */
  const handleAddMetricEntry = React.useCallback(() => {
    setMetricEntries((prev) => [...prev, createEmptyMetricEntry()])
    setFormErrors([])
    setSubmitError(null)
  }, [])

  /**
   * Removes a metric entry by ID.
   */
  const handleRemoveMetricEntry = React.useCallback((entryId: string) => {
    setMetricEntries((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((e) => e.id !== entryId)
    })
    setFormErrors([])
    setSubmitError(null)
  }, [])

  /**
   * Updates a field on a specific metric entry.
   */
  const handleEntryChange = React.useCallback(
    (entryId: string, field: keyof MetricEntry, value: string | boolean) => {
      setMetricEntries((prev) =>
        prev.map((entry) => {
          if (entry.id !== entryId) return entry
          return { ...entry, [field]: value }
        })
      )
      setFormErrors([])
      setSubmitError(null)
    },
    []
  )

  /**
   * Auto-fills the threshold with the default value for the selected metric and tier.
   */
  const handleAutoFillThreshold = React.useCallback(
    (entryId: string) => {
      setMetricEntries((prev) =>
        prev.map((entry) => {
          if (entry.id !== entryId) return entry
          if (!entry.name || !entry.tier) return entry

          const defaultVal = getDefaultThreshold(
            entry.name as MetricType,
            entry.tier as CriticalityTier
          )
          if (defaultVal !== null) {
            return { ...entry, threshold: String(defaultVal) }
          }
          return entry
        })
      )
    },
    []
  )

  /**
   * Validates the entire form and returns whether it's valid.
   */
  const validateForm = React.useCallback((): boolean => {
    const errors: string[] = []

    if (!domain.trim()) {
      errors.push("Domain is required.")
    }

    if (!application.trim()) {
      errors.push("Application is required.")
    }

    if (metricEntries.length === 0) {
      errors.push("At least one metric configuration is required.")
    }

    for (let i = 0; i < metricEntries.length; i++) {
      const entryErrors = validateMetricEntry(metricEntries[i])
      for (const err of entryErrors) {
        errors.push(`Metric ${i + 1}: ${err}`)
      }
    }

    // Check for duplicate metric names
    const names = metricEntries
      .filter((e) => e.name)
      .map((e) => e.name)
    const uniqueNames = new Set(names)
    if (names.length !== uniqueNames.size) {
      errors.push("Duplicate metric types are not allowed.")
    }

    setFormErrors(errors)
    return errors.length === 0
  }, [domain, application, metricEntries])

  /**
   * Handles form submission to create metrics configurations.
   */
  const handleSubmit = React.useCallback(async () => {
    if (!validateForm()) return
    if (!user) {
      setSubmitError("You must be signed in to configure metrics.")
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    const metrics = metricEntries
      .filter((e) => e.name && e.threshold)
      .map((e) => ({
        name: e.name as string,
        threshold: Number(e.threshold),
        tier: e.tier ? (e.tier as CriticalityTier) : undefined,
        environment: e.environment || undefined,
        enabled: e.enabled,
      }))

    try {
      const result = await createConfig({
        domain: domain.trim(),
        application: application.trim(),
        metrics,
        user_id: user.id,
        user_name: user.name,
      })

      if (result.success) {
        toast.success({
          title: "Configuration Saved",
          description: `${metrics.length} metric threshold(s) configured for ${domain.trim()}/${application.trim()}.`,
        })
        resetForm()
        mutateConfigs()
        mutateSummary()
        onSaveSuccess?.()
      } else {
        const errorMsg = result.error || "Failed to save configuration."
        setSubmitError(errorMsg)
        onSaveError?.(errorMsg)
        toast.error({
          title: "Save Failed",
          description: errorMsg,
        })
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "An unexpected error occurred."
      setSubmitError(errorMsg)
      onSaveError?.(errorMsg)
      toast.error({
        title: "Configuration Error",
        description: errorMsg,
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    validateForm,
    user,
    metricEntries,
    domain,
    application,
    createConfig,
    resetForm,
    mutateConfigs,
    mutateSummary,
    onSaveSuccess,
    onSaveError,
  ])

  /**
   * Handles toggling the enabled state of an existing config.
   */
  const handleToggleConfig = React.useCallback(
    async (configId: string, currentEnabled: boolean) => {
      if (!user) return

      setTogglingId(configId)

      try {
        const result = await toggleConfig(configId, !currentEnabled)

        if (result.success) {
          toast.success({
            title: !currentEnabled ? "Config Enabled" : "Config Disabled",
            description: `Metric configuration has been ${!currentEnabled ? "enabled" : "disabled"}.`,
          })
          mutateConfigs()
          mutateSummary()
        } else {
          toast.error({
            title: "Toggle Failed",
            description: result.error || "Failed to toggle configuration.",
          })
        }
      } catch (err) {
        toast.error({
          title: "Error",
          description:
            err instanceof Error
              ? err.message
              : "An unexpected error occurred.",
        })
      } finally {
        setTogglingId(null)
      }
    },
    [user, toggleConfig, mutateConfigs, mutateSummary]
  )

  /**
   * Handles deleting an existing config.
   */
  const handleDeleteConfig = React.useCallback(
    async (configId: string) => {
      if (!user) return

      setDeletingId(configId)

      try {
        const result = await deleteConfig(configId)

        if (result.success) {
          toast.success({
            title: "Configuration Deleted",
            description: "The metric configuration has been removed.",
          })
          mutateConfigs()
          mutateSummary()
        } else {
          toast.error({
            title: "Deletion Failed",
            description: result.error || "Failed to delete configuration.",
          })
        }
      } catch (err) {
        toast.error({
          title: "Error",
          description:
            err instanceof Error
              ? err.message
              : "An unexpected error occurred.",
        })
      } finally {
        setDeletingId(null)
      }
    },
    [user, deleteConfig, mutateConfigs, mutateSummary]
  )

  const isBusy = isSubmitting

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
              You do not have permission to configure metrics thresholds.
            </p>
          </CardContent>
        </Card>
      }
    >
      <div className={cn("space-y-4", className)}>
        {/* Configuration Form Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">
                  Metrics Configuration
                </CardTitle>
              </div>
              <CardDescription className="mt-0.5">
                Configure metric thresholds per domain and application. Changes
                are audit-logged for compliance.
              </CardDescription>
            </div>
            {metricEntries.length > 0 && (
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
            {/* Domain & Application Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="config-domain" className="text-sm">
                  Domain <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="config-domain"
                  placeholder="e.g., Payments, Identity, Claims"
                  value={domain}
                  onChange={(e) => {
                    setDomain(e.target.value)
                    setFormErrors([])
                    setSubmitError(null)
                  }}
                  className="h-9 text-sm"
                  disabled={isBusy}
                />
                <p className="text-2xs text-muted-foreground">
                  The business domain this configuration applies to.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="config-application" className="text-sm">
                  Application <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="config-application"
                  placeholder="e.g., checkout-api, auth-service"
                  value={application}
                  onChange={(e) => {
                    setApplication(e.target.value)
                    setFormErrors([])
                    setSubmitError(null)
                  }}
                  className="h-9 text-sm"
                  disabled={isBusy}
                />
                <p className="text-2xs text-muted-foreground">
                  The application or service name within the domain.
                </p>
              </div>
            </div>

            <Separator />

            {/* Metric Entries */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Metric Thresholds ({metricEntries.length})
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs h-7"
                  onClick={handleAddMetricEntry}
                  disabled={isBusy || metricEntries.length >= 10}
                >
                  <Plus className="h-3 w-3" />
                  Add Metric
                </Button>
              </div>

              <div className="space-y-2">
                {metricEntries.map((entry, index) => (
                  <MetricEntryRow
                    key={entry.id}
                    entry={entry}
                    index={index}
                    isOnly={metricEntries.length <= 1}
                    isBusy={isBusy}
                    onChange={handleEntryChange}
                    onRemove={handleRemoveMetricEntry}
                    onAutoFill={handleAutoFillThreshold}
                  />
                ))}
              </div>
            </div>

            {/* Form Errors */}
            {formErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Validation Errors</AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 space-y-0.5 text-sm list-disc list-inside">
                    {formErrors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Error */}
            {submitError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="text-sm">
                  {submitError}
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                {/* Save Button */}
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={handleSubmit}
                        disabled={
                          isBusy ||
                          !domain.trim() ||
                          !application.trim() ||
                          metricEntries.length === 0
                        }
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Save Configuration
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>
                      <p className="text-xs">
                        Save metric thresholds for the selected domain/application
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Audit Notice */}
              <div className="flex items-start gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-2xs text-muted-foreground leading-relaxed max-w-[280px]">
                  This configuration change will be recorded in the audit log
                  with your identity ({user?.name || "Unknown"}).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Section */}
        {showSummary && (
          <MetricsConfigSummarySection
            summary={summaryData}
            isLoading={isSummaryLoading}
            error={summaryError}
            onRefresh={mutateSummary}
          />
        )}

        {/* Existing Configurations Table */}
        {showExistingConfigs && (
          <ExistingConfigsSection
            configs={existingConfigs}
            totalConfigs={totalConfigs}
            isLoading={isConfigsLoading}
            error={configsError}
            maxRecords={maxConfigRecords}
            togglingId={togglingId}
            deletingId={deletingId}
            onToggle={handleToggleConfig}
            onDelete={handleDeleteConfig}
            onRefresh={mutateConfigs}
          />
        )}
      </div>
    </RoleGuard>
  )
}

// ============================================================
// MetricEntryRow Component
// ============================================================

interface MetricEntryRowProps {
  entry: MetricEntry
  index: number
  isOnly: boolean
  isBusy: boolean
  onChange: (entryId: string, field: keyof MetricEntry, value: string | boolean) => void
  onRemove: (entryId: string) => void
  onAutoFill: (entryId: string) => void
}

/**
 * Individual metric entry row with metric type selector, threshold input,
 * tier selector, environment selector, enabled toggle, and remove button.
 */
function MetricEntryRow({
  entry,
  index,
  isOnly,
  isBusy,
  onChange,
  onRemove,
  onAutoFill,
}: MetricEntryRowProps) {
  const unit = getMetricUnit(entry.name as MetricType)
  const hasAutoFill = entry.name && entry.tier

  return (
    <div className="rounded-md border px-3 py-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-2xs font-medium text-muted-foreground">
          Metric {index + 1}
        </span>
        <div className="flex items-center gap-2">
          {/* Enabled Toggle */}
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-muted-foreground">
              {entry.enabled ? "Enabled" : "Disabled"}
            </span>
            <Switch
              checked={entry.enabled}
              onCheckedChange={(checked) =>
                onChange(entry.id, "enabled", checked)
              }
              disabled={isBusy}
              className="h-4 w-7"
            />
          </div>

          {/* Remove Button */}
          {!isOnly && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemove(entry.id)}
                    disabled={isBusy}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  Remove metric
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric Type */}
        <div className="space-y-1">
          <Label className="text-2xs">
            Metric Type <span className="text-destructive">*</span>
          </Label>
          <Select
            value={entry.name || undefined}
            onValueChange={(value) => onChange(entry.id, "name", value)}
            disabled={isBusy}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              {VALID_METRIC_NAMES.map((metric) => (
                <SelectItem key={metric.value} value={metric.value}>
                  <div className="flex items-center gap-1.5">
                    <span>{metric.label}</span>
                    <span className="text-2xs text-muted-foreground">
                      ({metric.defaultUnit})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Threshold */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-2xs">
              Threshold <span className="text-destructive">*</span>
            </Label>
            {hasAutoFill && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-2xs text-primary hover:underline"
                      onClick={() => onAutoFill(entry.id)}
                      disabled={isBusy}
                    >
                      Auto-fill
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    <p className="text-xs">
                      Fill with default threshold for the selected tier
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="relative">
            <Input
              type="number"
              placeholder="e.g., 200"
              value={entry.threshold}
              onChange={(e) =>
                onChange(entry.id, "threshold", e.target.value)
              }
              className="h-8 text-xs pr-10"
              disabled={isBusy}
              min={0}
              step="any"
            />
            {unit && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-2xs text-muted-foreground">
                {unit}
              </span>
            )}
          </div>
        </div>

        {/* Tier */}
        <div className="space-y-1">
          <Label className="text-2xs">Criticality Tier</Label>
          <Select
            value={entry.tier || undefined}
            onValueChange={(value) => onChange(entry.id, "tier", value)}
            disabled={isBusy}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              {CRITICALITY_TIERS.map((tier) => (
                <SelectItem key={tier} value={tier}>
                  {CRITICALITY_TIER_LABELS[tier]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Environment */}
        <div className="space-y-1">
          <Label className="text-2xs">Environment</Label>
          <Select
            value={entry.environment || undefined}
            onValueChange={(value) =>
              onChange(entry.id, "environment", value)
            }
            disabled={isBusy}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              {ENVIRONMENTS.map((env) => (
                <SelectItem key={env} value={env}>
                  {ENVIRONMENT_LABELS[env]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Metric Description */}
      {entry.name && (
        <p className="text-2xs text-muted-foreground">
          {VALID_METRIC_NAMES.find((m) => m.value === entry.name)?.description ||
            ""}
        </p>
      )}
    </div>
  )
}

// ============================================================
// MetricsConfigSummarySection Component
// ============================================================

interface MetricsConfigSummarySectionProps {
  summary:
    | Array<{
        domain: string
        application: string
        total_metrics: number
        enabled_metrics: number
        disabled_metrics: number
        last_updated: string
      }>
    | undefined
  isLoading: boolean
  error: Error | undefined
  onRefresh: () => void
}

/**
 * Summary section showing configured metrics grouped by domain/application.
 */
function MetricsConfigSummarySection({
  summary,
  isLoading,
  error,
  onRefresh,
}: MetricsConfigSummarySectionProps) {
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
              Configuration Summary
            </CardTitle>
            <CardDescription>
              Failed to load configuration summary.
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
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-8 w-8 rounded-md" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const records = summary || []

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold">
              Configuration Summary
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
            Configured metrics grouped by domain and application
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
              Refresh summary
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
              <Settings className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No configurations yet
            </p>
            <p className="text-2xs text-muted-foreground mt-1">
              Use the form above to configure metric thresholds.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {records.map((record, idx) => (
              <div
                key={`${record.domain}-${record.application}-${idx}`}
                className="flex items-center justify-between rounded-md border px-3 py-2.5 transition-colors hover:bg-accent/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {record.domain}{" "}
                      <span className="text-muted-foreground">/</span>{" "}
                      {record.application}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-2xs text-muted-foreground">
                        {record.total_metrics} metric
                        {record.total_metrics !== 1 ? "s" : ""}
                      </span>
                      {record.enabled_metrics > 0 && (
                        <Badge variant="success" className="text-2xs">
                          {record.enabled_metrics} enabled
                        </Badge>
                      )}
                      {record.disabled_metrics > 0 && (
                        <Badge variant="secondary" className="text-2xs">
                          {record.disabled_metrics} disabled
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-2xs text-muted-foreground shrink-0 flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {formatRelativeTime(record.last_updated)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>
                      <p className="text-xs">
                        Last updated: {formatDateTime(record.last_updated)}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// ExistingConfigsSection Component
// ============================================================

interface ExistingConfigsSectionProps {
  configs: Array<{
    id: string
    domain: string
    application: string
    metric_name: string
    threshold: number
    tier?: CriticalityTier
    environment?: string
    enabled: boolean
    configured_by: string
    configured_by_name?: string
    configured_at: string
    updated_at: string
  }>
  totalConfigs: number
  isLoading: boolean
  error: Error | undefined
  maxRecords: number
  togglingId: string | null
  deletingId: string | null
  onToggle: (configId: string, currentEnabled: boolean) => void
  onDelete: (configId: string) => void
  onRefresh: () => void
}

/**
 * Displays existing metric configurations in a table with toggle and delete actions.
 */
function ExistingConfigsSection({
  configs,
  totalConfigs,
  isLoading,
  error,
  maxRecords,
  togglingId,
  deletingId,
  onToggle,
  onDelete,
  onRefresh,
}: ExistingConfigsSectionProps) {
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
              Existing Configurations
            </CardTitle>
            <CardDescription>
              Failed to load existing configurations.
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
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-8 w-8 rounded-md" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold">
              Existing Configurations
            </CardTitle>
            {totalConfigs > 0 && (
              <Badge
                variant="secondary"
                className="text-2xs h-5 min-w-5 justify-center"
              >
                {totalConfigs}
              </Badge>
            )}
          </div>
          <CardDescription className="mt-0.5">
            Current metric threshold configurations
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
              Refresh configurations
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {configs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
              <Settings className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No existing configurations
            </p>
            <p className="text-2xs text-muted-foreground mt-1">
              Configure metric thresholds using the form above.
            </p>
          </div>
        ) : (
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain / App</TableHead>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Threshold</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Env</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Configured By</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.slice(0, maxRecords).map((config) => (
                  <ExistingConfigRow
                    key={config.id}
                    config={config}
                    isToggling={togglingId === config.id}
                    isDeleting={deletingId === config.id}
                    onToggle={() => onToggle(config.id, config.enabled)}
                    onDelete={() => onDelete(config.id)}
                  />
                ))}
              </TableBody>
            </Table>

            {/* Footer */}
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-2xs text-muted-foreground">
                Showing {Math.min(configs.length, maxRecords)} of{" "}
                {totalConfigs} configuration
                {totalConfigs !== 1 ? "s" : ""}
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
// ExistingConfigRow Component
// ============================================================

interface ExistingConfigRowProps {
  config: {
    id: string
    domain: string
    application: string
    metric_name: string
    threshold: number
    tier?: CriticalityTier
    environment?: string
    enabled: boolean
    configured_by: string
    configured_by_name?: string
    configured_at: string
    updated_at: string
  }
  isToggling: boolean
  isDeleting: boolean
  onToggle: () => void
  onDelete: () => void
}

/**
 * Individual row in the existing configurations table.
 */
function ExistingConfigRow({
  config,
  isToggling,
  isDeleting,
  onToggle,
  onDelete,
}: ExistingConfigRowProps) {
  const unit = getMetricUnit(config.metric_name as MetricType)
  const metricLabel =
    METRIC_TYPE_LABELS[config.metric_name as MetricType] || config.metric_name
  const isBusy = isToggling || isDeleting

  return (
    <TooltipProvider delayDuration={200}>
      <TableRow className={cn(isBusy && "opacity-50 pointer-events-none")}>
        {/* Domain / App */}
        <TableCell>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="min-w-0">
                <span className="text-sm font-medium truncate block max-w-[160px]">
                  {config.domain}
                </span>
                <span className="text-2xs text-muted-foreground truncate block max-w-[160px]">
                  {config.application}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              <p className="text-xs">
                {config.domain} / {config.application}
              </p>
              <p className="text-2xs text-muted-foreground">
                Config ID: {config.id}
              </p>
            </TooltipContent>
          </Tooltip>
        </TableCell>

        {/* Metric */}
        <TableCell>
          <Badge variant="secondary" className="text-2xs">
            {metricLabel}
          </Badge>
        </TableCell>

        {/* Threshold */}
        <TableCell className="text-right">
          <span className="text-sm font-medium">
            {config.threshold}
            {unit && (
              <span className="text-2xs text-muted-foreground ml-0.5">
                {unit}
              </span>
            )}
          </span>
        </TableCell>

        {/* Tier */}
        <TableCell>
          {config.tier ? (
            <Badge
              variant={
                config.tier === "Tier-1"
                  ? "tier1"
                  : config.tier === "Tier-2"
                    ? "tier2"
                    : config.tier === "Tier-3"
                      ? "tier3"
                      : "tier4"
              }
              className="text-2xs"
            >
              {CRITICALITY_TIER_LABELS[config.tier] || config.tier}
            </Badge>
          ) : (
            <span className="text-2xs text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Environment */}
        <TableCell>
          {config.environment ? (
            <span className="text-2xs text-muted-foreground">
              {ENVIRONMENT_LABELS[config.environment as keyof typeof ENVIRONMENT_LABELS] ||
                config.environment}
            </span>
          ) : (
            <span className="text-2xs text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Status */}
        <TableCell>
          <Badge
            variant={config.enabled ? "success" : "secondary"}
            className="text-2xs"
          >
            {config.enabled ? "Enabled" : "Disabled"}
          </Badge>
        </TableCell>

        {/* Configured By */}
        <TableCell>
          <span className="text-2xs text-muted-foreground truncate max-w-[100px] inline-block">
            {config.configured_by_name || config.configured_by}
          </span>
        </TableCell>

        {/* Updated */}
        <TableCell>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-2xs text-muted-foreground">
                {formatRelativeTime(config.updated_at)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              <div className="space-y-0.5">
                <p className="text-xs">
                  Updated: {formatDateTime(config.updated_at)}
                </p>
                <p className="text-2xs text-muted-foreground">
                  Created: {formatDateTime(config.configured_at)}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TableCell>

        {/* Actions */}
        <TableCell>
          <div className="flex items-center gap-0.5">
            {/* Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onToggle}
                  disabled={isBusy}
                >
                  {isToggling ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : config.enabled ? (
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                <p className="text-xs">
                  {config.enabled ? "Disable" : "Enable"} configuration
                </p>
              </TooltipContent>
            </Tooltip>

            {/* Delete */}
            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      disabled={isBusy}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  <p className="text-xs">Delete configuration</p>
                </TooltipContent>
              </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Configuration</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete the{" "}
                    <span className="font-medium">{metricLabel}</span>{" "}
                    threshold configuration for{" "}
                    <span className="font-medium">
                      {config.domain}/{config.application}
                    </span>
                    ? This action will be recorded in the audit log and cannot
                    be undone.
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
          </div>
        </TableCell>
      </TableRow>
    </TooltipProvider>
  )
}

// ============================================================
// Wrapped Export with Error Boundary
// ============================================================

export interface MetricsConfigFormWithBoundaryProps
  extends MetricsConfigFormProps {}

/**
 * MetricsConfigForm wrapped with a module-level error boundary.
 * Use this export for safe rendering in admin layouts.
 */
export function MetricsConfigFormWithBoundary(
  props: MetricsConfigFormWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Metrics Configuration">
      <MetricsConfigForm {...props} />
    </ModuleErrorBoundary>
  )
}

export default MetricsConfigForm