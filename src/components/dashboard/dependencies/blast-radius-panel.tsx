"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Network,
  Server,
  Shield,
  X,
  Zap,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { StatusBadge, nodeStatusToHealthStatus } from "@/components/shared/status-badge"
import { TierBadge } from "@/components/shared/status-badge"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { ROUTES } from "@/constants/constants"
import type {
  CriticalityTier,
  DependencyMap,
  DependencyNode,
  DependencyEdge,
} from "@/types"

// ============================================================
// Types
// ============================================================

export interface BlastRadiusPanelProps {
  /** The full dependency map data */
  dependencyMap: DependencyMap | undefined
  /** The incident ID associated with the blast radius */
  incidentId?: string
  /** The root service ID (source of the failure) */
  rootServiceId?: string
  /** Whether the panel is visible */
  isOpen: boolean
  /** Callback to close the panel */
  onClose: () => void
  /** Callback when a service is clicked for navigation */
  onServiceClick?: (serviceId: string) => void
  /** Whether data is currently loading */
  isLoading?: boolean
  /** Additional CSS class names */
  className?: string
}

interface AffectedServiceInfo {
  id: string
  name: string
  type: DependencyNode["type"]
  tier?: CriticalityTier
  status?: DependencyNode["status"]
  domain?: string
  /** Number of dependency hops from the root service */
  distance: number
  /** The dependency path from root to this service */
  dependencyPath: string[]
}

interface BlastRadiusSummary {
  totalAffected: number
  criticalServicesAffected: number
  tier1Affected: number
  tier2Affected: number
  tier3Affected: number
  tier4Affected: number
  affectedByDomain: Map<string, number>
  affectedByStatus: Map<string, number>
}

// ============================================================
// Constants
// ============================================================

const NODE_TYPE_ICONS: Record<DependencyNode["type"], React.ElementType> = {
  service: Server,
  database: Server,
  queue: Server,
  external: ExternalLink,
  cache: Zap,
}

const NODE_TYPE_COLORS: Record<DependencyNode["type"], string> = {
  service: "#3b82f6",
  database: "#8b5cf6",
  queue: "#f59e0b",
  external: "#6b7280",
  cache: "#06b6d4",
}

// ============================================================
// Helpers
// ============================================================

/**
 * Builds a list of affected services from the dependency map blast radius,
 * enriched with node metadata and estimated distance from the root service.
 */
function buildAffectedServices(
  dependencyMap: DependencyMap | undefined,
  rootServiceId?: string
): AffectedServiceInfo[] {
  if (!dependencyMap || !dependencyMap.blast_radius || dependencyMap.blast_radius.length === 0) {
    return []
  }

  const blastRadiusSet = new Set(dependencyMap.blast_radius)
  const nodeMap = new Map<string, DependencyNode>()

  for (const node of dependencyMap.nodes) {
    nodeMap.set(node.id, node)
  }

  // Build adjacency lists for distance computation
  const incoming = new Map<string, DependencyEdge[]>()
  for (const edge of dependencyMap.edges) {
    if (!incoming.has(edge.to_service)) {
      incoming.set(edge.to_service, [])
    }
    incoming.get(edge.to_service)!.push(edge)
  }

  // BFS from root to compute distances
  const distances = new Map<string, { distance: number; path: string[] }>()

  if (rootServiceId) {
    const queue: Array<{ nodeId: string; depth: number; path: string[] }> = [
      { nodeId: rootServiceId, depth: 0, path: [rootServiceId] },
    ]
    const visited = new Set<string>()
    visited.add(rootServiceId)

    while (queue.length > 0) {
      const { nodeId, depth, path } = queue.shift()!

      // Find services that depend on this node (incoming edges to this node)
      const dependents = incoming.get(nodeId) || []
      for (const edge of dependents) {
        if (!visited.has(edge.from_service)) {
          visited.add(edge.from_service)
          const newPath = [...path, edge.from_service]
          distances.set(edge.from_service, { distance: depth + 1, path: newPath })
          queue.push({
            nodeId: edge.from_service,
            depth: depth + 1,
            path: newPath,
          })
        }
      }
    }
  }

  const affectedServices: AffectedServiceInfo[] = []

  for (const serviceId of blastRadiusSet) {
    const node = nodeMap.get(serviceId)
    const distanceInfo = distances.get(serviceId)

    affectedServices.push({
      id: serviceId,
      name: node?.name || serviceId,
      type: node?.type || "service",
      tier: node?.tier,
      status: node?.status,
      domain: node?.domain,
      distance: distanceInfo?.distance || 1,
      dependencyPath: distanceInfo?.path || [serviceId],
    })
  }

  // Sort by tier priority (Tier-1 first), then by distance
  const tierOrder: Record<string, number> = {
    "Tier-1": 1,
    "Tier-2": 2,
    "Tier-3": 3,
    "Tier-4": 4,
  }

  affectedServices.sort((a, b) => {
    const tierA = a.tier ? tierOrder[a.tier] || 99 : 99
    const tierB = b.tier ? tierOrder[b.tier] || 99 : 99
    if (tierA !== tierB) return tierA - tierB
    return a.distance - b.distance
  })

  return affectedServices
}

/**
 * Computes summary statistics from the affected services list.
 */
function computeBlastRadiusSummary(
  affectedServices: AffectedServiceInfo[]
): BlastRadiusSummary {
  const affectedByDomain = new Map<string, number>()
  const affectedByStatus = new Map<string, number>()

  let tier1Affected = 0
  let tier2Affected = 0
  let tier3Affected = 0
  let tier4Affected = 0
  let criticalServicesAffected = 0

  for (const service of affectedServices) {
    // Count by tier
    switch (service.tier) {
      case "Tier-1":
        tier1Affected++
        criticalServicesAffected++
        break
      case "Tier-2":
        tier2Affected++
        criticalServicesAffected++
        break
      case "Tier-3":
        tier3Affected++
        break
      case "Tier-4":
        tier4Affected++
        break
    }

    // Count by domain
    const domain = service.domain || "Unknown"
    affectedByDomain.set(domain, (affectedByDomain.get(domain) || 0) + 1)

    // Count by status
    const status = service.status || "unknown"
    affectedByStatus.set(status, (affectedByStatus.get(status) || 0) + 1)
  }

  return {
    totalAffected: affectedServices.length,
    criticalServicesAffected,
    tier1Affected,
    tier2Affected,
    tier3Affected,
    tier4Affected,
    affectedByDomain,
    affectedByStatus,
  }
}

/**
 * Estimates the impact severity based on the blast radius summary.
 */
function estimateImpactSeverity(
  summary: BlastRadiusSummary
): "critical" | "high" | "medium" | "low" {
  if (summary.tier1Affected > 0) return "critical"
  if (summary.tier2Affected > 0 || summary.totalAffected >= 5) return "high"
  if (summary.totalAffected >= 2) return "medium"
  return "low"
}

/**
 * Returns the color and label for an impact severity level.
 */
function getImpactSeverityConfig(severity: "critical" | "high" | "medium" | "low"): {
  label: string
  color: string
  badgeVariant: "destructive" | "warning" | "info" | "success"
} {
  switch (severity) {
    case "critical":
      return { label: "Critical Impact", color: "#ef4444", badgeVariant: "destructive" }
    case "high":
      return { label: "High Impact", color: "#f97316", badgeVariant: "warning" }
    case "medium":
      return { label: "Medium Impact", color: "#f59e0b", badgeVariant: "warning" }
    case "low":
      return { label: "Low Impact", color: "#22c55e", badgeVariant: "success" }
  }
}

// ============================================================
// BlastRadiusPanel Component
// ============================================================

/**
 * Side panel showing blast radius details when an incident is selected
 * on the dependency map. Lists affected services grouped by tier,
 * estimated impact severity, domain breakdown, and links to incident
 * and service detail pages.
 *
 * @example
 * ```tsx
 * <BlastRadiusPanel
 *   dependencyMap={data}
 *   incidentId="inc-123"
 *   rootServiceId="svc-456"
 *   isOpen={showBlastRadius}
 *   onClose={() => setShowBlastRadius(false)}
 *   onServiceClick={(id) => router.push(ROUTES.SERVICE_DETAIL(id))}
 * />
 * ```
 */
export function BlastRadiusPanel({
  dependencyMap,
  incidentId,
  rootServiceId,
  isOpen,
  onClose,
  onServiceClick,
  isLoading = false,
  className,
}: BlastRadiusPanelProps) {
  const router = useRouter()

  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(["affected-services", "impact-summary"])
  )

  const affectedServices = React.useMemo(
    () => buildAffectedServices(dependencyMap, rootServiceId),
    [dependencyMap, rootServiceId]
  )

  const summary = React.useMemo(
    () => computeBlastRadiusSummary(affectedServices),
    [affectedServices]
  )

  const impactSeverity = React.useMemo(
    () => estimateImpactSeverity(summary),
    [summary]
  )

  const impactConfig = getImpactSeverityConfig(impactSeverity)

  const rootNode = React.useMemo(() => {
    if (!dependencyMap || !rootServiceId) return null
    return dependencyMap.nodes.find((n) => n.id === rootServiceId) || null
  }, [dependencyMap, rootServiceId])

  const handleServiceClick = React.useCallback(
    (serviceId: string) => {
      if (onServiceClick) {
        onServiceClick(serviceId)
      } else {
        router.push(ROUTES.SERVICE_DETAIL(serviceId))
      }
    },
    [onServiceClick, router]
  )

  const handleIncidentClick = React.useCallback(() => {
    if (incidentId) {
      router.push(ROUTES.INCIDENT_DETAIL(incidentId))
    }
  }, [incidentId, router])

  const handleViewServiceMap = React.useCallback(() => {
    router.push(ROUTES.DASHBOARD_SERVICE_MAP)
  }, [router])

  const toggleSection = React.useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }, [])

  if (!isOpen) {
    return null
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn("w-80 shadow-dashboard-md", className)}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-4 px-4">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-6 w-6 rounded" />
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 space-y-3">
          <Skeleton className="h-16 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </CardContent>
      </Card>
    )
  }

  // Empty state — no blast radius data
  if (affectedServices.length === 0) {
    return (
      <Card className={cn("w-80 shadow-dashboard-md", className)}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-4 px-4">
          <div>
            <CardTitle className="text-sm font-semibold">Blast Radius</CardTitle>
            <CardDescription className="text-2xs">
              Impact analysis
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <div className="flex flex-col items-center justify-center py-6">
            <Shield className="h-8 w-8 text-green-600 dark:text-green-400 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">
              No blast radius detected
            </p>
            <p className="text-2xs text-muted-foreground mt-1 text-center">
              No downstream services are affected by this incident.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Group affected services by tier
  const servicesByTier = new Map<string, AffectedServiceInfo[]>()
  for (const service of affectedServices) {
    const tier = service.tier || "Unknown"
    if (!servicesByTier.has(tier)) {
      servicesByTier.set(tier, [])
    }
    servicesByTier.get(tier)!.push(service)
  }

  return (
    <Card className={cn("w-80 shadow-dashboard-md overflow-hidden", className)}>
      {/* Header */}
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-4 px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
            <CardTitle className="text-sm font-semibold">Blast Radius</CardTitle>
          </div>
          <CardDescription className="text-2xs mt-0.5">
            {summary.totalAffected} service{summary.totalAffected !== 1 ? "s" : ""} affected
            {incidentId && (
              <span> · Incident: {incidentId}</span>
            )}
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>

      <ScrollArea className="max-h-[calc(100vh-280px)]">
        <CardContent className="px-4 pb-4 pt-0 space-y-3">
          {/* Impact Severity Banner */}
          <div
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2",
              impactSeverity === "critical" && "border-red-500/30 bg-red-500/5",
              impactSeverity === "high" && "border-orange-500/30 bg-orange-500/5",
              impactSeverity === "medium" && "border-yellow-500/30 bg-yellow-500/5",
              impactSeverity === "low" && "border-green-500/30 bg-green-500/5"
            )}
          >
            <AlertTriangle
              className="h-4 w-4 shrink-0"
              style={{ color: impactConfig.color }}
            />
            <div className="min-w-0">
              <p className="text-2xs font-semibold" style={{ color: impactConfig.color }}>
                {impactConfig.label}
              </p>
              <p className="text-2xs text-muted-foreground">
                {summary.criticalServicesAffected > 0
                  ? `${summary.criticalServicesAffected} critical service${summary.criticalServicesAffected !== 1 ? "s" : ""} in blast radius`
                  : `${summary.totalAffected} service${summary.totalAffected !== 1 ? "s" : ""} potentially impacted`}
              </p>
            </div>
          </div>

          {/* Root Service */}
          {rootNode && (
            <div className="space-y-1">
              <span className="text-2xs text-muted-foreground font-medium">Root Service</span>
              <button
                type="button"
                className="flex items-center gap-2 w-full rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-left transition-colors hover:bg-blue-500/10"
                onClick={() => handleServiceClick(rootNode.id)}
              >
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-md shrink-0"
                  style={{ backgroundColor: `${NODE_TYPE_COLORS[rootNode.type]}20` }}
                >
                  {React.createElement(NODE_TYPE_ICONS[rootNode.type] || Server, {
                    className: "h-3.5 w-3.5",
                    style: { color: NODE_TYPE_COLORS[rootNode.type] },
                  })}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-2xs font-medium truncate">{rootNode.name}</p>
                  <div className="flex items-center gap-1">
                    {rootNode.tier && <TierBadge tier={rootNode.tier} size="sm" />}
                    <Badge variant="info" className="text-2xs h-3.5 px-1">
                      Root
                    </Badge>
                  </div>
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
              </button>
            </div>
          )}

          <Separator />

          {/* Impact Summary Section */}
          <Collapsible
            open={expandedSections.has("impact-summary")}
            onOpenChange={() => toggleSection("impact-summary")}
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-between w-full text-left py-1"
              >
                <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Impact Summary
                </span>
                {expandedSections.has("impact-summary") ? (
                  <ChevronUp className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 pt-1">
                {/* Tier Breakdown */}
                <div className="grid grid-cols-2 gap-1.5">
                  {summary.tier1Affected > 0 && (
                    <div className="flex items-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/5 px-2 py-1.5">
                      <Badge variant="tier1" className="text-2xs h-3.5 px-1">
                        T1
                      </Badge>
                      <span className="text-2xs font-medium text-red-700 dark:text-red-400">
                        {summary.tier1Affected} affected
                      </span>
                    </div>
                  )}
                  {summary.tier2Affected > 0 && (
                    <div className="flex items-center gap-1.5 rounded-md border border-orange-500/20 bg-orange-500/5 px-2 py-1.5">
                      <Badge variant="tier2" className="text-2xs h-3.5 px-1">
                        T2
                      </Badge>
                      <span className="text-2xs font-medium text-orange-700 dark:text-orange-400">
                        {summary.tier2Affected} affected
                      </span>
                    </div>
                  )}
                  {summary.tier3Affected > 0 && (
                    <div className="flex items-center gap-1.5 rounded-md border border-yellow-500/20 bg-yellow-500/5 px-2 py-1.5">
                      <Badge variant="tier3" className="text-2xs h-3.5 px-1">
                        T3
                      </Badge>
                      <span className="text-2xs font-medium text-yellow-700 dark:text-yellow-400">
                        {summary.tier3Affected} affected
                      </span>
                    </div>
                  )}
                  {summary.tier4Affected > 0 && (
                    <div className="flex items-center gap-1.5 rounded-md border border-green-500/20 bg-green-500/5 px-2 py-1.5">
                      <Badge variant="tier4" className="text-2xs h-3.5 px-1">
                        T4
                      </Badge>
                      <span className="text-2xs font-medium text-green-700 dark:text-green-400">
                        {summary.tier4Affected} affected
                      </span>
                    </div>
                  )}
                </div>

                {/* Domain Breakdown */}
                {summary.affectedByDomain.size > 0 && (
                  <div className="space-y-1">
                    <span className="text-2xs text-muted-foreground">By Domain:</span>
                    <div className="space-y-0.5">
                      {Array.from(summary.affectedByDomain.entries())
                        .sort((a, b) => b[1] - a[1])
                        .map(([domain, count]) => (
                          <div
                            key={domain}
                            className="flex items-center justify-between text-2xs"
                          >
                            <span className="text-muted-foreground truncate max-w-[160px]">
                              {domain}
                            </span>
                            <span className="font-medium shrink-0">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Status Breakdown */}
                {summary.affectedByStatus.size > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {Array.from(summary.affectedByStatus.entries()).map(
                      ([status, count]) => {
                        const healthStatus = nodeStatusToHealthStatus(status)
                        return (
                          <div key={status} className="flex items-center gap-1">
                            <StatusBadge
                              status={healthStatus}
                              size="sm"
                              showIcon
                              label=""
                            />
                            <span className="text-2xs text-muted-foreground">
                              {count}
                            </span>
                          </div>
                        )
                      }
                    )}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Affected Services List */}
          <Collapsible
            open={expandedSections.has("affected-services")}
            onOpenChange={() => toggleSection("affected-services")}
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-between w-full text-left py-1"
              >
                <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Affected Services ({summary.totalAffected})
                </span>
                {expandedSections.has("affected-services") ? (
                  <ChevronUp className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1 pt-1">
                {Array.from(servicesByTier.entries()).map(([tier, services]) => (
                  <div key={tier} className="space-y-0.5">
                    {/* Tier Group Header */}
                    <div className="flex items-center gap-1.5 py-0.5">
                      {tier !== "Unknown" ? (
                        <TierBadge tier={tier as CriticalityTier} size="sm" />
                      ) : (
                        <Badge variant="secondary" className="text-2xs h-3.5 px-1">
                          Unknown Tier
                        </Badge>
                      )}
                      <span className="text-2xs text-muted-foreground">
                        ({services.length})
                      </span>
                    </div>

                    {/* Service Items */}
                    {services.map((service) => (
                      <AffectedServiceItem
                        key={service.id}
                        service={service}
                        onClick={() => handleServiceClick(service.id)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Action Buttons */}
          <div className="space-y-1.5 pt-1">
            {incidentId && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1 text-xs"
                onClick={handleIncidentClick}
              >
                <AlertTriangle className="h-3 w-3" />
                View Incident Details
                <ArrowRight className="h-3 w-3 ml-auto" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-1 text-xs"
              onClick={handleViewServiceMap}
            >
              <Network className="h-3 w-3" />
              Full Service Map
              <ArrowRight className="h-3 w-3 ml-auto" />
            </Button>
          </div>
        </CardContent>
      </ScrollArea>
    </Card>
  )
}

// ============================================================
// AffectedServiceItem Component
// ============================================================

interface AffectedServiceItemProps {
  service: AffectedServiceInfo
  onClick?: () => void
}

/**
 * Individual affected service row in the blast radius panel.
 * Shows service name, type icon, status, and distance from root.
 */
function AffectedServiceItem({ service, onClick }: AffectedServiceItemProps) {
  const Icon = NODE_TYPE_ICONS[service.type] || Server
  const nodeColor = NODE_TYPE_COLORS[service.type] || "#6b7280"
  const healthStatus = nodeStatusToHealthStatus(service.status)

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 w-full rounded-md border border-red-500/15 px-2.5 py-1.5 text-left transition-colors hover:bg-red-500/5",
              onClick && "cursor-pointer"
            )}
            onClick={onClick}
          >
            <div
              className="flex h-5 w-5 items-center justify-center rounded shrink-0"
              style={{ backgroundColor: `${nodeColor}20` }}
            >
              <Icon className="h-3 w-3" style={{ color: nodeColor }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xs font-medium truncate">{service.name}</p>
              <div className="flex items-center gap-1">
                <StatusBadge status={healthStatus} size="sm" showIcon label="" />
                {service.domain && (
                  <span className="text-2xs text-muted-foreground truncate max-w-[80px]">
                    {service.domain}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <Badge variant="destructive" className="text-2xs h-3.5 px-1">
                Affected
              </Badge>
              {service.distance > 0 && (
                <span className="text-2xs text-muted-foreground">
                  {service.distance} hop{service.distance !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={4} className="max-w-xs">
          <div className="space-y-1">
            <p className="text-xs font-medium">{service.name}</p>
            <p className="text-2xs text-muted-foreground capitalize">
              Type: {service.type}
            </p>
            {service.tier && (
              <p className="text-2xs text-muted-foreground">Tier: {service.tier}</p>
            )}
            {service.domain && (
              <p className="text-2xs text-muted-foreground">Domain: {service.domain}</p>
            )}
            <p className="text-2xs text-muted-foreground">
              Distance from root: {service.distance} hop{service.distance !== 1 ? "s" : ""}
            </p>
            {service.dependencyPath.length > 1 && (
              <p className="text-2xs text-muted-foreground">
                Path: {service.dependencyPath.join(" → ")}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================
// Wrapped Export with Error Boundary
// ============================================================

export interface BlastRadiusPanelWithBoundaryProps extends BlastRadiusPanelProps {}

/**
 * BlastRadiusPanel wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function BlastRadiusPanelWithBoundary(
  props: BlastRadiusPanelWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Blast Radius Panel">
      <BlastRadiusPanel {...props} />
    </ModuleErrorBoundary>
  )
}

export default BlastRadiusPanel