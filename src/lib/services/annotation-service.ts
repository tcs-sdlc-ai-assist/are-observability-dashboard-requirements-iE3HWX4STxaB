import { createServerClient } from "@/lib/supabase";
import { logAction, AUDIT_ACTIONS } from "@/lib/services/audit-logger";
import { PAGINATION } from "@/constants/constants";
import type {
  Annotation,
  EntityType,
  PaginatedResponse,
} from "@/types";

// ============================================================
// Types
// ============================================================

export interface CreateAnnotationParams {
  entity_type: EntityType;
  entity_id: string;
  annotation: string;
  user_id: string;
  user_name?: string;
}

export interface UpdateAnnotationParams {
  annotation_id: string;
  annotation: string;
  user_id: string;
  user_name?: string;
}

export interface AnnotationFilter {
  entity_type?: EntityType;
  entity_id?: string;
  user_id?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

export interface ManualOverride {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  field: string;
  original_value: unknown;
  override_value: unknown;
  reason: string;
  user_id: string;
  user_name?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateManualOverrideParams {
  entity_type: EntityType;
  entity_id: string;
  field: string;
  original_value: unknown;
  override_value: unknown;
  reason: string;
  user_id: string;
  user_name?: string;
}

// ============================================================
// Validation Helpers
// ============================================================

/**
 * Validates that the annotation text is non-empty and within length limits.
 */
function validateAnnotationText(text: string): void {
  if (!text || text.trim().length === 0) {
    throw new Error("Annotation text cannot be empty.");
  }

  if (text.length > 5000) {
    throw new Error("Annotation text cannot exceed 5000 characters.");
  }
}

/**
 * Validates that the entity type is a supported value.
 */
function validateEntityType(entityType: string): asserts entityType is EntityType {
  const validTypes: EntityType[] = ["incident", "metric", "service", "deployment"];
  if (!validTypes.includes(entityType as EntityType)) {
    throw new Error(
      `Invalid entity type: "${entityType}". Must be one of: ${validTypes.join(", ")}.`
    );
  }
}

/**
 * Validates that the entity ID is a non-empty string.
 */
function validateEntityId(entityId: string): void {
  if (!entityId || entityId.trim().length === 0) {
    throw new Error("Entity ID cannot be empty.");
  }
}

// ============================================================
// Annotation CRUD Operations
// ============================================================

/**
 * Creates a new annotation on an entity (incident, metric, service, or deployment).
 * Logs the action to the audit trail for compliance.
 *
 * @param params - The annotation creation parameters
 * @returns The created annotation record
 * @throws Error if validation fails or the database write fails
 */
export async function createAnnotation(
  params: CreateAnnotationParams
): Promise<Annotation> {
  validateEntityType(params.entity_type);
  validateEntityId(params.entity_id);
  validateAnnotationText(params.annotation);

  if (!params.user_id || params.user_id.trim().length === 0) {
    throw new Error("User ID is required to create an annotation.");
  }

  const supabase = createServerClient();

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("annotations")
    .insert({
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      annotation: params.annotation.trim(),
      user_id: params.user_id,
      user_name: params.user_name || null,
      timestamp: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create annotation:", error);
    throw new Error(`Failed to create annotation: ${error.message}`);
  }

  // Log the action to the audit trail
  try {
    await logAction({
      action: AUDIT_ACTIONS.CREATE_ANNOTATION,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      user_id: params.user_id,
      user_name: params.user_name,
      details: {
        annotation_id: data.id,
        annotation_text: params.annotation.trim().substring(0, 200),
        entity_type: params.entity_type,
        entity_id: params.entity_id,
      },
    });
  } catch (auditError) {
    // Audit log failure should not silently pass — log but don't block the operation
    console.error("Audit log failed for annotation creation:", auditError);
  }

  return mapAnnotationRow(data);
}

/**
 * Updates an existing annotation. Only the annotation text can be modified.
 * The original author attribution is preserved; the update actor is tracked via audit log.
 *
 * @param params - The annotation update parameters
 * @returns The updated annotation record
 * @throws Error if the annotation is not found or the update fails
 */
export async function updateAnnotation(
  params: UpdateAnnotationParams
): Promise<Annotation> {
  if (!params.annotation_id || params.annotation_id.trim().length === 0) {
    throw new Error("Annotation ID is required for update.");
  }

  validateAnnotationText(params.annotation);

  if (!params.user_id || params.user_id.trim().length === 0) {
    throw new Error("User ID is required to update an annotation.");
  }

  const supabase = createServerClient();

  // Fetch the existing annotation to verify it exists and capture previous state
  const { data: existing, error: fetchError } = await supabase
    .from("annotations")
    .select("*")
    .eq("id", params.annotation_id)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      throw new Error(`Annotation not found: ${params.annotation_id}`);
    }
    console.error("Error fetching annotation for update:", fetchError);
    throw new Error(`Failed to fetch annotation: ${fetchError.message}`);
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("annotations")
    .update({
      annotation: params.annotation.trim(),
      updated_at: now,
    })
    .eq("id", params.annotation_id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update annotation:", error);
    throw new Error(`Failed to update annotation: ${error.message}`);
  }

  // Log the update action to the audit trail
  try {
    await logAction({
      action: AUDIT_ACTIONS.UPDATE_ANNOTATION,
      entity_type: existing.entity_type as EntityType,
      entity_id: existing.entity_id,
      user_id: params.user_id,
      user_name: params.user_name,
      details: {
        annotation_id: params.annotation_id,
        previous_text: existing.annotation?.substring(0, 200),
        new_text: params.annotation.trim().substring(0, 200),
      },
    });
  } catch (auditError) {
    console.error("Audit log failed for annotation update:", auditError);
  }

  return mapAnnotationRow(data);
}

/**
 * Deletes an annotation by ID.
 * Records the deletion in the audit log for compliance.
 *
 * @param annotationId - The ID of the annotation to delete
 * @param userId - The ID of the user performing the deletion
 * @param userName - Optional name of the user performing the deletion
 * @throws Error if the annotation is not found or the deletion fails
 */
export async function deleteAnnotation(
  annotationId: string,
  userId: string,
  userName?: string
): Promise<void> {
  if (!annotationId || annotationId.trim().length === 0) {
    throw new Error("Annotation ID is required for deletion.");
  }

  if (!userId || userId.trim().length === 0) {
    throw new Error("User ID is required to delete an annotation.");
  }

  const supabase = createServerClient();

  // Fetch the annotation before deletion for audit purposes
  const { data: existing, error: fetchError } = await supabase
    .from("annotations")
    .select("*")
    .eq("id", annotationId)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      throw new Error(`Annotation not found: ${annotationId}`);
    }
    console.error("Error fetching annotation for deletion:", fetchError);
    throw new Error(`Failed to fetch annotation: ${fetchError.message}`);
  }

  const { error: deleteError } = await supabase
    .from("annotations")
    .delete()
    .eq("id", annotationId);

  if (deleteError) {
    console.error("Failed to delete annotation:", deleteError);
    throw new Error(`Failed to delete annotation: ${deleteError.message}`);
  }

  // Log the deletion to the audit trail
  try {
    await logAction({
      action: AUDIT_ACTIONS.DELETE_ANNOTATION,
      entity_type: existing.entity_type as EntityType,
      entity_id: existing.entity_id,
      user_id: userId,
      user_name: userName,
      details: {
        annotation_id: annotationId,
        deleted_text: existing.annotation?.substring(0, 200),
        original_author: existing.user_id,
      },
    });
  } catch (auditError) {
    console.error("Audit log failed for annotation deletion:", auditError);
  }
}

/**
 * Retrieves a single annotation by ID.
 *
 * @param annotationId - The ID of the annotation to retrieve
 * @returns The annotation record or null if not found
 */
export async function getAnnotationById(
  annotationId: string
): Promise<Annotation | null> {
  if (!annotationId || annotationId.trim().length === 0) {
    throw new Error("Annotation ID is required.");
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("annotations")
    .select("*")
    .eq("id", annotationId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching annotation by ID:", error);
    throw new Error(`Failed to fetch annotation: ${error.message}`);
  }

  return mapAnnotationRow(data);
}

/**
 * Retrieves all annotations for a specific entity (e.g., all annotations on an incident).
 * Results are ordered by timestamp descending (most recent first).
 *
 * @param entityType - The type of entity
 * @param entityId - The ID of the entity
 * @returns Array of annotations for the entity
 */
export async function getAnnotationsForEntity(
  entityType: EntityType,
  entityId: string
): Promise<Annotation[]> {
  validateEntityType(entityType);
  validateEntityId(entityId);

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("annotations")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("timestamp", { ascending: false });

  if (error) {
    console.error("Error fetching annotations for entity:", error);
    throw new Error(
      `Failed to fetch annotations for ${entityType}:${entityId}: ${error.message}`
    );
  }

  return (data || []).map(mapAnnotationRow);
}

/**
 * Retrieves annotations with optional filters and pagination.
 * Supports filtering by entity type, entity ID, user ID, and time range.
 *
 * @param filter - Optional filter criteria
 * @returns Paginated annotation results
 */
export async function getAnnotations(
  filter?: AnnotationFilter
): Promise<PaginatedResponse<Annotation>> {
  const supabase = createServerClient();

  const page = filter?.page || PAGINATION.DEFAULT_PAGE;
  const pageSize = Math.min(
    filter?.page_size || PAGINATION.DEFAULT_PAGE_SIZE,
    PAGINATION.MAX_PAGE_SIZE
  );
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("annotations")
    .select("*", { count: "exact" });

  if (filter?.entity_type) {
    query = query.eq("entity_type", filter.entity_type);
  }

  if (filter?.entity_id) {
    query = query.eq("entity_id", filter.entity_id);
  }

  if (filter?.user_id) {
    query = query.eq("user_id", filter.user_id);
  }

  if (filter?.from) {
    query = query.gte("timestamp", filter.from);
  }

  if (filter?.to) {
    query = query.lte("timestamp", filter.to);
  }

  query = query
    .order("timestamp", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Failed to query annotations:", error);
    throw new Error(`Annotation query failed: ${error.message}`);
  }

  const total = count || 0;
  const annotations = (data || []).map(mapAnnotationRow);

  return {
    data: annotations,
    total,
    page,
    page_size: pageSize,
    has_next: offset + pageSize < total,
    has_previous: page > 1,
  };
}

/**
 * Retrieves all annotations created by a specific user.
 *
 * @param userId - The ID of the user
 * @param limit - Maximum number of records to return (default: 50)
 * @returns Array of annotations by the user, ordered by timestamp descending
 */
export async function getAnnotationsByUser(
  userId: string,
  limit: number = 50
): Promise<Annotation[]> {
  if (!userId || userId.trim().length === 0) {
    throw new Error("User ID is required.");
  }

  const supabase = createServerClient();

  const clampedLimit = Math.min(limit, PAGINATION.MAX_PAGE_SIZE);

  const { data, error } = await supabase
    .from("annotations")
    .select("*")
    .eq("user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(clampedLimit);

  if (error) {
    console.error("Error fetching annotations by user:", error);
    throw new Error(
      `Failed to fetch annotations for user ${userId}: ${error.message}`
    );
  }

  return (data || []).map(mapAnnotationRow);
}

/**
 * Counts the number of annotations for a specific entity.
 * Useful for displaying annotation counts on dashboard cards.
 *
 * @param entityType - The type of entity
 * @param entityId - The ID of the entity
 * @returns The count of annotations
 */
export async function countAnnotationsForEntity(
  entityType: EntityType,
  entityId: string
): Promise<number> {
  validateEntityType(entityType);
  validateEntityId(entityId);

  const supabase = createServerClient();

  const { count, error } = await supabase
    .from("annotations")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  if (error) {
    console.error("Error counting annotations:", error);
    throw new Error(
      `Failed to count annotations for ${entityType}:${entityId}: ${error.message}`
    );
  }

  return count || 0;
}

// ============================================================
// Manual Override Operations
// ============================================================

/**
 * Creates a manual override for a specific field on an entity.
 * Manual overrides allow ARE Leads to temporarily adjust metric values,
 * availability targets, or other computed fields with a documented reason.
 *
 * The override is stored as an annotation with structured metadata in the details.
 *
 * @param params - The manual override parameters
 * @returns The created annotation representing the override
 */
export async function createManualOverride(
  params: CreateManualOverrideParams
): Promise<Annotation> {
  validateEntityType(params.entity_type);
  validateEntityId(params.entity_id);

  if (!params.field || params.field.trim().length === 0) {
    throw new Error("Override field name is required.");
  }

  if (!params.reason || params.reason.trim().length === 0) {
    throw new Error("A reason is required for manual overrides.");
  }

  if (params.override_value === undefined || params.override_value === null) {
    throw new Error("Override value is required.");
  }

  // Build a structured annotation text for the override
  const overrideText = [
    `[MANUAL OVERRIDE] Field: ${params.field}`,
    `Original Value: ${JSON.stringify(params.original_value)}`,
    `Override Value: ${JSON.stringify(params.override_value)}`,
    `Reason: ${params.reason.trim()}`,
  ].join("\n");

  const annotation = await createAnnotation({
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    annotation: overrideText,
    user_id: params.user_id,
    user_name: params.user_name,
  });

  return annotation;
}

/**
 * Retrieves all manual overrides for a specific entity by filtering
 * annotations that contain the [MANUAL OVERRIDE] prefix.
 *
 * @param entityType - The type of entity
 * @param entityId - The ID of the entity
 * @returns Array of annotations representing manual overrides
 */
export async function getManualOverridesForEntity(
  entityType: EntityType,
  entityId: string
): Promise<Annotation[]> {
  const annotations = await getAnnotationsForEntity(entityType, entityId);

  return annotations.filter((a) =>
    a.annotation.startsWith("[MANUAL OVERRIDE]")
  );
}

/**
 * Checks if a specific field on an entity has an active manual override.
 *
 * @param entityType - The type of entity
 * @param entityId - The ID of the entity
 * @param field - The field name to check
 * @returns True if an active override exists for the field
 */
export async function hasManualOverride(
  entityType: EntityType,
  entityId: string,
  field: string
): Promise<boolean> {
  const overrides = await getManualOverridesForEntity(entityType, entityId);

  return overrides.some((a) =>
    a.annotation.includes(`Field: ${field}`)
  );
}

// ============================================================
// Bulk Operations
// ============================================================

/**
 * Retrieves annotation counts for multiple entities in a single query.
 * Useful for dashboard views that display annotation indicators on lists.
 *
 * @param entityType - The type of entities
 * @param entityIds - Array of entity IDs
 * @returns Map of entity ID to annotation count
 */
export async function getAnnotationCountsForEntities(
  entityType: EntityType,
  entityIds: string[]
): Promise<Map<string, number>> {
  if (entityIds.length === 0) {
    return new Map();
  }

  validateEntityType(entityType);

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("annotations")
    .select("entity_id")
    .eq("entity_type", entityType)
    .in("entity_id", entityIds);

  if (error) {
    console.error("Error fetching annotation counts for entities:", error);
    throw new Error(
      `Failed to fetch annotation counts: ${error.message}`
    );
  }

  const countMap = new Map<string, number>();

  // Initialize all entity IDs with 0
  for (const id of entityIds) {
    countMap.set(id, 0);
  }

  // Count annotations per entity
  for (const row of data || []) {
    const current = countMap.get(row.entity_id) || 0;
    countMap.set(row.entity_id, current + 1);
  }

  return countMap;
}

// ============================================================
// Row Mapping Helper
// ============================================================

/**
 * Maps a raw database row to the Annotation type.
 */
function mapAnnotationRow(row: {
  id: string;
  entity_type: string;
  entity_id: string;
  annotation: string;
  user_id: string;
  user_name: string | null;
  timestamp: string;
  updated_at: string | null;
}): Annotation {
  return {
    id: row.id,
    entity_type: row.entity_type as EntityType,
    entity_id: row.entity_id,
    annotation: row.annotation,
    user_id: row.user_id,
    user_name: row.user_name || undefined,
    timestamp: row.timestamp,
    updated_at: row.updated_at || undefined,
  };
}