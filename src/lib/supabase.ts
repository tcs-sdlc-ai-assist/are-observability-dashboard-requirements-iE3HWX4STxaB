import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Environment Variables
// ============================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ============================================================
// Database Schema Types
// ============================================================

export interface Database {
  public: {
    Tables: {
      domains: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          owner_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          owner_id?: string | null;
          updated_at?: string;
        };
      };
      applications: {
        Row: {
          id: string;
          name: string;
          domain_id: string;
          description: string | null;
          tier: string;
          environment: string;
          owner_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          domain_id: string;
          description?: string | null;
          tier: string;
          environment: string;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          domain_id?: string;
          description?: string | null;
          tier?: string;
          environment?: string;
          owner_id?: string | null;
          updated_at?: string;
        };
      };
      services: {
        Row: {
          id: string;
          name: string;
          application_id: string;
          domain: string;
          tier: string;
          criticality: string;
          environment: string;
          owners: string[];
          description: string | null;
          repository_url: string | null;
          documentation_url: string | null;
          health_check_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          application_id: string;
          domain: string;
          tier: string;
          criticality: string;
          environment: string;
          owners?: string[];
          description?: string | null;
          repository_url?: string | null;
          documentation_url?: string | null;
          health_check_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          application_id?: string;
          domain?: string;
          tier?: string;
          criticality?: string;
          environment?: string;
          owners?: string[];
          description?: string | null;
          repository_url?: string | null;
          documentation_url?: string | null;
          health_check_url?: string | null;
          updated_at?: string;
        };
      };
      metrics: {
        Row: {
          id: string;
          service_id: string;
          metric_type: string;
          value: number;
          unit: string;
          timestamp: string;
          environment: string | null;
          tags: Record<string, string> | null;
        };
        Insert: {
          id?: string;
          service_id: string;
          metric_type: string;
          value: number;
          unit: string;
          timestamp: string;
          environment?: string | null;
          tags?: Record<string, string> | null;
        };
        Update: {
          id?: string;
          service_id?: string;
          metric_type?: string;
          value?: number;
          unit?: string;
          timestamp?: string;
          environment?: string | null;
          tags?: Record<string, string> | null;
        };
      };
      incidents: {
        Row: {
          id: string;
          service_id: string;
          service_name: string | null;
          domain: string | null;
          severity: string;
          status: string;
          title: string;
          description: string | null;
          start_time: string;
          end_time: string | null;
          mttr: number | null;
          mttd: number | null;
          root_cause: string | null;
          root_cause_details: string | null;
          repeat_failure: boolean;
          external_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          service_id: string;
          service_name?: string | null;
          domain?: string | null;
          severity: string;
          status: string;
          title: string;
          description?: string | null;
          start_time: string;
          end_time?: string | null;
          mttr?: number | null;
          mttd?: number | null;
          root_cause?: string | null;
          root_cause_details?: string | null;
          repeat_failure?: boolean;
          external_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          service_id?: string;
          service_name?: string | null;
          domain?: string | null;
          severity?: string;
          status?: string;
          title?: string;
          description?: string | null;
          start_time?: string;
          end_time?: string | null;
          mttr?: number | null;
          mttd?: number | null;
          root_cause?: string | null;
          root_cause_details?: string | null;
          repeat_failure?: boolean;
          external_id?: string | null;
          updated_at?: string;
        };
      };
      deployments: {
        Row: {
          id: string;
          service_id: string;
          service_name: string | null;
          version: string;
          environment: string;
          status: string;
          deployed_by: string;
          deployed_at: string;
          rollback_at: string | null;
          change_ticket: string | null;
          description: string | null;
          has_incident: boolean;
          incident_id: string | null;
        };
        Insert: {
          id?: string;
          service_id: string;
          service_name?: string | null;
          version: string;
          environment: string;
          status: string;
          deployed_by: string;
          deployed_at: string;
          rollback_at?: string | null;
          change_ticket?: string | null;
          description?: string | null;
          has_incident?: boolean;
          incident_id?: string | null;
        };
        Update: {
          id?: string;
          service_id?: string;
          service_name?: string | null;
          version?: string;
          environment?: string;
          status?: string;
          deployed_by?: string;
          deployed_at?: string;
          rollback_at?: string | null;
          change_ticket?: string | null;
          description?: string | null;
          has_incident?: boolean;
          incident_id?: string | null;
        };
      };
      error_budgets: {
        Row: {
          id: string;
          service_id: string;
          service_name: string | null;
          period: string;
          initial: number;
          consumed: number;
          remaining: number;
          breach: boolean;
          trend: string;
          slo_target: number;
          burn_rate: number | null;
          projected_breach_date: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          service_id: string;
          service_name?: string | null;
          period: string;
          initial: number;
          consumed: number;
          remaining: number;
          breach?: boolean;
          trend: string;
          slo_target: number;
          burn_rate?: number | null;
          projected_breach_date?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          service_id?: string;
          service_name?: string | null;
          period?: string;
          initial?: number;
          consumed?: number;
          remaining?: number;
          breach?: boolean;
          trend?: string;
          slo_target?: number;
          burn_rate?: number | null;
          projected_breach_date?: string | null;
          updated_at?: string;
        };
      };
      annotations: {
        Row: {
          id: string;
          entity_type: string;
          entity_id: string;
          annotation: string;
          user_id: string;
          user_name: string | null;
          timestamp: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          entity_type: string;
          entity_id: string;
          annotation: string;
          user_id: string;
          user_name?: string | null;
          timestamp?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          entity_type?: string;
          entity_id?: string;
          annotation?: string;
          user_id?: string;
          user_name?: string | null;
          timestamp?: string;
          updated_at?: string | null;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          action: string;
          entity_type: string;
          entity_id: string;
          user_id: string;
          user_name: string | null;
          details: Record<string, unknown> | null;
          ip_address: string | null;
          correlation_id: string | null;
          timestamp: string;
        };
        Insert: {
          id?: string;
          action: string;
          entity_type: string;
          entity_id: string;
          user_id: string;
          user_name?: string | null;
          details?: Record<string, unknown> | null;
          ip_address?: string | null;
          correlation_id?: string | null;
          timestamp?: string;
        };
        Update: {
          id?: string;
          action?: string;
          entity_type?: string;
          entity_id?: string;
          user_id?: string;
          user_name?: string | null;
          details?: Record<string, unknown> | null;
          ip_address?: string | null;
          correlation_id?: string | null;
          timestamp?: string;
        };
      };
      dependency_edges: {
        Row: {
          id: string;
          from_service: string;
          to_service: string;
          from_service_name: string | null;
          to_service_name: string | null;
          type: string;
          latency_ms: number | null;
          error_rate: number | null;
          traffic_rps: number | null;
        };
        Insert: {
          id?: string;
          from_service: string;
          to_service: string;
          from_service_name?: string | null;
          to_service_name?: string | null;
          type: string;
          latency_ms?: number | null;
          error_rate?: number | null;
          traffic_rps?: number | null;
        };
        Update: {
          id?: string;
          from_service?: string;
          to_service?: string;
          from_service_name?: string | null;
          to_service_name?: string | null;
          type?: string;
          latency_ms?: number | null;
          error_rate?: number | null;
          traffic_rps?: number | null;
        };
      };
      dependency_nodes: {
        Row: {
          id: string;
          name: string;
          type: string;
          tier: string | null;
          status: string | null;
          domain: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          type: string;
          tier?: string | null;
          status?: string | null;
          domain?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          type?: string;
          tier?: string | null;
          status?: string | null;
          domain?: string | null;
        };
      };
      upload_logs: {
        Row: {
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
        };
        Insert: {
          id?: string;
          file_name: string;
          data_type: string;
          uploader: string;
          uploader_name?: string | null;
          records_ingested: number;
          records_failed?: number | null;
          errors?: string[] | null;
          status: string;
          file_size_bytes?: number | null;
          timestamp?: string;
        };
        Update: {
          id?: string;
          file_name?: string;
          data_type?: string;
          uploader?: string;
          uploader_name?: string | null;
          records_ingested?: number;
          records_failed?: number | null;
          errors?: string[] | null;
          status?: string;
          file_size_bytes?: number | null;
          timestamp?: string;
        };
      };
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: string;
          team: string | null;
          avatar_url: string | null;
          azure_ad_id: string | null;
          is_active: boolean;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          role: string;
          team?: string | null;
          avatar_url?: string | null;
          azure_ad_id?: string | null;
          is_active?: boolean;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          role?: string;
          team?: string | null;
          avatar_url?: string | null;
          azure_ad_id?: string | null;
          is_active?: boolean;
          last_login_at?: string | null;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// ============================================================
// Browser Client (Singleton)
// ============================================================

let browserClient: SupabaseClient<Database> | null = null;

/**
 * Creates or returns a singleton Supabase client for browser contexts.
 * Uses the anon key for row-level security (RLS) enforcement.
 */
export function createBrowserClient(): SupabaseClient<Database> {
  if (browserClient) {
    return browserClient;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required."
    );
  }

  browserClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return browserClient;
}

// ============================================================
// Server Client
// ============================================================

/**
 * Creates a Supabase client for server contexts (API routes, server components).
 * Uses the service role key to bypass RLS for admin operations.
 * A new client is created per invocation to avoid shared state across requests.
 */
export function createServerClient(): SupabaseClient<Database> {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
    );
  }

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================================
// Default Export (Browser Client)
// ============================================================

/**
 * Default Supabase client instance for browser usage.
 * Lazily initialized on first access.
 */
export const supabase = typeof window !== "undefined" ? createBrowserClient() : null;