import { createServerClient } from "@/lib/supabase";
import { TIME_PERIOD_MS, DEFAULT_THRESHOLDS } from "@/constants/constants";
import type {
  CriticalityTier,
  Environment,
  ErrorBudget,
  Incident,
  IncidentAnalytics,
  IncidentCounts,
  IncidentSeverity,
  MetricType,
  RootCauseCategory,
  TimePeriod,
  TrendDirection,
  AvailabilitySnapshot,
  DegradedService,
  SLACompliance,
  AvailabilityDashboard,
  GoldenSignals,
  ChangeFailureCorrelation,
  Deployment,
} from "@/types";

// ============================================================
// Types
// ============================================================

export interface ErrorBudgetResult {
  error_budget: ErrorBudget;
  burn_rate_history: Array<{
    timestamp: string;
    burn_rate: number;
  }>;
  recommendations: string[];
}

export interface SLOComplianceResult {
  service_id: string;
  service_name: string;
  slo_met: boolean;
  sla_met: boolean;
  availability_pct: number;
  target_pct: number;
  period: string;
  latency_p95_met: boolean;
  error_rate_met: boolean;
}

export interface IncidentTrendsResult {
  incident_counts: IncidentCounts;
  mttr: number;
  mttd: number;
  root_causes: Array<{ category: RootCauseCategory; count: number }>;
  repeat_failures: string[];
  trend: TrendDirection;
  period: string;
  change_failure_correlations: ChangeFailureCorrelation[];
}

export interface GoldenSignalsResult {
  signals: Array<{
    metric: MetricType;
    value: number;
    unit: string;
    threshold?: number;
    breached?: boolean;
  }>;
  service_id: string;
  service_name: string;
  environment: Environment;
  timestamp: string;
}

export interface AvailabilityQueryParams {
  domain?: string;
  tier?: CriticalityTier;
  period?: TimePeriod;
  environment?: Environment;
}

export interface GoldenSignalsQueryParams {
  service_id?: string;
  domain?: string;
  application?: string;
  environment?: Environment;
  metrics?: MetricType[];
  period?: TimePeriod;
}

export interface ErrorBudgetQueryParams {
  service_id: string;
  period?: TimePeriod;
}

export interface IncidentTrendsQueryParams {
  domain?: string;
  service_id?: string;
  severity?: IncidentSeverity;
  period?: TimePeriod;
  start_time?: string;
  end_time?: string;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Computes the start time for a given time period relative to now.
 */
function getStartTimeForPeriod(period: TimePeriod): string {
  const ms = TIME_PERIOD_MS[period];
  return new Date(Date.now() - ms).toISOString();
}

/**
 * Computes the average of an array of numbers.
 * Returns 0 if the array is empty.
 */
function average(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

/**
 * Determines trend direction by comparing recent vs older values.
 */
function computeTrend(values: number[]): TrendDirection {
  if (values.length < 2) return "stable";

  const midpoint = Math.floor(values.length / 2);
  const olderHalf = values.slice(0, midpoint);
  const recentHalf = values.slice(midpoint);

  const olderAvg = average(olderHalf);
  const recentAvg = average(recentHalf);

  const threshold = 0.05; // 5% change threshold
  const delta = olderAvg === 0 ? 0 : (recentAvg - olderAvg) / olderAvg;

  if (delta > threshold) return "up";
  if (delta < -threshold) return "down";
  return "stable";
}

/**
 * Generates error budget recommendations based on current state.
 */
function generateRecommendations(errorBudget: ErrorBudget): string[] {
  const recommendations: string[] = [];

  if (errorBudget.breach) {
    recommendations.push(
      "Error budget exhausted. Freeze non-critical deployments and focus on reliability improvements."
    );
    recommendations.push(
      "Conduct a review of recent incidents to identify systemic issues."
    );
  }

  const consumedPct =
    errorBudget.initial > 0
      ? (errorBudget.consumed / errorBudget.initial) * 100
      : 0;

  if (consumedPct > 80 && !errorBudget.breach) {
    recommendations.push(
      "Error budget is over 80% consumed. Consider reducing deployment velocity."
    );
  }

  if (
    errorBudget.burn_rate &&
    errorBudget.burn_rate > DEFAULT_THRESHOLDS.error_budget_burn_rate.critical
  ) {
    recommendations.push(
      `Burn rate (${errorBudget.burn_rate.toFixed(2)}x) exceeds critical threshold. Immediate action required.`
    );
  } else if (
    errorBudget.burn_rate &&
    errorBudget.burn_rate > DEFAULT_THRESHOLDS.error_budget_burn_rate.warning
  ) {
    recommendations.push(
      `Burn rate (${errorBudget.burn_rate.toFixed(2)}x) exceeds warning threshold. Monitor closely.`
    );
  }

  if (errorBudget.trend === "down" && !errorBudget.breach) {
    recommendations.push(
      "Error budget trend is declining. Review recent changes and incident patterns."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Error budget is healthy. Continue current deployment practices."
    );
  }

  return recommendations;
}

// ============================================================
// AnalyticsEngine
// ============================================================

/**
 * Computes the error budget for a specific service and period.
 * Queries the error_budgets table and enriches with burn rate history and recommendations.
 *
 * @param params - Query parameters including service_id and optional period
 * @returns Error budget result with history and recommendations
 */
export async function computeErrorBudget(
  params: ErrorBudgetQueryParams
): Promise<ErrorBudgetResult> {
  const supabase = createServerClient();
  const period = params.period || "30d";

  // Fetch the latest error budget record for the service
  const { data: budgetData, error: budgetError } = await supabase
    .from("error_budgets")
    .select("*")
    .eq("service_id", params.service_id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (budgetError && budgetError.code !== "PGRST116") {
    console.error("Error fetching error budget:", budgetError);
    throw new Error(`Failed to fetch error budget: ${budgetError.message}`);
  }

  // If no budget record exists, compute from metrics
  if (!budgetData) {
    const startTime = getStartTimeForPeriod(period);

    // Fetch availability metrics to compute budget
    const { data: metrics, error: metricsError } = await supabase
      .from("metrics")
      .select("value, timestamp")
      .eq("service_id", params.service_id)
      .eq("metric_type", "availability")
      .gte("timestamp", startTime)
      .order("timestamp", { ascending: true });

    if (metricsError) {
      console.error("Error fetching metrics for error budget:", metricsError);
      throw new Error(
        `Failed to fetch metrics for error budget: ${metricsError.message}`
      );
    }

    // Fetch service tier for SLO target
    const { data: service } = await supabase
      .from("services")
      .select("name, tier")
      .eq("id", params.service_id)
      .single();

    const tier = (service?.tier as CriticalityTier) || "Tier-3";
    const sloTarget =
      DEFAULT_THRESHOLDS.availability[tier] / 100;

    const metricValues = (metrics || []).map((m) => m.value);
    const totalMinutes = metricValues.length;
    const availableMinutes = metricValues.filter(
      (v) => v >= sloTarget * 100
    ).length;

    const initialBudget = totalMinutes * (1 - sloTarget);
    const consumed = totalMinutes - availableMinutes;
    const remaining = Math.max(0, initialBudget - consumed);
    const breach = remaining <= 0;
    const trend = computeTrend(metricValues);

    const computedBudget: ErrorBudget = {
      id: `computed-${params.service_id}`,
      service_id: params.service_id,
      service_name: service?.name || undefined,
      period,
      initial: Math.round(initialBudget * 100) / 100,
      consumed: Math.round(consumed * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      breach,
      trend,
      slo_target: sloTarget * 100,
      burn_rate:
        initialBudget > 0
          ? Math.round((consumed / initialBudget) * 100) / 100
          : 0,
      projected_breach_date: null,
      updated_at: new Date().toISOString(),
    };

    return {
      error_budget: computedBudget,
      burn_rate_history: (metrics || []).map((m) => ({
        timestamp: m.timestamp,
        burn_rate:
          initialBudget > 0
            ? Math.round(
                ((100 - m.value) / (100 * (1 - sloTarget))) * 100
              ) / 100
            : 0,
      })),
      recommendations: generateRecommendations(computedBudget),
    };
  }

  // Use existing budget record
  const errorBudget: ErrorBudget = {
    id: budgetData.id,
    service_id: budgetData.service_id,
    service_name: budgetData.service_name || undefined,
    period: budgetData.period,
    initial: budgetData.initial,
    consumed: budgetData.consumed,
    remaining: budgetData.remaining,
    breach: budgetData.breach,
    trend: budgetData.trend as TrendDirection,
    slo_target: budgetData.slo_target,
    burn_rate: budgetData.burn_rate || undefined,
    projected_breach_date: budgetData.projected_breach_date || null,
    updated_at: budgetData.updated_at,
  };

  // Fetch burn rate history from metrics
  const startTime = getStartTimeForPeriod(period);
  const { data: historyMetrics } = await supabase
    .from("metrics")
    .select("value, timestamp")
    .eq("service_id", params.service_id)
    .eq("metric_type", "availability")
    .gte("timestamp", startTime)
    .order("timestamp", { ascending: true });

  const sloTarget = errorBudget.slo_target / 100;
  const initialBudget = errorBudget.initial;

  const burnRateHistory = (historyMetrics || []).map((m) => ({
    timestamp: m.timestamp,
    burn_rate:
      initialBudget > 0
        ? Math.round(
            ((100 - m.value) / (100 * (1 - sloTarget))) * 100
          ) / 100
        : 0,
  }));

  return {
    error_budget: errorBudget,
    burn_rate_history: burnRateHistory,
    recommendations: generateRecommendations(errorBudget),
  };
}

/**
 * Computes SLO/SLA compliance for a specific service.
 * Evaluates availability, latency, and error rate against tier-based thresholds.
 *
 * @param serviceId - The service ID to evaluate
 * @param period - The time period for evaluation
 * @returns SLO compliance result
 */
export async function computeSLOCompliance(
  serviceId: string,
  period: TimePeriod = "30d"
): Promise<SLOComplianceResult> {
  const supabase = createServerClient();
  const startTime = getStartTimeForPeriod(period);

  // Fetch service details
  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("name, tier")
    .eq("id", serviceId)
    .single();

  if (serviceError) {
    console.error("Error fetching service for SLO compliance:", serviceError);
    throw new Error(
      `Failed to fetch service: ${serviceError.message}`
    );
  }

  const tier = (service?.tier as CriticalityTier) || "Tier-3";
  const targetAvailability = DEFAULT_THRESHOLDS.availability[tier];
  const targetLatencyP95 = DEFAULT_THRESHOLDS.latency_p95_ms[tier];
  const targetErrorRate5xx = DEFAULT_THRESHOLDS.error_rate_5xx[tier];

  // Fetch availability metrics
  const { data: availabilityMetrics } = await supabase
    .from("metrics")
    .select("value")
    .eq("service_id", serviceId)
    .eq("metric_type", "availability")
    .gte("timestamp", startTime);

  const availabilityValues = (availabilityMetrics || []).map((m) => m.value);
  const avgAvailability =
    availabilityValues.length > 0 ? average(availabilityValues) : 100;

  // Fetch latency P95 metrics
  const { data: latencyMetrics } = await supabase
    .from("metrics")
    .select("value")
    .eq("service_id", serviceId)
    .eq("metric_type", "latency_p95")
    .gte("timestamp", startTime);

  const latencyValues = (latencyMetrics || []).map((m) => m.value);
  const avgLatencyP95 = latencyValues.length > 0 ? average(latencyValues) : 0;

  // Fetch 5xx error metrics
  const { data: errorMetrics } = await supabase
    .from("metrics")
    .select("value")
    .eq("service_id", serviceId)
    .eq("metric_type", "errors_5xx")
    .gte("timestamp", startTime);

  const errorValues = (errorMetrics || []).map((m) => m.value);
  const avgErrorRate = errorValues.length > 0 ? average(errorValues) : 0;

  const availabilityMet = avgAvailability >= targetAvailability;
  const latencyP95Met = avgLatencyP95 <= targetLatencyP95;
  const errorRateMet = avgErrorRate <= targetErrorRate5xx;

  const sloMet = availabilityMet && latencyP95Met && errorRateMet;
  // SLA is typically just availability-based
  const slaMet = availabilityMet;

  return {
    service_id: serviceId,
    service_name: service?.name || "",
    slo_met: sloMet,
    sla_met: slaMet,
    availability_pct: Math.round(avgAvailability * 100) / 100,
    target_pct: targetAvailability,
    period,
    latency_p95_met: latencyP95Met,
    error_rate_met: errorRateMet,
  };
}

/**
 * Computes incident trends and analytics for a given domain/service and period.
 * Includes incident counts by severity, MTTR, MTTD, root cause distribution,
 * repeat failure detection, and change failure correlations.
 *
 * @param params - Query parameters for incident trends
 * @returns Incident trends result with analytics
 */
export async function incidentTrends(
  params: IncidentTrendsQueryParams
): Promise<IncidentTrendsResult> {
  const supabase = createServerClient();
  const period = params.period || "30d";
  const startTime = params.start_time || getStartTimeForPeriod(period);
  const endTime = params.end_time || new Date().toISOString();

  // Build incident query
  let query = supabase
    .from("incidents")
    .select("*")
    .gte("start_time", startTime)
    .lte("start_time", endTime);

  if (params.domain) {
    query = query.eq("domain", params.domain);
  }

  if (params.service_id) {
    query = query.eq("service_id", params.service_id);
  }

  if (params.severity) {
    query = query.eq("severity", params.severity);
  }

  query = query.order("start_time", { ascending: false });

  const { data: incidentData, error: incidentError } = await query;

  if (incidentError) {
    console.error("Error fetching incidents for trends:", incidentError);
    throw new Error(
      `Failed to fetch incidents: ${incidentError.message}`
    );
  }

  const incidents = (incidentData || []) as Incident[];

  // Count by severity
  const incidentCounts: IncidentCounts = {
    critical: 0,
    major: 0,
    minor: 0,
    warning: 0,
    total: incidents.length,
  };

  for (const incident of incidents) {
    const severity = incident.severity as keyof IncidentCounts;
    if (severity in incidentCounts && severity !== "total") {
      incidentCounts[severity]++;
    }
  }

  // Compute MTTR and MTTD
  const mttrValues = incidents
    .filter((i) => i.mttr != null)
    .map((i) => i.mttr as number);
  const mttdValues = incidents
    .filter((i) => i.mttd != null)
    .map((i) => i.mttd as number);

  const mttr = average(mttrValues);
  const mttd = average(mttdValues);

  // Root cause distribution
  const rootCauseMap = new Map<RootCauseCategory, number>();
  for (const incident of incidents) {
    if (incident.root_cause) {
      const category = incident.root_cause as RootCauseCategory;
      rootCauseMap.set(category, (rootCauseMap.get(category) || 0) + 1);
    }
  }

  const rootCauses = Array.from(rootCauseMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // Detect repeat failures
  const repeatFailures = incidents
    .filter((i) => i.repeat_failure)
    .map((i) => i.root_cause || "Unknown")
    .filter((value, index, self) => self.indexOf(value) === index);

  // Compute trend based on incident counts over time
  const incidentTimestamps = incidents.map((i) =>
    new Date(i.start_time).getTime()
  );
  const midTime =
    incidentTimestamps.length > 0
      ? (Math.min(...incidentTimestamps) + Math.max(...incidentTimestamps)) / 2
      : Date.now();

  const olderCount = incidentTimestamps.filter((t) => t < midTime).length;
  const recentCount = incidentTimestamps.filter((t) => t >= midTime).length;

  let trend: TrendDirection = "stable";
  if (incidents.length >= 2) {
    if (recentCount > olderCount * 1.2) {
      trend = "up";
    } else if (recentCount < olderCount * 0.8) {
      trend = "down";
    }
  }

  // Change failure correlations
  const changeFailureCorrelations = await computeChangeFailureCorrelations(
    incidents,
    startTime,
    endTime
  );

  return {
    incident_counts: incidentCounts,
    mttr,
    mttd,
    root_causes: rootCauses,
    repeat_failures: repeatFailures,
    trend,
    period,
    change_failure_correlations: changeFailureCorrelations,
  };
}

/**
 * Computes change failure correlations by matching incidents to recent deployments.
 * A deployment is correlated with an incident if it occurred within a configurable
 * time window before the incident start time.
 *
 * @param incidents - The incidents to correlate
 * @param startTime - Start of the time range
 * @param endTime - End of the time range
 * @returns Array of change failure correlations
 */
async function computeChangeFailureCorrelations(
  incidents: Incident[],
  startTime: string,
  endTime: string
): Promise<ChangeFailureCorrelation[]> {
  if (incidents.length === 0) return [];

  const supabase = createServerClient();

  // Fetch deployments in the same time range
  const { data: deploymentData, error: deploymentError } = await supabase
    .from("deployments")
    .select("*")
    .gte("deployed_at", startTime)
    .lte("deployed_at", endTime)
    .order("deployed_at", { ascending: false });

  if (deploymentError) {
    console.error(
      "Error fetching deployments for correlation:",
      deploymentError
    );
    return [];
  }

  const deployments = (deploymentData || []) as Deployment[];
  const correlations: ChangeFailureCorrelation[] = [];

  // Correlation window: 120 minutes before incident start
  const correlationWindowMs = 120 * 60 * 1000;

  for (const incident of incidents) {
    const incidentStart = new Date(incident.start_time).getTime();

    // Check if incident already has a linked deployment
    if (incident.external_id) {
      const linkedDeployment = deployments.find(
        (d) => d.id === incident.external_id
      );
      if (linkedDeployment) {
        const timeDelta = Math.abs(
          incidentStart - new Date(linkedDeployment.deployed_at).getTime()
        );
        correlations.push({
          deployment_id: linkedDeployment.id,
          incident_id: incident.id,
          service_id: incident.service_id,
          correlation_score: 1.0,
          time_delta_minutes: Math.round(timeDelta / 60000),
          deployment: linkedDeployment,
          incident,
        });
        continue;
      }
    }

    // Find deployments to the same service within the correlation window
    const matchingDeployments = deployments.filter((d) => {
      if (d.service_id !== incident.service_id) return false;
      const deployedAt = new Date(d.deployed_at).getTime();
      const timeDelta = incidentStart - deployedAt;
      return timeDelta >= 0 && timeDelta <= correlationWindowMs;
    });

    for (const deployment of matchingDeployments) {
      const deployedAt = new Date(deployment.deployed_at).getTime();
      const timeDeltaMs = incidentStart - deployedAt;
      const timeDeltaMinutes = Math.round(timeDeltaMs / 60000);

      // Correlation score: higher when deployment is closer in time to incident
      const score = Math.max(
        0,
        Math.round(
          (1 - timeDeltaMs / correlationWindowMs) * 100
        ) / 100
      );

      correlations.push({
        deployment_id: deployment.id,
        incident_id: incident.id,
        service_id: incident.service_id,
        correlation_score: score,
        time_delta_minutes: timeDeltaMinutes,
        deployment,
        incident,
      });
    }
  }

  // Sort by correlation score descending
  correlations.sort((a, b) => b.correlation_score - a.correlation_score);

  return correlations;
}

/**
 * Computes the availability dashboard data including availability snapshots,
 * top degraded services, and SLA/SLO compliance.
 *
 * @param params - Query parameters for availability
 * @returns Availability dashboard data
 */
export async function computeAvailability(
  params: AvailabilityQueryParams
): Promise<AvailabilityDashboard> {
  const supabase = createServerClient();
  const period = params.period || "24h";
  const startTime = getStartTimeForPeriod(period);

  // Fetch services with optional filters
  let serviceQuery = supabase
    .from("services")
    .select("id, name, domain, tier, environment");

  if (params.domain) {
    serviceQuery = serviceQuery.eq("domain", params.domain);
  }

  if (params.tier) {
    serviceQuery = serviceQuery.eq("tier", params.tier);
  }

  if (params.environment) {
    serviceQuery = serviceQuery.eq("environment", params.environment);
  }

  const { data: services, error: servicesError } = await serviceQuery;

  if (servicesError) {
    console.error("Error fetching services for availability:", servicesError);
    throw new Error(
      `Failed to fetch services: ${servicesError.message}`
    );
  }

  if (!services || services.length === 0) {
    return {
      availability: [],
      top_degraded_services: [],
      sla_slo_compliance: [],
      last_updated: new Date().toISOString(),
    };
  }

  // Fetch availability metrics for all services in the period
  const serviceIds = services.map((s) => s.id);
  const { data: metrics } = await supabase
    .from("metrics")
    .select("service_id, value, timestamp")
    .in("service_id", serviceIds)
    .eq("metric_type", "availability")
    .gte("timestamp", startTime)
    .order("timestamp", { ascending: true });

  // Group metrics by service
  const metricsByService = new Map<string, number[]>();
  for (const metric of metrics || []) {
    const existing = metricsByService.get(metric.service_id) || [];
    existing.push(metric.value);
    metricsByService.set(metric.service_id, existing);
  }

  // Compute availability snapshots grouped by domain + tier
  const snapshotMap = new Map<
    string,
    {
      domain: string;
      tier: CriticalityTier;
      availabilities: number[];
      servicesTotal: number;
      servicesDegraded: number;
    }
  >();

  const degradedServices: DegradedService[] = [];

  for (const service of services) {
    const key = `${service.domain}:${service.tier}`;
    const tier = service.tier as CriticalityTier;
    const target = DEFAULT_THRESHOLDS.availability[tier] || 99.9;

    const serviceMetrics = metricsByService.get(service.id) || [];
    const avgAvailability =
      serviceMetrics.length > 0 ? average(serviceMetrics) : 100;

    const isDegraded = avgAvailability < target;

    if (!snapshotMap.has(key)) {
      snapshotMap.set(key, {
        domain: service.domain,
        tier,
        availabilities: [],
        servicesTotal: 0,
        servicesDegraded: 0,
      });
    }

    const snapshot = snapshotMap.get(key)!;
    snapshot.availabilities.push(avgAvailability);
    snapshot.servicesTotal++;
    if (isDegraded) {
      snapshot.servicesDegraded++;
    }

    if (isDegraded) {
      degradedServices.push({
        service: service.name,
        service_id: service.id,
        domain: service.domain,
        tier,
        degradation_pct:
          Math.round((target - avgAvailability) * 100) / 100,
        primary_issue:
          avgAvailability < 99
            ? "Significant availability drop"
            : "Below SLO target",
      });
    }
  }

  // Build availability snapshots
  const availability: AvailabilitySnapshot[] = Array.from(
    snapshotMap.values()
  ).map((snapshot) => ({
    domain: snapshot.domain,
    tier: snapshot.tier,
    availability_pct:
      Math.round(average(snapshot.availabilities) * 100) / 100,
    trend: computeTrend(snapshot.availabilities),
    services_total: snapshot.servicesTotal,
    services_degraded: snapshot.servicesDegraded,
  }));

  // Sort degraded services by degradation percentage descending
  degradedServices.sort((a, b) => b.degradation_pct - a.degradation_pct);
  const topDegradedServices = degradedServices.slice(0, 10);

  // Compute SLA/SLO compliance for all services
  const slaCompliance: SLACompliance[] = [];
  for (const service of services) {
    const tier = service.tier as CriticalityTier;
    const target = DEFAULT_THRESHOLDS.availability[tier] || 99.9;
    const serviceMetrics = metricsByService.get(service.id) || [];
    const avgAvailability =
      serviceMetrics.length > 0 ? average(serviceMetrics) : 100;

    slaCompliance.push({
      service_id: service.id,
      service_name: service.name,
      slo_met: avgAvailability >= target,
      sla_met: avgAvailability >= target,
      availability_pct: Math.round(avgAvailability * 100) / 100,
      target_pct: target,
      period,
    });
  }

  return {
    availability,
    top_degraded_services: topDegradedServices,
    sla_slo_compliance: slaCompliance,
    last_updated: new Date().toISOString(),
  };
}

/**
 * Computes golden signals for a service or set of services.
 * Returns latency, traffic, errors, and saturation metrics.
 *
 * @param params - Query parameters for golden signals
 * @returns Array of golden signals results
 */
export async function computeGoldenSignals(
  params: GoldenSignalsQueryParams
): Promise<GoldenSignalsResult[]> {
  const supabase = createServerClient();
  const period = params.period || "24h";
  const startTime = getStartTimeForPeriod(period);

  // Determine which services to query
  let serviceIds: string[] = [];
  let serviceMap = new Map<string, { name: string; tier: string; environment: string }>();

  if (params.service_id) {
    serviceIds = [params.service_id];
    const { data: service } = await supabase
      .from("services")
      .select("id, name, tier, environment")
      .eq("id", params.service_id)
      .single();

    if (service) {
      serviceMap.set(service.id, {
        name: service.name,
        tier: service.tier,
        environment: service.environment as string,
      });
    }
  } else {
    let serviceQuery = supabase
      .from("services")
      .select("id, name, tier, environment");

    if (params.domain) {
      serviceQuery = serviceQuery.eq("domain", params.domain);
    }

    if (params.environment) {
      serviceQuery = serviceQuery.eq("environment", params.environment);
    }

    const { data: services } = await serviceQuery;

    if (services) {
      serviceIds = services.map((s) => s.id);
      for (const s of services) {
        serviceMap.set(s.id, {
          name: s.name,
          tier: s.tier,
          environment: s.environment as string,
        });
      }
    }
  }

  if (serviceIds.length === 0) {
    return [];
  }

  // Determine which metric types to fetch
  const metricTypes: MetricType[] = params.metrics || [
    "latency_p50",
    "latency_p95",
    "latency_p99",
    "errors_4xx",
    "errors_5xx",
    "traffic_rps",
    "saturation_cpu",
    "saturation_memory",
    "saturation_disk",
    "availability",
  ];

  // Fetch metrics for all services
  const { data: metrics, error: metricsError } = await supabase
    .from("metrics")
    .select("service_id, metric_type, value, unit, timestamp")
    .in("service_id", serviceIds)
    .in("metric_type", metricTypes)
    .gte("timestamp", startTime)
    .order("timestamp", { ascending: false });

  if (metricsError) {
    console.error("Error fetching golden signals metrics:", metricsError);
    throw new Error(
      `Failed to fetch golden signals: ${metricsError.message}`
    );
  }

  // Group metrics by service and metric type
  const metricsByServiceAndType = new Map<string, Map<string, number[]>>();
  const latestTimestampByService = new Map<string, string>();

  for (const metric of metrics || []) {
    const serviceKey = metric.service_id;
    if (!metricsByServiceAndType.has(serviceKey)) {
      metricsByServiceAndType.set(serviceKey, new Map());
    }

    const typeMap = metricsByServiceAndType.get(serviceKey)!;
    if (!typeMap.has(metric.metric_type)) {
      typeMap.set(metric.metric_type, []);
    }
    typeMap.get(metric.metric_type)!.push(metric.value);

    // Track latest timestamp
    if (
      !latestTimestampByService.has(serviceKey) ||
      metric.timestamp > latestTimestampByService.get(serviceKey)!
    ) {
      latestTimestampByService.set(serviceKey, metric.timestamp);
    }
  }

  // Build results
  const results: GoldenSignalsResult[] = [];

  for (const serviceId of serviceIds) {
    const serviceInfo = serviceMap.get(serviceId);
    if (!serviceInfo) continue;

    const tier = serviceInfo.tier as CriticalityTier;
    const typeMap = metricsByServiceAndType.get(serviceId) || new Map();

    const signals: GoldenSignalsResult["signals"] = [];

    for (const metricType of metricTypes) {
      const values = typeMap.get(metricType) || [];
      const avgValue = values.length > 0 ? average(values) : 0;

      // Determine unit
      let unit = "count";
      if (metricType.startsWith("latency")) unit = "ms";
      else if (metricType.startsWith("saturation") || metricType === "availability")
        unit = "percent";
      else if (metricType === "traffic_rps") unit = "rps";
      else if (metricType.startsWith("errors")) unit = "count";

      // Determine threshold and breach status
      let threshold: number | undefined;
      let breached: boolean | undefined;

      if (metricType === "latency_p95") {
        threshold = DEFAULT_THRESHOLDS.latency_p95_ms[tier];
        breached = avgValue > threshold;
      } else if (metricType === "latency_p99") {
        threshold = DEFAULT_THRESHOLDS.latency_p99_ms[tier];
        breached = avgValue > threshold;
      } else if (metricType === "errors_5xx") {
        threshold = DEFAULT_THRESHOLDS.error_rate_5xx[tier];
        breached = avgValue > threshold;
      } else if (metricType === "availability") {
        threshold = DEFAULT_THRESHOLDS.availability[tier];
        breached = avgValue < threshold;
      } else if (metricType === "saturation_cpu") {
        threshold = DEFAULT_THRESHOLDS.saturation.cpu_critical;
        breached = avgValue > threshold;
      } else if (metricType === "saturation_memory") {
        threshold = DEFAULT_THRESHOLDS.saturation.memory_critical;
        breached = avgValue > threshold;
      } else if (metricType === "saturation_disk") {
        threshold = DEFAULT_THRESHOLDS.saturation.disk_critical;
        breached = avgValue > threshold;
      }

      signals.push({
        metric: metricType as MetricType,
        value: Math.round(avgValue * 100) / 100,
        unit,
        threshold,
        breached,
      });
    }

    results.push({
      signals,
      service_id: serviceId,
      service_name: serviceInfo.name,
      environment: serviceInfo.environment as Environment,
      timestamp:
        latestTimestampByService.get(serviceId) || new Date().toISOString(),
    });
  }

  return results;
}

/**
 * Computes root cause analysis and failure pattern analytics.
 * Identifies recurring root causes, repeat failures, and systemic patterns.
 *
 * @param params - Query parameters for RCA analytics
 * @returns Root cause analytics with pattern detection
 */
export async function computeRootCauseAnalytics(
  params: IncidentTrendsQueryParams
): Promise<{
  root_causes: Array<{ category: RootCauseCategory; count: number; percentage: number }>;
  repeat_failures: Array<{
    root_cause: string;
    service_ids: string[];
    occurrence_count: number;
  }>;
  top_contributing_services: Array<{
    service_id: string;
    service_name: string;
    incident_count: number;
  }>;
  systemic_patterns: string[];
}> {
  const supabase = createServerClient();
  const period = params.period || "30d";
  const startTime = params.start_time || getStartTimeForPeriod(period);
  const endTime = params.end_time || new Date().toISOString();

  let query = supabase
    .from("incidents")
    .select("*")
    .gte("start_time", startTime)
    .lte("start_time", endTime);

  if (params.domain) {
    query = query.eq("domain", params.domain);
  }

  if (params.service_id) {
    query = query.eq("service_id", params.service_id);
  }

  const { data: incidentData, error } = await query;

  if (error) {
    console.error("Error fetching incidents for RCA:", error);
    throw new Error(`Failed to fetch incidents for RCA: ${error.message}`);
  }

  const incidents = (incidentData || []) as Incident[];

  // Root cause distribution with percentages
  const rootCauseMap = new Map<RootCauseCategory, number>();
  for (const incident of incidents) {
    if (incident.root_cause) {
      const category = incident.root_cause as RootCauseCategory;
      rootCauseMap.set(category, (rootCauseMap.get(category) || 0) + 1);
    }
  }

  const totalWithRootCause = Array.from(rootCauseMap.values()).reduce(
    (sum, count) => sum + count,
    0
  );

  const rootCauses = Array.from(rootCauseMap.entries())
    .map(([category, count]) => ({
      category,
      count,
      percentage:
        totalWithRootCause > 0
          ? Math.round((count / totalWithRootCause) * 10000) / 100
          : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Repeat failure analysis
  const repeatIncidents = incidents.filter((i) => i.repeat_failure);
  const repeatMap = new Map<
    string,
    { service_ids: Set<string>; count: number }
  >();

  for (const incident of repeatIncidents) {
    const rootCause = incident.root_cause || "Unknown";
    if (!repeatMap.has(rootCause)) {
      repeatMap.set(rootCause, { service_ids: new Set(), count: 0 });
    }
    const entry = repeatMap.get(rootCause)!;
    entry.service_ids.add(incident.service_id);
    entry.count++;
  }

  const repeatFailures = Array.from(repeatMap.entries())
    .map(([rootCause, data]) => ({
      root_cause: rootCause,
      service_ids: Array.from(data.service_ids),
      occurrence_count: data.count,
    }))
    .sort((a, b) => b.occurrence_count - a.occurrence_count);

  // Top contributing services
  const serviceCountMap = new Map<
    string,
    { name: string; count: number }
  >();

  for (const incident of incidents) {
    const key = incident.service_id;
    if (!serviceCountMap.has(key)) {
      serviceCountMap.set(key, {
        name: incident.service_name || key,
        count: 0,
      });
    }
    serviceCountMap.get(key)!.count++;
  }

  const topContributingServices = Array.from(serviceCountMap.entries())
    .map(([serviceId, data]) => ({
      service_id: serviceId,
      service_name: data.name,
      incident_count: data.count,
    }))
    .sort((a, b) => b.incident_count - a.incident_count)
    .slice(0, 10);

  // Detect systemic patterns
  const systemicPatterns: string[] = [];

  // Pattern: Same root cause across multiple services
  for (const [category, count] of rootCauseMap.entries()) {
    if (count >= 3) {
      const affectedServices = incidents
        .filter((i) => i.root_cause === category)
        .map((i) => i.service_id)
        .filter((v, i, a) => a.indexOf(v) === i);

      if (affectedServices.length >= 2) {
        systemicPatterns.push(
          `"${category}" root cause detected across ${affectedServices.length} services with ${count} incidents.`
        );
      }
    }
  }

  // Pattern: High repeat failure rate
  const repeatRate =
    incidents.length > 0
      ? repeatIncidents.length / incidents.length
      : 0;

  if (repeatRate > 0.3 && repeatIncidents.length >= 3) {
    systemicPatterns.push(
      `High repeat failure rate: ${Math.round(repeatRate * 100)}% of incidents are repeat failures.`
    );
  }

  // Pattern: Increasing incident frequency
  if (incidents.length >= 5) {
    const timestamps = incidents.map((i) =>
      new Date(i.start_time).getTime()
    );
    const midTime =
      (Math.min(...timestamps) + Math.max(...timestamps)) / 2;
    const olderCount = timestamps.filter((t) => t < midTime).length;
    const recentCount = timestamps.filter((t) => t >= midTime).length;

    if (recentCount > olderCount * 1.5) {
      systemicPatterns.push(
        "Incident frequency is increasing. Recent period shows significantly more incidents than earlier period."
      );
    }
  }

  return {
    root_causes: rootCauses,
    repeat_failures: repeatFailures,
    top_contributing_services: topContributingServices,
    systemic_patterns: systemicPatterns,
  };
}

/**
 * Computes a summary of all key reliability metrics for a single service.
 * Useful for service detail pages.
 *
 * @param serviceId - The service ID
 * @param period - The time period
 * @returns Combined reliability summary
 */
export async function computeServiceReliabilitySummary(
  serviceId: string,
  period: TimePeriod = "30d"
): Promise<{
  slo_compliance: SLOComplianceResult;
  error_budget: ErrorBudgetResult;
  incident_trends: IncidentTrendsResult;
  golden_signals: GoldenSignalsResult | null;
}> {
  const [sloCompliance, errorBudget, trends, goldenSignals] =
    await Promise.all([
      computeSLOCompliance(serviceId, period),
      computeErrorBudget({ service_id: serviceId, period }),
      incidentTrends({ service_id: serviceId, period }),
      computeGoldenSignals({ service_id: serviceId, period }).then(
        (results) => results[0] || null
      ),
    ]);

  return {
    slo_compliance: sloCompliance,
    error_budget: errorBudget,
    incident_trends: trends,
    golden_signals: goldenSignals,
  };
}