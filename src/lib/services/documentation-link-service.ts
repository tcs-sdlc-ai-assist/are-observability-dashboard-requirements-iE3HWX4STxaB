import { createServerClient } from "@/lib/supabase";
import { logAction, AUDIT_ACTIONS } from "@/lib/services/audit-logger";
import { PAGINATION } from "@/constants/constants";
import type {
  DocumentationLink,
  EntityType,
  PaginatedResponse,
} from "@/types";

// ============================================================
// Types
// ============================================================

export interface CreateDocumentationLinkParams {
  title: string;
  url: string;
  category: DocumentationLink["category"];
  service_id?: string;
  domain_id?: string;
  description?: string;
  user_id: string;
  user_name?: string;
}

export interface UpdateDocumentationLinkParams {
  link_id: string;
  title?: string;
  url?: string;
  category?: DocumentationLink["category"];
  service_id?: string;
  domain_id?: string;
  description?: string;
  user_id: string;
  user_name?: string;
}

export interface DeleteDocumentationLinkParams {
  link_id: string;
  user_id: string;
  user_name?: string;
}

export interface DocumentationLinkFilter {
  category?: DocumentationLink["category"];
  service_id?: string;
  domain_id?: string;
  created_by?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

// ============================================================
// Validation Constants
// ============================================================

const VALID_CATEGORIES: DocumentationLink["category"][] = [
  "runbook",
  "architecture",
  "sop",
  "postmortem",
  "sla",
  "other",
];

const MAX_TITLE_LENGTH = 256;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_URL_LENGTH = 2048;

// ============================================================
// Validation Helpers
// ============================================================

/**
 * Validates that the title is non-empty and within length limits.
 */
function validateTitle(title: string): void {
  if (!title || title.trim().length === 0) {
    throw new Error("Title is required.");
  }

  if (title.trim().length > MAX_TITLE_LENGTH) {
    throw new Error(`Title cannot exceed ${MAX_TITLE_LENGTH} characters.`);
  }
}

/**
 * Validates that the URL is non-empty, within length limits, and has a valid format.
 */
function validateUrl(url: string): void {
  if (!url || url.trim().length === 0) {
    throw new Error("URL is required.");
  }

  if (url.trim().length > MAX_URL_LENGTH) {
    throw new Error(`URL cannot exceed ${MAX_URL_LENGTH} characters.`);
  }

  try {
    const parsed = new URL(url.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("URL must use http or https protocol.");
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("protocol")) {
      throw e;
    }
    throw new Error(`Invalid URL format: "${url}". Must be a valid HTTP or HTTPS URL.`);
  }
}

/**
 * Validates that the category is one of the supported values.
 */
function validateCategory(category: string): asserts category is DocumentationLink["category"] {
  if (!category || category.trim().length === 0) {
    throw new Error("Category is required.");
  }

  if (!VALID_CATEGORIES.includes(category as DocumentationLink["category"])) {
    throw new Error(
      `Invalid category: "${category}". Must be one of: ${VALID_CATEGORIES.join(", ")}.`
    );
  }
}

/**
 * Validates that the description is within length limits (if provided).
 */
function validateDescription(description: string): void {
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`);
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

/**
 * Validates that a link ID is non-empty.
 */
function validateLinkId(linkId: string): void {
  if (!linkId || linkId.trim().length === 0) {
    throw new Error("Link ID is required.");
  }
}

// ============================================================
// Row Mapping Helper
// ============================================================

/**
 * Maps a raw database row to the DocumentationLink type.
 */
function mapLinkRow(row: {
  id: string;
  title: string;
  url: string;
  category: string;
  service_id: string | null;
  domain_id: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}): DocumentationLink {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    category: row.category as DocumentationLink["category"],
    service_id: row.service_id || undefined,
    domain_id: row.domain_id || undefined,
    description: row.description || undefined,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ============================================================
// CRUD Operations
// ============================================================

/**
 * Creates a new documentation link (playbook, runbook, SOP, etc.).
 * Validates all fields and logs the action to the audit trail.
 *
 * @param params - The documentation link creation parameters
 * @returns The created documentation link record
 * @throws Error if validation fails or the database write fails
 */
export async function createDocumentationLink(
  params: CreateDocumentationLinkParams
): Promise<DocumentationLink> {
  validateTitle(params.title);
  validateUrl(params.url);
  validateCategory(params.category);
  validateUserId(params.user_id);

  if (params.description) {
    validateDescription(params.description);
  }

  const supabase = createServerClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("documentation_links")
    .insert({
      title: params.title.trim(),
      url: params.url.trim(),
      category: params.category,
      service_id: params.service_id || null,
      domain_id: params.domain_id || null,
      description: params.description?.trim() || null,
      created_by: params.user_id,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create documentation link:", error);
    throw new Error(`Failed to create documentation link: ${error.message}`);
  }

  // Log the action to the audit trail
  try {
    await logAction({
      action: AUDIT_ACTIONS.CREATE_DOCUMENTATION_LINK,
      entity_type: "service" as EntityType,
      entity_id: data.id,
      user_id: params.user_id,
      user_name: params.user_name,
      details: {
        link_id: data.id,
        title: params.title.trim(),
        url: params.url.trim(),
        category: params.category,
        service_id: params.service_id || null,
        domain_id: params.domain_id || null,
      },
    });
  } catch (auditError) {
    console.error("Audit log failed for documentation link creation:", auditError);
  }

  return mapLinkRow(data);
}

/**
 * Updates an existing documentation link.
 * Only provided fields are updated; others remain unchanged.
 * The update is logged to the audit trail with previous and new values.
 *
 * @param params - The documentation link update parameters
 * @returns The updated documentation link record
 * @throws Error if the link is not found or validation fails
 */
export async function updateDocumentationLink(
  params: UpdateDocumentationLinkParams
): Promise<DocumentationLink> {
  validateLinkId(params.link_id);
  validateUserId(params.user_id);

  if (params.title !== undefined) {
    validateTitle(params.title);
  }

  if (params.url !== undefined) {
    validateUrl(params.url);
  }

  if (params.category !== undefined) {
    validateCategory(params.category);
  }

  if (params.description !== undefined && params.description !== null) {
    validateDescription(params.description);
  }

  const supabase = createServerClient();

  // Fetch the existing record for audit trail
  const { data: existing, error: fetchError } = await supabase
    .from("documentation_links")
    .select("*")
    .eq("id", params.link_id)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      throw new Error(`Documentation link not found: ${params.link_id}`);
    }
    console.error("Error fetching documentation link for update:", fetchError);
    throw new Error(
      `Failed to fetch documentation link: ${fetchError.message}`
    );
  }

  const now = new Date().toISOString();

  // Build the update payload with only provided fields
  const updatePayload: Record<string, unknown> = {
    updated_at: now,
  };

  if (params.title !== undefined) {
    updatePayload.title = params.title.trim();
  }

  if (params.url !== undefined) {
    updatePayload.url = params.url.trim();
  }

  if (params.category !== undefined) {
    updatePayload.category = params.category;
  }

  if (params.service_id !== undefined) {
    updatePayload.service_id = params.service_id || null;
  }

  if (params.domain_id !== undefined) {
    updatePayload.domain_id = params.domain_id || null;
  }

  if (params.description !== undefined) {
    updatePayload.description = params.description?.trim() || null;
  }

  const { data, error: updateError } = await supabase
    .from("documentation_links")
    .update(updatePayload)
    .eq("id", params.link_id)
    .select()
    .single();

  if (updateError) {
    console.error("Failed to update documentation link:", updateError);
    throw new Error(
      `Failed to update documentation link: ${updateError.message}`
    );
  }

  // Log the update to the audit trail
  try {
    await logAction({
      action: AUDIT_ACTIONS.UPDATE_DOCUMENTATION_LINK,
      entity_type: "service" as EntityType,
      entity_id: params.link_id,
      user_id: params.user_id,
      user_name: params.user_name,
      details: {
        link_id: params.link_id,
        previous_title: existing.title,
        new_title: params.title !== undefined ? params.title.trim() : existing.title,
        previous_url: existing.url,
        new_url: params.url !== undefined ? params.url.trim() : existing.url,
        previous_category: existing.category,
        new_category: params.category !== undefined ? params.category : existing.category,
      },
    });
  } catch (auditError) {
    console.error("Audit log failed for documentation link update:", auditError);
  }

  return mapLinkRow(data);
}

/**
 * Deletes a documentation link by ID.
 * Records the deletion in the audit log for compliance.
 *
 * @param params - The deletion parameters
 * @throws Error if the link is not found or the deletion fails
 */
export async function deleteDocumentationLink(
  params: DeleteDocumentationLinkParams
): Promise<void> {
  validateLinkId(params.link_id);
  validateUserId(params.user_id);

  const supabase = createServerClient();

  // Fetch the record before deletion for audit purposes
  const { data: existing, error: fetchError } = await supabase
    .from("documentation_links")
    .select("*")
    .eq("id", params.link_id)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      throw new Error(`Documentation link not found: ${params.link_id}`);
    }
    console.error("Error fetching documentation link for deletion:", fetchError);
    throw new Error(
      `Failed to fetch documentation link: ${fetchError.message}`
    );
  }

  const { error: deleteError } = await supabase
    .from("documentation_links")
    .delete()
    .eq("id", params.link_id);

  if (deleteError) {
    console.error("Failed to delete documentation link:", deleteError);
    throw new Error(
      `Failed to delete documentation link: ${deleteError.message}`
    );
  }

  // Log the deletion to the audit trail
  try {
    await logAction({
      action: AUDIT_ACTIONS.DELETE_DOCUMENTATION_LINK,
      entity_type: "service" as EntityType,
      entity_id: params.link_id,
      user_id: params.user_id,
      user_name: params.user_name,
      details: {
        link_id: params.link_id,
        deleted_title: existing.title,
        deleted_url: existing.url,
        deleted_category: existing.category,
        original_creator: existing.created_by,
      },
    });
  } catch (auditError) {
    console.error("Audit log failed for documentation link deletion:", auditError);
  }
}

// ============================================================
// Query Operations
// ============================================================

/**
 * Retrieves a single documentation link by ID.
 *
 * @param linkId - The ID of the documentation link
 * @returns The documentation link record or null if not found
 */
export async function getDocumentationLinkById(
  linkId: string
): Promise<DocumentationLink | null> {
  validateLinkId(linkId);

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("documentation_links")
    .select("*")
    .eq("id", linkId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching documentation link by ID:", error);
    throw new Error(
      `Failed to fetch documentation link: ${error.message}`
    );
  }

  return mapLinkRow(data);
}

/**
 * Retrieves documentation links with optional filters and pagination.
 * Supports filtering by category, service_id, domain_id, created_by, and search text.
 *
 * @param filter - Optional filter criteria
 * @returns Paginated documentation link results
 */
export async function getDocumentationLinks(
  filter?: DocumentationLinkFilter
): Promise<PaginatedResponse<DocumentationLink>> {
  const supabase = createServerClient();

  const page = filter?.page || PAGINATION.DEFAULT_PAGE;
  const pageSize = Math.min(
    filter?.page_size || PAGINATION.DEFAULT_PAGE_SIZE,
    PAGINATION.MAX_PAGE_SIZE
  );
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("documentation_links")
    .select("*", { count: "exact" });

  if (filter?.category) {
    query = query.eq("category", filter.category);
  }

  if (filter?.service_id) {
    query = query.eq("service_id", filter.service_id);
  }

  if (filter?.domain_id) {
    query = query.eq("domain_id", filter.domain_id);
  }

  if (filter?.created_by) {
    query = query.eq("created_by", filter.created_by);
  }

  if (filter?.search) {
    const searchTerm = filter.search.trim();
    if (searchTerm.length > 0) {
      query = query.or(
        `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,url.ilike.%${searchTerm}%`
      );
    }
  }

  query = query
    .order("updated_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Failed to query documentation links:", error);
    throw new Error(`Documentation link query failed: ${error.message}`);
  }

  const total = count || 0;
  const links = (data || []).map(mapLinkRow);

  return {
    data: links,
    total,
    page,
    page_size: pageSize,
    has_next: offset + pageSize < total,
    has_previous: page > 1,
  };
}

/**
 * Retrieves all documentation links for a specific service.
 * Results are ordered by category and title ascending.
 *
 * @param serviceId - The service ID
 * @returns Array of documentation links for the service
 */
export async function getDocumentationLinksForService(
  serviceId: string
): Promise<DocumentationLink[]> {
  if (!serviceId || serviceId.trim().length === 0) {
    throw new Error("Service ID is required.");
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("documentation_links")
    .select("*")
    .eq("service_id", serviceId)
    .order("category", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    console.error("Error fetching documentation links for service:", error);
    throw new Error(
      `Failed to fetch documentation links for service ${serviceId}: ${error.message}`
    );
  }

  return (data || []).map(mapLinkRow);
}

/**
 * Retrieves all documentation links for a specific domain.
 * Results are ordered by category and title ascending.
 *
 * @param domainId - The domain ID
 * @returns Array of documentation links for the domain
 */
export async function getDocumentationLinksForDomain(
  domainId: string
): Promise<DocumentationLink[]> {
  if (!domainId || domainId.trim().length === 0) {
    throw new Error("Domain ID is required.");
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("documentation_links")
    .select("*")
    .eq("domain_id", domainId)
    .order("category", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    console.error("Error fetching documentation links for domain:", error);
    throw new Error(
      `Failed to fetch documentation links for domain ${domainId}: ${error.message}`
    );
  }

  return (data || []).map(mapLinkRow);
}

/**
 * Retrieves all documentation links for a specific category.
 * Results are ordered by title ascending.
 *
 * @param category - The documentation link category
 * @returns Array of documentation links in the category
 */
export async function getDocumentationLinksByCategory(
  category: DocumentationLink["category"]
): Promise<DocumentationLink[]> {
  validateCategory(category);

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("documentation_links")
    .select("*")
    .eq("category", category)
    .order("title", { ascending: true });

  if (error) {
    console.error("Error fetching documentation links by category:", error);
    throw new Error(
      `Failed to fetch documentation links for category ${category}: ${error.message}`
    );
  }

  return (data || []).map(mapLinkRow);
}

/**
 * Counts the number of documentation links for a specific service.
 * Useful for displaying link counts on dashboard cards.
 *
 * @param serviceId - The service ID
 * @returns The count of documentation links
 */
export async function countDocumentationLinksForService(
  serviceId: string
): Promise<number> {
  if (!serviceId || serviceId.trim().length === 0) {
    throw new Error("Service ID is required.");
  }

  const supabase = createServerClient();

  const { count, error } = await supabase
    .from("documentation_links")
    .select("id", { count: "exact", head: true })
    .eq("service_id", serviceId);

  if (error) {
    console.error("Error counting documentation links:", error);
    throw new Error(
      `Failed to count documentation links for service ${serviceId}: ${error.message}`
    );
  }

  return count || 0;
}

// ============================================================
// Bulk Operations
// ============================================================

/**
 * Retrieves documentation link counts for multiple services in a single query.
 * Useful for dashboard views that display link indicators on service lists.
 *
 * @param serviceIds - Array of service IDs
 * @returns Map of service ID to documentation link count
 */
export async function getDocumentationLinkCountsForServices(
  serviceIds: string[]
): Promise<Map<string, number>> {
  if (serviceIds.length === 0) {
    return new Map();
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("documentation_links")
    .select("service_id")
    .in("service_id", serviceIds);

  if (error) {
    console.error("Error fetching documentation link counts for services:", error);
    throw new Error(
      `Failed to fetch documentation link counts: ${error.message}`
    );
  }

  const countMap = new Map<string, number>();

  // Initialize all service IDs with 0
  for (const id of serviceIds) {
    countMap.set(id, 0);
  }

  // Count links per service
  for (const row of data || []) {
    if (row.service_id) {
      const current = countMap.get(row.service_id) || 0;
      countMap.set(row.service_id, current + 1);
    }
  }

  return countMap;
}

/**
 * Retrieves a summary of all documentation links grouped by category.
 * Useful for admin overview pages.
 *
 * @returns Array of category summaries with counts
 */
export async function getDocumentationLinkSummary(): Promise<
  Array<{
    category: DocumentationLink["category"];
    total_links: number;
    last_updated: string;
  }>
> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("documentation_links")
    .select("category, updated_at")
    .order("category", { ascending: true });

  if (error) {
    console.error("Error fetching documentation link summary:", error);
    throw new Error(
      `Failed to fetch documentation link summary: ${error.message}`
    );
  }

  // Group by category
  const groupMap = new Map<
    string,
    {
      category: DocumentationLink["category"];
      total: number;
      lastUpdated: string;
    }
  >();

  for (const row of data || []) {
    if (!groupMap.has(row.category)) {
      groupMap.set(row.category, {
        category: row.category as DocumentationLink["category"],
        total: 0,
        lastUpdated: row.updated_at,
      });
    }

    const group = groupMap.get(row.category)!;
    group.total++;

    if (row.updated_at > group.lastUpdated) {
      group.lastUpdated = row.updated_at;
    }
  }

  return Array.from(groupMap.values()).map((group) => ({
    category: group.category,
    total_links: group.total,
    last_updated: group.lastUpdated,
  }));
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Checks if a documentation link with the same URL already exists
 * for a given service or domain. Useful for preventing duplicate links.
 *
 * @param url - The URL to check
 * @param serviceId - Optional service ID to scope the check
 * @param domainId - Optional domain ID to scope the check
 * @returns True if a link with the same URL already exists
 */
export async function documentationLinkExists(
  url: string,
  serviceId?: string,
  domainId?: string
): Promise<boolean> {
  validateUrl(url);

  const supabase = createServerClient();

  let query = supabase
    .from("documentation_links")
    .select("id", { count: "exact", head: true })
    .eq("url", url.trim());

  if (serviceId) {
    query = query.eq("service_id", serviceId);
  }

  if (domainId) {
    query = query.eq("domain_id", domainId);
  }

  const { count, error } = await query;

  if (error) {
    console.error("Error checking documentation link existence:", error);
    throw new Error(
      `Failed to check documentation link existence: ${error.message}`
    );
  }

  return (count || 0) > 0;
}

/**
 * Returns the list of valid documentation link categories.
 * Useful for populating dropdowns in the admin UI.
 */
export function getValidCategories(): DocumentationLink["category"][] {
  return [...VALID_CATEGORIES];
}

/**
 * Returns display labels for documentation link categories.
 */
export function getCategoryLabels(): Record<DocumentationLink["category"], string> {
  return {
    runbook: "Runbook",
    architecture: "Architecture",
    sop: "Standard Operating Procedure",
    postmortem: "Post-Mortem",
    sla: "SLA Document",
    other: "Other",
  };
}