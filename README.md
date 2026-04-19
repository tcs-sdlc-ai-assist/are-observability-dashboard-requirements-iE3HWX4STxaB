# ARE Observability Dashboard

**Application Reliability Engineering Observability Dashboard** — a comprehensive, enterprise-grade observability platform for healthcare payer organizations. Built with Next.js 14, Supabase, and Azure AD, it provides real-time visibility into service health, SLA/SLO compliance, incident analytics, error budgets, and service dependencies across all business domains.

> **Private & Confidential** — This software is proprietary. See [License](#license) for details.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Folder Structure](#folder-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Supabase Setup](#supabase-setup)
  - [Running the Development Server](#running-the-development-server)
- [RBAC Roles & Permissions](#rbac-roles--permissions)
- [API Endpoints](#api-endpoints)
- [Deployment](#deployment)
- [License](#license)

---

## Overview

The ARE Observability Dashboard consolidates observability data from multiple sources (Dynatrace, Elastic, ServiceNow, manual uploads) into a unified executive view. It enables Application Reliability Engineering (ARE) leads, SRE engineers, platform engineers, and executives to monitor service health, track SLA/SLO compliance, analyze incidents, manage error budgets, and visualize service dependencies — all within a single, role-secured interface.

Key capabilities:

- **Executive Overview** — Availability snapshots, degraded services, SLO compliance heatmaps, error budget summaries, and incident counts at a glance.
- **Golden Signals** — Latency (P50/P95/P99), traffic (RPS), error rates (4xx/5xx), and saturation (CPU/memory/disk) with threshold breach detection.
- **Incident Analytics & RCA** — Incident counts by severity, MTTR/MTTD trends, root cause analysis, repeat failure detection, and change failure correlation.
- **Error Budget Tracking** — Burn-down charts, burn rate history, projected breach dates, and actionable recommendations.
- **Service Dependency Map** — Interactive topology graph with blast radius computation and health status indicators.
- **Compliance & Governance** — SLA/SLO compliance reports, incident audit evidence, documentation links, and CSV export for regulatory reporting.
- **Embedded Dashboards** — Dynatrace and Elastic dashboards embedded via iframes with auto-refresh and fullscreen support.
- **Admin Panel** — Data upload (CSV/Excel/JSON), metrics threshold configuration, audit log viewer, and documentation link management.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 14](https://nextjs.org/) (App Router, Server Components, Edge Middleware) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (strict mode) |
| **Authentication** | [NextAuth.js](https://next-auth.js.org/) with Azure AD (Microsoft Entra ID) SSO |
| **Database** | [Supabase](https://supabase.com/) (PostgreSQL with Row Level Security) |
| **UI Components** | [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) primitives |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) with custom design tokens (Horizon brand) |
| **Charts** | [Recharts](https://recharts.org/) (line, area, bar, composed, pie charts) |
| **Graph Visualization** | [React Flow](https://reactflow.dev/) (service dependency topology) |
| **Data Fetching** | [SWR](https://swr.vercel.app/) with configurable refresh intervals |
| **Validation** | [Zod](https://zod.dev/) schemas for API request/response validation |
| **File Parsing** | [Papa Parse](https://www.papaparse.com/) (CSV) + [SheetJS](https://sheetjs.com/) (Excel) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Deployment** | [Vercel](https://vercel.com/) (Edge Runtime, serverless functions) |

---

## Features

### Executive Overview Dashboard
- Availability snapshot with domain/tier grid and color-coded health status
- Top degraded services table with severity badges and drill-down navigation
- SLO compliance heatmap with met/at-risk/breached status indicators
- Error budget summary table with budget remaining percentage and burn rate
- Incident summary cards with P1–P4 severity counts and MTTR/MTTD averages
- Global filter bar with domain, tier, environment, and time period selectors

### Golden Signals Visualization
- Latency chart (P50/P95/P99) with threshold reference lines and trend indicators
- Traffic chart (RPS) with area chart, average reference line, and anomaly detection
- Error rate chart (5xx/4xx) with composed bar/line chart and threshold breach alerts
- Saturation chart (CPU/Memory/Disk) with warning and critical threshold indicators
- Summary metric cards with sparkline support and change percentage

### Service Dependency Map
- Interactive React Flow graph with custom service node components
- Color-coded node types: service, database, queue, external, cache
- Health status indicators (healthy/degraded/down/unknown) on each node
- Blast radius computation and highlighting when an incident is selected
- Minimap, zoom controls, fullscreen toggle, and depth-configurable traversal

### Incident Analytics & Root Cause Analysis
- Incident counts by severity (P1–P4) with trend direction indicators
- MTTR/MTTD trends chart with dual-axis line chart and tier-based thresholds
- Root cause analysis breakdown with interactive donut chart
- Repeat failure pattern detection with systemic pattern identification
- Change failure correlation analysis mapping deployments to incidents
- Detailed incident analytics table with sortable columns and pagination

### Error Budget Tracking
- Error budget burn-down chart with dual-axis area chart
- Budget progress bar with consumption visualization and threshold markers
- Projected breach date calculation and warning alerts
- Burn rate history with warning (1.0x) and critical (2.0x) thresholds
- Recommendations engine generating actionable items based on budget state

### Compliance & Governance Reporting
- SLA compliance table with availability percentage, target, and breach count
- Incident audit table with severity, status, root cause, MTTR, and evidence links
- Compliance summary metrics: SLA compliance rate, overall availability, avg MTTR
- CSV export of full compliance report
- Evidence links management for incidents with URL validation and type inference
- Documentation link management (playbooks, runbooks, SOPs, architecture docs)

### Embedded External Dashboards
- Dynatrace and Elastic dashboard embedding with configurable URL and selector
- Auto-refresh support with configurable intervals (30s, 1m, 5m, 10m)
- Fullscreen toggle and open-in-new-tab functionality
- Blocked iframe fallback with troubleshooting guidance

### Admin Panel
- Drag-and-drop file upload with validation (CSV, Excel, JSON)
- Metrics threshold configuration with tier-based auto-fill defaults
- Immutable audit log viewer with filterable, searchable, paginated table
- Documentation links CRUD with category filtering and search
- All admin actions recorded in the audit trail for compliance

### Annotation System
- Create/edit/delete annotations on incidents, metrics, services, and deployments
- Annotation categories: Risk Note, Manual Override, Observation, Corrective Action
- Inline editing with keyboard shortcuts (Ctrl+Enter to save, Escape to cancel)

### Authentication & Authorization
- Azure AD (Microsoft Entra ID) Single Sign-On via NextAuth.js
- Role-Based Access Control (RBAC) with six roles
- Permission-based access enforcement on all API routes via `withRBAC` middleware
- Client-side `RoleGuard` component for conditional UI rendering
- Session management with 8-hour JWT expiry and automatic token refresh
- Inactive user account blocking at both middleware and API layers

---

## Folder Structure

```
are-observability-dashboard/
├── public/                          # Static assets
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── api/                     # API route handlers
│   │   │   ├── admin/               # Admin API routes
│   │   │   │   ├── audit-logs/      # GET audit logs
│   │   │   │   ├── compliance-report/ # GET compliance report (JSON/CSV)
│   │   │   │   ├── configure-metrics/ # GET/POST/PUT/DELETE metrics config
│   │   │   │   ├── documentation-links/ # GET/POST/PUT/DELETE doc links
│   │   │   │   └── upload-data/     # GET/POST file upload & history
│   │   │   ├── auth/                # NextAuth.js handler
│   │   │   ├── dashboard/           # Dashboard API routes
│   │   │   │   ├── annotations/     # GET/POST/PUT/DELETE annotations
│   │   │   │   ├── availability/    # GET availability data
│   │   │   │   ├── dependency-map/  # GET dependency graph
│   │   │   │   ├── error-budgets/   # GET error budget data
│   │   │   │   ├── golden-signals/  # GET golden signals
│   │   │   │   └── incidents/       # GET incident analytics
│   │   │   └── health/              # GET health check
│   │   ├── auth/
│   │   │   └── signin/              # Custom sign-in page
│   │   ├── dashboard/               # Dashboard pages (authenticated)
│   │   │   ├── admin/               # Admin panel page
│   │   │   ├── compliance/          # Compliance & governance page
│   │   │   ├── dependencies/        # Service dependency map page
│   │   │   ├── embedded/            # Embedded dashboards page
│   │   │   ├── golden-signals/      # Golden signals page
│   │   │   ├── incidents/           # Incident analytics page
│   │   │   ├── layout.tsx           # Authenticated layout wrapper
│   │   │   └── page.tsx             # Executive overview (landing page)
│   │   ├── globals.css              # Global styles & Tailwind layers
│   │   ├── layout.tsx               # Root layout
│   │   ├── loading.tsx              # Global loading skeleton
│   │   ├── not-found.tsx            # 404 page
│   │   ├── error.tsx                # Global error boundary
│   │   ├── page.tsx                 # Root redirect
│   │   └── providers.tsx            # Client providers (NextAuth, SWR, Theme)
│   ├── components/
│   │   ├── admin/                   # Admin panel components
│   │   │   ├── audit-log-viewer.tsx
│   │   │   ├── data-upload-form.tsx
│   │   │   └── metrics-config-form.tsx
│   │   ├── dashboard/               # Dashboard module components
│   │   │   ├── annotations/         # Annotation dialog & list
│   │   │   ├── compliance/          # Compliance report, evidence, doc links
│   │   │   ├── dependencies/        # Dependency graph, blast radius, service node
│   │   │   ├── embedded/            # Embedded dashboard iframe
│   │   │   ├── executive/           # Availability, degraded services, error budget, SLO
│   │   │   ├── golden-signals/      # Latency, traffic, error rate, saturation charts
│   │   │   └── incidents/           # Incident summary, MTTR/MTTD, RCA, failure patterns
│   │   ├── layout/                  # Layout components
│   │   │   ├── dashboard-shell.tsx
│   │   │   ├── footer.tsx
│   │   │   ├── header.tsx
│   │   │   └── sidebar.tsx
│   │   ├── shared/                  # Shared/reusable components
│   │   │   ├── error-boundary.tsx
│   │   │   ├── filter-bar.tsx
│   │   │   ├── loading-skeleton.tsx
│   │   │   ├── metric-card.tsx
│   │   │   ├── role-guard.tsx
│   │   │   └── status-badge.tsx
│   │   └── ui/                      # shadcn/ui primitives
│   ├── constants/
│   │   └── constants.ts             # Centralized enums, labels, colors, thresholds, routes
│   ├── hooks/
│   │   ├── use-admin-data.ts        # SWR hooks for admin data (audit, config, uploads, annotations)
│   │   ├── use-auth.ts              # Authentication hook with typed role checks
│   │   └── use-dashboard-data.ts    # SWR hooks for dashboard data (availability, signals, incidents)
│   ├── lib/
│   │   ├── auth.ts                  # NextAuth configuration & RBAC helpers
│   │   ├── supabase.ts              # Supabase client (browser & server)
│   │   ├── utils.ts                 # Utility functions (formatting, colors, parsing)
│   │   ├── validators.ts            # Zod schemas & validation helpers
│   │   └── services/                # Backend service layer
│   │       ├── analytics-engine.ts  # Availability, golden signals, error budgets, incidents
│   │       ├── annotation-service.ts # Annotation CRUD & manual overrides
│   │       ├── audit-logger.ts      # Immutable audit log writes & queries
│   │       ├── compliance-report-service.ts # Compliance report generation & CSV export
│   │       ├── dependency-map-service.ts    # Dependency graph & blast radius computation
│   │       ├── documentation-link-service.ts # Documentation link CRUD
│   │       ├── ingestion-service.ts # File parsing, validation, batch insert
│   │       ├── metrics-config-service.ts    # Metrics threshold configuration CRUD
│   │       └── rbac.ts              # Server-side RBAC middleware (withRBAC)
│   ├── middleware.ts                # Edge middleware (auth enforcement, security headers)
│   └── types/
│       └── index.ts                 # TypeScript type definitions for all data models
├── supabase/
│   ├── seed.sql                     # Database schema (tables, indexes, RLS policies)
│   └── sample-data.sql              # Sample data (20 services, 14 incidents, metrics, etc.)
├── .env.example                     # Environment variable template
├── .eslintrc.json                   # ESLint configuration
├── components.json                  # shadcn/ui configuration
├── next.config.js                   # Next.js configuration (headers, CSP, images)
├── package.json                     # Dependencies and scripts
├── postcss.config.js                # PostCSS configuration
├── tailwind.config.ts               # Tailwind CSS configuration (custom tokens)
├── tsconfig.json                    # TypeScript configuration
├── vercel.json                      # Vercel deployment configuration
├── CHANGELOG.md                     # Release changelog
└── README.md                        # This file
```

---

## Getting Started

### Prerequisites

- **Node.js** 18.17 or later
- **npm** 9+ (or yarn/pnpm)
- **Supabase** project (free tier works for development)
- **Azure AD** (Microsoft Entra ID) app registration for SSO
- **Git**

### Installation

```bash
# Clone the repository
git clone https://github.com/example/are-observability-dashboard.git
cd are-observability-dashboard

# Install dependencies
npm install
```

### Environment Configuration

Copy the example environment file and fill in your values:

```bash
cp .env.example .env.local
```

Configure the following environment variables in `.env.local`:

```env
# NextAuth.js Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-a-random-32-char-secret>

# Azure AD (Microsoft Entra ID) Configuration
AZURE_AD_CLIENT_ID=<your-azure-ad-client-id>
AZURE_AD_CLIENT_SECRET=<your-azure-ad-client-secret>
AZURE_AD_TENANT_ID=<your-azure-ad-tenant-id>

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>

# Observability Embed URLs (optional)
DYNATRACE_EMBED_URL=https://<your-dynatrace-instance>.live.dynatrace.com
ELASTIC_EMBED_URL=https://<your-elastic-instance>.elastic.co
```

**Generating a NextAuth secret:**

```bash
openssl rand -base64 32
```

**Azure AD Setup:**

1. Register a new application in the [Azure Portal](https://portal.azure.com/) → Azure Active Directory → App registrations.
2. Set the redirect URI to `http://localhost:3000/api/auth/callback/azure-ad` (and your production URL).
3. Create a client secret under Certificates & secrets.
4. Configure API permissions: `openid`, `profile`, `email`, `User.Read`.
5. (Optional) Configure App Roles for role-based access: `Admin`, `ARE Lead`, `SRE Engineer`, `Platform Engineer`, `Executive`, `Viewer`.

### Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com/).
2. Navigate to the SQL Editor in your Supabase dashboard.
3. Run the schema creation script:

```bash
# Copy the contents of supabase/seed.sql and execute in the Supabase SQL Editor
```

4. (Optional) Load sample data for development:

```bash
# Copy the contents of supabase/sample-data.sql and execute in the Supabase SQL Editor
```

The schema creates 16 tables with comprehensive indexing, Row Level Security (RLS) policies, auto-updating `updated_at` triggers, and UUID primary keys.

**Tables created:**

| Table | Description |
|---|---|
| `users` | User accounts with roles and Azure AD mapping |
| `domains` | Business domains (Payments, Claims, etc.) |
| `applications` | Applications within domains |
| `services` | Individual services with tier and environment |
| `metrics` | Time-series metrics (latency, errors, traffic, saturation, availability) |
| `incidents` | Incident records with severity, status, root cause |
| `deployments` | Deployment records with version and status |
| `error_budgets` | Error budget snapshots per service |
| `annotations` | Annotations on entities (incidents, services, etc.) |
| `audit_logs` | Immutable audit trail |
| `dependency_nodes` | Service topology nodes |
| `dependency_edges` | Service topology edges |
| `metrics_config` | Metric threshold configurations |
| `documentation_links` | Playbooks, runbooks, SOPs, architecture docs |
| `upload_logs` | File upload history |
| `evidence_links` | Incident audit evidence URLs |

### Running the Development Server

```bash
# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. You will be redirected to the sign-in page.

**Available scripts:**

| Command | Description |
|---|---|
| `npm run dev` | Start the development server (port 3000) |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint checks |
| `npm run type-check` | Run TypeScript type checking (no emit) |

---

## RBAC Roles & Permissions

The dashboard enforces Role-Based Access Control (RBAC) at both the API layer (`withRBAC` middleware) and the UI layer (`RoleGuard` component).

| Role | Description | Key Permissions |
|---|---|---|
| **Admin** | Full system access | All permissions — `read:all`, `write:all`, `delete:all`, `manage:users`, `manage:services`, `upload:data`, `view:audit_log`, `annotate:all` |
| **ARE Lead** | Application Reliability Engineering lead | `read:all`, `write:services`, `write:incidents`, `upload:data`, `view:audit_log`, `annotate:all` |
| **SRE Engineer** | Site Reliability Engineer | `read:all`, `write:incidents`, `write:annotations`, `upload:data`, `annotate:all` |
| **Platform Engineer** | Platform/infrastructure engineer | `read:all`, `write:services`, `write:deployments`, `upload:data`, `annotate:all` |
| **Executive** | Executive/VP-level read-only access | `read:all`, `read:reports` |
| **Viewer** | Read-only dashboard access | `read:dashboard`, `read:services`, `read:incidents`, `read:metrics` |

**Role hierarchy:** Admin > ARE Lead > SRE Engineer / Platform Engineer > Executive > Viewer

Admin role has implicit access to all permissions. Role assignments are synchronized from Azure AD group claims to Supabase on sign-in.

---

## API Endpoints

All API routes are protected by the `withRBAC` middleware unless otherwise noted. Responses follow a consistent JSON envelope:

```json
{
  "data": { ... },
  "status": "success",
  "correlation_id": "req-...",
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

### Health Check

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | None | Application health check with Supabase connectivity and environment validation |

### Dashboard APIs

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/api/dashboard/availability` | `read:dashboard` | Availability data with domain/tier/environment/period filters |
| `GET` | `/api/dashboard/golden-signals` | `read:dashboard` | Golden signals with service/domain/application/environment/metrics/period filters |
| `GET` | `/api/dashboard/error-budgets` | `read:dashboard` | Error budget data with service_id and period parameters |
| `GET` | `/api/dashboard/dependency-map` | `read:dashboard` | Dependency graph with incident/service/domain/tier/environment/depth parameters |
| `GET` | `/api/dashboard/incidents` | `read:dashboard` | Incident analytics with domain/service/severity/status/period filters |
| `GET` | `/api/dashboard/annotations` | `read:dashboard` | List annotations with entity_type/entity_id/user_id/time range filters |
| `POST` | `/api/dashboard/annotations` | `annotate:all` | Create a new annotation |
| `PUT` | `/api/dashboard/annotations` | `annotate:all` | Update an existing annotation |
| `DELETE` | `/api/dashboard/annotations` | `annotate:all` | Delete an annotation |

### Admin APIs

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/api/admin/audit-logs` | `view:audit_log` | Paginated audit log query with filters |
| `GET` | `/api/admin/compliance-report` | `view:audit_log` | Compliance report generation (JSON or CSV) |
| `GET` | `/api/admin/configure-metrics` | `read:all` | List metrics threshold configurations |
| `POST` | `/api/admin/configure-metrics` | `write:services` | Create metrics threshold configurations |
| `PUT` | `/api/admin/configure-metrics` | `write:services` | Update a metrics threshold configuration |
| `DELETE` | `/api/admin/configure-metrics` | `write:services` | Delete a metrics threshold configuration |
| `GET` | `/api/admin/upload-data` | `upload:data` | Upload history |
| `POST` | `/api/admin/upload-data` | `upload:data` | Upload a data file (multipart form data) |
| `GET` | `/api/admin/documentation-links` | `read:dashboard` | List documentation links |
| `POST` | `/api/admin/documentation-links` | `write:services` | Create a documentation link |
| `PUT` | `/api/admin/documentation-links` | `write:services` | Update a documentation link |
| `DELETE` | `/api/admin/documentation-links` | `write:services` | Delete a documentation link |

### Query Parameters

All list endpoints support pagination via `page` (default: 1) and `page_size` (default: 20, max: 100). Time-based filters accept ISO 8601 date strings. The `period` parameter accepts: `1h`, `6h`, `12h`, `24h`, `7d`, `14d`, `30d`, `90d`.

---

## Deployment

### Vercel (Recommended)

The application is optimized for deployment on [Vercel](https://vercel.com/):

1. **Connect your repository** to Vercel via the dashboard or CLI.

2. **Configure environment variables** in the Vercel project settings:
   - `NEXTAUTH_URL` — Your production URL (e.g., `https://are-dashboard.vercel.app`)
   - `NEXTAUTH_SECRET` — A strong random secret
   - `AZURE_AD_CLIENT_ID` — Azure AD application client ID
   - `AZURE_AD_CLIENT_SECRET` — Azure AD application client secret
   - `AZURE_AD_TENANT_ID` — Azure AD tenant ID
   - `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
   - `DYNATRACE_EMBED_URL` — (Optional) Dynatrace instance URL
   - `ELASTIC_EMBED_URL` — (Optional) Elastic instance URL

3. **Update Azure AD redirect URI** to include your production callback URL:
   ```
   https://your-domain.vercel.app/api/auth/callback/azure-ad
   ```

4. **Deploy:**
   ```bash
   vercel --prod
   ```

The `vercel.json` configuration includes:
- Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- API route cache control (no-store)
- SPA rewrites for client-side routing
- Region configuration (`iad1` — US East)

### Build Verification

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Production build
npm run build
```

### Security Headers

Security headers are applied at three layers for defense-in-depth:

1. **`next.config.js`** — Content-Security-Policy, HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
2. **`src/middleware.ts`** — Edge middleware applies headers to all responses and enforces authentication on protected routes
3. **`vercel.json`** — Vercel-level headers for API routes and static assets

---

## License

**PRIVATE AND CONFIDENTIAL**

This software is proprietary and confidential. Unauthorized copying, distribution, modification, or use of this software, via any medium, is strictly prohibited. All rights reserved.

© 2024 ARE Observability Dashboard. All rights reserved.