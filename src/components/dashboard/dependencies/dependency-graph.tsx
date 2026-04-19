"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type NodeMouseHandler,
  Handle,
} from "reactflow"
import "reactflow/dist/style.css"
import {
  AlertTriangle,
  ArrowRight,
  Circle,
  Database,
  Globe,
  HardDrive,
  Layers,
  Maximize2,
  Minimize2,
  Network,
  RefreshCw,
  Server,
  Zap,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useDependencyMap } from "@/hooks/use-dashboard-data"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { StatusBadge, nodeStatusToHealthStatus } from "@/components/shared/status-badge"
import { TierBadge } from "@/components/shared/status-badge"
import { MetricCard, MetricCardGrid } from "@/components/shared/metric-card"
import { MetricCardGridSkeleton, ChartSkeleton } from "@/components/shared/loading-skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { ROUTES, TIER_COLORS } from "@/constants/constants"
import type {
  CriticalityTier,
  DashboardFilters,
  DependencyEdge,
  DependencyMap,
  DependencyNode,
  DependencyType,
} from "@/types"

// ============================================================
// Types
// ============================================================

export interface DependencyGraphProps {
  /** Optional incident ID to highlight blast radius */
  incidentId?: string
  /** Optional service ID to center the graph on */
  serviceId?: string
  /** Dashboard-level filters to apply */
  filters?: DashboardFilters
  /** Whether to show the summary metric cards (default: true) */
  showSummary?: boolean
  /** Whether to show the minimap (default: true) */
  showMinimap?: boolean
  /** Whether to show the controls panel (default: true) */
  showControls?: boolean
  /** Graph height in pixels (default: 500) */
  graphHeight?: number
  /** Maximum traversal depth (default: 3) */
  depth?: number
  /** Additional CSS class names */
  className?: string
}

interface ServiceNodeData {
  label: string
  nodeType: DependencyNode["type"]
  tier?: CriticalityTier
  status?: DependencyNode["status"]
  domain?: string
  isBlastRadius: boolean
  isRoot: boolean
  isSelected: boolean
}

interface DependencyEdgeData {
  edgeType: DependencyType
  latencyMs?: number
  errorRate?: number
  trafficRps?: number
}

// ============================================================
// Constants
// ============================================================

const NODE_TYPE_ICONS: Record<DependencyNode["type"], React.ElementType> = {
  service: Server,
  database: Database,
  queue: Layers,
  external: Globe,
  cache: HardDrive,
}

const NODE_TYPE_COLORS: Record<DependencyNode["type"], string> = {
  service: "#3b82f6",
  database: "#8b5cf6",
  queue: "#f59e0b",
  external: "#6b7280",
  cache: "#06b6d4",
}

const EDGE_TYPE_STYLES: Record<DependencyType, { strokeDasharray?: string; label: string }> = {
  calls: { label: "calls" },
  publishes: { strokeDasharray: "5 5", label: "publishes" },
  subscribes: { strokeDasharray: "5 5", label: "subscribes" },
  queries: { label: "queries" },
  depends_on: { strokeDasharray: "8 4", label: "depends on" },
}

const DEPTH_OPTIONS = [
  { value: "1", label: "Depth 1" },
  { value: "2", label: "Depth 2" },
  { value: "3", label: "Depth 3" },
  { value: "4", label: "Depth 4" },
  { value: "5", label: "Depth 5" },
]

// ============================================================
// Helpers
// ============================================================

/**
 * Converts DependencyNode[] and DependencyEdge[] into React Flow nodes and edges.
 */
function buildReactFlowGraph(
  dependencyMap: DependencyMap | undefined,
  selectedNodeId: string | null,
  rootServiceId?: string
): { nodes: Node<ServiceNodeData>[]; edges: Edge<DependencyEdgeData>[] } {
  if (!dependencyMap || !dependencyMap.nodes || dependencyMap.nodes.length === 0) {
    return { nodes: [], edges: [] }
  }

  const blastRadiusSet = new Set(dependencyMap.blast_radius || [])

  // Layout: simple grid-based positioning
  const nodesPerRow = Math.max(4, Math.ceil(Math.sqrt(dependencyMap.nodes.length)))
  const horizontalSpacing = 280
  const verticalSpacing = 160

  const flowNodes: Node<ServiceNodeData>[] = dependencyMap.nodes.map((node, index) => {
    const row = Math.floor(index / nodesPerRow)
    const col = index % nodesPerRow

    const isRoot = rootServiceId ? node.id === rootServiceId : false
    const isBlastRadius = blastRadiusSet.has(node.id)
    const isSelected = selectedNodeId === node.id

    return {
      id: node.id,
      type: "serviceNode",
      position: {
        x: col * horizontalSpacing + (row % 2 === 1 ? horizontalSpacing / 2 : 0),
        y: row * verticalSpacing,
      },
      data: {
        label: node.name,
        nodeType: node.type,
        tier: node.tier,
        status: node.status,
        domain: node.domain,
        isBlastRadius,
        isRoot,
        isSelected,
      },
    }
  })

  const flowEdges: Edge<DependencyEdgeData>[] = dependencyMap.edges.map((edge) => {
    const edgeStyle = EDGE_TYPE_STYLES[edge.type] || EDGE_TYPE_STYLES.calls
    const isBlastRadiusEdge =
      blastRadiusSet.has(edge.from_service) || blastRadiusSet.has(edge.to_service)

    const hasHighErrorRate = edge.error_rate != null && edge.error_rate > 0.05
    const hasHighLatency = edge.latency_ms != null && edge.latency_ms > 500

    let strokeColor = "#94a3b8"
    if (isBlastRadiusEdge) strokeColor = "#ef4444"
    else if (hasHighErrorRate) strokeColor = "#f59e0b"
    else if (hasHighLatency) strokeColor = "#f97316"

    return {
      id: edge.id,
      source: edge.from_service,
      target: edge.to_service,
      type: "smoothstep",
      animated: isBlastRadiusEdge,
      label: edgeStyle.label,
      labelStyle: { fontSize: 9, fill: "#94a3b8" },
      labelBgStyle: { fill: "hsl(var(--background))", fillOpacity: 0.8 },
      labelBgPadding: [4, 2] as [number, number],
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: strokeColor,
      },
      style: {
        stroke: strokeColor,
        strokeWidth: isBlastRadiusEdge ? 2.5 : 1.5,
        strokeDasharray: edgeStyle.strokeDasharray,
      },
      data: {
        edgeType: edge.type,
        latencyMs: edge.latency_ms,
        errorRate: edge.error_rate,
        trafficRps: edge.traffic_rps,
      },
    }
  })

  return { nodes: flowNodes, edges: flowEdges }
}

/**
 * Computes summary statistics from the dependency map.
 */
function computeGraphSummary(dependencyMap: DependencyMap | undefined): {
  totalNodes: number
  totalEdges: number
  blastRadiusCount: number
  healthyCount: number
  degradedCount: number
  downCount: number
  unknownCount: number
} {
  if (!dependencyMap) {
    return {
      totalNodes: 0,
      totalEdges: 0,
      blastRadiusCount: 0,
      healthyCount: 0,
      degradedCount: 0,
      downCount: 0,
      unknownCount: 0,
    }
  }

  const nodes = dependencyMap.nodes || []
  const edges = dependencyMap.edges || []
  const blastRadius = dependencyMap.blast_radius || []

  let healthyCount = 0
  let degradedCount = 0
  let downCount = 0
  let unknownCount = 0

  for (const node of nodes) {
    switch (node.status) {
      case "healthy":
        healthyCount++
        break
      case "degraded":
        degradedCount++
        break
      case "down":
        downCount++
        break
      default:
        unknownCount++
    }
  }

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    blastRadiusCount: blastRadius.length,
    healthyCount,
    degradedCount,
    downCount,
    unknownCount,
  }
}

// ============================================================
// ServiceNode Custom Component
// ============================================================

interface ServiceNodeComponentProps {
  data: ServiceNodeData
}

function ServiceNodeComponent({ data }: ServiceNodeComponentProps) {
  const Icon = NODE_TYPE_ICONS[data.nodeType] || Server
  const nodeColor = NODE_TYPE_COLORS[data.nodeType] || "#6b7280"
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
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-muted-foreground/50" />
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
            className="flex h-6 w-6 items-center justify-center rounded-md"
            style={{ backgroundColor: `${nodeColor}20` }}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: nodeColor }} />
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
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-muted-foreground/50" />
    </>
  )
}

const nodeTypes: NodeTypes = {
  serviceNode: ServiceNodeComponent,
}

// ============================================================
// DependencyGraph Component
// ============================================================

/**
 * Interactive service dependency graph visualization using React Flow.
 * Renders a node-edge graph of service/API dependencies with color-coded
 * health status indicators. Highlights blast radius on incident selection
 * with animated edges and affected node badges.
 *
 * Supports drill-down navigation to service detail pages and the
 * service map dashboard.
 *
 * @example
 * ```tsx
 * <DependencyGraph
 *   incidentId="inc-123"
 *   filters={{ domain: "payments" }}
 *   showSummary
 *   showMinimap
 *   graphHeight={600}
 *   depth={3}
 * />
 * ```
 */
export function DependencyGraph({
  incidentId,
  serviceId,
  filters,
  showSummary = true,
  showMinimap = true,
  showControls = true,
  graphHeight = 500,
  depth: defaultDepth = 3,
  className,
}: DependencyGraphProps) {
  const router = useRouter()

  const [depth, setDepth] = React.useState<number>(defaultDepth)
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = React.useState(false)

  const { data, isLoading, error, mutate } = useDependencyMap({
    incident_id: incidentId,
    service_id: serviceId,
    domain: filters?.domain,
    tier: filters?.tier,
    environment: filters?.environment,
    depth,
  })

  const rootServiceId = serviceId || undefined

  const { nodes: flowNodes, edges: flowEdges } = React.useMemo(
    () => buildReactFlowGraph(data, selectedNodeId, rootServiceId),
    [data, selectedNodeId, rootServiceId]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges)

  // Sync React Flow state when data changes
  React.useEffect(() => {
    setNodes(flowNodes)
    setEdges(flowEdges)
  }, [flowNodes, flowEdges, setNodes, setEdges])

  const summary = React.useMemo(() => computeGraphSummary(data), [data])

  const handleNodeClick: NodeMouseHandler = React.useCallback(
    (_event, node) => {
      setSelectedNodeId((prev) => (prev === node.id ? null : node.id))
    },
    []
  )

  const handleNodeDoubleClick: NodeMouseHandler = React.useCallback(
    (_event, node) => {
      router.push(ROUTES.SERVICE_DETAIL(node.id))
    },
    [router]
  )

  const handleDepthChange = React.useCallback((value: string) => {
    setDepth(Number(value))
  }, [])

  const handleDrillDown = React.useCallback(() => {
    router.push(ROUTES.DASHBOARD_SERVICE_MAP)
  }, [router])

  const handleToggleFullscreen = React.useCallback(() => {
    setIsFullscreen((prev) => !prev)
  }, [])

  const minimapNodeColor = React.useCallback((node: Node<ServiceNodeData>) => {
    if (node.data.isRoot) return "#3b82f6"
    if (node.data.isBlastRadius) return "#ef4444"
    const status = node.data.status
    if (status === "healthy") return "#22c55e"
    if (status === "degraded") return "#f59e0b"
    if (status === "down") return "#ef4444"
    return "#6b7280"
  }, [])

  // Error state
  if (error) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              Service Dependency Map
            </CardTitle>
            <CardDescription>
              Failed to load dependency data.
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
      <div className={cn("space-y-4", className)}>
        {showSummary && <MetricCardGridSkeleton cards={4} columns={4} />}
        <ChartSkeleton height={graphHeight} showHeader />
      </div>
    )
  }

  // Empty state
  if (!data || data.nodes.length === 0) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Service Dependency Map
            </CardTitle>
            <CardDescription>
              Interactive service topology visualization
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(depth)} onValueChange={handleDepthChange}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="Depth" />
              </SelectTrigger>
              <SelectContent>
                {DEPTH_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Network className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No dependency data available
          </p>
          <p className="text-2xs text-muted-foreground mt-1">
            Adjust your filters or check that service dependencies are configured.
          </p>
        </CardContent>
      </Card>
    )
  }

  const hasBlastRadius = summary.blastRadiusCount > 0

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary Metric Cards */}
      {showSummary && (
        <MetricCardGrid columns={4}>
          <MetricCard
            label="Total Services"
            value={summary.totalNodes}
            format="number"
            decimals={0}
            icon={<Network className="h-4 w-4" />}
            description="Total number of services in the dependency graph"
            onClick={handleDrillDown}
          />

          <MetricCard
            label="Dependencies"
            value={summary.totalEdges}
            format="number"
            decimals={0}
            icon={<Zap className="h-4 w-4" />}
            description="Total number of dependency edges between services"
          />

          <MetricCard
            label="Blast Radius"
            value={summary.blastRadiusCount}
            format="number"
            decimals={0}
            trendUpIsGood={false}
            threshold={0}
            thresholdExceededIsBad={true}
            icon={<AlertTriangle className="h-4 w-4" />}
            description="Number of services affected by the selected incident or root service failure"
          />

          <MetricCard
            label="Degraded / Down"
            value={summary.degradedCount + summary.downCount}
            format="number"
            decimals={0}
            trendUpIsGood={false}
            threshold={0}
            thresholdExceededIsBad={true}
            icon={
              <span className="text-muted-foreground text-xs font-medium">
                !
              </span>
            }
            description="Services currently in degraded or down state"
          />
        </MetricCardGrid>
      )}

      {/* Dependency Graph */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Service Dependency Map
            </CardTitle>
            <CardDescription>
              <span className="flex items-center gap-2">
                <span>
                  {summary.totalNodes} service{summary.totalNodes !== 1 ? "s" : ""},{" "}
                  {summary.totalEdges} dependenc{summary.totalEdges !== 1 ? "ies" : "y"}
                </span>
                {incidentId && (
                  <Badge variant="destructive" className="text-2xs">
                    Incident: {incidentId}
                  </Badge>
                )}
                {hasBlastRadius && (
                  <Badge variant="warning" className="text-2xs">
                    {summary.blastRadiusCount} Affected
                  </Badge>
                )}
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Depth Selector */}
            <Select value={String(depth)} onValueChange={handleDepthChange}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="Depth" />
              </SelectTrigger>
              <SelectContent>
                {DEPTH_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Fullscreen Toggle */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleToggleFullscreen}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

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
                  Refresh graph
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={handleDrillDown}
            >
              Full Map
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 px-6 pb-3">
            {/* Node Type Legend */}
            <div className="flex items-center gap-3">
              <span className="text-2xs text-muted-foreground font-medium">Nodes:</span>
              {(Object.entries(NODE_TYPE_ICONS) as Array<[DependencyNode["type"], React.ElementType]>).map(
                ([type, Icon]) => (
                  <div key={type} className="flex items-center gap-1">
                    <Icon
                      className="h-3 w-3"
                      style={{ color: NODE_TYPE_COLORS[type] }}
                    />
                    <span className="text-2xs text-muted-foreground capitalize">
                      {type}
                    </span>
                  </div>
                )
              )}
            </div>

            {/* Status Legend */}
            <div className="flex items-center gap-3">
              <span className="text-2xs text-muted-foreground font-medium">Status:</span>
              <div className="flex items-center gap-1">
                <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500" />
                <span className="text-2xs text-muted-foreground">Healthy</span>
              </div>
              <div className="flex items-center gap-1">
                <Circle className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />
                <span className="text-2xs text-muted-foreground">Degraded</span>
              </div>
              <div className="flex items-center gap-1">
                <Circle className="h-2.5 w-2.5 fill-red-500 text-red-500" />
                <span className="text-2xs text-muted-foreground">Down</span>
              </div>
            </div>

            {/* Blast Radius Legend */}
            {hasBlastRadius && (
              <div className="flex items-center gap-1">
                <div className="h-0.5 w-4 bg-red-500" />
                <span className="text-2xs text-red-600 dark:text-red-400 font-medium">
                  Blast Radius
                </span>
              </div>
            )}
          </div>

          {/* React Flow Graph */}
          <div
            style={{ height: isFullscreen ? "calc(100vh - 200px)" : graphHeight }}
            className="w-full border-t"
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={handleNodeDoubleClick}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.1}
              maxZoom={2}
              defaultEdgeOptions={{
                type: "smoothstep",
              }}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="hsl(var(--muted-foreground))" gap={20} size={1} />
              {showControls && <Controls className="!shadow-dashboard" />}
              {showMinimap && (
                <MiniMap
                  nodeColor={minimapNodeColor}
                  maskColor="hsl(var(--background) / 0.7)"
                  className="!shadow-dashboard !border !border-border !rounded-md"
                  style={{ height: 100, width: 150 }}
                />
              )}

              {/* Selected Node Info Panel */}
              {selectedNodeId && (
                <Panel position="top-right" className="!m-2">
                  <SelectedNodePanel
                    nodeId={selectedNodeId}
                    dependencyMap={data}
                    onClose={() => setSelectedNodeId(null)}
                    onNavigate={(id) => router.push(ROUTES.SERVICE_DETAIL(id))}
                  />
                </Panel>
              )}
            </ReactFlow>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-2xs text-muted-foreground">
                {summary.totalNodes} node{summary.totalNodes !== 1 ? "s" : ""},{" "}
                {summary.totalEdges} edge{summary.totalEdges !== 1 ? "s" : ""}
              </span>
              {summary.healthyCount > 0 && (
                <Badge variant="success" className="text-2xs">
                  {summary.healthyCount} healthy
                </Badge>
              )}
              {summary.degradedCount > 0 && (
                <Badge variant="warning" className="text-2xs">
                  {summary.degradedCount} degraded
                </Badge>
              )}
              {summary.downCount > 0 && (
                <Badge variant="destructive" className="text-2xs">
                  {summary.downCount} down
                </Badge>
              )}
            </div>
            <span className="text-2xs text-muted-foreground">
              Double-click a node to view service details
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// SelectedNodePanel Component
// ============================================================

interface SelectedNodePanelProps {
  nodeId: string
  dependencyMap: DependencyMap | undefined
  onClose: () => void
  onNavigate: (serviceId: string) => void
}

/**
 * Info panel displayed when a node is selected in the graph.
 * Shows node details, upstream/downstream dependencies, and navigation.
 */
function SelectedNodePanel({
  nodeId,
  dependencyMap,
  onClose,
  onNavigate,
}: SelectedNodePanelProps) {
  if (!dependencyMap) return null

  const node = dependencyMap.nodes.find((n) => n.id === nodeId)
  if (!node) return null

  const blastRadiusSet = new Set(dependencyMap.blast_radius || [])
  const isInBlastRadius = blastRadiusSet.has(nodeId)

  // Find upstream (edges where this node is the target)
  const upstream = dependencyMap.edges.filter((e) => e.to_service === nodeId)
  // Find downstream (edges where this node is the source)
  const downstream = dependencyMap.edges.filter((e) => e.from_service === nodeId)

  const healthStatus = nodeStatusToHealthStatus(node.status)
  const Icon = NODE_TYPE_ICONS[node.type] || Server

  return (
    <Card className="w-64 shadow-dashboard-md">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-3 px-3">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-md shrink-0"
            style={{ backgroundColor: `${NODE_TYPE_COLORS[node.type]}20` }}
          >
            <Icon
              className="h-4 w-4"
              style={{ color: NODE_TYPE_COLORS[node.type] }}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{node.name}</p>
            <p className="text-2xs text-muted-foreground capitalize">{node.type}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onClose}
        >
          <span className="text-xs">✕</span>
        </Button>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 space-y-2">
        {/* Status & Tier */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={healthStatus} size="sm" />
          {node.tier && <TierBadge tier={node.tier} size="sm" />}
          {isInBlastRadius && (
            <Badge variant="destructive" className="text-2xs">
              In Blast Radius
            </Badge>
          )}
        </div>

        {/* Domain */}
        {node.domain && (
          <div className="flex items-center gap-1">
            <span className="text-2xs text-muted-foreground">Domain:</span>
            <span className="text-2xs font-medium">{node.domain}</span>
          </div>
        )}

        {/* Upstream Dependencies */}
        {upstream.length > 0 && (
          <div>
            <span className="text-2xs text-muted-foreground font-medium">
              Upstream ({upstream.length}):
            </span>
            <div className="mt-1 space-y-0.5">
              {upstream.slice(0, 5).map((edge) => (
                <button
                  key={edge.id}
                  type="button"
                  className="flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
                  onClick={() => onNavigate(edge.from_service)}
                >
                  <ArrowRight className="h-2.5 w-2.5 rotate-180 shrink-0" />
                  <span className="truncate">
                    {edge.from_service_name || edge.from_service}
                  </span>
                  <span className="text-muted-foreground/60 shrink-0">
                    ({edge.type})
                  </span>
                </button>
              ))}
              {upstream.length > 5 && (
                <span className="text-2xs text-muted-foreground">
                  +{upstream.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Downstream Dependencies */}
        {downstream.length > 0 && (
          <div>
            <span className="text-2xs text-muted-foreground font-medium">
              Downstream ({downstream.length}):
            </span>
            <div className="mt-1 space-y-0.5">
              {downstream.slice(0, 5).map((edge) => (
                <button
                  key={edge.id}
                  type="button"
                  className="flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
                  onClick={() => onNavigate(edge.to_service)}
                >
                  <ArrowRight className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">
                    {edge.to_service_name || edge.to_service}
                  </span>
                  <span className="text-muted-foreground/60 shrink-0">
                    ({edge.type})
                  </span>
                </button>
              ))}
              {downstream.length > 5 && (
                <span className="text-2xs text-muted-foreground">
                  +{downstream.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Navigate Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1 text-xs mt-1"
          onClick={() => onNavigate(nodeId)}
        >
          View Service Details
          <ArrowRight className="h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Wrapped Export with Error Boundary
// ============================================================

export interface DependencyGraphWithBoundaryProps
  extends DependencyGraphProps {}

/**
 * DependencyGraph wrapped with a module-level error boundary.
 * Use this export for safe rendering in dashboard layouts.
 */
export function DependencyGraphWithBoundary(
  props: DependencyGraphWithBoundaryProps
) {
  return (
    <ModuleErrorBoundary moduleName="Service Dependency Map">
      <DependencyGraph {...props} />
    </ModuleErrorBoundary>
  )
}

export default DependencyGraph