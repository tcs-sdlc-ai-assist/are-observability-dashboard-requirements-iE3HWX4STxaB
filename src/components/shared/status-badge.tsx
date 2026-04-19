"use client"

import * as React from "react"
import {
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  XCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  CriticalityTier,
  DeploymentStatus,
  IncidentSeverity,
  IncidentStatus,
} from "@/types"

// ============================================================
// Types
// ============================================================

export type HealthStatus = "healthy" | "degraded" | "critical" | "unknown"

export interface StatusBadgeProps {
  /** The health status to display */
  status: HealthStatus
  /** Optional label override (defaults to the status name) */
  label?: string
  /** Whether to show the status icon */
  showIcon?: boolean
  /** Optional tooltip description */
  description?: string
  /** Size variant */
  size?: "sm" | "md" | "lg"
  /** Additional CSS class names */
  className?: string
}

export interface SeverityBadgeProps {
  /** The incident severity to display */
  severity: IncidentSeverity
  /** Whether to show the icon */
  showIcon?: boolean
  /** Size variant */
  size?: "sm" | "md" | "lg"
  /** Additional CSS class names */
  className?: string
}

export interface IncidentStatusBadgeProps {
  /** The incident status to display */
  status: IncidentStatus
  /** Whether to show the icon */
  showIcon?: boolean
  /** Size variant */
  size?: "sm" | "md" | "lg"
  /** Additional CSS class names */
  className?: string
}

export interface TierBadgeProps {
  /** The criticality tier to display */
  tier: CriticalityTier
  /** Size variant */
  size?: "sm" | "md" | "lg"
  /** Additional CSS class names */
  className?: string
}

export interface DeploymentStatusBadgeProps {
  /** The deployment status to display */
  status: DeploymentStatus
  /** Whether to show the icon */
  showIcon?: boolean
  /** Size variant */
  size?: "sm" | "md" | "lg"
  /** Additional CSS class names */
  className?: string
}

export interface SLOStatusBadgeProps {
  /** Whether the SLO is met */
  met: boolean
  /** Optional label override */
  label?: string
  /** Whether to show the icon */
  showIcon?: boolean
  /** Optional tooltip description */
  description?: string
  /** Size variant */
  size?: "sm" | "md" | "lg"
  /** Additional CSS class names */
  className?: string
}

// ============================================================
// Constants
// ============================================================

const HEALTH_STATUS_CONFIG: Record<
  HealthStatus,
  {
    label: string
    icon: React.ElementType
    badgeClass: string
  }
> = {
  healthy: {
    label: "Healthy",
    icon: CheckCircle,
    badgeClass:
      "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  },
  degraded: {
    label: "Degraded",
    icon: AlertTriangle,
    badgeClass:
      "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  },
  critical: {
    label: "Critical",
    icon: XCircle,
    badgeClass:
      "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  },
  unknown: {
    label: "Unknown",
    icon: HelpCircle,
    badgeClass:
      "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
  },
}

const SEVERITY_BADGE_VARIANT: Record<IncidentSeverity, "critical" | "major" | "minor" | "warning"> = {
  critical: "critical",
  major: "major",
  minor: "minor",
  warning: "warning",
}

const SEVERITY_ICON: Record<IncidentSeverity, React.ElementType> = {
  critical: XCircle,
  major: AlertTriangle,
  minor: AlertTriangle,
  warning: AlertTriangle,
}

const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  critical: "Critical",
  major: "Major",
  minor: "Minor",
  warning: "Warning",
}

const INCIDENT_STATUS_CONFIG: Record<
  IncidentStatus,
  {
    label: string
    badgeClass: string
    icon: React.ElementType
  }
> = {
  open: {
    label: "Open",
    badgeClass: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    icon: XCircle,
  },
  investigating: {
    label: "Investigating",
    badgeClass:
      "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
    icon: AlertTriangle,
  },
  mitigated: {
    label: "Mitigated",
    badgeClass:
      "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
    icon: AlertTriangle,
  },
  resolved: {
    label: "Resolved",
    badgeClass:
      "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    icon: CheckCircle,
  },
  closed: {
    label: "Closed",
    badgeClass:
      "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
    icon: CheckCircle,
  },
}

const TIER_BADGE_VARIANT: Record<CriticalityTier, "tier1" | "tier2" | "tier3" | "tier4"> = {
  "Tier-1": "tier1",
  "Tier-2": "tier2",
  "Tier-3": "tier3",
  "Tier-4": "tier4",
}

const TIER_LABEL: Record<CriticalityTier, string> = {
  "Tier-1": "Tier 1",
  "Tier-2": "Tier 2",
  "Tier-3": "Tier 3",
  "Tier-4": "Tier 4",
}

const DEPLOYMENT_STATUS_CONFIG: Record<
  DeploymentStatus,
  {
    label: string
    badgeClass: string
    icon: React.ElementType
  }
> = {
  success: {
    label: "Success",
    badgeClass:
      "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    icon: CheckCircle,
  },
  failed: {
    label: "Failed",
    badgeClass:
      "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    icon: XCircle,
  },
  rolled_back: {
    label: "Rolled Back",
    badgeClass:
      "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
    icon: AlertTriangle,
  },
  in_progress: {
    label: "In Progress",
    badgeClass:
      "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    icon: HelpCircle,
  },
}

const SIZE_CLASSES: Record<string, string> = {
  sm: "text-2xs h-4 px-1.5 gap-0.5",
  md: "text-xs h-5 px-2 gap-1",
  lg: "text-xs h-6 px-2.5 gap-1",
}

const ICON_SIZE_CLASSES: Record<string, string> = {
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-3.5 w-3.5",
}

// ============================================================
// StatusBadge Component
// ============================================================

/**
 * Health status badge component mapping health states (healthy, degraded,
 * critical, unknown) to colored badges with icons. Used throughout the
 * dashboard for service and SLO status indicators.
 *
 * @example
 * ```tsx
 * <StatusBadge status="healthy" />
 * <StatusBadge status="degraded" showIcon description="Latency above threshold" />
 * <StatusBadge status="critical" label="Outage" size="lg" />
 * ```
 */
export function StatusBadge({
  status,
  label,
  showIcon = true,
  description,
  size = "md",
  className,
}: StatusBadgeProps) {
  const config = HEALTH_STATUS_CONFIG[status] || HEALTH_STATUS_CONFIG.unknown
  const Icon = config.icon
  const displayLabel = label || config.label

  const badgeContent = (
    <div
      className={cn(
        "inline-flex items-center rounded-full border font-semibold transition-colors",
        config.badgeClass,
        SIZE_CLASSES[size],
        className
      )}
    >
      {showIcon && <Icon className={cn("shrink-0", ICON_SIZE_CLASSES[size])} />}
      <span>{displayLabel}</span>
    </div>
  )

  if (description) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
          <TooltipContent side="top" sideOffset={4} className="max-w-xs">
            <p className="text-xs">{description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return badgeContent
}

// ============================================================
// SeverityBadge Component
// ============================================================

/**
 * Incident severity badge component. Maps severity levels to the
 * corresponding badge variant from the design system.
 *
 * @example
 * ```tsx
 * <SeverityBadge severity="critical" />
 * <SeverityBadge severity="major" showIcon={false} size="sm" />
 * ```
 */
export function SeverityBadge({
  severity,
  showIcon = true,
  size = "md",
  className,
}: SeverityBadgeProps) {
  const variant = SEVERITY_BADGE_VARIANT[severity] || "secondary"
  const Icon = SEVERITY_ICON[severity] || AlertTriangle
  const label = SEVERITY_LABEL[severity] || severity

  return (
    <Badge
      variant={variant}
      className={cn(
        "inline-flex items-center",
        SIZE_CLASSES[size],
        className
      )}
    >
      {showIcon && <Icon className={cn("shrink-0", ICON_SIZE_CLASSES[size])} />}
      <span>{label}</span>
    </Badge>
  )
}

// ============================================================
// IncidentStatusBadge Component
// ============================================================

/**
 * Incident status badge component. Maps incident statuses to colored
 * badges with appropriate icons.
 *
 * @example
 * ```tsx
 * <IncidentStatusBadge status="open" />
 * <IncidentStatusBadge status="resolved" showIcon size="lg" />
 * ```
 */
export function IncidentStatusBadge({
  status,
  showIcon = true,
  size = "md",
  className,
}: IncidentStatusBadgeProps) {
  const config = INCIDENT_STATUS_CONFIG[status] || INCIDENT_STATUS_CONFIG.open
  const Icon = config.icon

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border font-semibold transition-colors",
        config.badgeClass,
        SIZE_CLASSES[size],
        className
      )}
    >
      {showIcon && <Icon className={cn("shrink-0", ICON_SIZE_CLASSES[size])} />}
      <span>{config.label}</span>
    </div>
  )
}

// ============================================================
// TierBadge Component
// ============================================================

/**
 * Criticality tier badge component. Maps tier levels to the
 * corresponding badge variant from the design system.
 *
 * @example
 * ```tsx
 * <TierBadge tier="Tier-1" />
 * <TierBadge tier="Tier-3" size="sm" />
 * ```
 */
export function TierBadge({
  tier,
  size = "md",
  className,
}: TierBadgeProps) {
  const variant = TIER_BADGE_VARIANT[tier] || "secondary"
  const label = TIER_LABEL[tier] || tier

  return (
    <Badge
      variant={variant}
      className={cn(
        "inline-flex items-center",
        SIZE_CLASSES[size],
        className
      )}
    >
      <span>{label}</span>
    </Badge>
  )
}

// ============================================================
// DeploymentStatusBadge Component
// ============================================================

/**
 * Deployment status badge component. Maps deployment statuses to
 * colored badges with appropriate icons.
 *
 * @example
 * ```tsx
 * <DeploymentStatusBadge status="success" />
 * <DeploymentStatusBadge status="failed" showIcon size="lg" />
 * ```
 */
export function DeploymentStatusBadge({
  status,
  showIcon = true,
  size = "md",
  className,
}: DeploymentStatusBadgeProps) {
  const config =
    DEPLOYMENT_STATUS_CONFIG[status] || DEPLOYMENT_STATUS_CONFIG.in_progress
  const Icon = config.icon

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border font-semibold transition-colors",
        config.badgeClass,
        SIZE_CLASSES[size],
        className
      )}
    >
      {showIcon && <Icon className={cn("shrink-0", ICON_SIZE_CLASSES[size])} />}
      <span>{config.label}</span>
    </div>
  )
}

// ============================================================
// SLOStatusBadge Component
// ============================================================

/**
 * SLO compliance status badge. Displays whether an SLO target is met
 * or breached with appropriate color coding.
 *
 * @example
 * ```tsx
 * <SLOStatusBadge met={true} />
 * <SLOStatusBadge met={false} label="SLA Breached" description="Below 99.9% target" />
 * ```
 */
export function SLOStatusBadge({
  met,
  label,
  showIcon = true,
  description,
  size = "md",
  className,
}: SLOStatusBadgeProps) {
  const status: HealthStatus = met ? "healthy" : "critical"
  const defaultLabel = met ? "SLO Met" : "SLO Breached"

  return (
    <StatusBadge
      status={status}
      label={label || defaultLabel}
      showIcon={showIcon}
      description={description}
      size={size}
      className={className}
    />
  )
}

// ============================================================
// Utility: Map availability percentage to HealthStatus
// ============================================================

/**
 * Maps an availability percentage to a HealthStatus value based on
 * standard thresholds.
 *
 * @param percentage - Availability percentage (0-100)
 * @param thresholds - Optional custom thresholds
 * @returns The corresponding HealthStatus
 *
 * @example
 * ```tsx
 * const status = availabilityToHealthStatus(99.95); // "healthy"
 * const status = availabilityToHealthStatus(99.5);  // "degraded"
 * const status = availabilityToHealthStatus(98.0);  // "critical"
 * ```
 */
export function availabilityToHealthStatus(
  percentage: number | null | undefined,
  thresholds?: { healthy: number; degraded: number }
): HealthStatus {
  if (percentage === null || percentage === undefined || isNaN(percentage)) {
    return "unknown"
  }

  const healthyThreshold = thresholds?.healthy ?? 99.9
  const degradedThreshold = thresholds?.degraded ?? 99.5

  if (percentage >= healthyThreshold) return "healthy"
  if (percentage >= degradedThreshold) return "degraded"
  return "critical"
}

/**
 * Maps a DependencyNode status string to a HealthStatus value.
 *
 * @param nodeStatus - The dependency node status
 * @returns The corresponding HealthStatus
 */
export function nodeStatusToHealthStatus(
  nodeStatus: "healthy" | "degraded" | "down" | "unknown" | string | undefined
): HealthStatus {
  switch (nodeStatus) {
    case "healthy":
      return "healthy"
    case "degraded":
      return "degraded"
    case "down":
      return "critical"
    case "unknown":
    default:
      return "unknown"
  }
}

export default StatusBadge