import { createServerClient } from "@/lib/supabase";
import type {
  CriticalityTier,
  DependencyEdge,
  DependencyMap,
  DependencyNode,
  DependencyType,
  Environment,
} from "@/types";

// ============================================================
// Types
// ============================================================

export interface DependencyMapQueryParams {
  incident_id?: string;
  service_id?: string;
  domain?: string;
  tier?: CriticalityTier;
  environment?: Environment;
  depth?: number;
}

export interface DependencyGraphResult {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  blast_radius: string[];
  incident_id?: string;
  root_service_id?: string;
  depth: number;
  total_nodes: number;
  total_edges: number;
}

export interface BlastRadiusResult {
  affected_services: Array<{
    service_id: string;
    service_name: string;
    tier?: CriticalityTier;
    domain?: string;
    distance: number;
    dependency_path: string[];
  }>;
  total_affected: number;
  critical_services_affected: number;
  blast_radius_ids: string[];
}

export interface ServiceNeighbors {
  upstream: DependencyEdge[];
  downstream: DependencyEdge[];
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_TRAVERSAL_DEPTH = 3;
const MAX_TRAVERSAL_DEPTH = 10;

// ============================================================
// Helper Functions
// ============================================================

/**
 * Clamps the traversal depth to a safe range.
 */
function clampDepth(depth?: number): number {
  if (!depth || depth < 1) return DEFAULT_TRAVERSAL_DEPTH;
  return Math.min(depth, MAX_TRAVERSAL_DEPTH);
}

/**
 * Builds a node lookup map from an array of dependency nodes.
 */
function buildNodeMap(nodes: DependencyNode[]): Map<string, DependencyNode> {
  const map = new Map<string, DependencyNode>();
  for (const node of nodes) {
    map.set(node.id, node);
  }
  return map;
}

/**
 * Builds adjacency lists (outgoing and incoming) from edges.
 */
function buildAdjacencyLists(edges: DependencyEdge[]): {
  outgoing: Map<string, DependencyEdge[]>;
  incoming: Map<string, DependencyEdge[]>;
} {
  const outgoing = new Map<string, DependencyEdge[]>();
  const incoming = new Map<string, DependencyEdge[]>();

  for (const edge of edges) {
    if (!outgoing.has(edge.from_service)) {
      outgoing.set(edge.from_service, []);
    }
    outgoing.get(edge.from_service)!.push(edge);

    if (!incoming.has(edge.to_service)) {
      incoming.set(edge.to_service, []);
    }
    incoming.get(edge.to_service)!.push(edge);
  }

  return { outgoing, incoming };
}

// ============================================================
// DependencyMapService
// ============================================================

/**
 * Fetches all dependency nodes from the database, optionally filtered by domain or tier.
 *
 * @param params - Optional filter parameters
 * @returns Array of dependency nodes
 */
export async function fetchDependencyNodes(
  params?: Pick<DependencyMapQueryParams, "domain" | "tier">
): Promise<DependencyNode[]> {
  const supabase = createServerClient();

  let query = supabase.from("dependency_nodes").select("*");

  if (params?.domain) {
    query = query.eq("domain", params.domain);
  }

  if (params?.tier) {
    query = query.eq("tier", params.tier);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching dependency nodes:", error);
    throw new Error(`Failed to fetch dependency nodes: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type as DependencyNode["type"],
    tier: (row.tier as CriticalityTier) || undefined,
    status: (row.status as DependencyNode["status"]) || undefined,
    domain: row.domain || undefined,
  }));
}

/**
 * Fetches all dependency edges from the database.
 * Optionally filters to edges involving a specific set of node IDs.
 *
 * @param nodeIds - Optional set of node IDs to filter edges by
 * @returns Array of dependency edges
 */
export async function fetchDependencyEdges(
  nodeIds?: string[]
): Promise<DependencyEdge[]> {
  const supabase = createServerClient();

  let query = supabase.from("dependency_edges").select("*");

  // If nodeIds are provided and not too many, filter edges to relevant nodes
  if (nodeIds && nodeIds.length > 0 && nodeIds.length <= 200) {
    // Fetch edges where either from_service or to_service is in the set
    const { data: fromEdges, error: fromError } = await supabase
      .from("dependency_edges")
      .select("*")
      .in("from_service", nodeIds);

    if (fromError) {
      console.error("Error fetching dependency edges (from):", fromError);
      throw new Error(
        `Failed to fetch dependency edges: ${fromError.message}`
      );
    }

    const { data: toEdges, error: toError } = await supabase
      .from("dependency_edges")
      .select("*")
      .in("to_service", nodeIds);

    if (toError) {
      console.error("Error fetching dependency edges (to):", toError);
      throw new Error(
        `Failed to fetch dependency edges: ${toError.message}`
      );
    }

    // Deduplicate edges by ID
    const edgeMap = new Map<string, DependencyEdge>();
    for (const row of [...(fromEdges || []), ...(toEdges || [])]) {
      if (!edgeMap.has(row.id)) {
        edgeMap.set(row.id, mapEdgeRow(row));
      }
    }

    return Array.from(edgeMap.values());
  }

  // Fetch all edges
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching dependency edges:", error);
    throw new Error(`Failed to fetch dependency edges: ${error.message}`);
  }

  return (data || []).map(mapEdgeRow);
}

/**
 * Maps a raw database row to a DependencyEdge type.
 */
function mapEdgeRow(row: {
  id: string;
  from_service: string;
  to_service: string;
  from_service_name: string | null;
  to_service_name: string | null;
  type: string;
  latency_ms: number | null;
  error_rate: number | null;
  traffic_rps: number | null;
}): DependencyEdge {
  return {
    id: row.id,
    from_service: row.from_service,
    to_service: row.to_service,
    from_service_name: row.from_service_name || undefined,
    to_service_name: row.to_service_name || undefined,
    type: row.type as DependencyType,
    latency_ms: row.latency_ms || undefined,
    error_rate: row.error_rate || undefined,
    traffic_rps: row.traffic_rps || undefined,
  };
}

/**
 * Builds the complete dependency graph for visualization.
 * Supports filtering by domain, tier, or scoping to a specific service or incident.
 *
 * @param params - Query parameters for the dependency map
 * @returns Dependency graph result with nodes, edges, and blast radius
 */
export async function buildDependencyGraph(
  params: DependencyMapQueryParams
): Promise<DependencyGraphResult> {
  const depth = clampDepth(params.depth);

  // If an incident is specified, scope the graph to the incident's service
  let rootServiceId = params.service_id;

  if (params.incident_id && !rootServiceId) {
    rootServiceId = await getServiceIdFromIncident(params.incident_id);
  }

  // Fetch all nodes (with optional domain/tier filter)
  const allNodes = await fetchDependencyNodes({
    domain: params.domain,
    tier: params.tier,
  });

  // Fetch all edges
  const allEdges = await fetchDependencyEdges();

  // If we have a root service, compute a subgraph around it
  if (rootServiceId) {
    const subgraph = extractSubgraph(
      rootServiceId,
      allNodes,
      allEdges,
      depth
    );

    // Compute blast radius from the root service
    const blastRadiusIds = computeBlastRadiusIds(
      rootServiceId,
      allEdges,
      depth
    );

    return {
      nodes: subgraph.nodes,
      edges: subgraph.edges,
      blast_radius: blastRadiusIds,
      incident_id: params.incident_id,
      root_service_id: rootServiceId,
      depth,
      total_nodes: subgraph.nodes.length,
      total_edges: subgraph.edges.length,
    };
  }

  // No root service — return the full graph
  return {
    nodes: allNodes,
    edges: allEdges,
    blast_radius: [],
    incident_id: params.incident_id,
    root_service_id: undefined,
    depth,
    total_nodes: allNodes.length,
    total_edges: allEdges.length,
  };
}

/**
 * Extracts a subgraph centered on a root service, traversing up to `depth` hops
 * in both upstream and downstream directions.
 *
 * @param rootServiceId - The service to center the subgraph on
 * @param allNodes - All available nodes
 * @param allEdges - All available edges
 * @param depth - Maximum traversal depth
 * @returns Subgraph containing only reachable nodes and edges
 */
function extractSubgraph(
  rootServiceId: string,
  allNodes: DependencyNode[],
  allEdges: DependencyEdge[],
  depth: number
): { nodes: DependencyNode[]; edges: DependencyEdge[] } {
  const { outgoing, incoming } = buildAdjacencyLists(allEdges);
  const visitedNodeIds = new Set<string>();
  const relevantEdgeIds = new Set<string>();

  // BFS traversal in both directions
  const queue: Array<{ nodeId: string; currentDepth: number }> = [
    { nodeId: rootServiceId, currentDepth: 0 },
  ];
  visitedNodeIds.add(rootServiceId);

  while (queue.length > 0) {
    const { nodeId, currentDepth } = queue.shift()!;

    if (currentDepth >= depth) {
      continue;
    }

    // Traverse outgoing edges (downstream dependencies)
    const outEdges = outgoing.get(nodeId) || [];
    for (const edge of outEdges) {
      relevantEdgeIds.add(edge.id);
      if (!visitedNodeIds.has(edge.to_service)) {
        visitedNodeIds.add(edge.to_service);
        queue.push({
          nodeId: edge.to_service,
          currentDepth: currentDepth + 1,
        });
      }
    }

    // Traverse incoming edges (upstream dependencies)
    const inEdges = incoming.get(nodeId) || [];
    for (const edge of inEdges) {
      relevantEdgeIds.add(edge.id);
      if (!visitedNodeIds.has(edge.from_service)) {
        visitedNodeIds.add(edge.from_service);
        queue.push({
          nodeId: edge.from_service,
          currentDepth: currentDepth + 1,
        });
      }
    }
  }

  const nodeMap = buildNodeMap(allNodes);

  // Collect nodes that were visited and exist in the node set
  const subgraphNodes: DependencyNode[] = [];
  for (const nodeId of visitedNodeIds) {
    const node = nodeMap.get(nodeId);
    if (node) {
      subgraphNodes.push(node);
    } else {
      // Create a placeholder node for services referenced in edges but not in nodes table
      subgraphNodes.push({
        id: nodeId,
        name: nodeId,
        type: "service",
        status: "unknown",
      });
    }
  }

  // Collect relevant edges
  const subgraphEdges = allEdges.filter((edge) =>
    relevantEdgeIds.has(edge.id)
  );

  return {
    nodes: subgraphNodes,
    edges: subgraphEdges,
  };
}

/**
 * Computes the blast radius for a given service by traversing downstream
 * dependencies (outgoing edges only). Returns the IDs of all services
 * that would be affected if the root service fails.
 *
 * @param rootServiceId - The failing service
 * @param allEdges - All dependency edges
 * @param depth - Maximum traversal depth
 * @returns Array of affected service IDs (excluding the root service)
 */
function computeBlastRadiusIds(
  rootServiceId: string,
  allEdges: DependencyEdge[],
  depth: number
): string[] {
  const { incoming } = buildAdjacencyLists(allEdges);
  const visited = new Set<string>();
  visited.add(rootServiceId);

  // BFS: traverse services that depend ON the root service (incoming edges)
  // i.e., services that call/depend_on the root service
  const queue: Array<{ nodeId: string; currentDepth: number }> = [
    { nodeId: rootServiceId, currentDepth: 0 },
  ];

  while (queue.length > 0) {
    const { nodeId, currentDepth } = queue.shift()!;

    if (currentDepth >= depth) {
      continue;
    }

    // Find services that depend on this node (incoming edges = services calling this node)
    const dependents = incoming.get(nodeId) || [];
    for (const edge of dependents) {
      if (!visited.has(edge.from_service)) {
        visited.add(edge.from_service);
        queue.push({
          nodeId: edge.from_service,
          currentDepth: currentDepth + 1,
        });
      }
    }
  }

  // Remove the root service from the blast radius
  visited.delete(rootServiceId);
  return Array.from(visited);
}

/**
 * Computes detailed blast radius information for a service, including
 * affected service metadata, distance, and dependency paths.
 *
 * @param serviceId - The service to compute blast radius for
 * @param depth - Maximum traversal depth
 * @returns Detailed blast radius result
 */
export async function computeBlastRadius(
  serviceId: string,
  depth?: number
): Promise<BlastRadiusResult> {
  const maxDepth = clampDepth(depth);
  const allEdges = await fetchDependencyEdges();
  const allNodes = await fetchDependencyNodes();
  const nodeMap = buildNodeMap(allNodes);

  const { incoming } = buildAdjacencyLists(allEdges);

  // BFS with path tracking
  const visited = new Map<
    string,
    { distance: number; path: string[] }
  >();
  visited.set(serviceId, { distance: 0, path: [serviceId] });

  const queue: Array<{
    nodeId: string;
    currentDepth: number;
    path: string[];
  }> = [{ nodeId: serviceId, currentDepth: 0, path: [serviceId] }];

  while (queue.length > 0) {
    const { nodeId, currentDepth, path } = queue.shift()!;

    if (currentDepth >= maxDepth) {
      continue;
    }

    const dependents = incoming.get(nodeId) || [];
    for (const edge of dependents) {
      if (!visited.has(edge.from_service)) {
        const newPath = [...path, edge.from_service];
        visited.set(edge.from_service, {
          distance: currentDepth + 1,
          path: newPath,
        });
        queue.push({
          nodeId: edge.from_service,
          currentDepth: currentDepth + 1,
          path: newPath,
        });
      }
    }
  }

  // Remove the root service
  visited.delete(serviceId);

  // Build affected services list
  const affectedServices = Array.from(visited.entries())
    .map(([id, info]) => {
      const node = nodeMap.get(id);
      return {
        service_id: id,
        service_name: node?.name || id,
        tier: node?.tier,
        domain: node?.domain,
        distance: info.distance,
        dependency_path: info.path,
      };
    })
    .sort((a, b) => a.distance - b.distance);

  const criticalServicesAffected = affectedServices.filter(
    (s) => s.tier === "Tier-1" || s.tier === "Tier-2"
  ).length;

  return {
    affected_services: affectedServices,
    total_affected: affectedServices.length,
    critical_services_affected: criticalServicesAffected,
    blast_radius_ids: affectedServices.map((s) => s.service_id),
  };
}

/**
 * Retrieves the upstream and downstream neighbors for a specific service.
 *
 * @param serviceId - The service to get neighbors for
 * @returns Upstream and downstream dependency edges
 */
export async function getServiceNeighbors(
  serviceId: string
): Promise<ServiceNeighbors> {
  const supabase = createServerClient();

  // Fetch downstream edges (this service calls others)
  const { data: downstreamData, error: downstreamError } = await supabase
    .from("dependency_edges")
    .select("*")
    .eq("from_service", serviceId);

  if (downstreamError) {
    console.error("Error fetching downstream edges:", downstreamError);
    throw new Error(
      `Failed to fetch downstream edges: ${downstreamError.message}`
    );
  }

  // Fetch upstream edges (others call this service)
  const { data: upstreamData, error: upstreamError } = await supabase
    .from("dependency_edges")
    .select("*")
    .eq("to_service", serviceId);

  if (upstreamError) {
    console.error("Error fetching upstream edges:", upstreamError);
    throw new Error(
      `Failed to fetch upstream edges: ${upstreamError.message}`
    );
  }

  return {
    upstream: (upstreamData || []).map(mapEdgeRow),
    downstream: (downstreamData || []).map(mapEdgeRow),
  };
}

/**
 * Builds a DependencyMap for a specific incident by looking up the
 * incident's service and computing the dependency graph and blast radius.
 *
 * @param incidentId - The incident ID to build the map for
 * @param depth - Maximum traversal depth
 * @returns DependencyMap with nodes, edges, and blast radius
 */
export async function buildDependencyMapForIncident(
  incidentId: string,
  depth?: number
): Promise<DependencyMap> {
  const serviceId = await getServiceIdFromIncident(incidentId);

  if (!serviceId) {
    return {
      nodes: [],
      edges: [],
      blast_radius: [],
      incident_id: incidentId,
    };
  }

  const graphResult = await buildDependencyGraph({
    incident_id: incidentId,
    service_id: serviceId,
    depth,
  });

  return {
    nodes: graphResult.nodes,
    edges: graphResult.edges,
    blast_radius: graphResult.blast_radius,
    incident_id: incidentId,
  };
}

/**
 * Looks up the service_id associated with an incident.
 *
 * @param incidentId - The incident ID
 * @returns The service ID or null if not found
 */
async function getServiceIdFromIncident(
  incidentId: string
): Promise<string | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("incidents")
    .select("service_id")
    .eq("id", incidentId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows found
      return null;
    }
    console.error("Error fetching incident for dependency map:", error);
    throw new Error(
      `Failed to fetch incident: ${error.message}`
    );
  }

  return data?.service_id || null;
}

/**
 * Computes a summary of the dependency graph topology.
 * Useful for dashboard overview cards.
 *
 * @param params - Optional filter parameters
 * @returns Summary statistics about the dependency graph
 */
export async function getDependencyGraphSummary(
  params?: Pick<DependencyMapQueryParams, "domain" | "tier">
): Promise<{
  total_nodes: number;
  total_edges: number;
  node_types: Record<string, number>;
  edge_types: Record<string, number>;
  nodes_by_status: Record<string, number>;
  avg_latency_ms: number;
  avg_error_rate: number;
}> {
  const nodes = await fetchDependencyNodes(params);
  const allEdges = await fetchDependencyEdges();

  // Filter edges to only include those involving fetched nodes
  const nodeIdSet = new Set(nodes.map((n) => n.id));
  const edges = allEdges.filter(
    (e) => nodeIdSet.has(e.from_service) || nodeIdSet.has(e.to_service)
  );

  // Count node types
  const nodeTypes: Record<string, number> = {};
  const nodesByStatus: Record<string, number> = {};

  for (const node of nodes) {
    nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
    const status = node.status || "unknown";
    nodesByStatus[status] = (nodesByStatus[status] || 0) + 1;
  }

  // Count edge types and compute averages
  const edgeTypes: Record<string, number> = {};
  const latencies: number[] = [];
  const errorRates: number[] = [];

  for (const edge of edges) {
    edgeTypes[edge.type] = (edgeTypes[edge.type] || 0) + 1;
    if (edge.latency_ms != null) {
      latencies.push(edge.latency_ms);
    }
    if (edge.error_rate != null) {
      errorRates.push(edge.error_rate);
    }
  }

  const avgLatency =
    latencies.length > 0
      ? Math.round(
          (latencies.reduce((sum, v) => sum + v, 0) / latencies.length) * 100
        ) / 100
      : 0;

  const avgErrorRate =
    errorRates.length > 0
      ? Math.round(
          (errorRates.reduce((sum, v) => sum + v, 0) / errorRates.length) *
            10000
        ) / 10000
      : 0;

  return {
    total_nodes: nodes.length,
    total_edges: edges.length,
    node_types: nodeTypes,
    edge_types: edgeTypes,
    nodes_by_status: nodesByStatus,
    avg_latency_ms: avgLatency,
    avg_error_rate: avgErrorRate,
  };
}