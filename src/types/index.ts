// Core TypeScript type definitions for all data models
// Used across the ARE Observability Dashboard

// ============================================================
// Enums & Literal Types
// ============================================================

export type CriticalityTier = "Tier-1" | "Tier-2" | "Tier-3" | "Tier-4";

export type Environment = "Prod" | "Staging" | "QA" | "Dev";

export type IncidentSeverity = "critical" | "major" | "minor" | "warning";

export type IncidentStatus = "open" | "investigating" | "mitigated" | "resolved" | "closed";

export type MetricType =
  | "latency_p50"
  | "latency_p95"
  | "latency_p99"
  | "errors_4xx"
  | "errors_5xx"
  | "traffic_rps"
  | "saturation_cpu"
  | "saturation_memory"
  | "saturation_disk"
  | "availability";

export type MetricUnit = "ms" | "count" | "percent" | "rps" | "bytes";

export type TrendDirection = "up" | "down" | "stable";

export type RootCauseCategory =
  | "Config"
  | "Code"
  | "Infrastructure"
  | "Dependency"
  | "Capacity"
  | "Network"
  | "Security"
  | "Unknown";

export type DependencyType = "calls" | "publishes" | "subscribes" | "queries" | "depends_on";

export type EntityType = "incident" | "metric" | "service" | "deployment";

export type DataType = "incident" | "metric" | "service_map" | "deployment" | "error_budget";

export type UserRole =
  | "admin"
  | "are_lead"
  | "sre_engineer"
  | "executive"
  | "viewer"
  | "platform_engineer";

export type DeploymentStatus = "success" | "failed" | "rolled_back" | "in_progress";

export type TimePeriod = "1h" | "6h" | "12h" | "24h" | "7d" | "14d" | "30d" | "90d";

// ============================================================
// Core Domain Models
// ============================================================

export interface Domain {
  id: string;
  name: string;
  description?: string;
  owner_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  name: string;
  domain_id: string;
  domain?: Domain;
  description?: string;
  tier: CriticalityTier;
  environment: Environment;
  owner_id?: string;
  owners?: Owner[];
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  application_id: string;
  application?: Application;
  domain: string;
  tier: CriticalityTier;
  criticality: "high" | "medium" | "low";
  environment: Environment;
  owners: string[];
  description?: string;
  repository_url?: string;
  documentation_url?: string;
  health_check_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Owner {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  team?: string;
  avatar_url?: string;
}

// ============================================================
// Observability & Metrics Models
// ============================================================

export interface Metric {
  id: string;
  service_id: string;
  metric_type: MetricType;
  value: number;
  unit: MetricUnit;
  timestamp: string;
  environment?: Environment;
  tags?: Record<string, string>;
}

export interface GoldenSignals {
  service_id: string;
  service_name?: string;
  latency: {
    p50: number;
    p95: number;
    p99: number;
    unit: MetricUnit;
  };
  traffic: {
    rps: number;
    unit: MetricUnit;
  };
  errors: {
    rate_4xx: number;
    rate_5xx: number;
    total: number;
    unit: MetricUnit;
  };
  saturation: {
    cpu: number;
    memory: number;
    disk?: number;
    unit: MetricUnit;
  };
  timestamp: string;
}

export interface ErrorBudget {
  id: string;
  service_id: string;
  service_name?: string;
  period: string;
  initial: number;
  consumed: number;
  remaining: number;
  breach: boolean;
  trend: TrendDirection;
  slo_target: number;
  burn_rate?: number;
  projected_breach_date?: string | null;
  updated_at: string;
}

export interface SLO {
  id: string;
  service_id: string;
  name: string;
  description?: string;
  target: number;
  current: number;
  met: boolean;
  metric_type: MetricType;
  threshold: number;
  period: string;
  created_at: string;
  updated_at: string;
}

export interface SLACompliance {
  service_id: string;
  service_name: string;
  slo_met: boolean;
  sla_met: boolean;
  availability_pct: number;
  target_pct: number;
  period: string;
}

// ============================================================
// Incident & Root Cause Models
// ============================================================

export interface Incident {
  id: string;
  service_id: string;
  service_name?: string;
  domain?: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string | null;
  mttr?: number | null;
  mttd?: number | null;
  root_cause?: RootCauseCategory;
  root_cause_details?: string;
  repeat_failure: boolean;
  external_id?: string;
  annotations?: Annotation[];
  evidence_links?: EvidenceLink[];
  created_at: string;
  updated_at: string;
}

export interface RootCause {
  id: string;
  incident_id: string;
  category: RootCauseCategory;
  description: string;
  contributing_factors?: string[];
  corrective_actions?: string[];
  identified_by?: string;
  identified_at: string;
}

export interface IncidentCounts {
  critical: number;
  major: number;
  minor: number;
  warning: number;
  total: number;
}

export interface IncidentAnalytics {
  incident_counts: IncidentCounts;
  mttr: number;
  mttd: number;
  root_causes: Array<{ category: RootCauseCategory; count: number }>;
  repeat_failures: string[];
  trend: TrendDirection;
  period: string;
}

// ============================================================
// Deployment & Change Models
// ============================================================

export interface Deployment {
  id: string;
  service_id: string;
  service_name?: string;
  version: string;
  environment: Environment;
  status: DeploymentStatus;
  deployed_by: string;
  deployed_at: string;
  rollback_at?: string | null;
  change_ticket?: string;
  description?: string;
  has_incident: boolean;
  incident_id?: string | null;
}

export interface ChangeFailureCorrelation {
  deployment_id: string;
  incident_id: string;
  service_id: string;
  correlation_score: number;
  time_delta_minutes: number;
  deployment: Deployment;
  incident: Incident;
}

// ============================================================
// Annotation & Audit Models
// ============================================================

export interface Annotation {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  annotation: string;
  user_id: string;
  user_name?: string;
  timestamp: string;
  updated_at?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity_type: EntityType;
  entity_id: string;
  user_id: string;
  user_name?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  correlation_id?: string;
  timestamp: string;
}

export interface EvidenceLink {
  id: string;
  incident_id: string;
  url: string;
  title: string;
  type: "runbook" | "dashboard" | "log" | "trace" | "ticket" | "other";
  added_by: string;
  added_at: string;
}

// ============================================================
// Data Ingestion Models
// ============================================================

export interface InterimUploadLog {
  id: string;
  file_name: string;
  data_type: DataType;
  uploader: string;
  uploader_name?: string;
  records_ingested: number;
  records_failed?: number;
  errors?: string[];
  status: "success" | "partial" | "failed" | "processing";
  file_size_bytes?: number;
  timestamp: string;
}

// ============================================================
// Dependency & Topology Models
// ============================================================

export interface DependencyEdge {
  id: string;
  from_service: string;
  to_service: string;
  from_service_name?: string;
  to_service_name?: string;
  type: DependencyType;
  latency_ms?: number;
  error_rate?: number;
  traffic_rps?: number;
}

export interface DependencyNode {
  id: string;
  name: string;
  type: "service" | "database" | "queue" | "external" | "cache";
  tier?: CriticalityTier;
  status?: "healthy" | "degraded" | "down" | "unknown";
  domain?: string;
}

export interface DependencyMap {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  blast_radius: string[];
  incident_id?: string;
}

// ============================================================
// Configuration Models
// ============================================================

export interface MetricsConfig {
  id: string;
  source: "dynatrace" | "elastic" | "servicenow" | "manual" | "prometheus" | "datadog";
  endpoint_url: string;
  api_key_ref?: string;
  polling_interval_seconds: number;
  enabled: boolean;
  metric_types: MetricType[];
  last_sync_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentationLink {
  id: string;
  title: string;
  url: string;
  category: "runbook" | "architecture" | "sop" | "postmortem" | "sla" | "other";
  service_id?: string;
  domain_id?: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// User & Auth Models
// ============================================================

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  team?: string;
  avatar_url?: string;
  azure_ad_id?: string;
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// API Response Types
// ============================================================

export interface ApiResponse<T> {
  data: T;
  status: "success" | "error";
  message?: string;
  correlation_id?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  status: "error";
  message: string;
  errors?: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
  correlation_id: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
  has_previous: boolean;
}

// ============================================================
// Dashboard View Models
// ============================================================

export interface AvailabilitySnapshot {
  domain: string;
  tier: CriticalityTier;
  availability_pct: number;
  trend: TrendDirection;
  services_total: number;
  services_degraded: number;
}

export interface DegradedService {
  service: string;
  service_id: string;
  domain: string;
  tier: CriticalityTier;
  degradation_pct: number;
  primary_issue?: string;
}

export interface AvailabilityDashboard {
  availability: AvailabilitySnapshot[];
  top_degraded_services: DegradedService[];
  sla_slo_compliance: SLACompliance[];
  last_updated: string;
}

export interface GoldenSignalsDashboard {
  signals: Array<{
    metric: MetricType;
    value: number;
    unit: MetricUnit;
    threshold?: number;
    breached?: boolean;
  }>;
  service_id: string;
  service_name: string;
  environment: Environment;
  timestamp: string;
}

export interface ErrorBudgetDashboard {
  error_budget: ErrorBudget;
  burn_rate_history: Array<{
    timestamp: string;
    burn_rate: number;
  }>;
  recommendations?: string[];
}

// ============================================================
// Filter & Query Types
// ============================================================

export interface DashboardFilters {
  domain?: string;
  application?: string;
  service?: string;
  tier?: CriticalityTier;
  environment?: Environment;
  period?: TimePeriod;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
}

export interface MetricQuery {
  service_id: string;
  metric_types: MetricType[];
  environment?: Environment;
  start_time: string;
  end_time: string;
  granularity?: "1m" | "5m" | "15m" | "1h" | "6h" | "1d";
}

export interface IncidentQuery {
  domain?: string;
  service?: string;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  period?: TimePeriod;
  start_time?: string;
  end_time?: string;
  page?: number;
  page_size?: number;
}