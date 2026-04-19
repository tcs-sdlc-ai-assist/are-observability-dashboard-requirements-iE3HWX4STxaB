import useSWR from "swr";
import { REFRESH_INTERVALS } from "@/constants/constants";
import type {
  AvailabilityDashboard,
  CriticalityTier,
  DashboardFilters,
  DependencyMap,
  Environment,
  ErrorBudgetDashboard,
  GoldenSignalsDashboard,
  IncidentAnalytics,
  IncidentSeverity,
  IncidentStatus,
  MetricType,
  TimePeriod,
} from "@/types";

// ============================================================
// Types
// ============================================================

export interface AvailabilityParams {
  domain?: string;
  tier?: CriticalityTier;
  period?: TimePeriod;
  environment?: Environment;
}

export interface ErrorBudgetParams {
  service_id: string;
  period?: TimePeriod;
}

export interface GoldenSignalsParams {
  service_id?: string;
  domain?: string;
  application?: string;
  environment?: Environment;
  metrics?: MetricType[];
  period?: TimePeriod;
}

export interface DependencyMapParams {
  incident_id?: string;
  service_id?: string;
  domain?: string;
  tier?: CriticalityTier;
  environment?: Environment;
  depth?: number;
}

export interface IncidentAnalyticsParams {
  domain?: string;
  service_id?: string;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  period?: TimePeriod;
  start_time?: string;
  end_time?: string;
}

export interface UseDashboardDataReturn<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isValidating: boolean;
  mutate: () => void;
}

// ============================================================
// Fetcher
// ============================================================

/**
 * Generic JSON fetcher for SWR.
 * Throws an error with the response status text if the request fails.
 */
async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.message) {
        message = body.message;
      }
    } catch {
      // ignore JSON parse errors — use statusText
    }
    const error = new Error(message);
    (error as Error & { status: number }).status = res.status;
    throw error;
  }

  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

// ============================================================
// URL Builder Helpers
// ============================================================

/**
 * Builds a URL with query parameters, omitting undefined/null values.
 */
function buildUrl(
  basePath: string,
  params: Record<string, string | number | boolean | string[] | undefined | null>
): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      if (value.length > 0) {
        searchParams.set(key, value.join(","));
      }
    } else {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

// ============================================================
// Hooks
// ============================================================

/**
 * Fetches availability dashboard data including availability snapshots,
 * top degraded services, and SLA/SLO compliance.
 *
 * @param params - Optional filter parameters for domain, tier, period, environment
 * @returns SWR-managed data, error, and loading states
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useAvailability({ domain: "payments", period: "24h" });
 * ```
 */
export function useAvailability(
  params?: AvailabilityParams
): UseDashboardDataReturn<AvailabilityDashboard> {
  const url = buildUrl("/api/metrics/availability", {
    domain: params?.domain,
    tier: params?.tier,
    period: params?.period,
    environment: params?.environment,
  });

  const { data, error, isLoading, isValidating, mutate } = useSWR<AvailabilityDashboard>(
    url,
    fetcher,
    {
      refreshInterval: REFRESH_INTERVALS.DASHBOARD,
      revalidateOnFocus: true,
      dedupingInterval: 10_000,
    }
  );

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate: () => {
      mutate();
    },
  };
}

/**
 * Fetches error budget data for a specific service, including burn rate
 * history and recommendations.
 *
 * @param params - Query parameters including required service_id and optional period
 * @returns SWR-managed data, error, and loading states
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useErrorBudgets({ service_id: "svc-123", period: "30d" });
 * ```
 */
export function useErrorBudgets(
  params: ErrorBudgetParams | null
): UseDashboardDataReturn<ErrorBudgetDashboard> {
  const url = params?.service_id
    ? buildUrl("/api/error-budgets", {
        service_id: params.service_id,
        period: params.period,
      })
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<ErrorBudgetDashboard>(
    url,
    fetcher,
    {
      refreshInterval: REFRESH_INTERVALS.ERROR_BUDGET,
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
    }
  );

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate: () => {
      mutate();
    },
  };
}

/**
 * Fetches golden signals (latency, traffic, errors, saturation) for one or
 * more services. Supports filtering by service, domain, application,
 * environment, specific metric types, and time period.
 *
 * @param params - Optional filter parameters
 * @returns SWR-managed data, error, and loading states
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useGoldenSignals({ service_id: "svc-123", period: "24h" });
 * ```
 */
export function useGoldenSignals(
  params?: GoldenSignalsParams
): UseDashboardDataReturn<GoldenSignalsDashboard[]> {
  const url = buildUrl("/api/metrics/golden-signals", {
    service_id: params?.service_id,
    domain: params?.domain,
    application: params?.application,
    environment: params?.environment,
    metrics: params?.metrics,
    period: params?.period,
  });

  const { data, error, isLoading, isValidating, mutate } = useSWR<GoldenSignalsDashboard[]>(
    url,
    fetcher,
    {
      refreshInterval: REFRESH_INTERVALS.METRICS,
      revalidateOnFocus: true,
      dedupingInterval: 10_000,
    }
  );

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate: () => {
      mutate();
    },
  };
}

/**
 * Fetches the dependency map (service topology) with nodes, edges, and
 * blast radius information. Can be scoped to a specific incident, service,
 * domain, or tier.
 *
 * @param params - Optional filter parameters for scoping the dependency graph
 * @returns SWR-managed data, error, and loading states
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useDependencyMap({ service_id: "svc-123", depth: 3 });
 * ```
 */
export function useDependencyMap(
  params?: DependencyMapParams
): UseDashboardDataReturn<DependencyMap> {
  const url = buildUrl("/api/dependencies", {
    incident_id: params?.incident_id,
    service_id: params?.service_id,
    domain: params?.domain,
    tier: params?.tier,
    environment: params?.environment,
    depth: params?.depth,
  });

  const { data, error, isLoading, isValidating, mutate } = useSWR<DependencyMap>(
    url,
    fetcher,
    {
      refreshInterval: REFRESH_INTERVALS.SERVICE_MAP,
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
    }
  );

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate: () => {
      mutate();
    },
  };
}

/**
 * Fetches incident analytics including incident counts by severity, MTTR,
 * MTTD, root cause distribution, repeat failure detection, and trend
 * direction. Supports filtering by domain, service, severity, and time range.
 *
 * @param params - Optional filter parameters for incident analytics
 * @returns SWR-managed data, error, and loading states
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useIncidentAnalytics({ domain: "payments", period: "30d" });
 * ```
 */
export function useIncidentAnalytics(
  params?: IncidentAnalyticsParams
): UseDashboardDataReturn<IncidentAnalytics> {
  const url = buildUrl("/api/incidents/analytics", {
    domain: params?.domain,
    service_id: params?.service_id,
    severity: params?.severity,
    status: params?.status,
    period: params?.period,
    start_time: params?.start_time,
    end_time: params?.end_time,
  });

  const { data, error, isLoading, isValidating, mutate } = useSWR<IncidentAnalytics>(
    url,
    fetcher,
    {
      refreshInterval: REFRESH_INTERVALS.INCIDENTS,
      revalidateOnFocus: true,
      dedupingInterval: 10_000,
    }
  );

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate: () => {
      mutate();
    },
  };
}

// ============================================================
// Composite Hook
// ============================================================

/**
 * Convenience hook that fetches all primary dashboard data in parallel
 * using the shared dashboard filters. Useful for the main overview page.
 *
 * @param filters - Dashboard-level filter parameters
 * @returns Combined data, loading, and error states for all dashboard modules
 *
 * @example
 * ```tsx
 * const { availability, incidents, isLoading } = useDashboardData({
 *   domain: "payments",
 *   period: "24h",
 * });
 * ```
 */
export function useDashboardData(filters?: DashboardFilters) {
  const availability = useAvailability({
    domain: filters?.domain,
    tier: filters?.tier,
    period: filters?.period,
    environment: filters?.environment,
  });

  const incidents = useIncidentAnalytics({
    domain: filters?.domain,
    severity: filters?.severity,
    period: filters?.period,
  });

  const goldenSignals = useGoldenSignals({
    domain: filters?.domain,
    environment: filters?.environment,
    period: filters?.period,
  });

  const dependencyMap = useDependencyMap({
    domain: filters?.domain,
    tier: filters?.tier,
    environment: filters?.environment,
  });

  const isLoading =
    availability.isLoading ||
    incidents.isLoading ||
    goldenSignals.isLoading ||
    dependencyMap.isLoading;

  const isValidating =
    availability.isValidating ||
    incidents.isValidating ||
    goldenSignals.isValidating ||
    dependencyMap.isValidating;

  const hasError =
    !!availability.error ||
    !!incidents.error ||
    !!goldenSignals.error ||
    !!dependencyMap.error;

  const mutateAll = () => {
    availability.mutate();
    incidents.mutate();
    goldenSignals.mutate();
    dependencyMap.mutate();
  };

  return {
    availability: availability.data,
    incidents: incidents.data,
    goldenSignals: goldenSignals.data,
    dependencyMap: dependencyMap.data,
    isLoading,
    isValidating,
    hasError,
    errors: {
      availability: availability.error,
      incidents: incidents.error,
      goldenSignals: goldenSignals.error,
      dependencyMap: dependencyMap.error,
    },
    mutateAll,
  };
}