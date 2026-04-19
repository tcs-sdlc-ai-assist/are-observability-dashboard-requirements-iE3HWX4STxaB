import useSWR, { mutate as globalMutate } from "swr";
import { useCallback } from "react";
import { REFRESH_INTERVALS, PAGINATION } from "@/constants/constants";
import type {
  AuditLog,
  Annotation,
  DocumentationLink,
  EntityType,
  MetricType,
  CriticalityTier,
  DataType,
  PaginatedResponse,
} from "@/types";
import type { MetricsConfigRecord } from "@/lib/services/metrics-config-service";
import type { AuditLogFilter } from "@/lib/services/audit-logger";
import type { DocumentationLinkFilter } from "@/lib/services/documentation-link-service";
import type { MetricsConfigFilter } from "@/lib/services/metrics-config-service";

// ============================================================
// Types
// ============================================================

export interface UseAdminDataReturn<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isValidating: boolean;
  mutate: () => void;
}

export interface UsePaginatedAdminDataReturn<T> {
  data: PaginatedResponse<T> | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isValidating: boolean;
  mutate: () => void;
}

export interface AuditLogParams {
  action?: string;
  entity_type?: EntityType;
  entity_id?: string;
  user_id?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

export interface MetricsConfigParams {
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

export interface DocumentationLinkParams {
  category?: DocumentationLink["category"];
  service_id?: string;
  domain_id?: string;
  created_by?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface UploadHistoryParams {
  user_id?: string;
  limit?: number;
}

export interface CreateMetricsConfigPayload {
  domain: string;
  application: string;
  metrics: Array<{
    name: string;
    threshold: number;
    tier?: CriticalityTier;
    environment?: string;
    enabled?: boolean;
  }>;
}

export interface UpdateMetricsConfigPayload {
  config_id: string;
  threshold?: number;
  tier?: CriticalityTier;
  environment?: string;
  enabled?: boolean;
}

export interface CreateDocumentationLinkPayload {
  title: string;
  url: string;
  category: DocumentationLink["category"];
  service_id?: string;
  domain_id?: string;
  description?: string;
}

export interface UpdateDocumentationLinkPayload {
  link_id: string;
  title?: string;
  url?: string;
  category?: DocumentationLink["category"];
  service_id?: string;
  domain_id?: string;
  description?: string;
}

export interface UploadFilePayload {
  file: File;
  data_type: DataType;
}

export interface CreateAnnotationPayload {
  entity_type: EntityType;
  entity_id: string;
  annotation: string;
}

export interface UpdateAnnotationPayload {
  annotation_id: string;
  annotation: string;
}

export interface MutationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
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
// URL Builder Helper
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
// Mutation Helpers
// ============================================================

/**
 * Generic POST request helper for mutations.
 */
async function postRequest<T>(
  url: string,
  body: unknown
): Promise<MutationResult<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: json?.message || res.statusText || "Request failed.",
      };
    }

    return {
      success: true,
      data: json.data !== undefined ? json.data : json,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred.",
    };
  }
}

/**
 * Generic PUT/PATCH request helper for mutations.
 */
async function putRequest<T>(
  url: string,
  body: unknown
): Promise<MutationResult<T>> {
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: json?.message || res.statusText || "Request failed.",
      };
    }

    return {
      success: true,
      data: json.data !== undefined ? json.data : json,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred.",
    };
  }
}

/**
 * Generic DELETE request helper for mutations.
 */
async function deleteRequest<T>(
  url: string,
  body?: unknown
): Promise<MutationResult<T>> {
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: json?.message || res.statusText || "Request failed.",
      };
    }

    return {
      success: true,
      data: json.data !== undefined ? json.data : json,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred.",
    };
  }
}

// ============================================================
// Audit Log Hooks
// ============================================================

/**
 * Fetches paginated audit logs with optional filters.
 * Supports filtering by action, entity type, entity ID, user ID, and time range.
 *
 * @param params - Optional filter and pagination parameters
 * @returns SWR-managed paginated data, error, and loading states
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useAuditLogs({ action: "UPLOAD_INTERIM_DATA", page: 1 });
 * ```
 */
export function useAuditLogs(
  params?: AuditLogParams
): UsePaginatedAdminDataReturn<AuditLog> {
  const url = buildUrl("/api/audit-log", {
    action: params?.action,
    entity_type: params?.entity_type,
    entity_id: params?.entity_id,
    user_id: params?.user_id,
    from: params?.from,
    to: params?.to,
    page: params?.page,
    page_size: params?.page_size,
  });

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    PaginatedResponse<AuditLog>
  >(url, fetcher, {
    refreshInterval: REFRESH_INTERVALS.SLOW,
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  });

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
 * Fetches audit logs for a specific entity.
 *
 * @param entityType - The type of entity
 * @param entityId - The ID of the entity
 * @returns SWR-managed data, error, and loading states
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useAuditLogsForEntity("incident", "inc-123");
 * ```
 */
export function useAuditLogsForEntity(
  entityType: EntityType | null,
  entityId: string | null
): UseAdminDataReturn<AuditLog[]> {
  const url =
    entityType && entityId
      ? buildUrl("/api/audit-log", {
          entity_type: entityType,
          entity_id: entityId,
          page_size: PAGINATION.MAX_PAGE_SIZE,
        })
      : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    PaginatedResponse<AuditLog>
  >(url, fetcher, {
    refreshInterval: REFRESH_INTERVALS.SLOW,
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  });

  return {
    data: data?.data,
    error,
    isLoading,
    isValidating,
    mutate: () => {
      mutate();
    },
  };
}

// ============================================================
// Metrics Config Hooks
// ============================================================

/**
 * Fetches paginated metrics configurations with optional filters.
 * Supports filtering by domain, application, metric name, tier, environment,
 * enabled status, and configured_by user.
 *
 * @param params - Optional filter and pagination parameters
 * @returns SWR-managed paginated data, error, and loading states
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useMetricsConfig({ domain: "payments", enabled: true });
 * ```
 */
export function useMetricsConfig(
  params?: MetricsConfigParams
): UsePaginatedAdminDataReturn<MetricsConfigRecord> {
  const url = buildUrl("/api/metrics/config", {
    domain: params?.domain,
    application: params?.application,
    metric_name: params?.metric_name,
    tier: params?.tier,
    environment: params?.environment,
    enabled: params?.enabled,
    configured_by: params?.configured_by,
    page: params?.page,
    page_size: params?.page_size,
  });

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    PaginatedResponse<MetricsConfigRecord>
  >(url, fetcher, {
    refreshInterval: REFRESH_INTERVALS.SLOW,
    revalidateOnFocus: true,
    dedupingInterval: 15_000,
  });

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
 * Fetches metrics configurations for a specific domain and application.
 *
 * @param domain - The domain name
 * @param application - The application name
 * @returns SWR-managed data, error, and loading states
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useMetricsConfigForApplication("payments", "checkout-api");
 * ```
 */
export function useMetricsConfigForApplication(
  domain: string | null,
  application: string | null
): UseAdminDataReturn<MetricsConfigRecord[]> {
  const url =
    domain && application
      ? buildUrl("/api/metrics/config", {
          domain,
          application,
          page_size: PAGINATION.MAX_PAGE_SIZE,
        })
      : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    PaginatedResponse<MetricsConfigRecord>
  >(url, fetcher, {
    refreshInterval: REFRESH_INTERVALS.SLOW,
    revalidateOnFocus: true,
    dedupingInterval: 15_000,
  });

  return {
    data: data?.data,
    error,
    isLoading,
    isValidating,
    mutate: () => {
      mutate();
    },
  };
}

/**
 * Fetches the metrics config summary grouped by domain/application.
 *
 * @returns SWR-managed data, error, and loading states
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useMetricsConfigSummary();
 * ```
 */
export function useMetricsConfigSummary(): UseAdminDataReturn<
  Array<{
    domain: string;
    application: string;
    total_metrics: number;
    enabled_metrics: number;
    disabled_metrics: number;
    last_updated: string;
  }>
> {
  const { data, error, isLoading, isValidating, mutate } = useSWR<
    Array<{
      domain: string;
      application: string;
      total_metrics: number;
      enabled_metrics: number;
      disabled_metrics: number;
      last_updated: string;
    }>
  >("/api/metrics/config/summary", fetcher, {
    refreshInterval: REFRESH_INTERVALS.SLOW,
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
  });

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
 * Provides mutation functions for metrics configuration CRUD operations.
 * Includes optimistic update support via SWR cache invalidation.
 *
 * @returns Object with create, update, delete, and toggle mutation functions
 *
 * @example
 * ```tsx
 * const { createConfig, updateConfig, deleteConfig, toggleConfig } = useMetricsConfigMutations();
 *
 * const result = await createConfig({
 *   domain: "payments",
 *   application: "checkout-api",
 *   metrics: [{ name: "latency_p95", threshold: 200 }],
 * });
 * ```
 */
export function useMetricsConfigMutations() {
  const invalidateCache = useCallback(() => {
    globalMutate(
      (key) => typeof key === "string" && key.startsWith("/api/metrics/config"),
      undefined,
      { revalidate: true }
    );
  }, []);

  const createConfig = useCallback(
    async (
      payload: CreateMetricsConfigPayload
    ): Promise<MutationResult> => {
      const result = await postRequest("/api/metrics/config", payload);
      if (result.success) {
        invalidateCache();
      }
      return result;
    },
    [invalidateCache]
  );

  const updateConfig = useCallback(
    async (
      payload: UpdateMetricsConfigPayload
    ): Promise<MutationResult> => {
      const result = await putRequest(
        `/api/metrics/config/${payload.config_id}`,
        payload
      );
      if (result.success) {
        invalidateCache();
      }
      return result;
    },
    [invalidateCache]
  );

  const deleteConfig = useCallback(
    async (configId: string): Promise<MutationResult> => {
      const result = await deleteRequest(`/api/metrics/config/${configId}`);
      if (result.success) {
        invalidateCache();
      }
      return result;
    },
    [invalidateCache]
  );

  const toggleConfig = useCallback(
    async (configId: string, enabled: boolean): Promise<MutationResult> => {
      const result = await putRequest(
        `/api/metrics/config/${configId}`,
        { config_id: configId, enabled }
      );
      if (result.success) {
        invalidateCache();
      }
      return result;
    },
    [invalidateCache]
  );

  return {
    createConfig,
    updateConfig,
    deleteConfig,
    toggleConfig,
  };
}

// ============================================================
// Documentation Link Hooks
// ============================================================

/**
 * Fetches paginated documentation links with optional filters.
 * Supports filtering by category, service_id, domain_id, created_by, and search text.
 *
 * @param params - Optional filter and pagination parameters
 * @returns SWR-managed paginated data, error, and loading states
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useDocumentationLinks({ category: "runbook", search: "checkout" });
 * ```
 */
export function useDocumentationLinks(
  params?: DocumentationLinkParams
): UsePaginatedAdminDataReturn<DocumentationLink> {
  const url = buildUrl("/api/documentation-links", {
    category: params?.category,
    service_id: params?.service_id,
    domain_id: params?.domain_id,
    created_by: params?.created_by,
    search: params?.search,
    page: params?.page,
    page_size: params?.page_size,
  });

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    PaginatedResponse<DocumentationLink>
  >(url, fetcher, {
    refreshInterval: REFRESH_INTERVALS.SLOW,
    revalidateOnFocus: true,
    dedupingInterval: 15_000,
  });

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
 * Fetches documentation links for a specific service.
 *
 * @param serviceId - The service ID
 * @returns SWR-managed data, error, and loading states
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useDocumentationLinksForService("svc-123");
 * ```
 */
export function useDocumentationLinksForService(
  serviceId: string | null
): UseAdminDataReturn<DocumentationLink[]> {
  const url = serviceId
    ? buildUrl("/api/documentation-links", {
        service_id: serviceId,
        page_size: PAGINATION.MAX_PAGE_SIZE,
      })
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    PaginatedResponse<DocumentationLink>
  >(url, fetcher, {
    refreshInterval: REFRESH_INTERVALS.SLOW,
    revalidateOnFocus: true,
    dedupingInterval: 15_000,
  });

  return {
    data: data?.data,
    error,
    isLoading,
    isValidating,
    mutate: () => {
      mutate();
    },
  };
}

/**
 * Fetches the documentation link summary grouped by category.
 *
 * @returns SWR-managed data, error, and loading states
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useDocumentationLinkSummary();
 * ```
 */
export function useDocumentationLinkSummary(): UseAdminDataReturn<
  Array<{
    category: DocumentationLink["category"];
    total_links: number;
    last_updated: string;
  }>
> {
  const { data, error, isLoading, isValidating, mutate } = useSWR<
    Array<{
      category: DocumentationLink["category"];
      total_links: number;
      last_updated: string;
    }>
  >("/api/documentation-links/summary", fetcher, {
    refreshInterval: REFRESH_INTERVALS.SLOW,
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
  });

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
 * Provides mutation functions for documentation link CRUD operations.
 * Includes optimistic update support via SWR cache invalidation.
 *
 * @returns Object with create, update, and delete mutation functions
 *
 * @example
 * ```tsx
 * const { createLink, updateLink, deleteLink } = useDocumentationLinkMutations();
 *
 * const result = await createLink({
 *   title: "Checkout Runbook",
 *   url: "https://wiki.example.com/runbooks/checkout",
 *   category: "runbook",
 *   service_id: "svc-123",
 * });
 * ```
 */
export function useDocumentationLinkMutations() {
  const invalidateCache = useCallback(() => {
    globalMutate(
      (key) =>
        typeof key === "string" && key.startsWith("/api/documentation-links"),
      undefined,
      { revalidate: true }
    );
  }, []);

  const createLink = useCallback(
    async (
      payload: CreateDocumentationLinkPayload
    ): Promise<MutationResult<DocumentationLink>> => {
      const result = await postRequest<DocumentationLink>(
        "/api/documentation-links",
        payload
      );
      if (result.success) {
        invalidateCache();
      }
      return result;
    },
    [invalidateCache]
  );

  const updateLink = useCallback(
    async (
      payload: UpdateDocumentationLinkPayload
    ): Promise<MutationResult<DocumentationLink>> => {
      const result = await putRequest<DocumentationLink>(
        `/api/documentation-links/${payload.link_id}`,
        payload
      );
      if (result.success) {
        invalidateCache();
      }
      return result;
    },
    [invalidateCache]
  );

  const deleteLink = useCallback(
    async (linkId: string): Promise<MutationResult> => {
      const result = await deleteRequest(`/api/documentation-links/${linkId}`);
      if (result.success) {
        invalidateCache();
      }
      return result;
    },
    [invalidateCache]
  );

  return {
    createLink,
    updateLink,
    deleteLink,
  };
}

// ============================================================
// Upload Data Hooks
// ============================================================

/**
 * Fetches upload history with optional user filter.
 *
 * @param params - Optional filter parameters
 * @returns SWR-managed data, error, and loading states
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useUploadHistory({ limit: 20 });
 * ```
 */
export function useUploadHistory(
  params?: UploadHistoryParams
): UseAdminDataReturn<
  Array<{
    id: string;
    file_name: string;
    data_type: string;
    uploader: string;
    uploader_name: string | null;
    records_ingested: number;
    records_failed: number | null;
    errors: string[] | null;
    status: string;
    file_size_bytes: number | null;
    timestamp: string;
  }>
> {
  const url = buildUrl("/api/upload/history", {
    user_id: params?.user_id,
    limit: params?.limit,
  });

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    Array<{
      id: string;
      file_name: string;
      data_type: string;
      uploader: string;
      uploader_name: string | null;
      records_ingested: number;
      records_failed: number | null;
      errors: string[] | null;
      status: string;
      file_size_bytes: number | null;
      timestamp: string;
    }>
  >(url, fetcher, {
    refreshInterval: REFRESH_INTERVALS.SLOW,
    revalidateOnFocus: true,
    dedupingInterval: 15_000,
  });

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
 * Fetches a single upload log by ID.
 *
 * @param uploadLogId - The upload log ID
 * @returns SWR-managed data, error, and loading states
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useUploadLogById("upload-123");
 * ```
 */
export function useUploadLogById(
  uploadLogId: string | null
): UseAdminDataReturn<{
  id: string;
  file_name: string;
  data_type: string;
  uploader: string;
  uploader_name: string | null;
  records_ingested: number;
  records_failed: number | null;
  errors: string[] | null;
  status: string;
  file_size_bytes: number | null;
  timestamp: string;
}> {
  const url = uploadLogId ? `/api/upload/${uploadLogId}` : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
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
 * Provides mutation functions for file upload and validation operations.
 * Handles multipart form data submission for file uploads.
 *
 * @returns Object with uploadFile and validateFile mutation functions
 *
 * @example
 * ```tsx
 * const { uploadFile, validateFile } = useUploadData();
 *
 * const result = await uploadFile({ file: myFile, data_type: "metric" });
 * if (result.success) {
 *   console.log("Uploaded:", result.data);
 * }
 * ```
 */
export function useUploadData() {
  const invalidateCache = useCallback(() => {
    globalMutate(
      (key) => typeof key === "string" && key.startsWith("/api/upload"),
      undefined,
      { revalidate: true }
    );
  }, []);

  const uploadFile = useCallback(
    async (
      payload: UploadFilePayload
    ): Promise<
      MutationResult<{
        status: string;
        records_ingested: number;
        records_failed: number;
        errors: string[];
        file_name: string;
        data_type: string;
        upload_log_id?: string;
      }>
    > => {
      try {
        const formData = new FormData();
        formData.append("file", payload.file);
        formData.append("data_type", payload.data_type);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const json = await res.json();

        if (!res.ok) {
          return {
            success: false,
            error: json?.message || res.statusText || "Upload failed.",
          };
        }

        invalidateCache();

        return {
          success: true,
          data: json.data !== undefined ? json.data : json,
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred during upload.",
        };
      }
    },
    [invalidateCache]
  );

  const validateFile = useCallback(
    async (
      payload: UploadFilePayload
    ): Promise<
      MutationResult<{
        valid: boolean;
        total_rows: number;
        valid_rows: number;
        invalid_rows: number;
        errors: string[];
      }>
    > => {
      try {
        const formData = new FormData();
        formData.append("file", payload.file);
        formData.append("data_type", payload.data_type);

        const res = await fetch("/api/upload/validate", {
          method: "POST",
          body: formData,
        });

        const json = await res.json();

        if (!res.ok) {
          return {
            success: false,
            error: json?.message || res.statusText || "Validation failed.",
          };
        }

        return {
          success: true,
          data: json.data !== undefined ? json.data : json,
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred during validation.",
        };
      }
    },
    []
  );

  return {
    uploadFile,
    validateFile,
  };
}

// ============================================================
// Annotation Hooks
// ============================================================

/**
 * Fetches annotations for a specific entity.
 *
 * @param entityType - The type of entity
 * @param entityId - The ID of the entity
 * @returns SWR-managed data, error, and loading states
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useAnnotationsForEntity("incident", "inc-123");
 * ```
 */
export function useAnnotationsForEntity(
  entityType: EntityType | null,
  entityId: string | null
): UseAdminDataReturn<Annotation[]> {
  const url =
    entityType && entityId
      ? buildUrl("/api/annotations", {
          entity_type: entityType,
          entity_id: entityId,
          page_size: PAGINATION.MAX_PAGE_SIZE,
        })
      : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    PaginatedResponse<Annotation>
  >(url, fetcher, {
    refreshInterval: REFRESH_INTERVALS.NORMAL,
    revalidateOnFocus: true,
    dedupingInterval: 10_000,
  });

  return {
    data: data?.data,
    error,
    isLoading,
    isValidating,
    mutate: () => {
      mutate();
    },
  };
}

/**
 * Fetches paginated annotations with optional filters.
 *
 * @param params - Optional filter and pagination parameters
 * @returns SWR-managed paginated data, error, and loading states
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useAnnotations({ entity_type: "incident", page: 1 });
 * ```
 */
export function useAnnotations(params?: {
  entity_type?: EntityType;
  entity_id?: string;
  user_id?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}): UsePaginatedAdminDataReturn<Annotation> {
  const url = buildUrl("/api/annotations", {
    entity_type: params?.entity_type,
    entity_id: params?.entity_id,
    user_id: params?.user_id,
    from: params?.from,
    to: params?.to,
    page: params?.page,
    page_size: params?.page_size,
  });

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    PaginatedResponse<Annotation>
  >(url, fetcher, {
    refreshInterval: REFRESH_INTERVALS.NORMAL,
    revalidateOnFocus: true,
    dedupingInterval: 10_000,
  });

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
 * Provides mutation functions for annotation CRUD operations.
 * Includes optimistic update support via SWR cache invalidation.
 *
 * @returns Object with create, update, and delete mutation functions
 *
 * @example
 * ```tsx
 * const { createAnnotation, updateAnnotation, deleteAnnotation } = useAnnotationMutations();
 *
 * const result = await createAnnotation({
 *   entity_type: "incident",
 *   entity_id: "inc-123",
 *   annotation: "Root cause identified as config change.",
 * });
 * ```
 */
export function useAnnotationMutations() {
  const invalidateCache = useCallback(() => {
    globalMutate(
      (key) => typeof key === "string" && key.startsWith("/api/annotations"),
      undefined,
      { revalidate: true }
    );
  }, []);

  const createAnnotation = useCallback(
    async (
      payload: CreateAnnotationPayload
    ): Promise<MutationResult<Annotation>> => {
      const result = await postRequest<Annotation>(
        "/api/annotations",
        payload
      );
      if (result.success) {
        invalidateCache();
      }
      return result;
    },
    [invalidateCache]
  );

  const updateAnnotation = useCallback(
    async (
      payload: UpdateAnnotationPayload
    ): Promise<MutationResult<Annotation>> => {
      const result = await putRequest<Annotation>(
        `/api/annotations/${payload.annotation_id}`,
        payload
      );
      if (result.success) {
        invalidateCache();
      }
      return result;
    },
    [invalidateCache]
  );

  const deleteAnnotation = useCallback(
    async (annotationId: string): Promise<MutationResult> => {
      const result = await deleteRequest(`/api/annotations/${annotationId}`);
      if (result.success) {
        invalidateCache();
      }
      return result;
    },
    [invalidateCache]
  );

  return {
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
  };
}

// ============================================================
// Compliance Report Hook
// ============================================================

/**
 * Fetches a compliance report with optional filters.
 * This is a heavier query — uses a longer deduping interval.
 *
 * @param params - Optional filter parameters
 * @returns SWR-managed data, error, and loading states
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useComplianceReport({ domain: "payments", period: "30d" });
 * ```
 */
export function useComplianceReport(
  params?: {
    domain?: string;
    service_id?: string;
    tier?: CriticalityTier;
    environment?: string;
    period?: string;
    from?: string;
    to?: string;
  } | null
): UseAdminDataReturn<{
  report_id: string;
  generated_at: string;
  period: string;
  from: string;
  to: string;
  summary: Record<string, unknown>;
  sla_reports: Array<Record<string, unknown>>;
  incident_audits: Array<Record<string, unknown>>;
  recommendations: string[];
}> {
  const url = params
    ? buildUrl("/api/compliance/report", {
        domain: params.domain,
        service_id: params.service_id,
        tier: params.tier,
        environment: params.environment,
        period: params.period,
        from: params.from,
        to: params.to,
      })
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    url,
    fetcher,
    {
      refreshInterval: 0, // No auto-refresh for reports
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
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
// Composite Admin Hook
// ============================================================

/**
 * Convenience hook that fetches common admin overview data in parallel.
 * Useful for the admin overview page.
 *
 * @returns Combined data, loading, and error states for admin overview modules
 *
 * @example
 * ```tsx
 * const { auditLogs, metricsConfigSummary, uploadHistory, isLoading } = useAdminOverview();
 * ```
 */
export function useAdminOverview() {
  const auditLogs = useAuditLogs({ page: 1, page_size: 10 });
  const metricsConfigSummary = useMetricsConfigSummary();
  const documentationLinkSummary = useDocumentationLinkSummary();
  const uploadHistory = useUploadHistory({ limit: 10 });

  const isLoading =
    auditLogs.isLoading ||
    metricsConfigSummary.isLoading ||
    documentationLinkSummary.isLoading ||
    uploadHistory.isLoading;

  const isValidating =
    auditLogs.isValidating ||
    metricsConfigSummary.isValidating ||
    documentationLinkSummary.isValidating ||
    uploadHistory.isValidating;

  const hasError =
    !!auditLogs.error ||
    !!metricsConfigSummary.error ||
    !!documentationLinkSummary.error ||
    !!uploadHistory.error;

  const mutateAll = () => {
    auditLogs.mutate();
    metricsConfigSummary.mutate();
    documentationLinkSummary.mutate();
    uploadHistory.mutate();
  };

  return {
    auditLogs: auditLogs.data,
    metricsConfigSummary: metricsConfigSummary.data,
    documentationLinkSummary: documentationLinkSummary.data,
    uploadHistory: uploadHistory.data,
    isLoading,
    isValidating,
    hasError,
    errors: {
      auditLogs: auditLogs.error,
      metricsConfigSummary: metricsConfigSummary.error,
      documentationLinkSummary: documentationLinkSummary.error,
      uploadHistory: uploadHistory.error,
    },
    mutateAll,
  };
}