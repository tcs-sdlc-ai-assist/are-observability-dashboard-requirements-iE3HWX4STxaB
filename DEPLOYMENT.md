# Deployment & Operations Guide

**ARE Observability Dashboard** — Comprehensive deployment, configuration, and operations documentation for production, staging, and development environments.

> **Private & Confidential** — This document contains infrastructure configuration details. Handle according to your organization's security policies.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Supabase Project Setup](#supabase-project-setup)
  - [Creating a Supabase Project](#creating-a-supabase-project)
  - [Database Migration](#database-migration)
  - [Loading Sample Data](#loading-sample-data)
  - [Row Level Security](#row-level-security)
  - [Database Backups](#database-backups)
- [Azure AD App Registration](#azure-ad-app-registration)
  - [Creating the App Registration](#creating-the-app-registration)
  - [Configuring Redirect URIs](#configuring-redirect-uris)
  - [API Permissions](#api-permissions)
  - [App Roles Configuration](#app-roles-configuration)
  - [Client Secret Management](#client-secret-management)
- [Vercel Deployment](#vercel-deployment)
  - [Initial Setup](#initial-setup)
  - [Environment Variable Configuration](#environment-variable-configuration)
  - [Build Configuration](#build-configuration)
  - [Custom Domain Setup](#custom-domain-setup)
  - [Deployment Regions](#deployment-regions)
- [CI/CD with GitHub Actions](#cicd-with-github-actions)
  - [Workflow Configuration](#workflow-configuration)
  - [Branch Strategy](#branch-strategy)
  - [Automated Checks](#automated-checks)
  - [Preview Deployments](#preview-deployments)
  - [Production Deployment Pipeline](#production-deployment-pipeline)
- [Monitoring & Observability](#monitoring--observability)
  - [Health Check Endpoint](#health-check-endpoint)
  - [Vercel Analytics](#vercel-analytics)
  - [Supabase Monitoring](#supabase-monitoring)
  - [Uptime Monitoring](#uptime-monitoring)
  - [Error Tracking](#error-tracking)
  - [Audit Log Monitoring](#audit-log-monitoring)
- [Rollback Procedures](#rollback-procedures)
  - [Vercel Rollback](#vercel-rollback)
  - [Database Rollback](#database-rollback)
  - [Configuration Rollback](#configuration-rollback)
  - [Emergency Procedures](#emergency-procedures)
- [Security Hardening](#security-hardening)
  - [Security Headers](#security-headers)
  - [Content Security Policy](#content-security-policy)
  - [Secret Rotation](#secret-rotation)
  - [Access Control Audit](#access-control-audit)
- [Troubleshooting](#troubleshooting)
  - [Common Deployment Issues](#common-deployment-issues)
  - [Database Connectivity](#database-connectivity)
  - [Authentication Failures](#authentication-failures)
  - [Performance Issues](#performance-issues)

---

## Prerequisites

Before deploying the ARE Observability Dashboard, ensure you have the following:

| Requirement | Version / Details |
|---|---|
| **Node.js** | 18.17 or later |
| **npm** | 9+ (or yarn/pnpm) |
| **Git** | Latest stable |
| **Vercel Account** | Pro or Enterprise plan recommended for production |
| **Supabase Account** | Free tier works for development; Pro recommended for production |
| **Azure AD Tenant** | Microsoft Entra ID with admin access for app registration |
| **GitHub Repository** | Connected to Vercel for CI/CD |

### Required CLI Tools

```bash
# Install Vercel CLI
npm install -g vercel

# Install Supabase CLI (optional, for local development)
npm install -g supabase

# Verify installations
node --version    # >= 18.17
npm --version     # >= 9.0
vercel --version
```

---

## Environment Variables

The application requires the following environment variables. All variables must be configured in your deployment platform (Vercel) and locally in `.env.local` for development.

### Required Variables

| Variable | Description | Example |
|---|---|---|
| `NEXTAUTH_URL` | The canonical URL of your application | `https://are-dashboard.vercel.app` |
| `NEXTAUTH_SECRET` | Random secret for JWT encryption (min 32 chars) | `<openssl rand -base64 32>` |
| `AZURE_AD_CLIENT_ID` | Azure AD application (client) ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `AZURE_AD_CLIENT_SECRET` | Azure AD client secret value | `<secret-value>` |
| `AZURE_AD_TENANT_ID` | Azure AD directory (tenant) ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://abcdefgh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous (public) key | `eyJhbGciOiJIUzI1NiIs...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) | `eyJhbGciOiJIUzI1NiIs...` |

### Optional Variables

| Variable | Description | Default |
|---|---|---|
| `DYNATRACE_EMBED_URL` | Dynatrace instance URL for embedded dashboards | `https://your-dynatrace-instance.live.dynatrace.com` |
| `ELASTIC_EMBED_URL` | Elastic instance URL for embedded dashboards | `https://your-elastic-instance.elastic.co` |

### Generating the NextAuth Secret

```bash
# Option 1: OpenSSL
openssl rand -base64 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Local Development Setup

```bash
# Copy the example environment file
cp .env.example .env.local

# Edit .env.local with your values
# IMPORTANT: Never commit .env.local to version control
```

### Environment Variable Validation

The application validates critical environment variables at startup via the `/api/health` endpoint. Missing variables will cause the health check to report `unhealthy` status with details about which variables are missing.

```bash
# Verify environment configuration
curl https://your-domain.vercel.app/api/health | jq .
```

Expected healthy response:

```json
{
  "status": "healthy",
  "version": "0.1.0",
  "checks": {
    "supabase": { "status": "healthy", "latency_ms": 42 },
    "environment": { "status": "healthy" }
  }
}
```

---

## Supabase Project Setup

### Creating a Supabase Project

1. Navigate to [supabase.com](https://supabase.com/) and sign in.
2. Click **New Project** and configure:
   - **Organization**: Select or create your organization.
   - **Project Name**: `are-observability-dashboard` (or your preferred name).
   - **Database Password**: Generate a strong password and store it securely.
   - **Region**: Select the region closest to your Vercel deployment (e.g., `us-east-1` for `iad1`).
   - **Pricing Plan**: Free for development; Pro recommended for production.
3. Wait for the project to finish provisioning (typically 1–2 minutes).
4. Navigate to **Settings → API** to retrieve:
   - `NEXT_PUBLIC_SUPABASE_URL` — The project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — The `anon` public key.
   - `SUPABASE_SERVICE_ROLE_KEY` — The `service_role` key (keep this secret).

### Database Migration

The database schema is defined in `supabase/seed.sql`. This script creates all 16 tables, indexes, Row Level Security (RLS) policies, and triggers.

#### Option 1: Supabase SQL Editor (Recommended for first-time setup)

1. Open your Supabase project dashboard.
2. Navigate to **SQL Editor**.
3. Click **New Query**.
4. Copy the entire contents of `supabase/seed.sql` and paste into the editor.
5. Click **Run** (or press `Ctrl+Enter`).
6. Verify the tables were created by navigating to **Table Editor**.

#### Option 2: Supabase CLI

```bash
# Link your local project to the Supabase project
supabase link --project-ref <your-project-ref>

# Run the migration
supabase db push

# Or execute the SQL file directly
supabase db execute --file supabase/seed.sql
```

#### Option 3: psql Direct Connection

```bash
# Get the connection string from Supabase Settings → Database → Connection string
psql "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" -f supabase/seed.sql
```

#### Verifying the Migration

After running the migration, verify that all 16 tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables:

| Table | Description |
|---|---|
| `annotations` | Annotations on entities |
| `applications` | Applications within domains |
| `audit_logs` | Immutable audit trail |
| `dependency_edges` | Service topology edges |
| `dependency_nodes` | Service topology nodes |
| `deployments` | Deployment records |
| `documentation_links` | Playbooks, runbooks, SOPs |
| `domains` | Business domains |
| `error_budgets` | Error budget snapshots |
| `evidence_links` | Incident audit evidence URLs |
| `incidents` | Incident records |
| `metrics` | Time-series metrics |
| `metrics_config` | Metric threshold configurations |
| `services` | Individual services |
| `upload_logs` | File upload history |
| `users` | User accounts |

### Loading Sample Data

For development and demo environments, load the sample data script:

```bash
# Via Supabase SQL Editor: paste contents of supabase/sample-data.sql

# Via psql:
psql "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" -f supabase/sample-data.sql
```

The sample data includes:

- 10 users across 6 roles
- 7 healthcare payer domains
- 7 applications
- 20 services across all domains
- 30 days of hourly metrics (720 data points per service per metric type)
- 14 realistic incidents with evidence links and annotations
- 18 deployment records with rollback and incident associations
- 20 error budget records
- 52 dependency edges across services, databases, caches, queues, and external systems
- 32 metrics threshold configurations
- 22 documentation links
- 12 annotations including risk notes, manual overrides, and corrective actions
- 13 audit log entries
- 10 upload log records

> **Warning**: Do not load sample data into production environments. The sample data is intended for development and demonstration only.

### Row Level Security

All tables have Row Level Security (RLS) enabled. The application uses the `service_role` key for all server-side operations, which bypasses RLS by default. The RLS policies are configured as follows:

- **`service_role`**: Full access (SELECT, INSERT, UPDATE, DELETE) on all tables.
- **`authenticated`**: Read-only access (SELECT) on all tables.
- **`audit_logs`**: Immutable — no UPDATE or DELETE for non-service roles.

If you need to modify RLS policies for your deployment:

```sql
-- Example: Allow authenticated users to insert annotations
CREATE POLICY "Authenticated users can create annotations"
  ON public.annotations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);
```

### Database Backups

#### Supabase Managed Backups (Pro Plan)

Supabase Pro plan includes daily automated backups with 7-day retention. To configure:

1. Navigate to **Settings → Database → Backups**.
2. Verify that daily backups are enabled.
3. For point-in-time recovery (PITR), upgrade to the Pro plan.

#### Manual Backup

```bash
# Export the database using pg_dump
pg_dump "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" \
  --format=custom \
  --no-owner \
  --no-privileges \
  -f are-dashboard-backup-$(date +%Y%m%d).dump

# Restore from backup
pg_restore \
  --dbname="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" \
  --no-owner \
  --no-privileges \
  are-dashboard-backup-20240115.dump
```

#### Pre-Deployment Backup Checklist

Before any production deployment that includes database changes:

1. ☐ Create a manual backup using `pg_dump`.
2. ☐ Verify the backup file is non-empty and valid.
3. ☐ Store the backup in a secure location (e.g., encrypted S3 bucket).
4. ☐ Document the backup timestamp and file location in the deployment ticket.
5. ☐ Test the restore procedure in a staging environment.

---

## Azure AD App Registration

### Creating the App Registration

1. Sign in to the [Azure Portal](https://portal.azure.com/).
2. Navigate to **Azure Active Directory → App registrations → New registration**.
3. Configure the registration:
   - **Name**: `ARE Observability Dashboard`
   - **Supported account types**: `Accounts in this organizational directory only` (Single tenant)
   - **Redirect URI**: Select `Web` and enter:
     - Development: `http://localhost:3000/api/auth/callback/azure-ad`
     - Production: `https://your-domain.vercel.app/api/auth/callback/azure-ad`
4. Click **Register**.
5. Note the following values from the **Overview** page:
   - **Application (client) ID** → `AZURE_AD_CLIENT_ID`
   - **Directory (tenant) ID** → `AZURE_AD_TENANT_ID`

### Configuring Redirect URIs

After registration, add all required redirect URIs:

1. Navigate to **Authentication → Platform configurations → Web**.
2. Add the following redirect URIs:

| Environment | Redirect URI |
|---|---|
| Local Development | `http://localhost:3000/api/auth/callback/azure-ad` |
| Vercel Preview | `https://<project>-*-<team>.vercel.app/api/auth/callback/azure-ad` |
| Vercel Production | `https://your-domain.vercel.app/api/auth/callback/azure-ad` |
| Custom Domain | `https://are-dashboard.yourdomain.com/api/auth/callback/azure-ad` |

3. Under **Implicit grant and hybrid flows**, ensure both checkboxes are **unchecked** (the app uses the authorization code flow via NextAuth.js).
4. Under **Advanced settings**, set **Allow public client flows** to **No**.
5. Click **Save**.

### API Permissions

1. Navigate to **API permissions → Add a permission → Microsoft Graph → Delegated permissions**.
2. Add the following permissions:

| Permission | Type | Description |
|---|---|---|
| `openid` | Delegated | Sign users in |
| `profile` | Delegated | View users' basic profile |
| `email` | Delegated | View users' email address |
| `User.Read` | Delegated | Sign in and read user profile |

3. Click **Add permissions**.
4. If your organization requires it, click **Grant admin consent for [Organization]**.

### App Roles Configuration

To enable role-based access control via Azure AD group claims:

1. Navigate to **App roles → Create app role**.
2. Create the following roles:

| Display Name | Value | Description | Allowed Member Types |
|---|---|---|---|
| Admin | `Admin` | Full system access | Users/Groups |
| ARE Lead | `ARE_Lead` | Application Reliability Engineering lead | Users/Groups |
| SRE Engineer | `SRE_Engineer` | Site Reliability Engineer | Users/Groups |
| Platform Engineer | `Platform_Engineer` | Platform/infrastructure engineer | Users/Groups |
| Executive | `Executive` | Executive read-only access | Users/Groups |
| Viewer | `Viewer` | Read-only dashboard access | Users/Groups |

3. Navigate to **Enterprise applications → [Your App] → Users and groups**.
4. Assign users or groups to the appropriate roles.

> **Note**: The application maps Azure AD role claims to internal roles using the `AZURE_AD_ROLE_MAP` in `src/lib/auth.ts`. If no role is assigned, users default to the `viewer` role.

### Client Secret Management

1. Navigate to **Certificates & secrets → Client secrets → New client secret**.
2. Configure:
   - **Description**: `ARE Dashboard Production` (or environment-specific name)
   - **Expires**: Select an appropriate expiry (recommended: 12 months for production, 24 months for development)
3. Click **Add**.
4. **Immediately copy the secret value** — it will not be shown again.
5. Store the value as `AZURE_AD_CLIENT_SECRET` in your environment variables.

#### Secret Rotation Schedule

| Environment | Rotation Frequency | Reminder |
|---|---|---|
| Production | Every 12 months | Set calendar reminder 30 days before expiry |
| Staging | Every 24 months | Set calendar reminder 30 days before expiry |
| Development | Every 24 months | Rotate when expired |

#### Rotating the Client Secret

1. Create a new client secret in Azure AD (do not delete the old one yet).
2. Update the `AZURE_AD_CLIENT_SECRET` environment variable in Vercel.
3. Trigger a redeployment to pick up the new secret.
4. Verify authentication works with the new secret.
5. Delete the old client secret from Azure AD.
6. Log the rotation in the audit trail.

---

## Vercel Deployment

### Initial Setup

#### Option 1: Vercel Dashboard (Recommended)

1. Sign in to [vercel.com](https://vercel.com/).
2. Click **Add New → Project**.
3. Import your GitHub repository.
4. Vercel will auto-detect the Next.js framework.
5. Configure the project settings (see below).
6. Click **Deploy**.

#### Option 2: Vercel CLI

```bash
# Login to Vercel
vercel login

# Link the project (from the repository root)
vercel link

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Environment Variable Configuration

Configure all environment variables in the Vercel project settings:

1. Navigate to **Project Settings → Environment Variables**.
2. Add each variable with the appropriate scope:

| Variable | Production | Preview | Development |
|---|---|---|---|
| `NEXTAUTH_URL` | `https://your-domain.vercel.app` | `https://<auto>` | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | `<production-secret>` | `<preview-secret>` | `<dev-secret>` |
| `AZURE_AD_CLIENT_ID` | ✅ | ✅ | ✅ |
| `AZURE_AD_CLIENT_SECRET` | ✅ | ✅ | ✅ |
| `AZURE_AD_TENANT_ID` | ✅ | ✅ | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | ✅ |
| `DYNATRACE_EMBED_URL` | ✅ (optional) | ✅ (optional) | ✅ (optional) |
| `ELASTIC_EMBED_URL` | ✅ (optional) | ✅ (optional) | ✅ (optional) |

> **Important**: Use different `NEXTAUTH_SECRET` values for each environment. Use separate Supabase projects for production and staging/preview to avoid data contamination.

> **Important**: For preview deployments, `NEXTAUTH_URL` should be set to the Vercel-generated preview URL or left unset (NextAuth.js will auto-detect in Vercel environments).

### Build Configuration

The `vercel.json` configuration is already included in the repository:

```json
{
  "version": 2,
  "framework": "nextjs",
  "regions": ["iad1"],
  "headers": [...],
  "rewrites": [...]
}
```

#### Build Settings in Vercel Dashboard

| Setting | Value |
|---|---|
| **Framework Preset** | Next.js |
| **Build Command** | `npm run build` (default) |
| **Output Directory** | `.next` (default) |
| **Install Command** | `npm install` (default) |
| **Node.js Version** | 18.x |
| **Root Directory** | `.` (repository root) |

#### Build Verification

Before deploying to production, verify the build locally:

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Production build
npm run build

# Start production server locally
npm run start
```

### Custom Domain Setup

1. Navigate to **Project Settings → Domains**.
2. Add your custom domain (e.g., `are-dashboard.yourdomain.com`).
3. Configure DNS records as instructed by Vercel:
   - **CNAME**: `are-dashboard.yourdomain.com` → `cname.vercel-dns.com`
   - Or **A Record**: `76.76.21.21` (for apex domains)
4. Vercel will automatically provision and renew TLS certificates via Let's Encrypt.
5. Update the following after domain configuration:
   - `NEXTAUTH_URL` environment variable → `https://are-dashboard.yourdomain.com`
   - Azure AD redirect URI → `https://are-dashboard.yourdomain.com/api/auth/callback/azure-ad`

### Deployment Regions

The application is configured to deploy to `iad1` (US East — Washington, D.C.) via `vercel.json`. To change the region:

1. Update the `regions` field in `vercel.json`:

```json
{
  "regions": ["iad1"]
}
```

2. Available regions for serverless functions:

| Region Code | Location |
|---|---|
| `iad1` | US East (Washington, D.C.) |
| `sfo1` | US West (San Francisco) |
| `lhr1` | Europe (London) |
| `hnd1` | Asia Pacific (Tokyo) |
| `cdg1` | Europe (Paris) |
| `sin1` | Asia Pacific (Singapore) |

3. Choose a region close to your Supabase project for optimal latency.

---

## CI/CD with GitHub Actions

### Workflow Configuration

Create `.github/workflows/ci.yml` for automated checks on pull requests:

```yaml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-and-typecheck:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run TypeScript type check
        run: npm run type-check

  build:
    name: Build
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: lint-and-typecheck

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          NEXTAUTH_URL: http://localhost:3000
          NEXTAUTH_SECRET: ci-build-secret-not-for-production
          AZURE_AD_CLIENT_ID: ${{ secrets.AZURE_AD_CLIENT_ID }}
          AZURE_AD_CLIENT_SECRET: ${{ secrets.AZURE_AD_CLIENT_SECRET }}
          AZURE_AD_TENANT_ID: ${{ secrets.AZURE_AD_TENANT_ID }}
```

### Branch Strategy

| Branch | Purpose | Deployment Target | Auto-Deploy |
|---|---|---|---|
| `main` | Production-ready code | Vercel Production | ✅ |
| `develop` | Integration branch | Vercel Preview | ✅ |
| `feature/*` | Feature development | Vercel Preview (per-PR) | ✅ |
| `hotfix/*` | Emergency fixes | Vercel Preview → Production | ✅ |
| `release/*` | Release candidates | Vercel Preview | ✅ |

### Automated Checks

The following checks run on every pull request:

1. **ESLint** — Code quality and style enforcement.
2. **TypeScript Type Check** — Strict type validation with `tsc --noEmit`.
3. **Production Build** — Ensures the application builds successfully.

All checks must pass before a pull request can be merged.

### Preview Deployments

Vercel automatically creates preview deployments for every pull request:

- Each PR gets a unique URL: `https://<project>-<hash>-<team>.vercel.app`
- Preview deployments use the **Preview** environment variables.
- Preview deployments are automatically deleted when the PR is closed.
- Comment on the PR with the preview URL for team review.

> **Note**: Preview deployments share the same Supabase project as staging. Use a separate Supabase project for production.

### Production Deployment Pipeline

Production deployments follow this pipeline:

```
Feature Branch → Pull Request → CI Checks → Code Review → Merge to main → Vercel Production Deploy
```

1. **Developer** creates a feature branch and opens a PR against `main` (or `develop`).
2. **CI** runs lint, type check, and build automatically.
3. **Vercel** creates a preview deployment for the PR.
4. **Reviewer** reviews code and tests the preview deployment.
5. **Merge** to `main` triggers an automatic production deployment.
6. **Vercel** builds and deploys to production.
7. **Health check** is verified post-deployment.

#### Manual Production Deployment

If you need to deploy manually (e.g., bypassing CI):

```bash
# Deploy to production via CLI
vercel --prod

# Or promote a specific preview deployment
vercel promote <deployment-url>
```

---

## Monitoring & Observability

### Health Check Endpoint

The application exposes a health check endpoint at `/api/health` that verifies:

- Supabase database connectivity and latency.
- Critical environment variable presence.
- Application version and uptime.

```bash
# Check application health
curl -s https://your-domain.vercel.app/api/health | jq .

# Monitor with a cron job (every 5 minutes)
*/5 * * * * curl -sf https://your-domain.vercel.app/api/health > /dev/null || alert "ARE Dashboard health check failed"
```

#### Health Check Response Codes

| Status Code | Meaning |
|---|---|
| `200` | All checks healthy |
| `503` | One or more checks unhealthy or degraded |

#### Health Check Response Schema

```json
{
  "status": "healthy | degraded | unhealthy",
  "version": "0.1.0",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "correlation_id": "health-...",
  "uptime_seconds": 12345,
  "checks": {
    "supabase": {
      "status": "healthy | unhealthy",
      "latency_ms": 42,
      "message": "optional error message"
    },
    "environment": {
      "status": "healthy | unhealthy",
      "message": "optional missing vars list"
    }
  }
}
```

### Vercel Analytics

Enable Vercel Analytics for production monitoring:

1. Navigate to **Project → Analytics** in the Vercel dashboard.
2. Enable **Web Vitals** for Core Web Vitals tracking.
3. Enable **Speed Insights** for performance monitoring.
4. Monitor key metrics:
   - **LCP** (Largest Contentful Paint) — Target: < 2.5s
   - **FID** (First Input Delay) — Target: < 100ms
   - **CLS** (Cumulative Layout Shift) — Target: < 0.1
   - **TTFB** (Time to First Byte) — Target: < 800ms

### Supabase Monitoring

Monitor database health via the Supabase dashboard:

1. **Database → Reports**: Query performance, connection counts, and cache hit rates.
2. **Database → Replication**: Monitor replication lag (if using read replicas).
3. **Auth → Users**: Monitor authentication activity.
4. **Storage → Usage**: Monitor storage consumption.

Key metrics to watch:

| Metric | Warning Threshold | Critical Threshold |
|---|---|---|
| Active connections | > 80% of pool | > 95% of pool |
| Query latency (P95) | > 500ms | > 2000ms |
| Database size | > 80% of plan limit | > 95% of plan limit |
| Cache hit rate | < 95% | < 90% |

### Uptime Monitoring

Configure external uptime monitoring for the health check endpoint:

#### Option 1: Vercel Cron (Built-in)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/health",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

#### Option 2: External Monitoring Services

Configure your preferred uptime monitoring service to check:

- **URL**: `https://your-domain.vercel.app/api/health`
- **Method**: `GET`
- **Expected Status**: `200`
- **Check Interval**: Every 5 minutes
- **Timeout**: 10 seconds
- **Alert Channels**: Email, Slack, PagerDuty

### Error Tracking

The application logs errors to the server console. For production error tracking:

1. **Vercel Logs**: Navigate to **Project → Deployments → [Deployment] → Functions** to view serverless function logs.
2. **Runtime Logs**: Navigate to **Project → Logs** for real-time log streaming.
3. **Error Filtering**: Filter logs by:
   - `error` level for application errors.
   - `warn` level for warnings and deprecations.
   - Function name for specific API route errors.

#### Recommended: Integrate with an Error Tracking Service

For production environments, consider integrating with Sentry, Datadog, or a similar service for structured error tracking, alerting, and issue management.

### Audit Log Monitoring

The application maintains an immutable audit trail in the `audit_logs` table. Monitor for:

- **Failed login attempts**: `action = 'LOGIN_FAILED'`
- **User deactivations**: `action = 'DEACTIVATE_USER'`
- **Configuration changes**: `action LIKE 'CONFIGURE_%' OR action LIKE 'UPDATE_%' OR action LIKE 'DELETE_%'`
- **Data uploads**: `action = 'UPLOAD_INTERIM_DATA' OR action = 'UPLOAD_FAILED'`
- **Compliance report generation**: `action = 'GENERATE_COMPLIANCE_REPORT'`

```sql
-- Recent critical audit events (last 24 hours)
SELECT action, entity_type, entity_id, user_name, timestamp
FROM public.audit_logs
WHERE timestamp > now() - interval '24 hours'
  AND (
    action IN ('LOGIN_FAILED', 'DEACTIVATE_USER', 'DELETE_SERVICE', 'DELETE_METRICS_CONFIG')
    OR action LIKE 'UPLOAD_FAILED%'
  )
ORDER BY timestamp DESC
LIMIT 50;
```

---

## Rollback Procedures

### Vercel Rollback

Vercel maintains a history of all deployments. To rollback to a previous deployment:

#### Option 1: Vercel Dashboard (Recommended)

1. Navigate to **Project → Deployments**.
2. Find the last known-good deployment.
3. Click the **⋮** menu → **Promote to Production**.
4. Confirm the promotion.

#### Option 2: Vercel CLI

```bash
# List recent deployments
vercel ls

# Promote a specific deployment to production
vercel promote <deployment-url>

# Example:
vercel promote are-dashboard-abc123-team.vercel.app
```

#### Option 3: Git Revert

```bash
# Revert the problematic commit
git revert <commit-hash>
git push origin main

# Vercel will automatically deploy the reverted code
```

### Database Rollback

#### Rolling Back a Schema Migration

If a database migration causes issues:

1. **Identify the migration**: Check the audit log for recent `UPLOAD_INTERIM_DATA` or schema change entries.
2. **Restore from backup**: Use the pre-deployment backup created during the deployment checklist.

```bash
# Restore from backup
pg_restore \
  --dbname="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" \
  --clean \
  --no-owner \
  --no-privileges \
  are-dashboard-backup-<timestamp>.dump
```

3. **Verify data integrity**: Run validation queries to ensure data consistency.

```sql
-- Verify table row counts
SELECT
  'users' as table_name, count(*) as row_count FROM public.users
UNION ALL SELECT 'services', count(*) FROM public.services
UNION ALL SELECT 'incidents', count(*) FROM public.incidents
UNION ALL SELECT 'metrics', count(*) FROM public.metrics
UNION ALL SELECT 'audit_logs', count(*) FROM public.audit_logs
ORDER BY table_name;
```

#### Rolling Back Data Uploads

If a data upload introduced bad data:

1. Check the `upload_logs` table for the upload ID.
2. Identify the affected records by timestamp and data type.
3. Delete the affected records:

```sql
-- Example: Remove metrics from a bad upload (by timestamp range)
DELETE FROM public.metrics
WHERE timestamp BETWEEN '<upload-start-time>' AND '<upload-end-time>'
  AND service_id = '<affected-service-id>';

-- Log the rollback in the audit trail
INSERT INTO public.audit_logs (action, entity_type, entity_id, user_id, user_name, details, timestamp)
VALUES (
  'ROLLBACK_DATA_UPLOAD',
  'service',
  '<upload-log-id>',
  '<your-user-id>',
  '<your-name>',
  '{"reason": "Bad data detected", "records_removed": <count>, "upload_log_id": "<upload-log-id>"}'::jsonb,
  now()
);
```

### Configuration Rollback

If a metrics configuration change causes issues:

1. Check the audit log for the configuration change:

```sql
SELECT * FROM public.audit_logs
WHERE action IN ('CONFIGURE_METRICS', 'UPDATE_METRICS_CONFIG', 'DELETE_METRICS_CONFIG')
ORDER BY timestamp DESC
LIMIT 10;
```

2. The audit log `details` field contains the previous values. Use them to restore:

```sql
-- Example: Restore a threshold to its previous value
UPDATE public.metrics_config
SET threshold = <previous_threshold>, updated_at = now()
WHERE id = '<config-id>';
```

### Emergency Procedures

#### Complete Service Outage

If the application is completely unavailable:

1. **Check Vercel Status**: Visit [vercel.com/status](https://www.vercel-status.com/) for platform-wide issues.
2. **Check Supabase Status**: Visit [status.supabase.com](https://status.supabase.com/) for database issues.
3. **Check Health Endpoint**: `curl https://your-domain.vercel.app/api/health`
4. **Review Vercel Logs**: Check for deployment errors or function crashes.
5. **Rollback**: If the issue started after a deployment, rollback to the previous deployment immediately.
6. **Escalate**: If the issue is infrastructure-related, contact Vercel or Supabase support.

#### Authentication Outage

If users cannot sign in:

1. **Check Azure AD Status**: Visit [status.azure.com](https://status.azure.com/).
2. **Verify Client Secret**: Ensure the `AZURE_AD_CLIENT_SECRET` has not expired.
3. **Check Redirect URIs**: Verify the redirect URI matches the deployment URL.
4. **Review Auth Logs**: Check Vercel function logs for the `/api/auth/` routes.
5. **Temporary Bypass**: If Azure AD is down, there is no bypass — the application requires SSO authentication.

#### Data Corruption

If data corruption is detected:

1. **Immediately** stop all data uploads and configuration changes.
2. **Identify** the scope of corruption (which tables, which records).
3. **Restore** from the most recent clean backup.
4. **Verify** data integrity after restoration.
5. **Investigate** the root cause and implement preventive measures.
6. **Document** the incident in the audit log and create a post-mortem.

---

## Security Hardening

### Security Headers

Security headers are applied at three layers for defense-in-depth:

| Layer | File | Headers Applied |
|---|---|---|
| **Next.js Config** | `next.config.js` | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy |
| **Edge Middleware** | `src/middleware.ts` | X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, HSTS |
| **Vercel Config** | `vercel.json` | X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Cache-Control (API routes) |

### Content Security Policy

The CSP is configured in `next.config.js`:

```
default-src 'self';
script-src 'self' 'unsafe-eval' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in;
font-src 'self' data:;
connect-src 'self' https://*.supabase.co https://*.supabase.in;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

If you need to embed Dynatrace or Elastic dashboards, update the CSP to allow framing from those domains:

```javascript
// In next.config.js, update the frame-src directive:
"frame-src 'self' https://*.live.dynatrace.com https://*.elastic.co",
```

### Secret Rotation

Maintain a rotation schedule for all secrets:

| Secret | Rotation Frequency | Owner | Procedure |
|---|---|---|---|
| `NEXTAUTH_SECRET` | Every 12 months | Platform Team | Generate new secret → Update Vercel env → Redeploy → Verify auth |
| `AZURE_AD_CLIENT_SECRET` | Every 12 months | Identity Team | Create new secret in Azure AD → Update Vercel env → Redeploy → Delete old secret |
| `SUPABASE_SERVICE_ROLE_KEY` | On compromise only | Platform Team | Regenerate in Supabase dashboard → Update Vercel env → Redeploy |
| Supabase DB Password | Every 12 months | Platform Team | Reset in Supabase dashboard → Update connection strings |

### Access Control Audit

Periodically audit user access and permissions:

```sql
-- List all active users and their roles
SELECT name, email, role, is_active, last_login_at
FROM public.users
WHERE is_active = true
ORDER BY role, name;

-- Identify inactive users (no login in 90 days)
SELECT name, email, role, last_login_at
FROM public.users
WHERE is_active = true
  AND (last_login_at IS NULL OR last_login_at < now() - interval '90 days')
ORDER BY last_login_at ASC NULLS FIRST;

-- Audit admin actions in the last 30 days
SELECT user_name, action, entity_type, entity_id, timestamp
FROM public.audit_logs
WHERE timestamp > now() - interval '30 days'
  AND action IN ('CREATE_USER', 'UPDATE_USER', 'DEACTIVATE_USER', 'CHANGE_USER_ROLE', 'DELETE_SERVICE', 'DELETE_METRICS_CONFIG')
ORDER BY timestamp DESC;
```

---

## Troubleshooting

### Common Deployment Issues

#### Build Fails with TypeScript Errors

```
Type error: Property 'X' does not exist on type 'Y'
```

**Resolution**:
1. Run `npm run type-check` locally to reproduce.
2. Fix the type errors.
3. Ensure all dependencies are up to date: `npm install`.

#### Build Fails with Missing Environment Variables

```
Error: Missing Supabase environment variables
```

**Resolution**:
1. Verify all required environment variables are set in Vercel project settings.
2. Ensure variables are scoped to the correct environment (Production/Preview/Development).
3. Check that `NEXT_PUBLIC_` prefixed variables are set (they are embedded at build time).

#### Deployment Succeeds but Pages Return 500

**Resolution**:
1. Check Vercel function logs for the specific error.
2. Verify Supabase connectivity: `curl https://your-domain.vercel.app/api/health`.
3. Ensure the `SUPABASE_SERVICE_ROLE_KEY` is correct and the Supabase project is active.
4. Check that database migrations have been applied.

### Database Connectivity

#### "Failed to fetch" Errors in the Dashboard

**Resolution**:
1. Verify the Supabase project is running and accessible.
2. Check the `NEXT_PUBLIC_SUPABASE_URL` is correct.
3. Verify the `SUPABASE_SERVICE_ROLE_KEY` has not been regenerated.
4. Check Supabase dashboard for connection pool exhaustion.
5. If using the free tier, check if the project has been paused due to inactivity.

#### Supabase Connection Pool Exhaustion

```
Error: remaining connection slots are reserved for non-replication superuser connections
```

**Resolution**:
1. Check active connections in Supabase dashboard → Database → Reports.
2. Reduce the number of concurrent serverless function instances in Vercel.
3. Consider upgrading to Supabase Pro for higher connection limits.
4. Implement connection pooling via Supabase's built-in PgBouncer (enabled by default on Pro).

### Authentication Failures

#### "OAuthCallback" Error on Sign-In

**Resolution**:
1. Verify the redirect URI in Azure AD matches exactly: `https://your-domain.vercel.app/api/auth/callback/azure-ad`.
2. Check that the `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, and `AZURE_AD_TENANT_ID` are correct.
3. Ensure the client secret has not expired.
4. Verify the `NEXTAUTH_URL` matches the deployment URL.

#### "AccessDenied" Error After Sign-In

**Resolution**:
1. Check if the user's account is active in the `users` table: `SELECT is_active FROM users WHERE email = '<user-email>';`.
2. Verify the user has been assigned a role in Azure AD.
3. Check the middleware logs for the specific denial reason.

#### Session Expires Too Quickly

The default session duration is 8 hours (configured in `src/lib/auth.ts`). To adjust:

```typescript
// In src/lib/auth.ts
session: {
  strategy: "jwt",
  maxAge: 8 * 60 * 60, // Change this value (in seconds)
},
```

### Performance Issues

#### Slow Dashboard Load Times

**Resolution**:
1. Check Vercel Analytics for Core Web Vitals.
2. Verify Supabase query performance in the database reports.
3. Check if the metrics table has grown excessively large — consider archiving old data.
4. Ensure indexes are present on frequently queried columns (the seed script creates all required indexes).
5. Review SWR cache configuration in `src/hooks/use-dashboard-data.ts` — increase `dedupingInterval` if needed.

#### High Supabase Latency

**Resolution**:
1. Ensure the Supabase project region matches the Vercel deployment region.
2. Check for missing indexes on frequently queried columns.
3. Review slow query logs in Supabase dashboard.
4. Consider adding read replicas for heavy read workloads (Supabase Pro).

#### API Route Timeouts

Vercel serverless functions have a default timeout of 10 seconds (Pro: 60 seconds). If API routes are timing out:

1. Optimize database queries (add indexes, reduce result sets).
2. Implement pagination for large data sets (all list endpoints support `page` and `page_size`).
3. Consider upgrading to Vercel Pro for longer function timeouts.
4. For the compliance report endpoint, which aggregates data from multiple tables, ensure the time range is not excessively large.

---

## Appendix

### Deployment Checklist

Use this checklist for every production deployment:

#### Pre-Deployment

- [ ] All CI checks pass (lint, type check, build).
- [ ] Code review approved by at least one reviewer.
- [ ] Preview deployment tested and verified.
- [ ] Database backup created (if deployment includes schema changes).
- [ ] Environment variables verified in Vercel project settings.
- [ ] Azure AD redirect URIs updated (if domain changed).
- [ ] Change ticket created and approved (if required by your change management process).

#### Deployment

- [ ] Merge to `main` branch (or manual deploy via CLI).
- [ ] Monitor Vercel deployment logs for build errors.
- [ ] Wait for deployment to complete successfully.

#### Post-Deployment

- [ ] Health check passes: `curl https://your-domain.vercel.app/api/health`.
- [ ] Sign in with Azure AD SSO and verify authentication.
- [ ] Verify dashboard data loads correctly (availability, golden signals, incidents).
- [ ] Verify admin panel functionality (if admin features were changed).
- [ ] Check Vercel function logs for any errors.
- [ ] Monitor error rates for 30 minutes post-deployment.
- [ ] Update deployment documentation and CHANGELOG.md.

### Useful Commands

```bash
# Local development
npm run dev                    # Start development server (port 3000)
npm run build                  # Create production build
npm run start                  # Start production server
npm run lint                   # Run ESLint
npm run type-check             # Run TypeScript type check

# Vercel CLI
vercel                         # Deploy to preview
vercel --prod                  # Deploy to production
vercel ls                      # List deployments
vercel logs <deployment-url>   # View deployment logs
vercel env ls                  # List environment variables
vercel promote <url>           # Promote deployment to production

# Database
psql "<connection-string>" -f supabase/seed.sql         # Run schema migration
psql "<connection-string>" -f supabase/sample-data.sql  # Load sample data
pg_dump "<connection-string>" -Fc -f backup.dump         # Create backup
pg_restore --dbname="<connection-string>" backup.dump    # Restore backup

# Health check
curl -s https://your-domain.vercel.app/api/health | jq .
```

### Support & Escalation

| Issue Type | First Responder | Escalation |
|---|---|---|
| Application errors | SRE Engineer on-call | ARE Lead |
| Authentication issues | Identity Team | Platform Team |
| Database issues | Platform Engineer on-call | Supabase Support |
| Vercel platform issues | Platform Engineer on-call | Vercel Support |
| Security incidents | Security Team | CISO |

---

© 2024 ARE Observability Dashboard. All rights reserved.