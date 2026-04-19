"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { PageSkeleton } from "@/components/shared/loading-skeleton"
import { ModuleErrorBoundary } from "@/components/shared/error-boundary"
import { EmbeddedDashboardWithBoundary } from "@/components/dashboard/embedded/embedded-dashboard"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Monitor } from "lucide-react"

// ============================================================
// Constants
// ============================================================

const DYNATRACE_EMBED_URL =
  process.env.NEXT_PUBLIC_DYNATRACE_EMBED_URL ||
  process.env.DYNATRACE_EMBED_URL ||
  "https://your-dynatrace-instance.live.dynatrace.com"

const ELASTIC_EMBED_URL =
  process.env.NEXT_PUBLIC_ELASTIC_EMBED_URL ||
  process.env.ELASTIC_EMBED_URL ||
  "https://your-elastic-instance.elastic.co"

const DYNATRACE_DASHBOARD_OPTIONS = [
  {
    value: "infrastructure",
    label: "Infrastructure Overview",
    url: `${DYNATRACE_EMBED_URL}/ui/dashboards`,
  },
  {
    value: "services",
    label: "Service Performance",
    url: `${DYNATRACE_EMBED_URL}/ui/services`,
  },
  {
    value: "hosts",
    label: "Host Monitoring",
    url: `${DYNATRACE_EMBED_URL}/ui/hosts`,
  },
  {
    value: "problems",
    label: "Problems",
    url: `${DYNATRACE_EMBED_URL}/ui/problems`,
  },
]

const ELASTIC_DASHBOARD_OPTIONS = [
  {
    value: "logs",
    label: "Application Logs",
    url: `${ELASTIC_EMBED_URL}/app/discover`,
  },
  {
    value: "apm",
    label: "APM Overview",
    url: `${ELASTIC_EMBED_URL}/app/apm`,
  },
  {
    value: "metrics",
    label: "Metrics Explorer",
    url: `${ELASTIC_EMBED_URL}/app/metrics`,
  },
  {
    value: "uptime",
    label: "Uptime Monitoring",
    url: `${ELASTIC_EMBED_URL}/app/uptime`,
  },
]

const DEFAULT_TAB = "dynatrace"

// ============================================================
// Embedded Dashboards Page
// ============================================================

/**
 * Embedded Dashboards page with tabs for Dynatrace and Elastic
 * external dashboard views. Each tab renders an EmbeddedDashboard
 * component with configurable URL, dashboard selector, auto-refresh,
 * and fullscreen support.
 *
 * Restricted to authenticated users (enforced by the dashboard layout).
 */
export default function EmbeddedDashboardsPage() {
  const { user, isLoading: isAuthLoading } = useAuth()

  const [activeTab, setActiveTab] = React.useState<string>(DEFAULT_TAB)

  const [dynatraceUrl, setDynatraceUrl] = React.useState<string>(
    DYNATRACE_DASHBOARD_OPTIONS[0].url
  )
  const [elasticUrl, setElasticUrl] = React.useState<string>(
    ELASTIC_DASHBOARD_OPTIONS[0].url
  )

  /**
   * Handles Dynatrace dashboard URL change from the selector.
   */
  const handleDynatraceDashboardChange = React.useCallback((url: string) => {
    setDynatraceUrl(url)
  }, [])

  /**
   * Handles Elastic dashboard URL change from the selector.
   */
  const handleElasticDashboardChange = React.useCallback((url: string) => {
    setElasticUrl(url)
  }, [])

  // Show loading skeleton while auth state is resolving
  if (isAuthLoading) {
    return (
      <PageSkeleton
        showFilterBar={false}
        metricCards={0}
        showChart
        showTable={false}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Embedded Dashboards
            </h1>
            <p className="text-sm text-muted-foreground">
              External observability dashboards from Dynatrace &amp; Elastic embedded for unified access
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="info" className="text-xs">
              <Monitor className="h-3 w-3 mr-1" />
              External
            </Badge>
            {activeTab === "dynatrace" && (
              <Badge variant="secondary" className="text-xs">
                Dynatrace
              </Badge>
            )}
            {activeTab === "elastic" && (
              <Badge variant="secondary" className="text-xs">
                Elastic
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Tabbed Dashboard Views */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dynatrace" className="text-xs gap-1.5">
            <Monitor className="h-3.5 w-3.5" />
            Dynatrace
          </TabsTrigger>
          <TabsTrigger value="elastic" className="text-xs gap-1.5">
            <Monitor className="h-3.5 w-3.5" />
            Elastic
          </TabsTrigger>
        </TabsList>

        {/* Dynatrace Tab */}
        <TabsContent value="dynatrace" className="mt-4">
          <EmbeddedDashboardWithBoundary
            source="dynatrace"
            url={dynatraceUrl}
            title="Dynatrace Dashboard"
            description="Infrastructure monitoring, service performance, and problem detection"
            height={700}
            showHeader
            showFullscreen
            showRefresh
            showExternalLink
            dashboardOptions={DYNATRACE_DASHBOARD_OPTIONS}
            onDashboardChange={handleDynatraceDashboardChange}
            autoRefreshSeconds={60}
          />
        </TabsContent>

        {/* Elastic Tab */}
        <TabsContent value="elastic" className="mt-4">
          <EmbeddedDashboardWithBoundary
            source="elastic"
            url={elasticUrl}
            title="Elastic Dashboard"
            description="Application logs, APM traces, metrics explorer, and uptime monitoring"
            height={700}
            showHeader
            showFullscreen
            showRefresh
            showExternalLink
            dashboardOptions={ELASTIC_DASHBOARD_OPTIONS}
            onDashboardChange={handleElasticDashboardChange}
            autoRefreshSeconds={60}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}