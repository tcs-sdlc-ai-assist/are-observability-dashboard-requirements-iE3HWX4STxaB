import { createServerClient } from "@/lib/supabase";
import { logAction, logAdminAction, AUDIT_ACTIONS } from "@/lib/services/audit-logger";
import { PAGINATION } from "@/constants/constants";
import type {
  CriticalityTier,
  EntityType,
  MetricType,
  PaginatedResponse,
} from "@/types";

// ============================================================
// Types
// ============================================================

export interface MetricsConfigRecord {
  id: string;
  domain: string;
  application: string;
  metric_name: string;
  threshold: number;
  tier?: CriticalityTier;
  environment?: string;
  enabled: boolean;
  configured_by: string;
  configured_by_name?: string;
  configured_at: string;
  updated_at: string;
}

export interface CreateMetricsConfigParams {
  domain: string;
  application: string;
  metrics: Array<{
    name: string;
    threshold: number;
    tier?: CriticalityTier;
    environment?: string;
    enabled?: boolean;
  }>;
  user_id: string;
  user_name?: string;
}

export interface UpdateMetricsConfigParams {
  config_id: string;
  threshold?: number;
  tier?: CriticalityTier;
  environment?: string;
  enabled?: boolean;
  user_id: string;
  user_name?: string;
}

export interface DeleteMetricsConfigParams {
  config_id: string;
  user_id: string;
  user_name?: string;
}

export interface MetricsConfigFilter {
  domain?: string;
  application?: string;
  metric_name?: string;
  tier?: CriticalityTier;
  environment?: string;
  enabled?: boolean;
  configured_by?: string;
  page?: number;
  page_size?: number;
}

export interface MetricsConfigBulkResult {
  created: number;
  failed: number;
  errors: string[];
  config_ids: string[];
}

// ============================================================
// Validation Constants
// ============================================================

const VALID_METRIC_NAMES: string[] = [
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

const VALID_TIERS: CriticalityTier[] = [
  "Tier-1",
  "Tier-2",
  "Tier-3",
  "Tier-4",
];

const VALID_ENVIRONMENTS: string[] = ["Prod", "Staging", "QA", "Dev"];

// ============================================================
// Validation Helpers
// ============================================================

/**
 * Validates that a domain name is non-empty and within length limits.
 */
function validateDomain(domain: string): void {
  if (!domain || domain.trim().length === 0) {
    throw new Error("Domain name is required.");
  }

  if (domain.trim().length > 128) {
    throw new Error("Domain name cannot exceed 128 characters.");
  }
}

/**
 * Validates that an application name is non-empty and within length limits.
 */
function validateApplication(application: string): void {
  if (!application || application.trim().length === 0) {
    throw new Error("Application name is required.");
  }

  if (application.trim().length > 128) {
    throw new Error("Application name cannot exceed 128 characters.");
  }
}

/**
 * Validates that a metric name is one of the supported metric types.
 */
function validateMetricName(metricName: string): void {
  if (!metricName || metricName.trim().length === 0) {
    throw new Error("Metric name is required.");
  }

  if (!VALID_METRIC_NAMES.includes(metricName.trim())) {
    throw new Error(
      `Invalid metric name: "${metricName}". Must be one of: ${VALID_METRIC_NAMES.join(", ")}.`
    );
  }
}

/**
 * Validates that a threshold value is a positive number.
 */
function validateThreshold(threshold: number): void {
  if (threshold === undefined || threshold === null) {
    throw new Error("Threshold value is required.");
  }

  if (typeof threshold !== "number" || isNaN(threshold)) {
    throw new Error("Threshold must be a valid number.");
  }

  if (threshold <= 0) {
    throw new Error("Threshold must be a positive number.");
  }
}

/**
 * Validates that a tier value is one of the supported criticality tiers.
 */
function validateTier(tier: string): void {
  if (!VALID_TIERS.includes(tier as CriticalityTier)) {
    throw new Error(
      `Invalid tier: "${tier}". Must be one of: ${VALID_TIERS.join(", ")}.`
    );
  }
}

/**
 * Validates that an environment value is one of the supported environments.
 */
function validateEnvironment(environment: string): void {
  if (!VALID_ENVIRONMENTS.includes(environment)) {
    throw new Error(
      `Invalid environment: "${environment}". Must be one of: ${VALID_ENVIRONMENTS.join(", ")}.`
    );
  }
}

/**
 * Validates that a user ID is non-empty.
 */
function validateUserId(userId: string): void {
  if (!userId || userId.trim().length === 0) {
    throw new Error("User ID is required.");
  }
}

// ============================================================
// Row Mapping Helper
// ============================================================

/**
 * Maps a raw database row to the MetricsConfigRecord type.
 */
function mapConfigRow(row: {
  id: string;
  domain: string;
  application: string;
  metric_name: string;
  threshold: number;
  tier: string | null;
  environment: string | null;
  enabled: boolean;
  configured_by: string;
  configured_by_name: string | null;
  configured_at: string;
  updated_at: string;
}): MetricsConfigRecord {
  return {
    id: row.id,
    domain: row.domain,
    application: row.application,
    metric_name: row.metric_name,
    threshold: row.threshold,
    tier: (row.tier as CriticalityTier) || undefined,
    environment: row.environment || undefined,
    enabled: row.enabled,
    configured_by: row.configured_by,
    configured_by_name: row.configured_by_name || undefined,
    configured_at: row.configured_at,
    updated_at: row.updated_at,
  };
}

// ============================================================
// CRUD Operations
// ============================================================

/**
 * Creates one or more metrics configuration records for a domain/application.
 * Each metric entry is validated individually. Valid entries are inserted;
 * invalid entries are collected as errors. The operation is logged to the audit trail.
 *
 * @param params - The configuration creation parameters
 * @returns Bulk result with counts and any errors
 * @throws Error if domain, application, or user_id validation fails
 */
export async function createMetricsConfig(
  params: CreateMetricsConfigParams
): Promise<MetricsConfigBulkResult> {
  validateDomain(params.domain);
  validateApplication(params.application);
  validateUserId(params.user_id);

  if (!params.metrics || params.metrics.length === 0) {
    throw new Error("At least one metric configuration is required.");
  }

  const supabase = createServerClient();
  const now = new Date().toISOString();

  const validRecords: Array<Record<string, unknown>> = [];
  const errors: string[] = [];

  for (let i = 0; i < params.metrics.length; i++) {
    const metric = params.metrics[i];

    try {
      validateMetricName(metric.name);
      validateThreshold(metric.threshold);

      if (metric.tier) {
        validateTier(metric.tier);
      }

      if (metric.environment) {
        validateEnvironment(metric.environment);
      }

      validRecords.push({
        domain: params.domain.trim(),
        application: params.application.trim(),
        metric_name: metric.name.trim(),
        threshold: metric.threshold,
        tier: metric.tier || null,
        environment: metric.environment || null,
        enabled: metric.enabled !== undefined ? metric.enabled : true,
        configured_by: params.user_id,
        configured_by_name: params.user_name || null,
        configured_at: now,
        updated_at: now,
      });
    } catch (validationError) {
      errors.push(
        `Metric ${i + 1} (${metric.name || "unknown"}): ${validationError instanceof Error ? validationError.message : "Validation error."}`
      );
    }
  }

  if (validRecords.length === 0) {
    return {
      created: 0,
      failed: params.metrics.length,
      errors,
      config_ids: [],
    };
  }

  const { data, error: insertError } = await supabase
    .from("metrics_config")
    .insert(validRecords)
    .select("id");

  if (insertError) {
    console.error("Failed to create metrics config:", insertError);
    throw new Error(
      `Failed to create metrics configuration: ${insertError.message}`
    );
  }

  const configIds = (data || []).map((row: { id: string }) => row.id);

  // Log the action to the audit trail
  try {
    await logAction({
      action: AUDIT_ACTIONS.CONFIGURE_METRICS,
      entity_type: "service" as EntityType,
      entity_id: `${params.domain.trim()}:${params.application.trim()}`,
      user_id: params.user_id,
      user_name: params.user_name,
      details: {
        domain: params.domain.trim(),
        application: params.application.trim(),
        metrics_count: configIds.length,
        config_ids: configIds,
        failed_count: errors.length,
      },
    });
  } catch (auditError) {
    console.error("Audit log failed for metrics config creation:", auditError);
  }

  return {
    created: configIds.length,
    failed: errors.length,
    errors,
    config_ids: configIds,
  };
}

/**
 * Updates an existing metrics configuration record.
 * Only threshold, tier, environment, and enabled fields can be modified.
 * The update is logged to the audit trail with previous and new values.
 *
 * @param params - The configuration update parameters
 * @returns The updated configuration record
 * @throws Error if the configuration is not found or validation fails
 */
export async function updateMetricsConfig(
  params: UpdateMetricsConfigParams
): Promise<MetricsConfigRecord> {
  if (!params.config_id || params.config_id.trim().length === 0) {
    throw new Error("Config ID is required for update.");
  }

  validateUserId(params.user_id);

  // Validate optional fields if provided
  if (params.threshold !== undefined) {
    validateThreshold(params.threshold);
  }

  if (params.tier !== undefined) {
    validateTier(params.tier);
  }

  if (params.environment !== undefined) {
    validateEnvironment(params.environment);
  }

  const supabase = createServerClient();

  // Fetch the existing record for audit trail
  const { data: existing, error: fetchError } = await supabase
    .from("metrics_config")
    .select("*")
    .eq("id", params.config_id)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      throw new Error(`Metrics configuration not found: ${params.config_id}`);
    }
    console.error("Error fetching metrics config for update:", fetchError);
    throw new Error(
      `Failed to fetch metrics configuration: ${fetchError.message}`
    );
  }

  const now = new Date().toISOString();

  // Build the update payload with only provided fields
  const updatePayload: Record<string, unknown> = {
    updated_at: now,
  };

  if (params.threshold !== undefined) {
    updatePayload.threshold = params.threshold;
  }

  if (params.tier !== undefined) {
    updatePayload.tier = params.tier;
  }

  if (params.environment !== undefined) {
    updatePayload.environment = params.environment;
  }

  if (params.enabled !== undefined) {
    updatePayload.enabled = params.enabled;
  }

  const { data, error: updateError } = await supabase
    .from("metrics_config")
    .update(updatePayload)
    .eq("id", params.config_id)
    .select()
    .single();

  if (updateError) {
    console.error("Failed to update metrics config:", updateError);
    throw new Error(
      `Failed to update metrics configuration: ${updateError.message}`
    );
  }

  // Log the update to the audit trail
  try {
    await logAction({
      action: AUDIT_ACTIONS.UPDATE_METRICS_CONFIG,
      entity_type: "service" as EntityType,
      entity_id: params.config_id,
      user_id: params.user_id,
      user_name: params.user_name,
      details: {
        config_id: params.config_id,
        domain: existing.domain,
        application: existing.application,
        metric_name: existing.metric_name,
        previous_threshold: existing.threshold,
        new_threshold: params.threshold !== undefined ? params.threshold : existing.threshold,
        previous_tier: existing.tier,
        new_tier: params.tier !== undefined ? params.tier : existing.tier,
        previous_enabled: existing.enabled,
        new_enabled: params.enabled !== undefined ? params.enabled : existing.enabled,
      },
    });
  } catch (auditError) {
    console.error("Audit log failed for metrics config update:", auditError);
  }

  return mapConfigRow(data);
}

/**
 * Deletes a metrics configuration record by ID.
 * Records the deletion in the audit log for compliance.
 *
 * @param params - The deletion parameters
 * @throws Error if the configuration is not found or the deletion fails
 */
export async function deleteMetricsConfig(
  params: DeleteMetricsConfigParams
): Promise<void> {
  if (!params.config_id || params.config_id.trim().length === 0) {
    throw new Error("Config ID is required for deletion.");
  }

  validateUserId(params.user_id);

  const supabase = createServerClient();

  // Fetch the record before deletion for audit purposes
  const { data: existing, error: fetchError } = await supabase
    .from("metrics_config")
    .select("*")
    .eq("id", params.config_id)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      throw new Error(`Metrics configuration not found: ${params.config_id}`);
    }
    console.error("Error fetching metrics config for deletion:", fetchError);
    throw new Error(
      `Failed to fetch metrics configuration: ${fetchError.message}`
    );
  }

  const { error: deleteError } = await supabase
    .from("metrics_config")
    .delete()
    .eq("id", params.config_id);

  if (deleteError) {
    console.error("Failed to delete metrics config:", deleteError);
    throw new Error(
      `Failed to delete metrics configuration: ${deleteError.message}`
    );
  }

  // Log the deletion to the audit trail
  try {
    await logAction({
      action: AUDIT_ACTIONS.DELETE_METRICS_CONFIG,
      entity_type: "service" as EntityType,
      entity_id: params.config_id,
      user_id: params.user_id,
      user_name: params.user_name,
      details: {
        config_id: params.config_id,
        domain: existing.domain,
        application: existing.application,
        metric_name: existing.metric_name,
        threshold: existing.threshold,
        tier: existing.tier,
        deleted_record: {
          domain: existing.domain,
          application: existing.application,
          metric_name: existing.metric_name,
          threshold: existing.threshold,
        },
      },
    });
  } catch (auditError) {
    console.error("Audit log failed for metrics config deletion:", auditError);
  }
}

// ============================================================
// Query Operations
// ============================================================

/**
 * Retrieves a single metrics configuration record by ID.
 *
 * @param configId - The ID of the configuration record
 * @returns The configuration record or null if not found
 */
export async function getMetricsConfigById(
  configId: string
): Promise<MetricsConfigRecord | null> {
  if (!configId || configId.trim().length === 0) {
    throw new Error("Config ID is required.");
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("metrics_config")
    .select("*")
    .eq("id", configId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching metrics config by ID:", error);
    throw new Error(
      `Failed to fetch metrics configuration: ${error.message}`
    );
  }

  return mapConfigRow(data);
}

/**
 * Retrieves metrics configurations with optional filters and pagination.
 * Supports filtering by domain, application, metric name, tier, environment,
 * enabled status, and configured_by user.
 *
 * @param filter - Optional filter criteria
 * @returns Paginated configuration results
 */
export async function getMetricsConfigs(
  filter?: MetricsConfigFilter
): Promise<PaginatedResponse<MetricsConfigRecord>> {
  const supabase = createServerClient();

  const page = filter?.page || PAGINATION.DEFAULT_PAGE;
  const pageSize = Math.min(
    filter?.page_size || PAGINATION.DEFAULT_PAGE_SIZE,
    PAGINATION.MAX_PAGE_SIZE
  );
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("metrics_config")
    .select("*", { count: "exact" });

  if (filter?.domain) {
    query = query.eq("domain", filter.domain);
  }

  if (filter?.application) {
    query = query.eq("application", filter.application);
  }

  if (filter?.metric_name) {
    query = query.eq("metric_name", filter.metric_name);
  }

  if (filter?.tier) {
    query = query.eq("tier", filter.tier);
  }

  if (filter?.environment) {
    query = query.eq("environment", filter.environment);
  }

  if (filter?.enabled !== undefined) {
    query = query.eq("enabled", filter.enabled);
  }

  if (filter?.configured_by) {
    query = query.eq("configured_by", filter.configured_by);
  }

  query = query
    .order("updated_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Failed to query metrics configs:", error);
    throw new Error(`Metrics configuration query failed: ${error.message}`);
  }

  const total = count || 0;
  const configs = (data || []).map(mapConfigRow);

  return {
    data: configs,
    total,
    page,
    page_size: pageSize,
    has_next: offset + pageSize < total,
    has_previous: page > 1,
  };
}

/**
 * Retrieves all metrics configurations for a specific domain and application.
 * Results are ordered by metric_name ascending.
 *
 * @param domain - The domain name
 * @param application - The application name
 * @returns Array of configuration records
 */
export async function getMetricsConfigForApplication(
  domain: string,
  application: string
): Promise<MetricsConfigRecord[]> {
  validateDomain(domain);
  validateApplication(application);

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("metrics_config")
    .select("*")
    .eq("domain", domain)
    .eq("application", application)
    .order("metric_name", { ascending: true });

  if (error) {
    console.error("Error fetching metrics config for application:", error);
    throw new Error(
      `Failed to fetch metrics configuration for ${domain}/${application}: ${error.message}`
    );
  }

  return (data || []).map(mapConfigRow);
}

/**
 * Retrieves all metrics configurations for a specific domain.
 * Results are ordered by application and metric_name ascending.
 *
 * @param domain - The domain name
 * @returns Array of configuration records
 */
export async function getMetricsConfigForDomain(
  domain: string
): Promise<MetricsConfigRecord[]> {
  validateDomain(domain);

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("metrics_config")
    .select("*")
    .eq("domain", domain)
    .order("application", { ascending: true })
    .order("metric_name", { ascending: true });

  if (error) {
    console.error("Error fetching metrics config for domain:", error);
    throw new Error(
      `Failed to fetch metrics configuration for domain ${domain}: ${error.message}`
    );
  }

  return (data || []).map(mapConfigRow);
}

/**
 * Retrieves only enabled metrics configurations for a specific domain and application.
 * Useful for runtime threshold evaluation.
 *
 * @param domain - The domain name
 * @param application - The application name
 * @returns Array of enabled configuration records
 */
export async function getActiveMetricsConfig(
  domain: string,
  application: string
): Promise<MetricsConfigRecord[]> {
  validateDomain(domain);
  validateApplication(application);

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("metrics_config")
    .select("*")
    .eq("domain", domain)
    .eq("application", application)
    .eq("enabled", true)
    .order("metric_name", { ascending: true });

  if (error) {
    console.error("Error fetching active metrics config:", error);
    throw new Error(
      `Failed to fetch active metrics configuration: ${error.message}`
    );
  }

  return (data || []).map(mapConfigRow);
}

/**
 * Retrieves the threshold for a specific metric on a domain/application.
 * Returns null if no configuration exists.
 *
 * @param domain - The domain name
 * @param application - The application name
 * @param metricName - The metric name
 * @returns The threshold value or null if not configured
 */
export async function getThresholdForMetric(
  domain: string,
  application: string,
  metricName: string
): Promise<number | null> {
  validateDomain(domain);
  validateApplication(application);
  validateMetricName(metricName);

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("metrics_config")
    .select("threshold, enabled")
    .eq("domain", domain)
    .eq("application", application)
    .eq("metric_name", metricName)
    .eq("enabled", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching threshold for metric:", error);
    throw new Error(
      `Failed to fetch threshold for ${metricName}: ${error.message}`
    );
  }

  return data?.threshold ?? null;
}

// ============================================================
// Bulk Operations
// ============================================================

/**
 * Retrieves a summary of all configured metrics grouped by domain.
 * Useful for admin overview pages.
 *
 * @returns Map of domain to array of application summaries
 */
export async function getMetricsConfigSummary(): Promise<
  Array<{
    domain: string;
    application: string;
    total_metrics: number;
    enabled_metrics: number;
    disabled_metrics: number;
    last_updated: string;
  }>
> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("metrics_config")
    .select("domain, application, enabled, updated_at")
    .order("domain", { ascending: true })
    .order("application", { ascending: true });

  if (error) {
    console.error("Error fetching metrics config summary:", error);
    throw new Error(
      `Failed to fetch metrics configuration summary: ${error.message}`
    );
  }

  // Group by domain + application
  const groupMap = new Map<
    string,
    {
      domain: string;
      application: string;
      total: number;
      enabled: number;
      disabled: number;
      lastUpdated: string;
    }
  >();

  for (const row of data || []) {
    const key = `${row.domain}:${row.application}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        domain: row.domain,
        application: row.application,
        total: 0,
        enabled: 0,
        disabled: 0,
        lastUpdated: row.updated_at,
      });
    }

    const group = groupMap.get(key)!;
    group.total++;

    if (row.enabled) {
      group.enabled++;
    } else {
      group.disabled++;
    }

    if (row.updated_at > group.lastUpdated) {
      group.lastUpdated = row.updated_at;
    }
  }

  return Array.from(groupMap.values()).map((group) => ({
    domain: group.domain,
    application: group.application,
    total_metrics: group.total,
    enabled_metrics: group.enabled,
    disabled_metrics: group.disabled,
    last_updated: group.lastUpdated,
  }));
}

/**
 * Checks if a specific metric configuration already exists for a domain/application.
 * Useful for preventing duplicate configurations.
 *
 * @param domain - The domain name
 * @param application - The application name
 * @param metricName - The metric name
 * @returns True if a configuration already exists
 */
export async function metricsConfigExists(
  domain: string,
  application: string,
  metricName: string
): Promise<boolean> {
  validateDomain(domain);
  validateApplication(application);
  validateMetricName(metricName);

  const supabase = createServerClient();

  const { count, error } = await supabase
    .from("metrics_config")
    .select("id", { count: "exact", head: true })
    .eq("domain", domain)
    .eq("application", application)
    .eq("metric_name", metricName);

  if (error) {
    console.error("Error checking metrics config existence:", error);
    throw new Error(
      `Failed to check metrics configuration existence: ${error.message}`
    );
  }

  return (count || 0) > 0;
}

/**
 * Toggles the enabled status of a metrics configuration record.
 * Convenience method for enabling/disabling a configuration without
 * needing to specify the full update payload.
 *
 * @param configId - The ID of the configuration record
 * @param enabled - The new enabled status
 * @param userId - The ID of the user performing the action
 * @param userName - Optional name of the user
 * @returns The updated configuration record
 */
export async function toggleMetricsConfig(
  configId: string,
  enabled: boolean,
  userId: string,
  userName?: string
): Promise<MetricsConfigRecord> {
  return updateMetricsConfig({
    config_id: configId,
    enabled,
    user_id: userId,
    user_name: userName,
  });
}

/**
 * Returns the list of valid metric names that can be configured.
 * Useful for populating dropdowns in the admin UI.
 */
export function getValidMetricNames(): string[] {
  return [...VALID_METRIC_NAMES];
}

/**
 * Returns the list of valid tiers that can be assigned to configurations.
 */
export function getValidTiers(): CriticalityTier[] {
  return [...VALID_TIERS];
}

/**
 * Returns the list of valid environments that can be assigned to configurations.
 */
export function getValidEnvironments(): string[] {
  return [...VALID_ENVIRONMENTS];
}