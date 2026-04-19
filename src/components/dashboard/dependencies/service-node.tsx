"use client"

import * as React from "react"
import { Handle, Position, type NodeProps } from "reactflow"

import { cn } from "@/lib/utils"
import { StatusBadge, nodeStatusToHealthStatus } from "@/components/shared/status-badge"
import { TierBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import type { CriticalityTier } from "@/types"

// ============================================================
// Types
// ============================================================

export interface ServiceNodeData {
  label: string
  nodeType: "service" | "database" | "queue" | "external" | "cache"
  tier?: CriticalityTier
  status?: "healthy" | "degraded" | "down" | "unknown"
  domain?: string
  isBlastRadius: boolean
  isRoot: boolean
  isSelected: boolean
}

// ============================================================
// Constants
// ============================================================

const NODE_TYPE_ICONS: Record<ServiceNodeData["nodeType"], string> = {
  service: "🖥",
  database: "🗄",
  queue: "📋",
  external: "🌐",
  cache: "⚡",
}

const NODE_TYPE_COLORS: Record<ServiceNodeData["nodeType"], string> = {
  service: "#3b82f6",
  database: "#8b5cf6",
  queue: "#f59e0b",
  external: "#6b7280",
  cache: "#06b6d4",
}

// ============================================================
// ServiceNode Component
// ============================================================

/**
 * Custom React Flow node component for services in the dependency map.
 * Displays service name, type icon, tier badge, health status indicator,
 * and visual markers for blast radius and root service identification.
 *
 * Supports selection highlighting and click interaction for the details panel.
 *
 * @example
 * ```tsx
 * // Used as a custom node type in React Flow:
 * const nodeTypes = { serviceNode: ServiceNode };
 *
 * <ReactFlow nodes={nodes} nodeTypes={nodeTypes} />
 * ```
 */
function ServiceNode({ data }: NodeProps<ServiceNodeData>) {
  const nodeColor = NODE_TYPE_COLORS[data.nodeType] || "#6b7280"
  const nodeIcon = NODE_TYPE_ICONS[data.nodeType] || "🖥"
  const healthStatus = nodeStatusToHealthStatus(data.status)

  const borderColor = data.isRoot
    ? "border-blue-500"
    : data.isBlastRadius
      ? "border-red-500"
      : data.isSelected
        ? "border-primary"
        : healthStatus === "critical"
          ? "border-red-500/50"
          : healthStatus === "degraded"
            ? "border-yellow-500/50"
            : "border-border"

  const bgColor = data.isBlastRadius
    ? "bg-red-500/5"
    : data.isRoot
      ? "bg-blue-500/5"
      : "bg-card"

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-muted-foreground/50"
      />
      <div
        className={cn(
          "flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-2 shadow-dashboard transition-all min-w-[120px] max-w-[180px]",
          borderColor,
          bgColor
        )}
      >
        {/* Node Icon & Type */}
        <div className="flex items-center gap-1.5">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-md text-xs"
            style={{ backgroundColor: `${nodeColor}20` }}
          >
            <span style={{ color: nodeColor }}>{nodeIcon}</span>
          </div>
          {data.tier && <TierBadge tier={data.tier} size="sm" />}
        </div>

        {/* Node Name */}
        <span className="text-2xs font-medium text-foreground text-center leading-tight truncate w-full">
          {data.label}
        </span>

        {/* Status & Domain */}
        <div className="flex items-center gap-1">
          <StatusBadge status={healthStatus} size="sm" showIcon label="" />
          {data.domain && (
            <span className="text-2xs text-muted-foreground truncate max-w-[80px]">
              {data.domain}
            </span>
          )}
        </div>

        {/* Blast Radius / Root Indicator */}
        {data.isRoot && (
          <Badge variant="info" className="text-2xs h-3.5 px-1">
            Root
          </Badge>
        )}
        {data.isBlastRadius && !data.isRoot && (
          <Badge variant="destructive" className="text-2xs h-3.5 px-1">
            Affected
          </Badge>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-muted-foreground/50"
      />
    </>
  )
}

export default ServiceNode

export { ServiceNode }

export type { ServiceNodeData as ServiceNodeDataType }