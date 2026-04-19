-- ============================================================
-- ARE Observability Dashboard — Sample Data Script
-- ============================================================
-- Populates the database with realistic healthcare payer
-- observability data for development and demo purposes.
--
-- This script is idempotent — it uses ON CONFLICT DO NOTHING
-- to avoid duplicate inserts when re-run.
--
-- Prerequisites:
--   Run supabase/seed.sql first to create all tables and indexes.
--
-- Usage:
--   Execute via the Supabase SQL editor or CLI:
--     psql -f supabase/sample-data.sql
-- ============================================================

-- ============================================================
-- Users
-- ============================================================

INSERT INTO public.users (id, name, email, role, team, is_active, last_login_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Sarah Chen', 'sarah.chen@example.com', 'admin', 'Platform Engineering', true, now() - interval '2 hours'),
  ('a0000000-0000-0000-0000-000000000002', 'Marcus Johnson', 'marcus.johnson@example.com', 'are_lead', 'Application Reliability', true, now() - interval '30 minutes'),
  ('a0000000-0000-0000-0000-000000000003', 'Priya Patel', 'priya.patel@example.com', 'sre_engineer', 'SRE Team', true, now() - interval '1 hour'),
  ('a0000000-0000-0000-0000-000000000004', 'James Wilson', 'james.wilson@example.com', 'platform_engineer', 'Platform Engineering', true, now() - interval '4 hours'),
  ('a0000000-0000-0000-0000-000000000005', 'Emily Rodriguez', 'emily.rodriguez@example.com', 'executive', 'VP Engineering', true, now() - interval '1 day'),
  ('a0000000-0000-0000-0000-000000000006', 'David Kim', 'david.kim@example.com', 'sre_engineer', 'SRE Team', true, now() - interval '3 hours'),
  ('a0000000-0000-0000-0000-000000000007', 'Lisa Thompson', 'lisa.thompson@example.com', 'viewer', 'Business Operations', true, now() - interval '6 hours'),
  ('a0000000-0000-0000-0000-000000000008', 'Robert Martinez', 'robert.martinez@example.com', 'platform_engineer', 'Platform Engineering', true, now() - interval '5 hours'),
  ('a0000000-0000-0000-0000-000000000009', 'Amanda Foster', 'amanda.foster@example.com', 'are_lead', 'Application Reliability', true, now() - interval '45 minutes'),
  ('a0000000-0000-0000-0000-000000000010', 'Chris Taylor', 'chris.taylor@example.com', 'viewer', 'Compliance', true, now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Domains
-- ============================================================

INSERT INTO public.domains (id, name, description, owner_id) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'Payments', 'Payment processing, billing, and financial transactions for member premiums and provider reimbursements.', 'a0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000002', 'Identity', 'Authentication, authorization, member identity verification, and single sign-on services.', 'a0000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000003', 'Platform', 'Core platform infrastructure including API gateway, service mesh, and shared middleware.', 'a0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000004', 'Claims', 'Insurance claims intake, adjudication, processing, and provider payment workflows.', 'a0000000-0000-0000-0000-000000000009'),
  ('d0000000-0000-0000-0000-000000000005', 'Enrollment', 'Member enrollment, eligibility verification, plan selection, and benefits administration.', 'a0000000-0000-0000-0000-000000000009'),
  ('d0000000-0000-0000-0000-000000000006', 'Provider', 'Provider network management, credentialing, directory services, and contract administration.', 'a0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000007', 'Member', 'Member portal, communications, care management, and member engagement services.', 'a0000000-0000-0000-0000-000000000009')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Applications
-- ============================================================

INSERT INTO public.applications (id, name, domain_id, description, tier, environment, owner_id) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Premium Billing', 'd0000000-0000-0000-0000-000000000001', 'Member premium billing and payment collection system.', 'Tier-1', 'Prod', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000002', 'Auth Gateway', 'd0000000-0000-0000-0000-000000000002', 'Centralized authentication and token management.', 'Tier-1', 'Prod', 'a0000000-0000-0000-0000-000000000003'),
  ('b0000000-0000-0000-0000-000000000003', 'API Platform', 'd0000000-0000-0000-0000-000000000003', 'API gateway and service mesh infrastructure.', 'Tier-1', 'Prod', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000004', 'Claims Engine', 'd0000000-0000-0000-0000-000000000004', 'Claims adjudication and processing engine.', 'Tier-1', 'Prod', 'a0000000-0000-0000-0000-000000000009'),
  ('b0000000-0000-0000-0000-000000000005', 'Eligibility Platform', 'd0000000-0000-0000-0000-000000000005', 'Real-time eligibility verification and benefits lookup.', 'Tier-2', 'Prod', 'a0000000-0000-0000-0000-000000000009'),
  ('b0000000-0000-0000-0000-000000000006', 'Provider Directory', 'd0000000-0000-0000-0000-000000000006', 'Provider search, directory, and network management.', 'Tier-2', 'Prod', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000007', 'Member Portal', 'd0000000-0000-0000-0000-000000000007', 'Member-facing web portal and mobile app backend.', 'Tier-2', 'Prod', 'a0000000-0000-0000-0000-000000000009')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Services
-- ============================================================

INSERT INTO public.services (id, name, application_id, domain, tier, criticality, environment, owners, description, repository_url, health_check_url) VALUES
  -- Payments domain
  ('s0000000-0000-0000-0000-000000000001', 'Premium Billing API', 'b0000000-0000-0000-0000-000000000001', 'Payments', 'Tier-1', 'high', 'Prod',
   ARRAY['marcus.johnson@example.com', 'priya.patel@example.com'],
   'REST API for member premium billing, payment processing, and invoice generation. Handles ACH, credit card, and EFT transactions.',
   'https://github.com/example/premium-billing-api', 'https://premium-billing.internal/health'),

  ('s0000000-0000-0000-0000-000000000002', 'Payment Gateway Service', 'b0000000-0000-0000-0000-000000000001', 'Payments', 'Tier-1', 'high', 'Prod',
   ARRAY['marcus.johnson@example.com'],
   'Payment gateway integration service connecting to external payment processors (Stripe, PayPal, bank ACH networks).',
   'https://github.com/example/payment-gateway', 'https://payment-gateway.internal/health'),

  ('s0000000-0000-0000-0000-000000000003', 'Remittance Service', 'b0000000-0000-0000-0000-000000000001', 'Payments', 'Tier-2', 'medium', 'Prod',
   ARRAY['marcus.johnson@example.com'],
   'Provider remittance advice generation and electronic funds transfer for claims payments.',
   'https://github.com/example/remittance-service', 'https://remittance.internal/health'),

  -- Identity domain
  ('s0000000-0000-0000-0000-000000000004', 'Auth Service', 'b0000000-0000-0000-0000-000000000002', 'Identity', 'Tier-1', 'high', 'Prod',
   ARRAY['priya.patel@example.com', 'david.kim@example.com'],
   'OAuth 2.0 / OIDC authentication service with MFA support. Handles member, provider, and internal user authentication.',
   'https://github.com/example/auth-service', 'https://auth.internal/health'),

  ('s0000000-0000-0000-0000-000000000005', 'User Directory Service', 'b0000000-0000-0000-0000-000000000002', 'Identity', 'Tier-2', 'medium', 'Prod',
   ARRAY['priya.patel@example.com'],
   'User profile management, role assignment, and LDAP/AD synchronization service.',
   'https://github.com/example/user-directory', 'https://user-directory.internal/health'),

  ('s0000000-0000-0000-0000-000000000006', 'Token Service', 'b0000000-0000-0000-0000-000000000002', 'Identity', 'Tier-1', 'high', 'Prod',
   ARRAY['david.kim@example.com'],
   'JWT token issuance, validation, and refresh service. Manages session tokens and API keys.',
   'https://github.com/example/token-service', 'https://token-service.internal/health'),

  -- Platform domain
  ('s0000000-0000-0000-0000-000000000007', 'API Gateway', 'b0000000-0000-0000-0000-000000000003', 'Platform', 'Tier-1', 'high', 'Prod',
   ARRAY['sarah.chen@example.com', 'james.wilson@example.com'],
   'Kong-based API gateway handling rate limiting, request routing, SSL termination, and API versioning.',
   'https://github.com/example/api-gateway', 'https://api-gateway.internal/health'),

  ('s0000000-0000-0000-0000-000000000008', 'Event Bus', 'b0000000-0000-0000-0000-000000000003', 'Platform', 'Tier-1', 'high', 'Prod',
   ARRAY['james.wilson@example.com', 'robert.martinez@example.com'],
   'Kafka-based event streaming platform for asynchronous inter-service communication and event sourcing.',
   'https://github.com/example/event-bus', 'https://event-bus.internal/health'),

  ('s0000000-0000-0000-0000-000000000009', 'Notification Service', 'b0000000-0000-0000-0000-000000000003', 'Platform', 'Tier-3', 'medium', 'Prod',
   ARRAY['robert.martinez@example.com'],
   'Multi-channel notification delivery (email, SMS, push) with template management and delivery tracking.',
   'https://github.com/example/notification-service', 'https://notifications.internal/health'),

  ('s0000000-0000-0000-0000-000000000010', 'Config Service', 'b0000000-0000-0000-0000-000000000003', 'Platform', 'Tier-2', 'medium', 'Prod',
   ARRAY['sarah.chen@example.com'],
   'Centralized configuration management with feature flags, environment-specific settings, and dynamic config updates.',
   'https://github.com/example/config-service', 'https://config-service.internal/health'),

  -- Claims domain
  ('s0000000-0000-0000-0000-000000000011', 'Claims Intake API', 'b0000000-0000-0000-0000-000000000004', 'Claims', 'Tier-1', 'high', 'Prod',
   ARRAY['amanda.foster@example.com', 'priya.patel@example.com'],
   'Claims submission API supporting EDI 837, FHIR, and proprietary formats. Validates claims against business rules.',
   'https://github.com/example/claims-intake', 'https://claims-intake.internal/health'),

  ('s0000000-0000-0000-0000-000000000012', 'Adjudication Engine', 'b0000000-0000-0000-0000-000000000004', 'Claims', 'Tier-1', 'high', 'Prod',
   ARRAY['amanda.foster@example.com'],
   'Rules-based claims adjudication engine processing medical, dental, and pharmacy claims against benefit plans.',
   'https://github.com/example/adjudication-engine', 'https://adjudication.internal/health'),

  ('s0000000-0000-0000-0000-000000000013', 'Claims Status API', 'b0000000-0000-0000-0000-000000000004', 'Claims', 'Tier-2', 'medium', 'Prod',
   ARRAY['amanda.foster@example.com'],
   'Real-time claims status inquiry API supporting EDI 276/277 and FHIR ClaimResponse.',
   'https://github.com/example/claims-status', 'https://claims-status.internal/health'),

  -- Enrollment domain
  ('s0000000-0000-0000-0000-000000000014', 'Eligibility API', 'b0000000-0000-0000-0000-000000000005', 'Enrollment', 'Tier-1', 'high', 'Prod',
   ARRAY['amanda.foster@example.com', 'marcus.johnson@example.com'],
   'Real-time member eligibility verification API supporting EDI 270/271 and FHIR Coverage resources.',
   'https://github.com/example/eligibility-api', 'https://eligibility.internal/health'),

  ('s0000000-0000-0000-0000-000000000015', 'Enrollment Service', 'b0000000-0000-0000-0000-000000000005', 'Enrollment', 'Tier-2', 'high', 'Prod',
   ARRAY['amanda.foster@example.com'],
   'Member enrollment processing, plan selection, and benefits assignment service.',
   'https://github.com/example/enrollment-service', 'https://enrollment.internal/health'),

  ('s0000000-0000-0000-0000-000000000016', 'Benefits Calculator', 'b0000000-0000-0000-0000-000000000005', 'Enrollment', 'Tier-3', 'medium', 'Prod',
   ARRAY['amanda.foster@example.com'],
   'Benefits calculation engine for cost sharing, deductibles, copays, and out-of-pocket maximums.',
   'https://github.com/example/benefits-calculator', 'https://benefits-calc.internal/health'),

  -- Provider domain
  ('s0000000-0000-0000-0000-000000000017', 'Provider Search API', 'b0000000-0000-0000-0000-000000000006', 'Provider', 'Tier-2', 'medium', 'Prod',
   ARRAY['marcus.johnson@example.com'],
   'Provider directory search with geo-location, specialty filtering, and network status.',
   'https://github.com/example/provider-search', 'https://provider-search.internal/health'),

  ('s0000000-0000-0000-0000-000000000018', 'Credentialing Service', 'b0000000-0000-0000-0000-000000000006', 'Provider', 'Tier-3', 'medium', 'Prod',
   ARRAY['marcus.johnson@example.com'],
   'Provider credentialing verification and network participation management.',
   'https://github.com/example/credentialing', 'https://credentialing.internal/health'),

  -- Member domain
  ('s0000000-0000-0000-0000-000000000019', 'Member Portal BFF', 'b0000000-0000-0000-0000-000000000007', 'Member', 'Tier-2', 'high', 'Prod',
   ARRAY['priya.patel@example.com', 'david.kim@example.com'],
   'Backend-for-frontend service powering the member web portal and mobile application.',
   'https://github.com/example/member-portal-bff', 'https://member-bff.internal/health'),

  ('s0000000-0000-0000-0000-000000000020', 'Document Service', 'b0000000-0000-0000-0000-000000000007', 'Member', 'Tier-3', 'low', 'Prod',
   ARRAY['robert.martinez@example.com'],
   'Document generation, storage, and retrieval for EOBs, ID cards, and correspondence.',
   'https://github.com/example/document-service', 'https://documents.internal/health')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Dependency Nodes
-- ============================================================

INSERT INTO public.dependency_nodes (id, name, type, tier, status, domain) VALUES
  -- Services
  ('s0000000-0000-0000-0000-000000000001', 'Premium Billing API', 'service', 'Tier-1', 'healthy', 'Payments'),
  ('s0000000-0000-0000-0000-000000000002', 'Payment Gateway Service', 'service', 'Tier-1', 'healthy', 'Payments'),
  ('s0000000-0000-0000-0000-000000000003', 'Remittance Service', 'service', 'Tier-2', 'healthy', 'Payments'),
  ('s0000000-0000-0000-0000-000000000004', 'Auth Service', 'service', 'Tier-1', 'healthy', 'Identity'),
  ('s0000000-0000-0000-0000-000000000005', 'User Directory Service', 'service', 'Tier-2', 'healthy', 'Identity'),
  ('s0000000-0000-0000-0000-000000000006', 'Token Service', 'service', 'Tier-1', 'healthy', 'Identity'),
  ('s0000000-0000-0000-0000-000000000007', 'API Gateway', 'service', 'Tier-1', 'healthy', 'Platform'),
  ('s0000000-0000-0000-0000-000000000008', 'Event Bus', 'service', 'Tier-1', 'healthy', 'Platform'),
  ('s0000000-0000-0000-0000-000000000009', 'Notification Service', 'service', 'Tier-3', 'healthy', 'Platform'),
  ('s0000000-0000-0000-0000-000000000010', 'Config Service', 'service', 'Tier-2', 'healthy', 'Platform'),
  ('s0000000-0000-0000-0000-000000000011', 'Claims Intake API', 'service', 'Tier-1', 'degraded', 'Claims'),
  ('s0000000-0000-0000-0000-000000000012', 'Adjudication Engine', 'service', 'Tier-1', 'healthy', 'Claims'),
  ('s0000000-0000-0000-0000-000000000013', 'Claims Status API', 'service', 'Tier-2', 'healthy', 'Claims'),
  ('s0000000-0000-0000-0000-000000000014', 'Eligibility API', 'service', 'Tier-1', 'healthy', 'Enrollment'),
  ('s0000000-0000-0000-0000-000000000015', 'Enrollment Service', 'service', 'Tier-2', 'healthy', 'Enrollment'),
  ('s0000000-0000-0000-0000-000000000016', 'Benefits Calculator', 'service', 'Tier-3', 'healthy', 'Enrollment'),
  ('s0000000-0000-0000-0000-000000000017', 'Provider Search API', 'service', 'Tier-2', 'healthy', 'Provider'),
  ('s0000000-0000-0000-0000-000000000018', 'Credentialing Service', 'service', 'Tier-3', 'healthy', 'Provider'),
  ('s0000000-0000-0000-0000-000000000019', 'Member Portal BFF', 'service', 'Tier-2', 'healthy', 'Member'),
  ('s0000000-0000-0000-0000-000000000020', 'Document Service', 'service', 'Tier-3', 'healthy', 'Member'),

  -- Databases
  ('n0000000-0000-0000-0000-000000000001', 'Payments DB (PostgreSQL)', 'database', 'Tier-1', 'healthy', 'Payments'),
  ('n0000000-0000-0000-0000-000000000002', 'Identity DB (PostgreSQL)', 'database', 'Tier-1', 'healthy', 'Identity'),
  ('n0000000-0000-0000-0000-000000000003', 'Claims DB (PostgreSQL)', 'database', 'Tier-1', 'healthy', 'Claims'),
  ('n0000000-0000-0000-0000-000000000004', 'Enrollment DB (PostgreSQL)', 'database', 'Tier-1', 'healthy', 'Enrollment'),
  ('n0000000-0000-0000-0000-000000000005', 'Provider DB (PostgreSQL)', 'database', 'Tier-2', 'healthy', 'Provider'),
  ('n0000000-0000-0000-0000-000000000006', 'Member DB (PostgreSQL)', 'database', 'Tier-2', 'healthy', 'Member'),
  ('n0000000-0000-0000-0000-000000000007', 'Document Store (S3)', 'database', 'Tier-3', 'healthy', 'Member'),

  -- Caches
  ('n0000000-0000-0000-0000-000000000008', 'Redis Cluster (Sessions)', 'cache', 'Tier-1', 'healthy', 'Platform'),
  ('n0000000-0000-0000-0000-000000000009', 'Redis Cluster (API Cache)', 'cache', 'Tier-2', 'healthy', 'Platform'),
  ('n0000000-0000-0000-0000-000000000010', 'Elasticsearch (Provider Index)', 'cache', 'Tier-2', 'healthy', 'Provider'),

  -- Queues
  ('n0000000-0000-0000-0000-000000000011', 'Kafka Cluster', 'queue', 'Tier-1', 'healthy', 'Platform'),
  ('n0000000-0000-0000-0000-000000000012', 'Claims Processing Queue', 'queue', 'Tier-1', 'healthy', 'Claims'),
  ('n0000000-0000-0000-0000-000000000013', 'Notification Queue', 'queue', 'Tier-3', 'healthy', 'Platform'),

  -- External
  ('n0000000-0000-0000-0000-000000000014', 'Stripe Payment Processor', 'external', NULL, 'healthy', NULL),
  ('n0000000-0000-0000-0000-000000000015', 'Bank ACH Network', 'external', NULL, 'healthy', NULL),
  ('n0000000-0000-0000-0000-000000000016', 'CMS HIOS (Enrollment)', 'external', NULL, 'healthy', NULL),
  ('n0000000-0000-0000-0000-000000000017', 'CAQH ProView (Credentialing)', 'external', NULL, 'healthy', NULL),
  ('n0000000-0000-0000-0000-000000000018', 'Twilio (SMS)', 'external', NULL, 'healthy', NULL),
  ('n0000000-0000-0000-0000-000000000019', 'SendGrid (Email)', 'external', NULL, 'healthy', NULL),
  ('n0000000-0000-0000-0000-000000000020', 'Azure AD (SSO)', 'external', NULL, 'healthy', NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Dependency Edges
-- ============================================================

INSERT INTO public.dependency_edges (from_service, to_service, from_service_name, to_service_name, type, latency_ms, error_rate, traffic_rps) VALUES
  -- API Gateway routes to all services
  ('s0000000-0000-0000-0000-000000000007', 's0000000-0000-0000-0000-000000000001', 'API Gateway', 'Premium Billing API', 'calls', 14, 0.001, 420),
  ('s0000000-0000-0000-0000-000000000007', 's0000000-0000-0000-0000-000000000004', 'API Gateway', 'Auth Service', 'calls', 6, 0.0003, 2800),
  ('s0000000-0000-0000-0000-000000000007', 's0000000-0000-0000-0000-000000000011', 'API Gateway', 'Claims Intake API', 'calls', 18, 0.002, 650),
  ('s0000000-0000-0000-0000-000000000007', 's0000000-0000-0000-0000-000000000013', 'API Gateway', 'Claims Status API', 'calls', 12, 0.001, 380),
  ('s0000000-0000-0000-0000-000000000007', 's0000000-0000-0000-0000-000000000014', 'API Gateway', 'Eligibility API', 'calls', 10, 0.0008, 1200),
  ('s0000000-0000-0000-0000-000000000007', 's0000000-0000-0000-0000-000000000017', 'API Gateway', 'Provider Search API', 'calls', 22, 0.001, 550),
  ('s0000000-0000-0000-0000-000000000007', 's0000000-0000-0000-0000-000000000019', 'API Gateway', 'Member Portal BFF', 'calls', 15, 0.001, 900),

  -- Auth Service dependencies
  ('s0000000-0000-0000-0000-000000000004', 'n0000000-0000-0000-0000-000000000002', 'Auth Service', 'Identity DB (PostgreSQL)', 'queries', 3, 0.0001, 2800),
  ('s0000000-0000-0000-0000-000000000004', 'n0000000-0000-0000-0000-000000000008', 'Auth Service', 'Redis Cluster (Sessions)', 'queries', 1, 0.00005, 5600),
  ('s0000000-0000-0000-0000-000000000004', 's0000000-0000-0000-0000-000000000005', 'Auth Service', 'User Directory Service', 'calls', 8, 0.0005, 1400),
  ('s0000000-0000-0000-0000-000000000004', 's0000000-0000-0000-0000-000000000006', 'Auth Service', 'Token Service', 'calls', 4, 0.0002, 2800),
  ('s0000000-0000-0000-0000-000000000004', 'n0000000-0000-0000-0000-000000000020', 'Auth Service', 'Azure AD (SSO)', 'calls', 85, 0.003, 800),

  -- Token Service dependencies
  ('s0000000-0000-0000-0000-000000000006', 'n0000000-0000-0000-0000-000000000008', 'Token Service', 'Redis Cluster (Sessions)', 'queries', 1, 0.00005, 4000),
  ('s0000000-0000-0000-0000-000000000006', 'n0000000-0000-0000-0000-000000000002', 'Token Service', 'Identity DB (PostgreSQL)', 'queries', 2, 0.0001, 1200),

  -- User Directory dependencies
  ('s0000000-0000-0000-0000-000000000005', 'n0000000-0000-0000-0000-000000000002', 'User Directory Service', 'Identity DB (PostgreSQL)', 'queries', 4, 0.0001, 1400),

  -- Premium Billing API dependencies
  ('s0000000-0000-0000-0000-000000000001', 'n0000000-0000-0000-0000-000000000001', 'Premium Billing API', 'Payments DB (PostgreSQL)', 'queries', 5, 0.0001, 420),
  ('s0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000002', 'Premium Billing API', 'Payment Gateway Service', 'calls', 35, 0.004, 200),
  ('s0000000-0000-0000-0000-000000000001', 'n0000000-0000-0000-0000-000000000009', 'Premium Billing API', 'Redis Cluster (API Cache)', 'queries', 2, 0.0001, 800),
  ('s0000000-0000-0000-0000-000000000001', 'n0000000-0000-0000-0000-000000000011', 'Premium Billing API', 'Kafka Cluster', 'publishes', 3, 0.0001, 420),

  -- Payment Gateway dependencies
  ('s0000000-0000-0000-0000-000000000002', 'n0000000-0000-0000-0000-000000000014', 'Payment Gateway Service', 'Stripe Payment Processor', 'calls', 220, 0.006, 150),
  ('s0000000-0000-0000-0000-000000000002', 'n0000000-0000-0000-0000-000000000015', 'Payment Gateway Service', 'Bank ACH Network', 'calls', 350, 0.008, 50),
  ('s0000000-0000-0000-0000-000000000002', 'n0000000-0000-0000-0000-000000000001', 'Payment Gateway Service', 'Payments DB (PostgreSQL)', 'queries', 4, 0.0001, 200),

  -- Remittance Service dependencies
  ('s0000000-0000-0000-0000-000000000003', 'n0000000-0000-0000-0000-000000000001', 'Remittance Service', 'Payments DB (PostgreSQL)', 'queries', 6, 0.0002, 180),
  ('s0000000-0000-0000-0000-000000000003', 'n0000000-0000-0000-0000-000000000011', 'Remittance Service', 'Kafka Cluster', 'subscribes', 2, 0.0001, 180),
  ('s0000000-0000-0000-0000-000000000003', 'n0000000-0000-0000-0000-000000000015', 'Remittance Service', 'Bank ACH Network', 'calls', 400, 0.01, 80),

  -- Claims Intake API dependencies
  ('s0000000-0000-0000-0000-000000000011', 'n0000000-0000-0000-0000-000000000003', 'Claims Intake API', 'Claims DB (PostgreSQL)', 'queries', 5, 0.0001, 650),
  ('s0000000-0000-0000-0000-000000000011', 'n0000000-0000-0000-0000-000000000012', 'Claims Intake API', 'Claims Processing Queue', 'publishes', 3, 0.0001, 650),
  ('s0000000-0000-0000-0000-000000000011', 's0000000-0000-0000-0000-000000000014', 'Claims Intake API', 'Eligibility API', 'calls', 25, 0.002, 650),
  ('s0000000-0000-0000-0000-000000000011', 's0000000-0000-0000-0000-000000000010', 'Claims Intake API', 'Config Service', 'calls', 5, 0.0001, 100),

  -- Adjudication Engine dependencies
  ('s0000000-0000-0000-0000-000000000012', 'n0000000-0000-0000-0000-000000000012', 'Adjudication Engine', 'Claims Processing Queue', 'subscribes', 2, 0.0001, 650),
  ('s0000000-0000-0000-0000-000000000012', 'n0000000-0000-0000-0000-000000000003', 'Adjudication Engine', 'Claims DB (PostgreSQL)', 'queries', 8, 0.0002, 1300),
  ('s0000000-0000-0000-0000-000000000012', 's0000000-0000-0000-0000-000000000016', 'Adjudication Engine', 'Benefits Calculator', 'calls', 15, 0.001, 650),
  ('s0000000-0000-0000-0000-000000000012', 'n0000000-0000-0000-0000-000000000011', 'Adjudication Engine', 'Kafka Cluster', 'publishes', 3, 0.0001, 650),

  -- Claims Status API dependencies
  ('s0000000-0000-0000-0000-000000000013', 'n0000000-0000-0000-0000-000000000003', 'Claims Status API', 'Claims DB (PostgreSQL)', 'queries', 4, 0.0001, 380),
  ('s0000000-0000-0000-0000-000000000013', 'n0000000-0000-0000-0000-000000000009', 'Claims Status API', 'Redis Cluster (API Cache)', 'queries', 1, 0.00005, 760),

  -- Eligibility API dependencies
  ('s0000000-0000-0000-0000-000000000014', 'n0000000-0000-0000-0000-000000000004', 'Eligibility API', 'Enrollment DB (PostgreSQL)', 'queries', 4, 0.0001, 1200),
  ('s0000000-0000-0000-0000-000000000014', 'n0000000-0000-0000-0000-000000000009', 'Eligibility API', 'Redis Cluster (API Cache)', 'queries', 1, 0.00005, 2400),
  ('s0000000-0000-0000-0000-000000000014', 's0000000-0000-0000-0000-000000000010', 'Eligibility API', 'Config Service', 'calls', 4, 0.0001, 200),

  -- Enrollment Service dependencies
  ('s0000000-0000-0000-0000-000000000015', 'n0000000-0000-0000-0000-000000000004', 'Enrollment Service', 'Enrollment DB (PostgreSQL)', 'queries', 6, 0.0002, 300),
  ('s0000000-0000-0000-0000-000000000015', 'n0000000-0000-0000-0000-000000000016', 'Enrollment Service', 'CMS HIOS (Enrollment)', 'calls', 450, 0.012, 50),
  ('s0000000-0000-0000-0000-000000000015', 'n0000000-0000-0000-0000-000000000011', 'Enrollment Service', 'Kafka Cluster', 'publishes', 3, 0.0001, 300),

  -- Benefits Calculator dependencies
  ('s0000000-0000-0000-0000-000000000016', 'n0000000-0000-0000-0000-000000000004', 'Benefits Calculator', 'Enrollment DB (PostgreSQL)', 'queries', 5, 0.0001, 650),
  ('s0000000-0000-0000-0000-000000000016', 'n0000000-0000-0000-0000-000000000009', 'Benefits Calculator', 'Redis Cluster (API Cache)', 'queries', 1, 0.00005, 1300),

  -- Provider Search API dependencies
  ('s0000000-0000-0000-0000-000000000017', 'n0000000-0000-0000-0000-000000000010', 'Provider Search API', 'Elasticsearch (Provider Index)', 'queries', 12, 0.0005, 550),
  ('s0000000-0000-0000-0000-000000000017', 'n0000000-0000-0000-0000-000000000005', 'Provider Search API', 'Provider DB (PostgreSQL)', 'queries', 5, 0.0001, 200),

  -- Credentialing Service dependencies
  ('s0000000-0000-0000-0000-000000000018', 'n0000000-0000-0000-0000-000000000005', 'Credentialing Service', 'Provider DB (PostgreSQL)', 'queries', 6, 0.0002, 80),
  ('s0000000-0000-0000-0000-000000000018', 'n0000000-0000-0000-0000-000000000017', 'Credentialing Service', 'CAQH ProView (Credentialing)', 'calls', 800, 0.015, 20),

  -- Member Portal BFF dependencies
  ('s0000000-0000-0000-0000-000000000019', 's0000000-0000-0000-0000-000000000014', 'Member Portal BFF', 'Eligibility API', 'calls', 12, 0.001, 450),
  ('s0000000-0000-0000-0000-000000000019', 's0000000-0000-0000-0000-000000000013', 'Member Portal BFF', 'Claims Status API', 'calls', 14, 0.001, 300),
  ('s0000000-0000-0000-0000-000000000019', 's0000000-0000-0000-0000-000000000017', 'Member Portal BFF', 'Provider Search API', 'calls', 25, 0.001, 200),
  ('s0000000-0000-0000-0000-000000000019', 's0000000-0000-0000-0000-000000000020', 'Member Portal BFF', 'Document Service', 'calls', 30, 0.002, 150),
  ('s0000000-0000-0000-0000-000000000019', 'n0000000-0000-0000-0000-000000000006', 'Member Portal BFF', 'Member DB (PostgreSQL)', 'queries', 4, 0.0001, 900),

  -- Document Service dependencies
  ('s0000000-0000-0000-0000-000000000020', 'n0000000-0000-0000-0000-000000000006', 'Document Service', 'Member DB (PostgreSQL)', 'queries', 5, 0.0001, 150),
  ('s0000000-0000-0000-0000-000000000020', 'n0000000-0000-0000-0000-000000000007', 'Document Service', 'Document Store (S3)', 'queries', 45, 0.002, 150),

  -- Notification Service dependencies
  ('s0000000-0000-0000-0000-000000000009', 'n0000000-0000-0000-0000-000000000013', 'Notification Service', 'Notification Queue', 'subscribes', 2, 0.0001, 500),
  ('s0000000-0000-0000-0000-000000000009', 'n0000000-0000-0000-0000-000000000018', 'Notification Service', 'Twilio (SMS)', 'calls', 150, 0.008, 100),
  ('s0000000-0000-0000-0000-000000000009', 'n0000000-0000-0000-0000-000000000019', 'Notification Service', 'SendGrid (Email)', 'calls', 120, 0.005, 400),

  -- Config Service dependencies
  ('s0000000-0000-0000-0000-000000000010', 'n0000000-0000-0000-0000-000000000009', 'Config Service', 'Redis Cluster (API Cache)', 'queries', 1, 0.00005, 3000),

  -- Event Bus publishes to notification queue
  ('s0000000-0000-0000-0000-000000000008', 'n0000000-0000-0000-0000-000000000013', 'Event Bus', 'Notification Queue', 'publishes', 2, 0.0001, 500)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Metrics — Generate 30 days of hourly data for all services
-- ============================================================

DO $$
DECLARE
  svc_ids UUID[] := ARRAY[
    's0000000-0000-0000-0000-000000000001',
    's0000000-0000-0000-0000-000000000002',
    's0000000-0000-0000-0000-000000000003',
    's0000000-0000-0000-0000-000000000004',
    's0000000-0000-0000-0000-000000000005',
    's0000000-0000-0000-0000-000000000006',
    's0000000-0000-0000-0000-000000000007',
    's0000000-0000-0000-0000-000000000008',
    's0000000-0000-0000-0000-000000000009',
    's0000000-0000-0000-0000-000000000010',
    's0000000-0000-0000-0000-000000000011',
    's0000000-0000-0000-0000-000000000012',
    's0000000-0000-0000-0000-000000000013',
    's0000000-0000-0000-0000-000000000014',
    's0000000-0000-0000-0000-000000000015',
    's0000000-0000-0000-0000-000000000016',
    's0000000-0000-0000-0000-000000000017',
    's0000000-0000-0000-0000-000000000018',
    's0000000-0000-0000-0000-000000000019',
    's0000000-0000-0000-0000-000000000020'
  ];
  svc UUID;
  i INTEGER;
  ts TIMESTAMPTZ;
  base_avail DOUBLE PRECISION;
  base_latency DOUBLE PRECISION;
  hour_of_day INTEGER;
  traffic_multiplier DOUBLE PRECISION;
BEGIN
  FOREACH svc IN ARRAY svc_ids LOOP
    FOR i IN 0..719 LOOP
      ts := now() - (i * interval '1 hour');
      hour_of_day := EXTRACT(HOUR FROM ts)::INTEGER;

      -- Simulate business-hours traffic pattern (higher during 8am-6pm ET)
      IF hour_of_day >= 8 AND hour_of_day <= 18 THEN
        traffic_multiplier := 1.0 + (random() * 0.3);
      ELSIF hour_of_day >= 6 AND hour_of_day <= 20 THEN
        traffic_multiplier := 0.6 + (random() * 0.2);
      ELSE
        traffic_multiplier := 0.2 + (random() * 0.15);
      END IF;

      -- Availability (slight dip for Claims Intake API around day 3)
      IF svc = 's0000000-0000-0000-0000-000000000011' AND i BETWEEN 60 AND 72 THEN
        base_avail := 98.5 + random() * 1.0;
      ELSIF svc = 's0000000-0000-0000-0000-000000000002' AND i BETWEEN 110 AND 115 THEN
        base_avail := 99.0 + random() * 0.5;
      ELSE
        base_avail := 99.7 + random() * 0.3;
      END IF;

      INSERT INTO public.metrics (service_id, metric_type, value, unit, timestamp, environment)
      VALUES (svc, 'availability', base_avail, 'percent', ts, 'Prod');

      -- Latency P50
      base_latency := 15 + random() * 35;
      INSERT INTO public.metrics (service_id, metric_type, value, unit, timestamp, environment)
      VALUES (svc, 'latency_p50', base_latency, 'ms', ts, 'Prod');

      -- Latency P95
      INSERT INTO public.metrics (service_id, metric_type, value, unit, timestamp, environment)
      VALUES (svc, 'latency_p95', base_latency * (2.0 + random() * 1.5), 'ms', ts, 'Prod');

      -- Latency P99
      INSERT INTO public.metrics (service_id, metric_type, value, unit, timestamp, environment)
      VALUES (svc, 'latency_p99', base_latency * (3.5 + random() * 3.0), 'ms', ts, 'Prod');

      -- 5xx Error Rate
      INSERT INTO public.metrics (service_id, metric_type, value, unit, timestamp, environment)
      VALUES (svc, 'errors_5xx', random() * 0.04, 'count', ts, 'Prod');

      -- 4xx Error Rate
      INSERT INTO public.metrics (service_id, metric_type, value, unit, timestamp, environment)
      VALUES (svc, 'errors_4xx', random() * 0.3, 'count', ts, 'Prod');

      -- Traffic RPS
      INSERT INTO public.metrics (service_id, metric_type, value, unit, timestamp, environment)
      VALUES (svc, 'traffic_rps', (100 + random() * 900) * traffic_multiplier, 'rps', ts, 'Prod');

      -- CPU Saturation
      INSERT INTO public.metrics (service_id, metric_type, value, unit, timestamp, environment)
      VALUES (svc, 'saturation_cpu', (15 + random() * 45) * traffic_multiplier, 'percent', ts, 'Prod');

      -- Memory Saturation
      INSERT INTO public.metrics (service_id, metric_type, value, unit, timestamp, environment)
      VALUES (svc, 'saturation_memory', 35 + random() * 30, 'percent', ts, 'Prod');

      -- Disk Saturation (only every 6 hours to reduce volume)
      IF i % 6 = 0 THEN
        INSERT INTO public.metrics (service_id, metric_type, value, unit, timestamp, environment)
        VALUES (svc, 'saturation_disk', 20 + random() * 25, 'percent', ts, 'Prod');
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- Incidents
-- ============================================================

INSERT INTO public.incidents (id, service_id, service_name, domain, severity, status, title, description, start_time, end_time, mttr, mttd, root_cause, root_cause_details, repeat_failure, external_id) VALUES
  -- Critical: Claims Intake API outage
  ('i0000000-0000-0000-0000-000000000001',
   's0000000-0000-0000-0000-000000000011', 'Claims Intake API', 'Claims',
   'critical', 'resolved',
   'Claims Intake API — Complete service outage',
   'Claims Intake API returned 503 for all requests. Root cause traced to database connection pool exhaustion caused by a long-running migration query that held locks on the claims table.',
   now() - interval '3 days', now() - interval '3 days' + interval '52 minutes',
   52, 4,
   'Infrastructure', 'Database connection pool exhausted due to long-running migration query holding table locks during peak claims submission window.',
   false, 'SNOW-INC-2024-0847'),

  -- Critical: Payment Gateway degradation
  ('i0000000-0000-0000-0000-000000000002',
   's0000000-0000-0000-0000-000000000002', 'Payment Gateway Service', 'Payments',
   'critical', 'resolved',
   'Payment Gateway — Stripe integration timeout cascade',
   'Stripe API latency increased from 200ms to 8s causing timeout cascades across the payment processing pipeline. Member premium payments failed for 38 minutes.',
   now() - interval '10 days', now() - interval '10 days' + interval '38 minutes',
   38, 3,
   'Dependency', 'Stripe API experienced elevated latency (8s avg) during their infrastructure maintenance window. Circuit breaker thresholds were set too high to trigger.',
   false, 'SNOW-INC-2024-0812'),

  -- Major: Auth Service certificate expiry
  ('i0000000-0000-0000-0000-000000000003',
   's0000000-0000-0000-0000-000000000004', 'Auth Service', 'Identity',
   'major', 'resolved',
   'Auth Service — TLS certificate expiry on Azure AD integration',
   'Authentication failures for SSO users due to expired TLS certificate on the Azure AD federation trust. Internal auth (username/password) was unaffected.',
   now() - interval '18 days', now() - interval '18 days' + interval '95 minutes',
   95, 15,
   'Config', 'TLS certificate for Azure AD federation trust expired. Certificate rotation was not automated and the expiry alert was routed to a decommissioned distribution list.',
   false, 'SNOW-INC-2024-0789'),

  -- Major: Adjudication Engine slow processing
  ('i0000000-0000-0000-0000-000000000004',
   's0000000-0000-0000-0000-000000000012', 'Adjudication Engine', 'Claims',
   'major', 'resolved',
   'Adjudication Engine — Claims processing backlog (4-hour delay)',
   'Claims adjudication processing fell behind by 4 hours due to a poorly optimized benefit plan rule that caused O(n²) evaluation for pharmacy claims.',
   now() - interval '7 days', now() - interval '7 days' + interval '180 minutes',
   180, 45,
   'Code', 'Pharmacy benefit rule evaluation had O(n²) complexity for formulary lookups. Triggered by a new formulary with 12,000 entries loaded during open enrollment.',
   false, 'SNOW-INC-2024-0831'),

  -- Major: Eligibility API elevated error rate
  ('i0000000-0000-0000-0000-000000000005',
   's0000000-0000-0000-0000-000000000014', 'Eligibility API', 'Enrollment',
   'major', 'resolved',
   'Eligibility API — 15% error rate after schema migration',
   'Eligibility API returned 500 errors for 15% of requests after a database schema migration introduced a NOT NULL constraint on a column that had existing null values.',
   now() - interval '14 days', now() - interval '14 days' + interval '65 minutes',
   65, 8,
   'Code', 'Database migration added NOT NULL constraint to member_plan_id column without backfilling existing null values. Affected legacy enrollment records from pre-2020.',
   false, 'SNOW-INC-2024-0801'),

  -- Minor: API Gateway rate limiting misconfiguration
  ('i0000000-0000-0000-0000-000000000006',
   's0000000-0000-0000-0000-000000000007', 'API Gateway', 'Platform',
   'minor', 'resolved',
   'API Gateway — Rate limiting incorrectly applied to internal services',
   'Rate limiting rules deployed for external API consumers were incorrectly applied to internal service-to-service calls, causing intermittent 429 responses.',
   now() - interval '5 days', now() - interval '5 days' + interval '25 minutes',
   25, 10,
   'Config', 'Kong rate limiting plugin configuration used global scope instead of consumer-specific scope. Internal service accounts were not excluded from rate limits.',
   false, 'SNOW-INC-2024-0841'),

  -- Minor: Notification Service SMS delivery failures
  ('i0000000-0000-0000-0000-000000000007',
   's0000000-0000-0000-0000-000000000009', 'Notification Service', 'Platform',
   'minor', 'resolved',
   'Notification Service — SMS delivery failures for member alerts',
   'SMS notifications for claims status updates and payment confirmations failed for 2 hours due to Twilio API key rotation.',
   now() - interval '22 days', now() - interval '22 days' + interval '130 minutes',
   130, 25,
   'Config', 'Twilio API key was rotated as part of quarterly security rotation but the new key was not propagated to the production Notification Service configuration.',
   false, 'SNOW-INC-2024-0775'),

  -- Minor: Provider Search latency spike
  ('i0000000-0000-0000-0000-000000000008',
   's0000000-0000-0000-0000-000000000017', 'Provider Search API', 'Provider',
   'minor', 'resolved',
   'Provider Search API — P95 latency spike to 2.5s',
   'Provider search queries experienced elevated latency after Elasticsearch index rebalancing triggered by a node replacement.',
   now() - interval '9 days', now() - interval '9 days' + interval '45 minutes',
   45, 12,
   'Infrastructure', 'Elasticsearch cluster rebalanced shards after a node replacement, causing temporary I/O contention on the remaining nodes.',
   false, 'SNOW-INC-2024-0822'),

  -- Warning: Config Service memory leak
  ('i0000000-0000-0000-0000-000000000009',
   's0000000-0000-0000-0000-000000000010', 'Config Service', 'Platform',
   'warning', 'closed',
   'Config Service — Gradual memory leak detected',
   'Config Service memory utilization increased from 45% to 82% over 7 days. Identified as a cache eviction bug in the feature flag evaluation module.',
   now() - interval '25 days', now() - interval '25 days' + interval '360 minutes',
   360, 120,
   'Code', 'Feature flag evaluation cache did not properly evict stale entries when flag definitions were updated, causing unbounded memory growth.',
   false, 'SNOW-INC-2024-0762'),

  -- Critical: Claims Intake API — repeat failure
  ('i0000000-0000-0000-0000-000000000010',
   's0000000-0000-0000-0000-000000000011', 'Claims Intake API', 'Claims',
   'critical', 'resolved',
   'Claims Intake API — Database connection pool exhaustion (REPEAT)',
   'Second occurrence of database connection pool exhaustion on Claims Intake API. Same root cause as INC-0847 — connection pool sizing was increased but the underlying long-running query pattern was not addressed.',
   now() - interval '1 day', now() - interval '1 day' + interval '28 minutes',
   28, 2,
   'Infrastructure', 'Database connection pool exhausted again. Previous remediation only increased pool size without addressing the root cause of long-running analytical queries running against the OLTP database.',
   true, 'SNOW-INC-2024-0855'),

  -- Major: Event Bus consumer lag
  ('i0000000-0000-0000-0000-000000000011',
   's0000000-0000-0000-0000-000000000008', 'Event Bus', 'Platform',
   'major', 'investigating',
   'Event Bus — Consumer lag exceeding 30 minutes on claims topic',
   'Kafka consumer group for claims processing topic has accumulated 30+ minutes of lag. Claims adjudication is delayed. Investigating potential consumer rebalancing issue.',
   now() - interval '4 hours', NULL,
   NULL, 8,
   NULL, NULL,
   false, 'SNOW-INC-2024-0858'),

  -- Warning: Enrollment Service CMS connectivity
  ('i0000000-0000-0000-0000-000000000012',
   's0000000-0000-0000-0000-000000000015', 'Enrollment Service', 'Enrollment',
   'warning', 'mitigated',
   'Enrollment Service — Intermittent CMS HIOS connectivity issues',
   'CMS HIOS enrollment submission endpoint returning intermittent 503 errors. Enrollment submissions are being queued for retry.',
   now() - interval '8 hours', NULL,
   NULL, 30,
   'Dependency', 'CMS HIOS system experiencing intermittent availability issues during their maintenance window.',
   false, 'SNOW-INC-2024-0856'),

  -- Minor: Member Portal BFF slow responses
  ('i0000000-0000-0000-0000-000000000013',
   's0000000-0000-0000-0000-000000000019', 'Member Portal BFF', 'Member',
   'minor', 'resolved',
   'Member Portal BFF — Slow page load times during open enrollment',
   'Member portal page load times increased from 1.2s to 4.5s during open enrollment period due to increased traffic and unoptimized eligibility queries.',
   now() - interval '12 days', now() - interval '12 days' + interval '90 minutes',
   90, 20,
   'Capacity', 'Open enrollment traffic exceeded capacity planning estimates by 40%. Eligibility API queries were not optimized for the increased concurrent user load.',
   false, 'SNOW-INC-2024-0808'),

  -- Major: Auth Service — repeat config issue
  ('i0000000-0000-0000-0000-000000000014',
   's0000000-0000-0000-0000-000000000004', 'Auth Service', 'Identity',
   'major', 'resolved',
   'Auth Service — SAML assertion validation failure (REPEAT config issue)',
   'SAML assertion validation failed for provider portal SSO users after IdP metadata refresh. Similar to previous certificate expiry incident — automated rotation still not fully implemented.',
   now() - interval '6 days', now() - interval '6 days' + interval '40 minutes',
   40, 5,
   'Config', 'IdP metadata refresh changed the signing certificate but the Auth Service SAML configuration was not updated. Automated metadata refresh was partially implemented but not enabled for the provider portal federation.',
   true, 'SNOW-INC-2024-0843')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Evidence Links
-- ============================================================

INSERT INTO public.evidence_links (incident_id, url, title, type, added_by, added_at) VALUES
  -- Claims Intake API outage evidence
  ('i0000000-0000-0000-0000-000000000001', 'https://grafana.internal/d/claims-intake/overview?from=1704067200000&to=1704070800000', 'Grafana — Claims Intake API Dashboard (incident window)', 'dashboard', 'a0000000-0000-0000-0000-000000000003', now() - interval '3 days' + interval '1 hour'),
  ('i0000000-0000-0000-0000-000000000001', 'https://kibana.internal/app/discover#/claims-intake-errors', 'Kibana — Claims Intake Error Logs', 'log', 'a0000000-0000-0000-0000-000000000003', now() - interval '3 days' + interval '1 hour'),
  ('i0000000-0000-0000-0000-000000000001', 'https://confluence.internal/postmortems/INC-0847', 'Post-Mortem: Claims Intake DB Connection Pool Exhaustion', 'runbook', 'a0000000-0000-0000-0000-000000000002', now() - interval '2 days'),
  ('i0000000-0000-0000-0000-000000000001', 'https://jira.internal/browse/SNOW-INC-2024-0847', 'ServiceNow Incident Ticket', 'ticket', 'a0000000-0000-0000-0000-000000000003', now() - interval '3 days'),

  -- Payment Gateway evidence
  ('i0000000-0000-0000-0000-000000000002', 'https://grafana.internal/d/payment-gateway/overview', 'Grafana — Payment Gateway Dashboard', 'dashboard', 'a0000000-0000-0000-0000-000000000002', now() - interval '10 days' + interval '1 hour'),
  ('i0000000-0000-0000-0000-000000000002', 'https://status.stripe.com/incidents/2024-01-15', 'Stripe Status Page — Elevated API Latency', 'other', 'a0000000-0000-0000-0000-000000000002', now() - interval '10 days' + interval '2 hours'),
  ('i0000000-0000-0000-0000-000000000002', 'https://jira.internal/browse/SNOW-INC-2024-0812', 'ServiceNow Incident Ticket', 'ticket', 'a0000000-0000-0000-0000-000000000002', now() - interval '10 days'),

  -- Auth Service certificate evidence
  ('i0000000-0000-0000-0000-000000000003', 'https://kibana.internal/app/discover#/auth-service-tls-errors', 'Kibana — Auth Service TLS Error Logs', 'log', 'a0000000-0000-0000-0000-000000000006', now() - interval '18 days' + interval '2 hours'),
  ('i0000000-0000-0000-0000-000000000003', 'https://confluence.internal/runbooks/auth-service-certificate-rotation', 'Runbook: Auth Service Certificate Rotation', 'runbook', 'a0000000-0000-0000-0000-000000000006', now() - interval '18 days' + interval '30 minutes'),

  -- Claims Intake repeat failure evidence
  ('i0000000-0000-0000-0000-000000000010', 'https://grafana.internal/d/claims-intake/overview?from=latest', 'Grafana — Claims Intake API Dashboard (repeat incident)', 'dashboard', 'a0000000-0000-0000-0000-000000000003', now() - interval '1 day' + interval '30 minutes'),
  ('i0000000-0000-0000-0000-000000000010', 'https://jaeger.internal/trace/abc123def456', 'Jaeger — Slow Query Trace', 'trace', 'a0000000-0000-0000-0000-000000000003', now() - interval '1 day' + interval '45 minutes'),
  ('i0000000-0000-0000-0000-000000000010', 'https://jira.internal/browse/SNOW-INC-2024-0855', 'ServiceNow Incident Ticket (repeat)', 'ticket', 'a0000000-0000-0000-0000-000000000002', now() - interval '1 day')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Deployments
-- ============================================================

INSERT INTO public.deployments (id, service_id, service_name, version, environment, status, deployed_by, deployed_at, rollback_at, change_ticket, description, has_incident, incident_id) VALUES
  ('dp000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000011', 'Claims Intake API', 'v4.12.0', 'Prod', 'rolled_back', 'ci-pipeline', now() - interval '3 days' - interval '2 hours', now() - interval '3 days' - interval '1 hour', 'CHG-2024-1847', 'Database migration adding indexes to claims table. Caused connection pool exhaustion.', true, 'i0000000-0000-0000-0000-000000000001'),
  ('dp000000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000011', 'Claims Intake API', 'v4.12.1', 'Prod', 'success', 'ci-pipeline', now() - interval '2 days', NULL, 'CHG-2024-1852', 'Hotfix: Increased connection pool size and added query timeout.', false, NULL),
  ('dp000000-0000-0000-0000-000000000003', 's0000000-0000-0000-0000-000000000004', 'Auth Service', 'v3.8.0', 'Prod', 'success', 'ci-pipeline', now() - interval '20 days', NULL, 'CHG-2024-1790', 'Added SAML metadata auto-refresh capability.', false, NULL),
  ('dp000000-0000-0000-0000-000000000004', 's0000000-0000-0000-0000-000000000004', 'Auth Service', 'v3.8.1', 'Prod', 'success', 'ci-pipeline', now() - interval '17 days', NULL, 'CHG-2024-1795', 'Hotfix: Renewed Azure AD federation TLS certificate.', false, NULL),
  ('dp000000-0000-0000-0000-000000000005', 's0000000-0000-0000-0000-000000000007', 'API Gateway', 'v2.5.0', 'Prod', 'failed', 'ci-pipeline', now() - interval '5 days' - interval '1 hour', NULL, 'CHG-2024-1838', 'Rate limiting configuration update. Incorrectly scoped to all consumers.', true, 'i0000000-0000-0000-0000-000000000006'),
  ('dp000000-0000-0000-0000-000000000006', 's0000000-0000-0000-0000-000000000007', 'API Gateway', 'v2.5.1', 'Prod', 'success', 'ci-pipeline', now() - interval '5 days' + interval '1 hour', NULL, 'CHG-2024-1839', 'Hotfix: Corrected rate limiting scope to external consumers only.', false, NULL),
  ('dp000000-0000-0000-0000-000000000007', 's0000000-0000-0000-0000-000000000012', 'Adjudication Engine', 'v5.2.0', 'Prod', 'success', 'ci-pipeline', now() - interval '8 days', NULL, 'CHG-2024-1825', 'New formulary loading for 2024 open enrollment.', true, 'i0000000-0000-0000-0000-000000000004'),
  ('dp000000-0000-0000-0000-000000000008', 's0000000-0000-0000-0000-000000000012', 'Adjudication Engine', 'v5.2.1', 'Prod', 'success', 'ci-pipeline', now() - interval '6 days', NULL, 'CHG-2024-1835', 'Performance fix: Optimized pharmacy benefit rule evaluation from O(n²) to O(n log n).', false, NULL),
  ('dp000000-0000-0000-0000-000000000009', 's0000000-0000-0000-0000-000000000014', 'Eligibility API', 'v3.4.0', 'Prod', 'rolled_back', 'deploy-bot', now() - interval '14 days' - interval '30 minutes', now() - interval '14 days' + interval '30 minutes', 'CHG-2024-1800', 'Schema migration with NOT NULL constraint. Caused 500 errors for legacy records.', true, 'i0000000-0000-0000-0000-000000000005'),
  ('dp000000-0000-0000-0000-000000000010', 's0000000-0000-0000-0000-000000000014', 'Eligibility API', 'v3.4.1', 'Prod', 'success', 'deploy-bot', now() - interval '13 days', NULL, 'CHG-2024-1803', 'Hotfix: Backfilled null member_plan_id values and re-applied migration.', false, NULL),
  ('dp000000-0000-0000-0000-000000000011', 's0000000-0000-0000-0000-000000000001', 'Premium Billing API', 'v6.1.0', 'Prod', 'success', 'ci-pipeline', now() - interval '4 days', NULL, 'CHG-2024-1840', 'Added support for HSA contribution billing.', false, NULL),
  ('dp000000-0000-0000-0000-000000000012', 's0000000-0000-0000-0000-000000000019', 'Member Portal BFF', 'v2.9.0', 'Prod', 'success', 'ci-pipeline', now() - interval '11 days', NULL, 'CHG-2024-1810', 'Open enrollment UI enhancements and plan comparison feature.', false, NULL),
  ('dp000000-0000-0000-0000-000000000013', 's0000000-0000-0000-0000-000000000019', 'Member Portal BFF', 'v2.9.1', 'Prod', 'success', 'ci-pipeline', now() - interval '11 days' + interval '4 hours', NULL, 'CHG-2024-1811', 'Performance optimization: Added caching for eligibility lookups.', false, NULL),
  ('dp000000-0000-0000-0000-000000000014', 's0000000-0000-0000-0000-000000000010', 'Config Service', 'v1.7.0', 'Prod', 'success', 'ci-pipeline', now() - interval '24 days', NULL, 'CHG-2024-1770', 'Feature flag evaluation cache fix for memory leak.', false, NULL),
  ('dp000000-0000-0000-0000-000000000015', 's0000000-0000-0000-0000-000000000017', 'Provider Search API', 'v2.3.0', 'Prod', 'success', 'deploy-bot', now() - interval '15 days', NULL, 'CHG-2024-1798', 'Elasticsearch index optimization and geo-search improvements.', false, NULL),
  ('dp000000-0000-0000-0000-000000000016', 's0000000-0000-0000-0000-000000000006', 'Token Service', 'v2.1.0', 'Prod', 'success', 'ci-pipeline', now() - interval '16 days', NULL, 'CHG-2024-1796', 'JWT token rotation and refresh token security hardening.', false, NULL),
  ('dp000000-0000-0000-0000-000000000017', 's0000000-0000-0000-0000-000000000003', 'Remittance Service', 'v1.4.0', 'Prod', 'success', 'ci-pipeline', now() - interval '19 days', NULL, 'CHG-2024-1785', 'Added support for ERA 835 v5010A1 format.', false, NULL),
  ('dp000000-0000-0000-0000-000000000018', 's0000000-0000-0000-0000-000000000020', 'Document Service', 'v1.2.0', 'Prod', 'success', 'deploy-bot', now() - interval '21 days', NULL, 'CHG-2024-1778', 'EOB document generation performance improvements.', false, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Error Budgets
-- ============================================================

INSERT INTO public.error_budgets (service_id, service_name, period, initial, consumed, remaining, breach, trend, slo_target, burn_rate, projected_breach_date) VALUES
  ('s0000000-0000-0000-0000-000000000001', 'Premium Billing API', '30d', 4.32, 1.80, 2.52, false, 'stable', 99.99, 0.8, NULL),
  ('s0000000-0000-0000-0000-000000000002', 'Payment Gateway Service', '30d', 4.32, 2.90, 1.42, false, 'down', 99.99, 1.3, now() + interval '8 days'),
  ('s0000000-0000-0000-0000-000000000003', 'Remittance Service', '30d', 21.6, 3.20, 18.40, false, 'stable', 99.95, 0.3, NULL),
  ('s0000000-0000-0000-0000-000000000004', 'Auth Service', '30d', 4.32, 3.50, 0.82, false, 'down', 99.99, 1.6, now() + interval '3 days'),
  ('s0000000-0000-0000-0000-000000000005', 'User Directory Service', '30d', 21.6, 2.10, 19.50, false, 'stable', 99.95, 0.2, NULL),
  ('s0000000-0000-0000-0000-000000000006', 'Token Service', '30d', 4.32, 0.90, 3.42, false, 'stable', 99.99, 0.4, NULL),
  ('s0000000-0000-0000-0000-000000000007', 'API Gateway', '30d', 4.32, 1.50, 2.82, false, 'up', 99.99, 0.7, NULL),
  ('s0000000-0000-0000-0000-000000000008', 'Event Bus', '30d', 4.32, 2.20, 2.12, false, 'down', 99.99, 1.0, now() + interval '15 days'),
  ('s0000000-0000-0000-0000-000000000009', 'Notification Service', '30d', 43.2, 8.60, 34.60, false, 'stable', 99.9, 0.4, NULL),
  ('s0000000-0000-0000-0000-000000000010', 'Config Service', '30d', 21.6, 4.30, 17.30, false, 'up', 99.95, 0.4, NULL),
  ('s0000000-0000-0000-0000-000000000011', 'Claims Intake API', '30d', 4.32, 4.10, 0.22, false, 'down', 99.99, 1.9, now() + interval '1 day'),
  ('s0000000-0000-0000-0000-000000000012', 'Adjudication Engine', '30d', 4.32, 3.00, 1.32, false, 'up', 99.99, 1.4, now() + interval '6 days'),
  ('s0000000-0000-0000-0000-000000000013', 'Claims Status API', '30d', 21.6, 1.80, 19.80, false, 'stable', 99.95, 0.2, NULL),
  ('s0000000-0000-0000-0000-000000000014', 'Eligibility API', '30d', 4.32, 3.60, 0.72, false, 'down', 99.99, 1.7, now() + interval '2 days'),
  ('s0000000-0000-0000-0000-000000000015', 'Enrollment Service', '30d', 21.6, 5.40, 16.20, false, 'stable', 99.95, 0.5, NULL),
  ('s0000000-0000-0000-0000-000000000016', 'Benefits Calculator', '30d', 43.2, 2.16, 41.04, false, 'stable', 99.9, 0.1, NULL),
  ('s0000000-0000-0000-0000-000000000017', 'Provider Search API', '30d', 21.6, 6.50, 15.10, false, 'up', 99.95, 0.6, NULL),
  ('s0000000-0000-0000-0000-000000000018', 'Credentialing Service', '30d', 43.2, 3.50, 39.70, false, 'stable', 99.9, 0.2, NULL),
  ('s0000000-0000-0000-0000-000000000019', 'Member Portal BFF', '30d', 21.6, 8.60, 13.00, false, 'up', 99.95, 0.8, NULL),
  ('s0000000-0000-0000-0000-000000000020', 'Document Service', '30d', 43.2, 4.30, 38.90, false, 'stable', 99.9, 0.2, NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Metrics Configurations
-- ============================================================

INSERT INTO public.metrics_config (domain, application, metric_name, threshold, tier, environment, enabled, configured_by, configured_by_name) VALUES
  -- Payments domain
  ('Payments', 'Premium Billing API', 'latency_p95', 200, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000002', 'Marcus Johnson'),
  ('Payments', 'Premium Billing API', 'latency_p99', 500, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000002', 'Marcus Johnson'),
  ('Payments', 'Premium Billing API', 'errors_5xx', 0.01, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000002', 'Marcus Johnson'),
  ('Payments', 'Premium Billing API', 'availability', 99.99, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000002', 'Marcus Johnson'),
  ('Payments', 'Premium Billing API', 'saturation_cpu', 90, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000002', 'Marcus Johnson'),
  ('Payments', 'Payment Gateway Service', 'latency_p95', 300, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000002', 'Marcus Johnson'),
  ('Payments', 'Payment Gateway Service', 'errors_5xx', 0.01, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000002', 'Marcus Johnson'),
  ('Payments', 'Remittance Service', 'latency_p95', 500, 'Tier-2', 'Prod', true, 'a0000000-0000-0000-0000-000000000002', 'Marcus Johnson'),

  -- Identity domain
  ('Identity', 'Auth Service', 'latency_p95', 100, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000003', 'Priya Patel'),
  ('Identity', 'Auth Service', 'latency_p99', 250, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000003', 'Priya Patel'),
  ('Identity', 'Auth Service', 'errors_5xx', 0.005, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000003', 'Priya Patel'),
  ('Identity', 'Auth Service', 'availability', 99.99, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000003', 'Priya Patel'),
  ('Identity', 'Token Service', 'latency_p95', 50, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000006', 'David Kim'),
  ('Identity', 'Token Service', 'errors_5xx', 0.005, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000006', 'David Kim'),

  -- Platform domain
  ('Platform', 'API Gateway', 'latency_p95', 50, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000001', 'Sarah Chen'),
  ('Platform', 'API Gateway', 'errors_5xx', 0.005, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000001', 'Sarah Chen'),
  ('Platform', 'API Gateway', 'availability', 99.99, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000001', 'Sarah Chen'),
  ('Platform', 'Event Bus', 'availability', 99.99, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000004', 'James Wilson'),
  ('Platform', 'Notification Service', 'latency_p95', 1000, 'Tier-3', 'Prod', true, 'a0000000-0000-0000-0000-000000000008', 'Robert Martinez'),

  -- Claims domain
  ('Claims', 'Claims Intake API', 'latency_p95', 200, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000009', 'Amanda Foster'),
  ('Claims', 'Claims Intake API', 'errors_5xx', 0.01, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000009', 'Amanda Foster'),
  ('Claims', 'Claims Intake API', 'availability', 99.99, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000009', 'Amanda Foster'),
  ('Claims', 'Adjudication Engine', 'latency_p95', 500, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000009', 'Amanda Foster'),
  ('Claims', 'Adjudication Engine', 'errors_5xx', 0.01, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000009', 'Amanda Foster'),

  -- Enrollment domain
  ('Enrollment', 'Eligibility API', 'latency_p95', 150, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000009', 'Amanda Foster'),
  ('Enrollment', 'Eligibility API', 'errors_5xx', 0.01, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000009', 'Amanda Foster'),
  ('Enrollment', 'Eligibility API', 'availability', 99.99, 'Tier-1', 'Prod', true, 'a0000000-0000-0000-0000-000000000009', 'Amanda Foster'),
  ('Enrollment', 'Enrollment Service', 'latency_p95', 500, 'Tier-2', 'Prod', true, 'a0000000-0000-0000-0000-000000000009', 'Amanda Foster'),

  -- Provider domain
  ('Provider', 'Provider Search API', 'latency_p95', 500, 'Tier-2', 'Prod', true, 'a0000000-0000-0000-0000-000000000002', 'Marcus Johnson'),
  ('Provider', 'Provider Search API', 'errors_5xx', 0.05, 'Tier-2', 'Prod', true, 'a0000000-0000-0000-0000-000000000002', 'Marcus Johnson'),

  -- Member domain
  ('Member', 'Member Portal BFF', 'latency_p95', 500, 'Tier-2', 'Prod', true, 'a0000000-0000-0000-0000-000000000003', 'Priya Patel'),
  ('Member', 'Member Portal BFF', 'errors_5xx', 0.05, 'Tier-2', 'Prod', true, 'a0000000-0000-0000-0000-000000000003', 'Priya Patel')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Documentation Links
-- ============================================================

INSERT INTO public.documentation_links (title, url, category, service_id, domain_id, description, created_by) VALUES
  -- Runbooks
  ('Claims Intake API — Incident Response Runbook', 'https://confluence.internal/runbooks/claims-intake-api', 'runbook', 's0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000004', 'Step-by-step incident response procedures for Claims Intake API including database connection pool recovery, queue backlog management, and EDI submission retry procedures.', 'a0000000-0000-0000-0000-000000000009'),
  ('Auth Service — Certificate Rotation Runbook', 'https://confluence.internal/runbooks/auth-service-cert-rotation', 'runbook', 's0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'Procedures for rotating TLS certificates, SAML signing certificates, and OAuth client secrets for the Auth Service and its federation trusts.', 'a0000000-0000-0000-0000-000000000006'),
  ('Payment Gateway — Failover Procedures', 'https://confluence.internal/runbooks/payment-gateway-failover', 'runbook', 's0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Failover procedures for switching between Stripe and backup payment processor. Includes ACH network fallback and manual payment processing steps.', 'a0000000-0000-0000-0000-000000000002'),
  ('API Gateway — Rate Limiting Configuration Guide', 'https://confluence.internal/runbooks/api-gateway-rate-limiting', 'runbook', 's0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000003', 'Guide for configuring Kong rate limiting plugins including consumer-specific rules, internal service exemptions, and burst handling.', 'a0000000-0000-0000-0000-000000000001'),
  ('Event Bus — Consumer Lag Recovery', 'https://confluence.internal/runbooks/event-bus-consumer-lag', 'runbook', 's0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000003', 'Procedures for diagnosing and recovering from Kafka consumer lag including partition rebalancing, consumer group reset, and dead letter queue management.', 'a0000000-0000-0000-0000-000000000004'),
  ('Eligibility API — Cache Invalidation Runbook', 'https://confluence.internal/runbooks/eligibility-cache-invalidation', 'runbook', 's0000000-0000-0000-0000-000000000014', 'd0000000-0000-0000-0000-000000000005', 'Procedures for invalidating eligibility cache entries after enrollment changes, plan updates, or data corrections.', 'a0000000-0000-0000-0000-000000000009'),

  -- Architecture docs
  ('Claims Processing Architecture', 'https://confluence.internal/architecture/claims-processing', 'architecture', NULL, 'd0000000-0000-0000-0000-000000000004', 'End-to-end architecture diagram for claims processing pipeline from EDI 837 intake through adjudication, payment, and ERA 835 generation.', 'a0000000-0000-0000-0000-000000000009'),
  ('Identity & Access Management Architecture', 'https://confluence.internal/architecture/iam', 'architecture', NULL, 'd0000000-0000-0000-0000-000000000002', 'Architecture overview of the IAM stack including OAuth 2.0 flows, SAML federation, MFA, and session management.', 'a0000000-0000-0000-0000-000000000006'),
  ('Platform Infrastructure Architecture', 'https://confluence.internal/architecture/platform-infra', 'architecture', NULL, 'd0000000-0000-0000-0000-000000000003', 'Platform infrastructure architecture including API gateway, event bus, service mesh, and shared middleware components.', 'a0000000-0000-0000-0000-000000000001'),
  ('Member Portal Architecture', 'https://confluence.internal/architecture/member-portal', 'architecture', NULL, 'd0000000-0000-0000-0000-000000000007', 'Architecture diagram for the member-facing portal including BFF pattern, API aggregation, and caching strategy.', 'a0000000-0000-0000-0000-000000000003'),

  -- SOPs
  ('HIPAA Incident Response SOP', 'https://confluence.internal/sops/hipaa-incident-response', 'sop', NULL, NULL, 'Standard operating procedure for HIPAA-related security incidents including breach notification timelines, PHI exposure assessment, and regulatory reporting requirements.', 'a0000000-0000-0000-0000-000000000001'),
  ('Production Deployment SOP', 'https://confluence.internal/sops/production-deployment', 'sop', NULL, NULL, 'Standard operating procedure for production deployments including change management approval, canary deployment, rollback criteria, and post-deployment verification.', 'a0000000-0000-0000-0000-000000000001'),
  ('Database Migration SOP', 'https://confluence.internal/sops/database-migration', 'sop', NULL, NULL, 'Standard operating procedure for database schema migrations including backward compatibility requirements, rollback scripts, and connection pool impact assessment.', 'a0000000-0000-0000-0000-000000000004'),
  ('On-Call Escalation SOP', 'https://confluence.internal/sops/on-call-escalation', 'sop', NULL, NULL, 'On-call escalation procedures including severity classification, response time SLAs, and escalation paths for each domain team.', 'a0000000-0000-0000-0000-000000000002'),

  -- Post-mortems
  ('Post-Mortem: Claims Intake DB Connection Pool Exhaustion', 'https://confluence.internal/postmortems/INC-0847', 'postmortem', 's0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000004', 'Post-mortem for the Claims Intake API outage caused by database connection pool exhaustion during a schema migration.', 'a0000000-0000-0000-0000-000000000002'),
  ('Post-Mortem: Stripe Integration Timeout Cascade', 'https://confluence.internal/postmortems/INC-0812', 'postmortem', 's0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Post-mortem for the Payment Gateway timeout cascade caused by Stripe API latency during their maintenance window.', 'a0000000-0000-0000-0000-000000000002'),
  ('Post-Mortem: Auth Service TLS Certificate Expiry', 'https://confluence.internal/postmortems/INC-0789', 'postmortem', 's0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'Post-mortem for the Auth Service SSO failure caused by expired TLS certificate on the Azure AD federation trust.', 'a0000000-0000-0000-0000-000000000006'),
  ('Post-Mortem: Eligibility API Schema Migration Failure', 'https://confluence.internal/postmortems/INC-0801', 'postmortem', 's0000000-0000-0000-0000-000000000014', 'd0000000-0000-0000-0000-000000000005', 'Post-mortem for the Eligibility API error rate spike caused by a NOT NULL constraint migration on legacy enrollment records.', 'a0000000-0000-0000-0000-000000000009'),

  -- SLA docs
  ('Payments Domain SLA', 'https://confluence.internal/sla/payments-domain', 'sla', NULL, 'd0000000-0000-0000-0000-000000000001', 'Service Level Agreement for the Payments domain including availability targets, latency SLOs, and error budget policies for premium billing and payment processing.', 'a0000000-0000-0000-0000-000000000002'),
  ('Claims Domain SLA', 'https://confluence.internal/sla/claims-domain', 'sla', NULL, 'd0000000-0000-0000-0000-000000000004', 'Service Level Agreement for the Claims domain including claims processing SLAs, adjudication turnaround times, and EDI transaction response requirements.', 'a0000000-0000-0000-0000-000000000009'),
  ('Enrollment Domain SLA', 'https://confluence.internal/sla/enrollment-domain', 'sla', NULL, 'd0000000-0000-0000-0000-000000000005', 'Service Level Agreement for the Enrollment domain including eligibility verification response times, enrollment processing SLAs, and CMS submission deadlines.', 'a0000000-0000-0000-0000-000000000009'),
  ('Platform SLA', 'https://confluence.internal/sla/platform', 'sla', NULL, 'd0000000-0000-0000-0000-000000000003', 'Service Level Agreement for Platform infrastructure services including API gateway availability, event bus throughput guarantees, and notification delivery SLAs.', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Annotations
-- ============================================================

INSERT INTO public.annotations (entity_type, entity_id, annotation, user_id, user_name, timestamp) VALUES
  -- Service annotations
  ('service', 's0000000-0000-0000-0000-000000000011',
   '[RISK NOTE] Claims Intake API has experienced two database connection pool exhaustion incidents in the past 30 days. The underlying root cause (long-running analytical queries on the OLTP database) has not been fully remediated. Recommend migrating analytical workloads to a read replica before Q1 open enrollment peak.',
   'a0000000-0000-0000-0000-000000000002', 'Marcus Johnson', now() - interval '1 day'),

  ('service', 's0000000-0000-0000-0000-000000000004',
   '[RISK NOTE] Auth Service certificate management is partially automated. SAML metadata auto-refresh is implemented but not enabled for all federation trusts. Two certificate-related incidents in the past 30 days. Recommend completing automation for all IdP integrations before next quarterly certificate rotation.',
   'a0000000-0000-0000-0000-000000000006', 'David Kim', now() - interval '5 days'),

  ('service', 's0000000-0000-0000-0000-000000000014',
   '[OBSERVATION] Eligibility API error budget is at 83% consumed with 17% remaining. Burn rate of 1.7x will exhaust budget within 2 days at current rate. Primary contributor is the schema migration incident from 14 days ago.',
   'a0000000-0000-0000-0000-000000000009', 'Amanda Foster', now() - interval '2 days'),

  ('service', 's0000000-0000-0000-0000-000000000002',
   '[OBSERVATION] Payment Gateway Service circuit breaker thresholds were increased after the Stripe timeout cascade incident. Current thresholds: 5s timeout, 60% failure rate to open. Previous: 10s timeout, 80% failure rate. Monitoring for false positives.',
   'a0000000-0000-0000-0000-000000000002', 'Marcus Johnson', now() - interval '9 days'),

  ('service', 's0000000-0000-0000-0000-000000000008',
   '[CORRECTIVE ACTION] Event Bus consumer lag investigation in progress. Preliminary analysis suggests consumer rebalancing triggered by a pod restart. Increasing consumer group session timeout from 30s to 60s and adding lag alerting at 5-minute threshold.',
   'a0000000-0000-0000-0000-000000000004', 'James Wilson', now() - interval '3 hours'),

  ('service', 's0000000-0000-0000-0000-000000000019',
   '[OBSERVATION] Member Portal BFF performance improved after v2.9.1 deployment with eligibility caching. P95 latency reduced from 4.5s to 1.8s during open enrollment traffic. Monitoring cache hit rates — currently at 78%.',
   'a0000000-0000-0000-0000-000000000003', 'Priya Patel', now() - interval '10 days'),

  -- Incident annotations
  ('incident', 'i0000000-0000-0000-0000-000000000001',
   'Root cause confirmed: Long-running analytical query (claims_summary_report) acquired row-level locks on the claims table during peak submission window (2pm-4pm ET). Query ran for 47 minutes, exhausting all 50 connections in the pool. Immediate fix: increased pool to 200 connections. Permanent fix needed: migrate analytical queries to read replica.',
   'a0000000-0000-0000-0000-000000000003', 'Priya Patel', now() - interval '3 days' + interval '2 hours'),

  ('incident', 'i0000000-0000-0000-0000-000000000010',
   '[MANUAL OVERRIDE] Field: repeat_failure\nOriginal Value: false\nOverride Value: true\nReason: This incident has the same root cause as INC-0847 (database connection pool exhaustion on Claims Intake API). The previous remediation only increased pool size without addressing the underlying long-running query pattern. Marking as repeat failure for compliance tracking.',
   'a0000000-0000-0000-0000-000000000002', 'Marcus Johnson', now() - interval '1 day' + interval '1 hour'),

  ('incident', 'i0000000-0000-0000-0000-000000000004',
   'Performance analysis complete. The pharmacy benefit rule evaluation was performing a full table scan of the formulary for each claim line item. With the new 2024 formulary containing 12,000 entries (up from 3,000), this caused O(n²) behavior. Fix deployed in v5.2.1 using a hash-indexed lookup reducing evaluation from 45s to 0.3s per claim.',
   'a0000000-0000-0000-0000-000000000009', 'Amanda Foster', now() - interval '6 days'),

  ('incident', 'i0000000-0000-0000-0000-000000000011',
   'Consumer lag appears to be caused by a Kafka partition rebalance triggered when the adjudication-consumer-3 pod was evicted due to node memory pressure. The rebalance took 8 minutes to complete, during which no messages were consumed. Investigating node resource allocation.',
   'a0000000-0000-0000-0000-000000000004', 'James Wilson', now() - interval '2 hours'),

  -- Deployment annotations
  ('deployment', 'dp000000-0000-0000-0000-000000000001',
   '[CORRECTIVE ACTION] Deployment rolled back after Claims Intake API outage. The database migration (adding composite index on claims.member_id, claims.service_date) acquired an exclusive lock on the claims table. Future migrations must use CREATE INDEX CONCURRENTLY and be scheduled outside peak hours (before 8am ET or after 8pm ET).',
   'a0000000-0000-0000-0000-000000000003', 'Priya Patel', now() - interval '3 days' + interval '3 hours'),

  ('deployment', 'dp000000-0000-0000-0000-000000000009',
   '[CORRECTIVE ACTION] Deployment rolled back after Eligibility API error rate spike. Schema migration must include data backfill step before applying NOT NULL constraints. Added pre-migration data validation check to CI/CD pipeline.',
   'a0000000-0000-0000-0000-000000000009', 'Amanda Foster', now() - interval '14 days' + interval '2 hours')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Audit Logs — Sample admin actions
-- ============================================================

INSERT INTO public.audit_logs (action, entity_type, entity_id, user_id, user_name, details, ip_address, correlation_id, timestamp) VALUES
  ('UPLOAD_INTERIM_DATA', 'service', 'metric', 'a0000000-0000-0000-0000-000000000003', 'Priya Patel',
   '{"file_name": "claims-metrics-2024-01.csv", "data_type": "metric", "records_ingested": 4320, "records_failed": 0, "status": "success"}'::jsonb,
   '10.0.1.42', 'upload-1704067200-abc123', now() - interval '2 days'),

  ('CONFIGURE_METRICS', 'service', 'Claims:Claims Intake API', 'a0000000-0000-0000-0000-000000000009', 'Amanda Foster',
   '{"domain": "Claims", "application": "Claims Intake API", "metrics_count": 3, "config_ids": ["cfg-001", "cfg-002", "cfg-003"]}'::jsonb,
   '10.0.1.55', 'mcfg-1704067200-def456', now() - interval '5 days'),

  ('UPDATE_METRICS_CONFIG', 'service', 'cfg-payment-gw-latency', 'a0000000-0000-0000-0000-000000000002', 'Marcus Johnson',
   '{"config_id": "cfg-payment-gw-latency", "domain": "Payments", "application": "Payment Gateway Service", "metric_name": "latency_p95", "previous_threshold": 200, "new_threshold": 300}'::jsonb,
   '10.0.1.38', 'mcfg-1704153600-ghi789', now() - interval '9 days'),

  ('CREATE_ANNOTATION', 'service', 's0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000002', 'Marcus Johnson',
   '{"annotation_id": "ann-001", "annotation_text": "[RISK NOTE] Claims Intake API has experienced two database connection pool...", "entity_type": "service", "entity_id": "s0000000-0000-0000-0000-000000000011"}'::jsonb,
   '10.0.1.38', 'ann-1704240000-jkl012', now() - interval '1 day'),

  ('CREATE_DOCUMENTATION_LINK', 'service', 'doc-claims-runbook', 'a0000000-0000-0000-0000-000000000009', 'Amanda Foster',
   '{"link_id": "doc-claims-runbook", "title": "Claims Intake API — Incident Response Runbook", "url": "https://confluence.internal/runbooks/claims-intake-api", "category": "runbook"}'::jsonb,
   '10.0.1.55', 'doclink-1704326400-mno345', now() - interval '7 days'),

  ('UPLOAD_INTERIM_DATA', 'service', 'incident', 'a0000000-0000-0000-0000-000000000002', 'Marcus Johnson',
   '{"file_name": "incidents-january-2024.json", "data_type": "incident", "records_ingested": 14, "records_failed": 0, "status": "success"}'::jsonb,
   '10.0.1.38', 'upload-1704412800-pqr678', now() - interval '3 days'),

  ('UPLOAD_INTERIM_DATA', 'service', 'deployment', 'a0000000-0000-0000-0000-000000000004', 'James Wilson',
   '{"file_name": "deployments-week-3.csv", "data_type": "deployment", "records_ingested": 18, "records_failed": 0, "status": "success"}'::jsonb,
   '10.0.1.47', 'upload-1704499200-stu901', now() - interval '4 days'),

  ('UPLOAD_INTERIM_DATA', 'service', 'service_map', 'a0000000-0000-0000-0000-000000000001', 'Sarah Chen',
   '{"file_name": "dependency-map-v2.xlsx", "data_type": "service_map", "records_ingested": 52, "records_failed": 2, "status": "partial"}'::jsonb,
   '10.0.1.30', 'upload-1704585600-vwx234', now() - interval '6 days'),

  ('GENERATE_COMPLIANCE_REPORT', 'service', 'rpt-2024-01-compliance', 'a0000000-0000-0000-0000-000000000005', 'Emily Rodriguez',
   '{"report_id": "rpt-2024-01-compliance", "period": "30d", "format": "json", "total_services": 20, "total_incidents": 14, "services_breaching_sla": 3}'::jsonb,
   '10.0.1.60', 'compliance-1704672000-yza567', now() - interval '1 day'),

  ('EXPORT_AUDIT_LOGS', 'service', 'rpt-2024-01-compliance', 'a0000000-0000-0000-0000-000000000005', 'Emily Rodriguez',
   '{"report_id": "rpt-2024-01-compliance", "export_format": "csv", "file_name": "compliance-report-2024-01.csv", "record_count": 42}'::jsonb,
   '10.0.1.60', 'compliance-1704672000-yza567', now() - interval '1 day' + interval '5 minutes'),

  ('USER_LOGIN', 'service', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Sarah Chen',
   '{"login_method": "azure_ad_sso", "user_agent": "Mozilla/5.0"}'::jsonb,
   '10.0.1.30', 'auth-1704758400-bcd890', now() - interval '2 hours'),

  ('USER_LOGIN', 'service', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Marcus Johnson',
   '{"login_method": "azure_ad_sso", "user_agent": "Mozilla/5.0"}'::jsonb,
   '10.0.1.38', 'auth-1704758400-efg123', now() - interval '30 minutes'),

  ('CREATE_ANNOTATION', 'incident', 'i0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000004', 'James Wilson',
   '{"annotation_id": "ann-eventbus-lag", "annotation_text": "Consumer lag appears to be caused by a Kafka partition rebalance...", "entity_type": "incident", "entity_id": "i0000000-0000-0000-0000-000000000011"}'::jsonb,
   '10.0.1.47', 'ann-1704844800-hij456', now() - interval '2 hours')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Upload Logs — Sample upload history
-- ============================================================

INSERT INTO public.upload_logs (file_name, data_type, uploader, uploader_name, records_ingested, records_failed, errors, status, file_size_bytes, timestamp) VALUES
  ('claims-metrics-2024-01.csv', 'metric', 'a0000000-0000-0000-0000-000000000003', 'Priya Patel', 4320, 0, NULL, 'success', 524288, now() - interval '2 days'),
  ('incidents-january-2024.json', 'incident', 'a0000000-0000-0000-0000-000000000002', 'Marcus Johnson', 14, 0, NULL, 'success', 28672, now() - interval '3 days'),
  ('deployments-week-3.csv', 'deployment', 'a0000000-0000-0000-0000-000000000004', 'James Wilson', 18, 0, NULL, 'success', 12288, now() - interval '4 days'),
  ('dependency-map-v2.xlsx', 'service_map', 'a0000000-0000-0000-0000-000000000001', 'Sarah Chen', 52, 2, ARRAY['Row 34: Invalid dependency type "references". Must be one of: calls, publishes, subscribes, queries, depends_on.', 'Row 48: Missing required field "to_service".'], 'partial', 45056, now() - interval '6 days'),
  ('error-budgets-january.csv', 'error_budget', 'a0000000-0000-0000-0000-000000000009', 'Amanda Foster', 20, 0, NULL, 'success', 8192, now() - interval '7 days'),
  ('provider-metrics-weekly.csv', 'metric', 'a0000000-0000-0000-0000-000000000002', 'Marcus Johnson', 2160, 0, NULL, 'success', 262144, now() - interval '8 days'),
  ('enrollment-incidents-q4.json', 'incident', 'a0000000-0000-0000-0000-000000000009', 'Amanda Foster', 8, 1, ARRAY['Row 6: Invalid severity "high". Must be one of: critical, major, minor, warning.'], 'partial', 16384, now() - interval '10 days'),
  ('platform-metrics-daily.csv', 'metric', 'a0000000-0000-0000-0000-000000000004', 'James Wilson', 8640, 0, NULL, 'success', 1048576, now() - interval '12 days'),
  ('identity-metrics-weekly.csv', 'metric', 'a0000000-0000-0000-0000-000000000006', 'David Kim', 3240, 0, NULL, 'success', 393216, now() - interval '14 days'),
  ('bad-format-test.txt', 'metric', 'a0000000-0000-0000-0000-000000000003', 'Priya Patel', 0, 0, ARRAY['Unsupported file type: "bad-format-test.txt". Accepted types: .csv, .xlsx, .xls, .json.'], 'failed', 1024, now() - interval '15 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Complete
-- ============================================================