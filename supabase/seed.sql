-- ============================================================
-- ARE Observability Dashboard — Supabase Seed Script
-- ============================================================
-- Creates all tables, indexes, and RLS policies required by the
-- ARE Observability Dashboard application.
--
-- Tables:
--   users, domains, applications, services, metrics, incidents,
--   deployments, error_budgets, annotations, audit_logs,
--   dependency_nodes, dependency_edges, metrics_config,
--   documentation_links, upload_logs, evidence_links
--
-- Run this script against your Supabase project via the SQL editor
-- or the Supabase CLI: supabase db reset
-- ============================================================

-- ============================================================
-- Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Table: users
-- ============================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('admin', 'are_lead', 'sre_engineer', 'executive', 'viewer', 'platform_engineer')),
  team TEXT,
  avatar_url TEXT,
  azure_ad_id TEXT UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);
CREATE INDEX IF NOT EXISTS idx_users_azure_ad_id ON public.users (azure_ad_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users (is_active);

-- ============================================================
-- Table: domains
-- ============================================================

CREATE TABLE IF NOT EXISTS public.domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_domains_name ON public.domains (name);
CREATE INDEX IF NOT EXISTS idx_domains_owner_id ON public.domains (owner_id);

-- ============================================================
-- Table: applications
-- ============================================================

CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  domain_id UUID NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  description TEXT,
  tier TEXT NOT NULL DEFAULT 'Tier-3'
    CHECK (tier IN ('Tier-1', 'Tier-2', 'Tier-3', 'Tier-4')),
  environment TEXT NOT NULL DEFAULT 'Prod'
    CHECK (environment IN ('Prod', 'Staging', 'QA', 'Dev')),
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_applications_domain_id ON public.applications (domain_id);
CREATE INDEX IF NOT EXISTS idx_applications_tier ON public.applications (tier);
CREATE INDEX IF NOT EXISTS idx_applications_environment ON public.applications (environment);
CREATE INDEX IF NOT EXISTS idx_applications_name ON public.applications (name);

-- ============================================================
-- Table: services
-- ============================================================

CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  domain TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'Tier-3'
    CHECK (tier IN ('Tier-1', 'Tier-2', 'Tier-3', 'Tier-4')),
  criticality TEXT NOT NULL DEFAULT 'medium'
    CHECK (criticality IN ('high', 'medium', 'low')),
  environment TEXT NOT NULL DEFAULT 'Prod'
    CHECK (environment IN ('Prod', 'Staging', 'QA', 'Dev')),
  owners TEXT[] DEFAULT '{}',
  description TEXT,
  repository_url TEXT,
  documentation_url TEXT,
  health_check_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_domain ON public.services (domain);
CREATE INDEX IF NOT EXISTS idx_services_tier ON public.services (tier);
CREATE INDEX IF NOT EXISTS idx_services_environment ON public.services (environment);
CREATE INDEX IF NOT EXISTS idx_services_application_id ON public.services (application_id);
CREATE INDEX IF NOT EXISTS idx_services_name ON public.services (name);
CREATE INDEX IF NOT EXISTS idx_services_criticality ON public.services (criticality);

-- ============================================================
-- Table: metrics
-- ============================================================

CREATE TABLE IF NOT EXISTS public.metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL
    CHECK (metric_type IN (
      'latency_p50', 'latency_p95', 'latency_p99',
      'errors_4xx', 'errors_5xx',
      'traffic_rps',
      'saturation_cpu', 'saturation_memory', 'saturation_disk',
      'availability'
    )),
  value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL DEFAULT 'count'
    CHECK (unit IN ('ms', 'count', 'percent', 'rps', 'bytes')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  environment TEXT
    CHECK (environment IS NULL OR environment IN ('Prod', 'Staging', 'QA', 'Dev')),
  tags JSONB
);

CREATE INDEX IF NOT EXISTS idx_metrics_service_id ON public.metrics (service_id);
CREATE INDEX IF NOT EXISTS idx_metrics_metric_type ON public.metrics (metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON public.metrics (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_service_type_ts ON public.metrics (service_id, metric_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_environment ON public.metrics (environment);

-- ============================================================
-- Table: incidents
-- ============================================================

CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  service_name TEXT,
  domain TEXT,
  severity TEXT NOT NULL
    CHECK (severity IN ('critical', 'major', 'minor', 'warning')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'mitigated', 'resolved', 'closed')),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  mttr DOUBLE PRECISION,
  mttd DOUBLE PRECISION,
  root_cause TEXT
    CHECK (root_cause IS NULL OR root_cause IN (
      'Config', 'Code', 'Infrastructure', 'Dependency',
      'Capacity', 'Network', 'Security', 'Unknown'
    )),
  root_cause_details TEXT,
  repeat_failure BOOLEAN NOT NULL DEFAULT false,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_service_id ON public.incidents (service_id);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON public.incidents (severity);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents (status);
CREATE INDEX IF NOT EXISTS idx_incidents_start_time ON public.incidents (start_time DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_domain ON public.incidents (domain);
CREATE INDEX IF NOT EXISTS idx_incidents_repeat_failure ON public.incidents (repeat_failure);
CREATE INDEX IF NOT EXISTS idx_incidents_root_cause ON public.incidents (root_cause);
CREATE INDEX IF NOT EXISTS idx_incidents_external_id ON public.incidents (external_id);

-- ============================================================
-- Table: deployments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  service_name TEXT,
  version TEXT NOT NULL,
  environment TEXT NOT NULL
    CHECK (environment IN ('Prod', 'Staging', 'QA', 'Dev')),
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('success', 'failed', 'rolled_back', 'in_progress')),
  deployed_by TEXT NOT NULL,
  deployed_at TIMESTAMPTZ NOT NULL,
  rollback_at TIMESTAMPTZ,
  change_ticket TEXT,
  description TEXT,
  has_incident BOOLEAN NOT NULL DEFAULT false,
  incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deployments_service_id ON public.deployments (service_id);
CREATE INDEX IF NOT EXISTS idx_deployments_deployed_at ON public.deployments (deployed_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON public.deployments (status);
CREATE INDEX IF NOT EXISTS idx_deployments_environment ON public.deployments (environment);
CREATE INDEX IF NOT EXISTS idx_deployments_has_incident ON public.deployments (has_incident);
CREATE INDEX IF NOT EXISTS idx_deployments_incident_id ON public.deployments (incident_id);

-- ============================================================
-- Table: error_budgets
-- ============================================================

CREATE TABLE IF NOT EXISTS public.error_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  service_name TEXT,
  period TEXT NOT NULL,
  initial DOUBLE PRECISION NOT NULL,
  consumed DOUBLE PRECISION NOT NULL,
  remaining DOUBLE PRECISION NOT NULL,
  breach BOOLEAN NOT NULL DEFAULT false,
  trend TEXT NOT NULL DEFAULT 'stable'
    CHECK (trend IN ('up', 'down', 'stable')),
  slo_target DOUBLE PRECISION NOT NULL,
  burn_rate DOUBLE PRECISION,
  projected_breach_date TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_budgets_service_id ON public.error_budgets (service_id);
CREATE INDEX IF NOT EXISTS idx_error_budgets_breach ON public.error_budgets (breach);
CREATE INDEX IF NOT EXISTS idx_error_budgets_updated_at ON public.error_budgets (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_budgets_period ON public.error_budgets (period);

-- ============================================================
-- Table: annotations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('incident', 'metric', 'service', 'deployment')),
  entity_id TEXT NOT NULL,
  annotation TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_annotations_entity ON public.annotations (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_annotations_user_id ON public.annotations (user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_timestamp ON public.annotations (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_annotations_entity_type ON public.annotations (entity_type);

-- ============================================================
-- Table: audit_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('incident', 'metric', 'service', 'deployment')),
  entity_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  details JSONB,
  ip_address TEXT,
  correlation_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id ON public.audit_logs (correlation_id);

-- ============================================================
-- Table: dependency_nodes
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dependency_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'service'
    CHECK (type IN ('service', 'database', 'queue', 'external', 'cache')),
  tier TEXT
    CHECK (tier IS NULL OR tier IN ('Tier-1', 'Tier-2', 'Tier-3', 'Tier-4')),
  status TEXT DEFAULT 'unknown'
    CHECK (status IS NULL OR status IN ('healthy', 'degraded', 'down', 'unknown')),
  domain TEXT
);

CREATE INDEX IF NOT EXISTS idx_dependency_nodes_type ON public.dependency_nodes (type);
CREATE INDEX IF NOT EXISTS idx_dependency_nodes_domain ON public.dependency_nodes (domain);
CREATE INDEX IF NOT EXISTS idx_dependency_nodes_tier ON public.dependency_nodes (tier);
CREATE INDEX IF NOT EXISTS idx_dependency_nodes_status ON public.dependency_nodes (status);
CREATE INDEX IF NOT EXISTS idx_dependency_nodes_name ON public.dependency_nodes (name);

-- ============================================================
-- Table: dependency_edges
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dependency_edges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_service TEXT NOT NULL,
  to_service TEXT NOT NULL,
  from_service_name TEXT,
  to_service_name TEXT,
  type TEXT NOT NULL DEFAULT 'calls'
    CHECK (type IN ('calls', 'publishes', 'subscribes', 'queries', 'depends_on')),
  latency_ms DOUBLE PRECISION,
  error_rate DOUBLE PRECISION,
  traffic_rps DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_dependency_edges_from ON public.dependency_edges (from_service);
CREATE INDEX IF NOT EXISTS idx_dependency_edges_to ON public.dependency_edges (to_service);
CREATE INDEX IF NOT EXISTS idx_dependency_edges_type ON public.dependency_edges (type);

-- ============================================================
-- Table: metrics_config
-- ============================================================

CREATE TABLE IF NOT EXISTS public.metrics_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain TEXT NOT NULL,
  application TEXT NOT NULL,
  metric_name TEXT NOT NULL
    CHECK (metric_name IN (
      'latency_p50', 'latency_p95', 'latency_p99',
      'errors_4xx', 'errors_5xx',
      'traffic_rps',
      'saturation_cpu', 'saturation_memory', 'saturation_disk',
      'availability'
    )),
  threshold DOUBLE PRECISION NOT NULL CHECK (threshold > 0),
  tier TEXT
    CHECK (tier IS NULL OR tier IN ('Tier-1', 'Tier-2', 'Tier-3', 'Tier-4')),
  environment TEXT
    CHECK (environment IS NULL OR environment IN ('Prod', 'Staging', 'QA', 'Dev')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  configured_by TEXT NOT NULL,
  configured_by_name TEXT,
  configured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metrics_config_domain ON public.metrics_config (domain);
CREATE INDEX IF NOT EXISTS idx_metrics_config_application ON public.metrics_config (application);
CREATE INDEX IF NOT EXISTS idx_metrics_config_domain_app ON public.metrics_config (domain, application);
CREATE INDEX IF NOT EXISTS idx_metrics_config_metric_name ON public.metrics_config (metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_config_enabled ON public.metrics_config (enabled);
CREATE INDEX IF NOT EXISTS idx_metrics_config_tier ON public.metrics_config (tier);
CREATE INDEX IF NOT EXISTS idx_metrics_config_configured_by ON public.metrics_config (configured_by);
CREATE INDEX IF NOT EXISTS idx_metrics_config_updated_at ON public.metrics_config (updated_at DESC);

-- ============================================================
-- Table: documentation_links
-- ============================================================

CREATE TABLE IF NOT EXISTS public.documentation_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('runbook', 'architecture', 'sop', 'postmortem', 'sla', 'other')),
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  domain_id UUID REFERENCES public.domains(id) ON DELETE SET NULL,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documentation_links_category ON public.documentation_links (category);
CREATE INDEX IF NOT EXISTS idx_documentation_links_service_id ON public.documentation_links (service_id);
CREATE INDEX IF NOT EXISTS idx_documentation_links_domain_id ON public.documentation_links (domain_id);
CREATE INDEX IF NOT EXISTS idx_documentation_links_created_by ON public.documentation_links (created_by);
CREATE INDEX IF NOT EXISTS idx_documentation_links_updated_at ON public.documentation_links (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_documentation_links_title_search ON public.documentation_links USING gin (to_tsvector('english', title));

-- ============================================================
-- Table: upload_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.upload_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name TEXT NOT NULL,
  data_type TEXT NOT NULL
    CHECK (data_type IN ('incident', 'metric', 'service_map', 'deployment', 'error_budget')),
  uploader TEXT NOT NULL,
  uploader_name TEXT,
  records_ingested INTEGER NOT NULL DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  errors TEXT[],
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('success', 'partial', 'failed', 'processing')),
  file_size_bytes BIGINT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upload_logs_uploader ON public.upload_logs (uploader);
CREATE INDEX IF NOT EXISTS idx_upload_logs_data_type ON public.upload_logs (data_type);
CREATE INDEX IF NOT EXISTS idx_upload_logs_status ON public.upload_logs (status);
CREATE INDEX IF NOT EXISTS idx_upload_logs_timestamp ON public.upload_logs (timestamp DESC);

-- ============================================================
-- Table: evidence_links
-- ============================================================

CREATE TABLE IF NOT EXISTS public.evidence_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other'
    CHECK (type IN ('runbook', 'dashboard', 'log', 'trace', 'ticket', 'other')),
  added_by TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_links_incident_id ON public.evidence_links (incident_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_type ON public.evidence_links (type);
CREATE INDEX IF NOT EXISTS idx_evidence_links_added_by ON public.evidence_links (added_by);
CREATE INDEX IF NOT EXISTS idx_evidence_links_added_at ON public.evidence_links (added_at DESC);

-- ============================================================
-- Enable Row Level Security on all tables
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependency_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependency_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentation_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_links ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies: Service Role (full access for server-side operations)
-- ============================================================
-- The application uses the service_role key for all server-side
-- operations (API routes, services). These policies grant full
-- access to the service_role, which bypasses RLS by default.
-- The policies below are for the anon/authenticated roles used
-- by the browser client (if needed in the future).
-- ============================================================

-- ============================================================
-- RLS Policies: users
-- ============================================================

CREATE POLICY "Service role full access on users"
  ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = azure_ad_id OR auth.uid()::text = id::text);

-- ============================================================
-- RLS Policies: domains
-- ============================================================

CREATE POLICY "Service role full access on domains"
  ON public.domains
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read domains"
  ON public.domains
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- RLS Policies: applications
-- ============================================================

CREATE POLICY "Service role full access on applications"
  ON public.applications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read applications"
  ON public.applications
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- RLS Policies: services
-- ============================================================

CREATE POLICY "Service role full access on services"
  ON public.services
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read services"
  ON public.services
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- RLS Policies: metrics
-- ============================================================

CREATE POLICY "Service role full access on metrics"
  ON public.metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read metrics"
  ON public.metrics
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- RLS Policies: incidents
-- ============================================================

CREATE POLICY "Service role full access on incidents"
  ON public.incidents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read incidents"
  ON public.incidents
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- RLS Policies: deployments
-- ============================================================

CREATE POLICY "Service role full access on deployments"
  ON public.deployments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read deployments"
  ON public.deployments
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- RLS Policies: error_budgets
-- ============================================================

CREATE POLICY "Service role full access on error_budgets"
  ON public.error_budgets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read error_budgets"
  ON public.error_budgets
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- RLS Policies: annotations
-- ============================================================

CREATE POLICY "Service role full access on annotations"
  ON public.annotations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read annotations"
  ON public.annotations
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- RLS Policies: audit_logs
-- ============================================================
-- Audit logs are immutable — no UPDATE or DELETE for non-service roles.

CREATE POLICY "Service role full access on audit_logs"
  ON public.audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read audit_logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- RLS Policies: dependency_nodes
-- ============================================================

CREATE POLICY "Service role full access on dependency_nodes"
  ON public.dependency_nodes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read dependency_nodes"
  ON public.dependency_nodes
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- RLS Policies: dependency_edges
-- ============================================================

CREATE POLICY "Service role full access on dependency_edges"
  ON public.dependency_edges
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read dependency_edges"
  ON public.dependency_edges
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- RLS Policies: metrics_config
-- ============================================================

CREATE POLICY "Service role full access on metrics_config"
  ON public.metrics_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read metrics_config"
  ON public.metrics_config
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- RLS Policies: documentation_links
-- ============================================================

CREATE POLICY "Service role full access on documentation_links"
  ON public.documentation_links
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read documentation_links"
  ON public.documentation_links
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- RLS Policies: upload_logs
-- ============================================================

CREATE POLICY "Service role full access on upload_logs"
  ON public.upload_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read upload_logs"
  ON public.upload_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- RLS Policies: evidence_links
-- ============================================================

CREATE POLICY "Service role full access on evidence_links"
  ON public.evidence_links
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read evidence_links"
  ON public.evidence_links
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- Trigger: auto-update updated_at columns
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- users
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- domains
CREATE TRIGGER set_domains_updated_at
  BEFORE UPDATE ON public.domains
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- applications
CREATE TRIGGER set_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- services
CREATE TRIGGER set_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- incidents
CREATE TRIGGER set_incidents_updated_at
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- error_budgets
CREATE TRIGGER set_error_budgets_updated_at
  BEFORE UPDATE ON public.error_budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- metrics_config
CREATE TRIGGER set_metrics_config_updated_at
  BEFORE UPDATE ON public.metrics_config
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- documentation_links
CREATE TRIGGER set_documentation_links_updated_at
  BEFORE UPDATE ON public.documentation_links
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- Seed Data: Default admin user
-- ============================================================

INSERT INTO public.users (name, email, role, is_active)
VALUES ('System Admin', 'admin@are-dashboard.local', 'admin', true)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- Seed Data: Sample domains
-- ============================================================

INSERT INTO public.domains (name, description) VALUES
  ('Payments', 'Payment processing and billing domain'),
  ('Identity', 'Authentication and authorization domain'),
  ('Platform', 'Core platform infrastructure services'),
  ('Claims', 'Insurance claims processing domain'),
  ('Enrollment', 'Member enrollment and eligibility domain')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Seed Data: Sample services
-- ============================================================

INSERT INTO public.services (id, name, domain, tier, criticality, environment) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Checkout API', 'Payments', 'Tier-1', 'high', 'Prod'),
  ('00000000-0000-0000-0000-000000000002', 'Auth Service', 'Identity', 'Tier-1', 'high', 'Prod'),
  ('00000000-0000-0000-0000-000000000003', 'API Gateway', 'Platform', 'Tier-1', 'high', 'Prod'),
  ('00000000-0000-0000-0000-000000000004', 'Claims API', 'Claims', 'Tier-2', 'high', 'Prod'),
  ('00000000-0000-0000-0000-000000000005', 'Eligibility API', 'Enrollment', 'Tier-2', 'high', 'Prod'),
  ('00000000-0000-0000-0000-000000000006', 'Billing Service', 'Payments', 'Tier-2', 'medium', 'Prod'),
  ('00000000-0000-0000-0000-000000000007', 'Notification Service', 'Platform', 'Tier-3', 'medium', 'Prod'),
  ('00000000-0000-0000-0000-000000000008', 'User Service', 'Identity', 'Tier-3', 'medium', 'Prod')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Seed Data: Sample dependency nodes
-- ============================================================

INSERT INTO public.dependency_nodes (id, name, type, tier, status, domain) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Checkout API', 'service', 'Tier-1', 'healthy', 'Payments'),
  ('00000000-0000-0000-0000-000000000002', 'Auth Service', 'service', 'Tier-1', 'healthy', 'Identity'),
  ('00000000-0000-0000-0000-000000000003', 'API Gateway', 'service', 'Tier-1', 'healthy', 'Platform'),
  ('00000000-0000-0000-0000-000000000004', 'Claims API', 'service', 'Tier-2', 'healthy', 'Claims'),
  ('00000000-0000-0000-0000-000000000005', 'Eligibility API', 'service', 'Tier-2', 'healthy', 'Enrollment'),
  ('00000000-0000-0000-0000-000000000006', 'Billing Service', 'service', 'Tier-2', 'healthy', 'Payments'),
  ('00000000-0000-0000-0000-000000000007', 'Notification Service', 'service', 'Tier-3', 'healthy', 'Platform'),
  ('00000000-0000-0000-0000-000000000008', 'User Service', 'service', 'Tier-3', 'healthy', 'Identity'),
  ('00000000-0000-0000-0000-000000000009', 'Payments DB', 'database', 'Tier-1', 'healthy', 'Payments'),
  ('00000000-0000-0000-0000-000000000010', 'Identity DB', 'database', 'Tier-1', 'healthy', 'Identity'),
  ('00000000-0000-0000-0000-000000000011', 'Redis Cache', 'cache', 'Tier-2', 'healthy', 'Platform'),
  ('00000000-0000-0000-0000-000000000012', 'Message Queue', 'queue', 'Tier-2', 'healthy', 'Platform'),
  ('00000000-0000-0000-0000-000000000013', 'External Payment Provider', 'external', NULL, 'healthy', NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Seed Data: Sample dependency edges
-- ============================================================

INSERT INTO public.dependency_edges (from_service, to_service, from_service_name, to_service_name, type, latency_ms, error_rate, traffic_rps) VALUES
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'API Gateway', 'Checkout API', 'calls', 12, 0.001, 850),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'API Gateway', 'Auth Service', 'calls', 8, 0.0005, 1200),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', 'API Gateway', 'Claims API', 'calls', 15, 0.002, 300),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', 'API Gateway', 'Eligibility API', 'calls', 18, 0.001, 250),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000009', 'Checkout API', 'Payments DB', 'queries', 5, 0.0001, 850),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', 'Checkout API', 'Billing Service', 'calls', 25, 0.003, 400),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013', 'Checkout API', 'External Payment Provider', 'calls', 180, 0.005, 200),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'Checkout API', 'Redis Cache', 'queries', 2, 0.0001, 1500),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', 'Auth Service', 'Identity DB', 'queries', 4, 0.0001, 1200),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000011', 'Auth Service', 'Redis Cache', 'queries', 1, 0.0001, 2000),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000008', 'Auth Service', 'User Service', 'calls', 10, 0.001, 600),
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000009', 'Billing Service', 'Payments DB', 'queries', 6, 0.0002, 400),
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000012', 'Billing Service', 'Message Queue', 'publishes', 3, 0.0001, 400),
  ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000012', 'Notification Service', 'Message Queue', 'subscribes', 2, 0.0001, 400),
  ('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000010', 'User Service', 'Identity DB', 'queries', 5, 0.0001, 600)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed Data: Sample metrics (recent data points)
-- ============================================================

DO $$
DECLARE
  svc_ids UUID[] := ARRAY[
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000007',
    '00000000-0000-0000-0000-000000000008'
  ];
  svc UUID;
  i INTEGER;
  ts TIMESTAMPTZ;
  base_avail DOUBLE PRECISION;
BEGIN
  FOREACH svc IN ARRAY svc_ids LOOP
    -- Generate 30 days of hourly availability data points
    FOR i IN 0..719 LOOP
      ts := now() - (i * interval '1 hour');
      base_avail := 99.5 + random() * 0.5;

      INSERT INTO public.metrics (service_id, metric_type, value, unit, timestamp, environment)
      VALUES (svc, 'availability', base_avail, 'percent', ts, 'Prod');
    END LOOP;

    -- Generate 30 days of hourly latency p95 data points
    FOR i IN 0..719 LOOP
      ts := now() - (i * interval '1 hour');

      INSERT INTO public.metrics (service_id, metric_type, value, unit, timestamp, environment)
      VALUES (svc, 'latency_p95', 50 + random() * 150, 'ms', ts, 'Prod');
    END LOOP;

    -- Generate 30 days of hourly latency p99 data points
    FOR i IN 0..719 LOOP
      ts := now() - (i * interval '1 hour');

      INSERT INTO public.metrics (service_id, metric_type, value, unit, timestamp, environment)
      VALUES (svc, 'latency_p99', 100 + random() * 400, 'ms', ts, 'Prod');
    END LOOP;

    -- Generate 30 days of hourly error rate 5xx data points
    FOR i IN 0..719 LOOP
      ts := now() - (i * interval '1 hour');

      INSERT INTO public.metrics (service_id, metric_type, value, unit, timestamp, environment)
      VALUES (svc, 'errors_5xx', random() * 0.05, 'count', ts, 'Prod');
    END LOOP;

    -- Generate 30 days of hourly error rate 4xx data points
    FOR i IN 0..719 LOOP
      ts := now() - (i * interval '1 hour');

      INSERT INTO public.metrics (service_id, metric_type, value, unit, timestamp, environment)
      VALUES (svc, 'errors_4xx', random() * 0.5, 'count', ts, 'Prod');
    END LOOP;

    -- Generate 30 days of hourly traffic rps data points
    FOR i IN 0..719 LOOP
      ts := now() - (i * interval '1 hour');

      INSERT INTO public.metrics (service_id, metric_type, value, unit, timestamp, environment)
      VALUES (svc, 'traffic_rps', 200 + random() * 1800, 'rps', ts, 'Prod');
    END LOOP;

    -- Generate 30 days of hourly CPU saturation data points
    FOR i IN 0..719 LOOP
      ts := now() - (i * interval '1 hour');

      INSERT INTO public.metrics (service_id, metric_type, value, unit, timestamp, environment)
      VALUES (svc, 'saturation_cpu', 20 + random() * 50, 'percent', ts, 'Prod');
    END LOOP;

    -- Generate 30 days of hourly memory saturation data points
    FOR i IN 0..719 LOOP
      ts := now() - (i * interval '1 hour');

      INSERT INTO public.metrics (service_id, metric_type, value, unit, timestamp, environment)
      VALUES (svc, 'saturation_memory', 30 + random() * 40, 'percent', ts, 'Prod');
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- Seed Data: Sample incidents
-- ============================================================

INSERT INTO public.incidents (service_id, service_name, domain, severity, status, title, description, start_time, end_time, mttr, mttd, root_cause, root_cause_details, repeat_failure) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Checkout API', 'Payments', 'critical', 'resolved',
   'Complete outage — Checkout API', 'Payment processing completely unavailable due to database connection pool exhaustion.',
   now() - interval '5 days', now() - interval '5 days' + interval '45 minutes', 45, 5,
   'Infrastructure', 'Database connection pool exhausted under peak load', false),

  ('00000000-0000-0000-0000-000000000002', 'Auth Service', 'Identity', 'major', 'resolved',
   'Degraded performance — Auth Service', 'Authentication latency increased 10x due to expired TLS certificate on upstream IdP.',
   now() - interval '12 days', now() - interval '12 days' + interval '90 minutes', 90, 12,
   'Config', 'TLS certificate expired on upstream identity provider connection', false),

  ('00000000-0000-0000-0000-000000000003', 'API Gateway', 'Platform', 'major', 'resolved',
   'High error rate — API Gateway', '5xx error rate spiked to 15% after deployment of rate limiting rules.',
   now() - interval '8 days', now() - interval '8 days' + interval '30 minutes', 30, 8,
   'Code', 'Incorrect rate limiting configuration deployed', false),

  ('00000000-0000-0000-0000-000000000001', 'Checkout API', 'Payments', 'minor', 'resolved',
   'Elevated latency — Checkout API', 'P95 latency increased from 150ms to 800ms during batch processing window.',
   now() - interval '3 days', now() - interval '3 days' + interval '60 minutes', 60, 15,
   'Capacity', 'Batch processing job competing for database resources', false),

  ('00000000-0000-0000-0000-000000000004', 'Claims API', 'Claims', 'minor', 'resolved',
   'Intermittent errors — Claims API', 'Sporadic 503 errors from downstream dependency.',
   now() - interval '15 days', now() - interval '15 days' + interval '120 minutes', 120, 20,
   'Dependency', 'Downstream claims processing service intermittent failures', false),

  ('00000000-0000-0000-0000-000000000006', 'Billing Service', 'Payments', 'warning', 'closed',
   'Threshold approaching — Billing Service', 'CPU utilization consistently above 75% during business hours.',
   now() - interval '20 days', now() - interval '20 days' + interval '240 minutes', 240, 30,
   'Capacity', 'Insufficient compute resources for growing transaction volume', false),

  ('00000000-0000-0000-0000-000000000001', 'Checkout API', 'Payments', 'critical', 'resolved',
   'Service unavailable — Checkout API (repeat)', 'Second occurrence of database connection pool exhaustion under load.',
   now() - interval '1 day', now() - interval '1 day' + interval '35 minutes', 35, 3,
   'Infrastructure', 'Database connection pool exhausted — repeat of previous incident', true),

  ('00000000-0000-0000-0000-000000000005', 'Eligibility API', 'Enrollment', 'major', 'investigating',
   'High error rate — Eligibility API', 'Error rate increased after upstream schema change.',
   now() - interval '6 hours', NULL, NULL, 10,
   'Dependency', 'Upstream schema change broke API contract', false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed Data: Sample deployments
-- ============================================================

INSERT INTO public.deployments (service_id, service_name, version, environment, status, deployed_by, deployed_at, has_incident) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Checkout API', 'v2.4.1', 'Prod', 'success', 'ci-pipeline', now() - interval '2 days', false),
  ('00000000-0000-0000-0000-000000000001', 'Checkout API', 'v2.4.0', 'Prod', 'rolled_back', 'ci-pipeline', now() - interval '5 days' - interval '2 hours', true),
  ('00000000-0000-0000-0000-000000000002', 'Auth Service', 'v3.1.0', 'Prod', 'success', 'ci-pipeline', now() - interval '7 days', false),
  ('00000000-0000-0000-0000-000000000003', 'API Gateway', 'v1.8.2', 'Prod', 'failed', 'ci-pipeline', now() - interval '8 days' - interval '1 hour', true),
  ('00000000-0000-0000-0000-000000000003', 'API Gateway', 'v1.8.3', 'Prod', 'success', 'ci-pipeline', now() - interval '8 days' + interval '2 hours', false),
  ('00000000-0000-0000-0000-000000000004', 'Claims API', 'v4.0.0', 'Prod', 'success', 'deploy-bot', now() - interval '10 days', false),
  ('00000000-0000-0000-0000-000000000005', 'Eligibility API', 'v2.2.0', 'Prod', 'success', 'deploy-bot', now() - interval '3 days', false),
  ('00000000-0000-0000-0000-000000000006', 'Billing Service', 'v1.5.1', 'Prod', 'success', 'ci-pipeline', now() - interval '14 days', false),
  ('00000000-0000-0000-0000-000000000007', 'Notification Service', 'v2.0.0', 'Prod', 'success', 'ci-pipeline', now() - interval '6 days', false),
  ('00000000-0000-0000-0000-000000000008', 'User Service', 'v1.3.0', 'Prod', 'success', 'deploy-bot', now() - interval '4 days', false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed Data: Sample error budgets
-- ============================================================

INSERT INTO public.error_budgets (service_id, service_name, period, initial, consumed, remaining, breach, trend, slo_target, burn_rate) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Checkout API', '30d', 4.32, 3.10, 1.22, false, 'down', 99.99, 1.4),
  ('00000000-0000-0000-0000-000000000002', 'Auth Service', '30d', 4.32, 1.50, 2.82, false, 'stable', 99.99, 0.7),
  ('00000000-0000-0000-0000-000000000003', 'API Gateway', '30d', 4.32, 2.80, 1.52, false, 'up', 99.99, 1.2),
  ('00000000-0000-0000-0000-000000000004', 'Claims API', '30d', 21.6, 5.40, 16.20, false, 'stable', 99.95, 0.5),
  ('00000000-0000-0000-0000-000000000005', 'Eligibility API', '30d', 21.6, 18.00, 3.60, false, 'down', 99.95, 1.6),
  ('00000000-0000-0000-0000-000000000006', 'Billing Service', '30d', 43.2, 10.80, 32.40, false, 'stable', 99.9, 0.5),
  ('00000000-0000-0000-0000-000000000007', 'Notification Service', '30d', 43.2, 2.16, 41.04, false, 'stable', 99.9, 0.1),
  ('00000000-0000-0000-0000-000000000008', 'User Service', '30d', 43.2, 8.64, 34.56, false, 'stable', 99.9, 0.4)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed Data: Sample metrics configurations
-- ============================================================

INSERT INTO public.metrics_config (domain, application, metric_name, threshold, tier, environment, enabled, configured_by, configured_by_name) VALUES
  ('Payments', 'Checkout API', 'latency_p95', 200, 'Tier-1', 'Prod', true, 'system', 'System Admin'),
  ('Payments', 'Checkout API', 'latency_p99', 500, 'Tier-1', 'Prod', true, 'system', 'System Admin'),
  ('Payments', 'Checkout API', 'errors_5xx', 0.01, 'Tier-1', 'Prod', true, 'system', 'System Admin'),
  ('Payments', 'Checkout API', 'availability', 99.99, 'Tier-1', 'Prod', true, 'system', 'System Admin'),
  ('Payments', 'Checkout API', 'saturation_cpu', 90, 'Tier-1', 'Prod', true, 'system', 'System Admin'),
  ('Identity', 'Auth Service', 'latency_p95', 200, 'Tier-1', 'Prod', true, 'system', 'System Admin'),
  ('Identity', 'Auth Service', 'errors_5xx', 0.01, 'Tier-1', 'Prod', true, 'system', 'System Admin'),
  ('Identity', 'Auth Service', 'availability', 99.99, 'Tier-1', 'Prod', true, 'system', 'System Admin'),
  ('Platform', 'API Gateway', 'latency_p95', 200, 'Tier-1', 'Prod', true, 'system', 'System Admin'),
  ('Platform', 'API Gateway', 'errors_5xx', 0.01, 'Tier-1', 'Prod', true, 'system', 'System Admin'),
  ('Claims', 'Claims API', 'latency_p95', 500, 'Tier-2', 'Prod', true, 'system', 'System Admin'),
  ('Claims', 'Claims API', 'errors_5xx', 0.05, 'Tier-2', 'Prod', true, 'system', 'System Admin'),
  ('Enrollment', 'Eligibility API', 'latency_p95', 500, 'Tier-2', 'Prod', true, 'system', 'System Admin'),
  ('Enrollment', 'Eligibility API', 'errors_5xx', 0.05, 'Tier-2', 'Prod', true, 'system', 'System Admin')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed Data: Sample documentation links
-- ============================================================

INSERT INTO public.documentation_links (title, url, category, service_id, description, created_by) VALUES
  ('Checkout API Runbook', 'https://confluence.example.com/runbooks/checkout-api', 'runbook',
   '00000000-0000-0000-0000-000000000001', 'Operational runbook for the Checkout API service including incident response procedures.', 'system'),
  ('Auth Service Architecture', 'https://confluence.example.com/architecture/auth-service', 'architecture',
   '00000000-0000-0000-0000-000000000002', 'Architecture diagram and design document for the Auth Service.', 'system'),
  ('API Gateway SOP', 'https://confluence.example.com/sops/api-gateway', 'sop',
   '00000000-0000-0000-0000-000000000003', 'Standard operating procedures for API Gateway management.', 'system'),
  ('Payments Domain SLA', 'https://confluence.example.com/sla/payments', 'sla',
   NULL, 'Service Level Agreement documentation for the Payments domain.', 'system'),
  ('Incident Response Playbook', 'https://confluence.example.com/playbooks/incident-response', 'runbook',
   NULL, 'General incident response playbook for all services.', 'system'),
  ('Post-Mortem: Checkout Outage 2024-01', 'https://confluence.example.com/postmortems/checkout-2024-01', 'postmortem',
   '00000000-0000-0000-0000-000000000001', 'Post-mortem report for the January 2024 Checkout API outage.', 'system')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed Data: Sample annotations
-- ============================================================

INSERT INTO public.annotations (entity_type, entity_id, annotation, user_id, user_name) VALUES
  ('service', '00000000-0000-0000-0000-000000000001',
   '[RISK NOTE] Connection pool sizing needs review before Q4 peak traffic season.',
   'system', 'System Admin'),
  ('service', '00000000-0000-0000-0000-000000000005',
   '[OBSERVATION] Eligibility API error budget consumption accelerating — monitor closely.',
   'system', 'System Admin'),
  ('incident', '00000000-0000-0000-0000-000000000001',
   'Root cause confirmed as database connection pool exhaustion. Corrective action: increase pool size from 50 to 200.',
   'system', 'System Admin')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed Data: Initial audit log entry
-- ============================================================

INSERT INTO public.audit_logs (action, entity_type, entity_id, user_id, user_name, details, correlation_id) VALUES
  ('UPLOAD_INTERIM_DATA', 'service', 'seed', 'system', 'System Admin',
   '{"description": "Database seeded with initial data", "tables_seeded": ["users", "domains", "services", "metrics", "incidents", "deployments", "error_budgets", "dependency_nodes", "dependency_edges", "metrics_config", "documentation_links", "annotations"]}'::jsonb,
   'seed-' || extract(epoch from now())::text)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Complete
-- ============================================================