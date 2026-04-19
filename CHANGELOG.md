# Changelog

All notable changes to the ARE Observability Dashboard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-15

### Added

#### Authentication & Authorization
- Azure AD (Microsoft Entra ID) Single Sign-On integration via NextAuth.js
- Role-Based Access Control (RBAC) with six roles: Admin, ARE Lead, SRE Engineer, Platform Engineer, Executive, and Viewer
- Permission-based access enforcement on all API routes via `withRBAC` middleware
- Client-side `RoleGuard` component for conditional UI rendering based on user role
- Automatic user provisioning and role synchronization from Azure AD group claims to Supabase
- Session management with 8-hour JWT expiry and automatic token refresh
- Inactive user account blocking at both middleware and API layers
- Custom sign-in page with Azure AD SSO button and error handling

#### Executive Overview Dashboard
- Availability snapshot with domain/tier grid showing color-coded health status
- Top degraded services table with severity badges, degradation percentage, and drill-down navigation
- SLO compliance heatmap with met/at-risk/breached status indicators per service
- Error budget summary table with budget remaining percentage, burn rate, and trend direction
- Incident summary cards with P1–P4 severity counts, MTTR/MTTD averages, and root cause distribution
- Global filter bar with domain, tier, environment, and time period selectors
- Responsive layout with metric card grids and collapsible sidebar navigation

#### Golden Signals Visualization
- Latency chart (P50/P95/P99) with Recharts line chart, threshold reference lines, and trend indicators
- Traffic chart (RPS) with area chart, average reference line, and traffic anomaly detection
- Error rate chart (5xx/4xx) with composed bar/line chart and tier-based threshold breach alerts
- Saturation chart (CPU/Memory/Disk) with multi-line chart, warning and critical threshold indicators
- Summary metric cards with sparkline support, threshold breach badges, and change percentage
- Configurable time period selector (1h to 90d) with automatic data refresh via SWR

#### Service Dependency Map
- Interactive React Flow graph visualization with custom service node components
- Color-coded node types: service, database, queue, external, and cache
- Health status indicators (healthy/degraded/down/unknown) on each node
- Criticality tier badges (Tier-1 through Tier-4) displayed on nodes
- Blast radius computation and highlighting when an incident is selected
- Animated edges for blast radius paths with affected service badges
- Minimap, zoom controls, and fullscreen toggle
- Selected node info panel with upstream/downstream dependency lists
- Depth-configurable traversal (1–10 hops) for subgraph extraction
- Blast radius side panel with impact severity estimation, tier breakdown, and domain grouping

#### Incident Analytics & Root Cause Analysis
- Incident counts by severity (P1–P4) with trend direction indicators
- MTTR/MTTD trends chart with dual-axis line chart and tier-based threshold reference lines
- Root cause analysis breakdown with interactive donut chart and category detail list
- Repeat failure pattern detection with systemic pattern identification and corrective action recommendations
- Change failure correlation analysis mapping deployments to incidents with confidence scoring
- Deployment-incident timeline chart with combined bar/line visualization
- Detailed incident analytics table with sortable columns, severity/status/root cause filters, and pagination
- Failure pattern analysis with affected services breakdown and recommended actions

#### Error Budget Tracking
- Error budget burn-down chart with dual-axis area chart showing budget remaining and burn rate
- Budget progress bar with consumption visualization and threshold markers
- Projected breach date calculation and warning alerts
- Burn rate history with warning (1.0x) and critical (2.0x) threshold reference lines
- Error budget summary table with sortable columns, breach status filter, and trend indicators
- Recommendations engine generating actionable items based on budget state and burn rate

#### Embedded External Dashboards
- Dynatrace dashboard embedding with configurable URL and dashboard selector
- Elastic (Kibana) dashboard embedding with APM, logs, metrics, and uptime views
- Auto-refresh support with configurable intervals (30s, 1m, 5m, 10m)
- Fullscreen toggle and open-in-new-tab functionality
- Loading state with connection indicator and timeout detection
- Blocked iframe fallback with troubleshooting guidance (CSP, X-Frame-Options)

#### Admin Panel — Data Upload
- Drag-and-drop file upload zone with file type validation (CSV, Excel, JSON)
- Data type selector for incident, metric, service_map, deployment, and error_budget uploads
- File validation mode (dry-run) with row-level error reporting
- Upload progress indicator with simulated progress increments
- Upload result panel showing ingested/failed record counts and error details
- Upload history table with status badges, file metadata, and uploader attribution
- File size validation (10 MB max) and record count limits (50,000 max)
- All uploads recorded in the audit log with uploader identity and file metadata

#### Admin Panel — Metrics Configuration
- Metric threshold configuration form with domain/application selectors
- Support for 10 metric types: latency (P50/P95/P99), errors (4xx/5xx), traffic (RPS), saturation (CPU/Memory/Disk), and availability
- Auto-fill threshold values based on selected criticality tier defaults
- Bulk metric entry with add/remove rows and duplicate detection
- Existing configurations table with inline toggle (enable/disable) and delete with confirmation dialog
- Configuration summary grouped by domain/application with enabled/disabled counts
- All configuration changes recorded in the audit log with previous and new values

#### Admin Panel — Audit Log Viewer
- Immutable audit trail table with timestamp, actor, action type, entity, details, IP address, and correlation ID
- Filterable by action type, entity type, user ID, and time range
- Full-text search across all audit log fields
- Sortable columns with ascending/descending toggle
- Paginated results with configurable page size
- CSV export functionality for compliance reporting
- Summary metric cards showing total entries, unique users, action types, and critical actions
- Action category badges (Upload, Config, Delete, Create, Auth, Export) with color coding

#### Compliance & Governance Reporting
- Comprehensive compliance report generation with SLA/uptime reports, incident audits, and audit trail
- SLA compliance table with availability percentage, target, breach count, and downtime minutes
- Incident audit table with severity, status, root cause, MTTR, evidence links, and annotation counts
- Compliance summary metrics: SLA compliance rate, overall availability, avg MTTR, change failure rate
- Recommendations engine generating prioritized actions based on SLA breaches, repeat failures, and MTTR thresholds
- CSV export of full compliance report with summary, SLA reports, incident audits, and recommendations sections
- Evidence links management for incidents with URL validation, type inference, and status tracking
- Incident evidence viewer with add/edit/delete capabilities and audit trail logging

#### Documentation Link Management
- CRUD operations for documentation links (playbooks, runbooks, SOPs, architecture docs, post-mortems, SLA documents)
- Category-based filtering and full-text search across title, description, and URL
- Grouped list view by category with expandable sections
- Table view mode for compact display
- URL validation (HTTP/HTTPS only) with hostname extraction for display
- Service and domain association for contextual documentation
- Summary badges showing link counts by category
- All changes recorded in the audit log with previous and new values

#### Annotation System
- Create/edit/delete annotations on incidents, metrics, services, and deployments
- Annotation categories: Risk Note, Manual Override, Observation, Corrective Action, General Note
- Manual override support with structured field/original value/override value/reason format
- Inline editing with keyboard shortcuts (Ctrl+Enter to save, Escape to cancel)
- Character count with 5,000 character limit
- Category detection from annotation text prefix
- Annotation list with author avatars, timestamps, category badges, and edit indicators
- Delete confirmation dialog with audit trail notice

#### Shared Components
- `MetricCard` — Reusable KPI display with trend indicator, sparkline, threshold breach detection, and change percentage
- `MetricCardGrid` — Responsive grid layout for metric cards (2–5 columns)
- `StatusBadge` — Health status badge mapping (healthy/degraded/critical/unknown)
- `SeverityBadge` — Incident severity badge (critical/major/minor/warning)
- `TierBadge` — Criticality tier badge (Tier-1 through Tier-4)
- `IncidentStatusBadge` — Incident status badge (open/investigating/mitigated/resolved/closed)
- `DeploymentStatusBadge` — Deployment status badge (success/failed/rolled_back/in_progress)
- `SLOStatusBadge` — SLO compliance badge (met/breached)
- `FilterBar` — Reusable filter bar with domain, application, tier, environment, period, severity, and status selectors
- `ErrorBoundary` — React error boundary with inline, card, and full-page fallback variants
- `ModuleErrorBoundary` — Convenience wrapper for dashboard module error isolation
- `RoleGuard` — Client-side RBAC guard with role, permission, and admin checks
- `PageSkeleton` — Full page loading skeleton composing filter bar, metric cards, chart, and table skeletons
- Loading skeletons for cards, charts, tables, filter bars, sidebars, and detail pages

#### Layout & Navigation
- Global header with navigation links, user profile dropdown, role display, and sign-out
- Collapsible sidebar with icon-only mode, tooltips, and role-based admin section visibility
- Footer with copyright, version info, and links to audit log, data upload, and documentation
- Dashboard shell layout with sticky header, scrollable sidebar, and main content area
- Mobile-responsive hamburger menu for navigation on small screens
- Active route highlighting in both header and sidebar navigation

#### API Routes
- `GET /api/health` — Application health check with Supabase connectivity and environment validation
- `GET /api/dashboard/availability` — Availability data with domain/tier/environment/period filters
- `GET /api/dashboard/golden-signals` — Golden signals with service/domain/application/environment/metrics/period filters
- `GET /api/dashboard/error-budgets` — Error budget data with service_id and period parameters
- `GET /api/dashboard/dependency-map` — Dependency graph with incident/service/domain/tier/environment/depth parameters
- `GET /api/dashboard/incidents` — Incident analytics with domain/service/severity/status/period filters
- `GET/POST/PUT/DELETE /api/dashboard/annotations` — Full CRUD for annotations with entity scoping
- `GET/POST /api/admin/upload-data` — File upload ingestion and upload history
- `GET/POST/PUT/DELETE /api/admin/configure-metrics` — Metrics threshold configuration CRUD
- `GET /api/admin/audit-logs` — Paginated audit log query with filters
- `GET /api/admin/compliance-report` — Compliance report generation with JSON and CSV output
- `GET/POST/PUT/DELETE /api/admin/documentation-links` — Documentation link CRUD

#### Backend Services
- `analytics-engine` — Computes availability, golden signals, error budgets, incident trends, SLO compliance, and root cause analytics
- `annotation-service` — Annotation CRUD with manual override support and bulk operations
- `audit-logger` — Immutable audit log writes with correlation ID tracking and IP address extraction
- `compliance-report-service` — Full compliance report generation with SLA reports, incident audits, and CSV export
- `dependency-map-service` — Dependency graph construction, subgraph extraction, and blast radius computation
- `documentation-link-service` — Documentation link CRUD with category management and bulk operations
- `ingestion-service` — File parsing (CSV/Excel/JSON), row-level validation, batch database insertion, and upload logging
- `metrics-config-service` — Metrics threshold configuration CRUD with summary and existence checks
- `rbac` — Server-side RBAC middleware with role hierarchy, permission matrix, and convenience wrappers

#### Data Layer
- Supabase PostgreSQL database with 16 tables and comprehensive indexing
- Row Level Security (RLS) policies for all tables with service_role full access
- Auto-updating `updated_at` triggers on mutable tables
- UUID primary keys with `uuid-ossp` extension
- Sample data script with 20 services across 7 healthcare payer domains
- 30 days of hourly metrics data (720 data points per service per metric type)
- 14 realistic incidents with evidence links, annotations, and deployment correlations
- 18 deployment records with rollback and incident association
- 20 error budget records with burn rate and projected breach dates
- 52 dependency edges across services, databases, caches, queues, and external systems
- 32 metrics threshold configurations across all domains
- 22 documentation links (runbooks, architecture, SOPs, post-mortems, SLAs)
- 12 annotations including risk notes, manual overrides, and corrective actions
- 13 audit log entries covering uploads, configurations, annotations, and compliance reports
- 10 upload log records with success, partial, and failed statuses

#### Validation & Security
- Zod schema validation for all API request bodies and query parameters
- Input sanitization for query parameters with null byte and control character removal
- Pagination parameter validation with configurable limits (max 100 per page)
- File type and size validation for uploads
- HTTP/HTTPS URL validation for documentation and evidence links
- Content Security Policy headers via Next.js config and middleware
- Security headers: HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- CSRF protection via NextAuth.js session tokens
- Correlation ID generation for request tracing across API calls and audit logs

#### Developer Experience
- TypeScript strict mode with comprehensive type definitions in `src/types/index.ts`
- ESLint configuration with Next.js core web vitals and TypeScript rules
- Tailwind CSS with custom design tokens (Horizon brand colors, dashboard shadows, status colors)
- shadcn/ui component library with custom badge variants (tier, severity, status)
- SWR data fetching hooks with configurable refresh intervals and deduplication
- Custom `useAuth` hook with typed role checks and permission evaluation
- Custom `useDashboardData` composite hook for parallel data fetching
- Custom `useAdminData` hooks for audit logs, metrics config, documentation links, and upload operations
- Centralized constants file with enums, labels, colors, thresholds, routes, and configuration

[1.0.0]: https://github.com/example/are-observability-dashboard/releases/tag/v1.0.0