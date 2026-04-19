// Centralized application constants and enums
// Used across the ARE Observability Dashboard

import type {
  CriticalityTier,
  Environment,
  IncidentSeverity,
  IncidentStatus,
  MetricType,
  RootCauseCategory,
  TimePeriod,
  UserRole,
  DeploymentStatus,
  DependencyType,
  DataType,
  EntityType,
} from "@/types";

// ============================================================
// Enum Value Arrays (for iteration, dropdowns, validation)
// ============================================================

export const USER_ROLES: UserRole[] = [
  "admin",
  "are_lead",
  "sre_engineer",
  "executive",
  "viewer",
  "platform_engineer",
];

export const CRITICALITY_TIERS: CriticalityTier[] = [
  "Tier-1",
  "Tier-2",
  "Tier-3",
  "Tier-4",
];

export const ENVIRONMENTS: Environment[] = ["Prod", "Staging", "QA", "Dev"];

export const INCIDENT_SEVERITIES: IncidentSeverity[] = [
  "critical",
  "major",
  "minor",
  "warning",
];

export const INCIDENT_STATUSES: IncidentStatus[] = [
  "open",
  "investigating",
  "mitigated",
  "resolved",
  "closed",
];

export const ROOT_CAUSE_CATEGORIES: RootCauseCategory[] = [
  "Config",
  "Code",
  "Infrastructure",
  "Dependency",
  "Capacity",
  "Network",
  "Security",
  "Unknown",
];

export const METRIC_TYPES: MetricType[] = [
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

export const DEPLOYMENT_STATUSES: DeploymentStatus[] = [
  "success",
  "failed",
  "rolled_back",
  "in_progress",
];

export const DEPENDENCY_TYPES: DependencyType[] = [
  "calls",
  "publishes",
  "subscribes",
  "queries",
  "depends_on",
];

export const DATA_TYPES: DataType[] = [
  "incident",
  "metric",
  "service_map",
  "deployment",
  "error_budget",
];

export const ENTITY_TYPES: EntityType[] = [
  "incident",
  "metric",
  "service",
  "deployment",
];

// ============================================================
// Display Labels
// ============================================================

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  are_lead: "ARE Lead",
  sre_engineer: "SRE Engineer",
  executive: "Executive",
  viewer: "Viewer",
  platform_engineer: "Platform Engineer",
};

export const CRITICALITY_TIER_LABELS: Record<CriticalityTier, string> = {
  "Tier-1": "Tier 1 – Critical",
  "Tier-2": "Tier 2 – High",
  "Tier-3": "Tier 3 – Medium",
  "Tier-4": "Tier 4 – Low",
};

export const ENVIRONMENT_LABELS: Record<Environment, string> = {
  Prod: "Production",
  Staging: "Staging",
  QA: "QA",
  Dev: "Development",
};

export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  critical: "Critical",
  major: "Major",
  minor: "Minor",
  warning: "Warning",
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  mitigated: "Mitigated",
  resolved: "Resolved",
  closed: "Closed",
};

export const ROOT_CAUSE_CATEGORY_LABELS: Record<RootCauseCategory, string> = {
  Config: "Configuration",
  Code: "Code Defect",
  Infrastructure: "Infrastructure",
  Dependency: "Dependency Failure",
  Capacity: "Capacity",
  Network: "Network",
  Security: "Security",
  Unknown: "Unknown",
};

export const METRIC_TYPE_LABELS: Record<MetricType, string> = {
  latency_p50: "Latency (P50)",
  latency_p95: "Latency (P95)",
  latency_p99: "Latency (P99)",
  errors_4xx: "4xx Errors",
  errors_5xx: "5xx Errors",
  traffic_rps: "Traffic (RPS)",
  saturation_cpu: "CPU Saturation",
  saturation_memory: "Memory Saturation",
  saturation_disk: "Disk Saturation",
  availability: "Availability",
};

export const DEPLOYMENT_STATUS_LABELS: Record<DeploymentStatus, string> = {
  success: "Success",
  failed: "Failed",
  rolled_back: "Rolled Back",
  in_progress: "In Progress",
};

// ============================================================
// Color Mappings
// ============================================================

export const SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  critical: "#ef4444",
  major: "#f97316",
  minor: "#f59e0b",
  warning: "#eab308",
};

export const SEVERITY_BG_CLASSES: Record<IncidentSeverity, string> = {
  critical: "bg-red-500/10 text-red-700 dark:text-red-400",
  major: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  minor: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

export const STATUS_COLORS: Record<IncidentStatus, string> = {
  open: "#ef4444",
  investigating: "#f97316",
  mitigated: "#f59e0b",
  resolved: "#22c55e",
  closed: "#6b7280",
};

export const STATUS_BG_CLASSES: Record<IncidentStatus, string> = {
  open: "bg-red-500/10 text-red-700 dark:text-red-400",
  investigating: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  mitigated: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  resolved: "bg-green-500/10 text-green-700 dark:text-green-400",
  closed: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
};

export const TIER_COLORS: Record<CriticalityTier, string> = {
  "Tier-1": "#ef4444",
  "Tier-2": "#f97316",
  "Tier-3": "#f59e0b",
  "Tier-4": "#22c55e",
};

export const TIER_BG_CLASSES: Record<CriticalityTier, string> = {
  "Tier-1": "bg-red-500/10 text-red-700 dark:text-red-400",
  "Tier-2": "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  "Tier-3": "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  "Tier-4": "bg-green-500/10 text-green-700 dark:text-green-400",
};

export const DEPLOYMENT_STATUS_COLORS: Record<DeploymentStatus, string> = {
  success: "#22c55e",
  failed: "#ef4444",
  rolled_back: "#f97316",
  in_progress: "#3b82f6",
};

// ============================================================
// Time Range Options
// ============================================================

export const TIME_PERIODS: TimePeriod[] = [
  "1h",
  "6h",
  "12h",
  "24h",
  "7d",
  "14d",
  "30d",
  "90d",
];

export const TIME_PERIOD_LABELS: Record<TimePeriod, string> = {
  "1h": "Last 1 Hour",
  "6h": "Last 6 Hours",
  "12h": "Last 12 Hours",
  "24h": "Last 24 Hours",
  "7d": "Last 7 Days",
  "14d": "Last 14 Days",
  "30d": "Last 30 Days",
  "90d": "Last 90 Days",
};

export const TIME_PERIOD_MS: Record<TimePeriod, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "14d": 14 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

// ============================================================
// Default Thresholds
// ============================================================

export const DEFAULT_THRESHOLDS = {
  availability: {
    "Tier-1": 99.99,
    "Tier-2": 99.95,
    "Tier-3": 99.9,
    "Tier-4": 99.5,
  } as Record<CriticalityTier, number>,

  latency_p95_ms: {
    "Tier-1": 200,
    "Tier-2": 500,
    "Tier-3": 1000,
    "Tier-4": 2000,
  } as Record<CriticalityTier, number>,

  latency_p99_ms: {
    "Tier-1": 500,
    "Tier-2": 1000,
    "Tier-3": 2000,
    "Tier-4": 5000,
  } as Record<CriticalityTier, number>,

  error_rate_5xx: {
    "Tier-1": 0.01,
    "Tier-2": 0.05,
    "Tier-3": 0.1,
    "Tier-4": 0.5,
  } as Record<CriticalityTier, number>,

  error_budget_burn_rate: {
    warning: 1.0,
    critical: 2.0,
  },

  saturation: {
    cpu_warning: 70,
    cpu_critical: 90,
    memory_warning: 75,
    memory_critical: 90,
    disk_warning: 80,
    disk_critical: 95,
  },

  mttr_minutes: {
    "Tier-1": 30,
    "Tier-2": 60,
    "Tier-3": 120,
    "Tier-4": 240,
  } as Record<CriticalityTier, number>,

  mttd_minutes: {
    "Tier-1": 5,
    "Tier-2": 10,
    "Tier-3": 15,
    "Tier-4": 30,
  } as Record<CriticalityTier, number>,
} as const;

// ============================================================
// Route Paths
// ============================================================

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",

  // Dashboard routes
  DASHBOARD: "/dashboard",
  DASHBOARD_AVAILABILITY: "/dashboard/availability",
  DASHBOARD_GOLDEN_SIGNALS: "/dashboard/golden-signals",
  DASHBOARD_ERROR_BUDGET: "/dashboard/error-budget",
  DASHBOARD_INCIDENTS: "/dashboard/incidents",
  DASHBOARD_DEPLOYMENTS: "/dashboard/deployments",
  DASHBOARD_SERVICE_MAP: "/dashboard/service-map",

  // Detail routes
  SERVICE_DETAIL: (id: string) => `/dashboard/services/${id}` as const,
  INCIDENT_DETAIL: (id: string) => `/dashboard/incidents/${id}` as const,
  DEPLOYMENT_DETAIL: (id: string) => `/dashboard/deployments/${id}` as const,

  // Admin routes
  ADMIN: "/admin",
  ADMIN_USERS: "/admin/users",
  ADMIN_SERVICES: "/admin/services",
  ADMIN_DOMAINS: "/admin/domains",
  ADMIN_INTEGRATIONS: "/admin/integrations",
  ADMIN_UPLOAD: "/admin/upload",
  ADMIN_AUDIT_LOG: "/admin/audit-log",

  // API routes
  API_AUTH: "/api/auth",
  API_SERVICES: "/api/services",
  API_INCIDENTS: "/api/incidents",
  API_METRICS: "/api/metrics",
  API_DEPLOYMENTS: "/api/deployments",
  API_ERROR_BUDGETS: "/api/error-budgets",
  API_DEPENDENCIES: "/api/dependencies",
  API_ANNOTATIONS: "/api/annotations",
  API_UPLOAD: "/api/upload",
  API_AUDIT_LOG: "/api/audit-log",
} as const;

// ============================================================
// Navigation Items
// ============================================================

export const NAV_ITEMS = [
  {
    label: "Overview",
    href: ROUTES.DASHBOARD,
    icon: "LayoutDashboard",
  },
  {
    label: "Availability",
    href: ROUTES.DASHBOARD_AVAILABILITY,
    icon: "Activity",
  },
  {
    label: "Golden Signals",
    href: ROUTES.DASHBOARD_GOLDEN_SIGNALS,
    icon: "Signal",
  },
  {
    label: "Error Budget",
    href: ROUTES.DASHBOARD_ERROR_BUDGET,
    icon: "PieChart",
  },
  {
    label: "Incidents",
    href: ROUTES.DASHBOARD_INCIDENTS,
    icon: "AlertTriangle",
  },
  {
    label: "Deployments",
    href: ROUTES.DASHBOARD_DEPLOYMENTS,
    icon: "Rocket",
  },
  {
    label: "Service Map",
    href: ROUTES.DASHBOARD_SERVICE_MAP,
    icon: "Network",
  },
] as const;

export const ADMIN_NAV_ITEMS = [
  {
    label: "Admin Overview",
    href: ROUTES.ADMIN,
    icon: "Settings",
  },
  {
    label: "Users",
    href: ROUTES.ADMIN_USERS,
    icon: "Users",
  },
  {
    label: "Services",
    href: ROUTES.ADMIN_SERVICES,
    icon: "Server",
  },
  {
    label: "Domains",
    href: ROUTES.ADMIN_DOMAINS,
    icon: "Layers",
  },
  {
    label: "Integrations",
    href: ROUTES.ADMIN_INTEGRATIONS,
    icon: "Plug",
  },
  {
    label: "Data Upload",
    href: ROUTES.ADMIN_UPLOAD,
    icon: "Upload",
  },
  {
    label: "Audit Log",
    href: ROUTES.ADMIN_AUDIT_LOG,
    icon: "FileText",
  },
] as const;

// ============================================================
// Pagination Defaults
// ============================================================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
  MAX_PAGE_SIZE: 100,
} as const;

// ============================================================
// Polling & Refresh Intervals (in milliseconds)
// ============================================================

export const REFRESH_INTERVALS = {
  REAL_TIME: 10_000,
  FAST: 30_000,
  NORMAL: 60_000,
  SLOW: 300_000,
  DASHBOARD: 60_000,
  INCIDENTS: 30_000,
  METRICS: 30_000,
  SERVICE_MAP: 120_000,
  ERROR_BUDGET: 300_000,
} as const;

// ============================================================
// File Upload Constraints
// ============================================================

export const UPLOAD = {
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  ACCEPTED_FILE_TYPES: [".csv", ".xlsx", ".xls", ".json"],
  ACCEPTED_MIME_TYPES: [
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/json",
  ],
  MAX_RECORDS_PER_FILE: 50_000,
} as const;

// ============================================================
// Chart & Visualization Defaults
// ============================================================

export const CHART_DEFAULTS = {
  COLORS: [
    "#0c8eeb",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#f97316",
  ],
  ANIMATION_DURATION: 300,
  TOOLTIP_DELAY: 200,
  MIN_HEIGHT: 200,
  DEFAULT_HEIGHT: 300,
} as const;

// ============================================================
// Role-Based Access Control
// ============================================================

export const ROLE_PERMISSIONS: Record<UserRole, readonly string[]> = {
  admin: [
    "read:all",
    "write:all",
    "delete:all",
    "manage:users",
    "manage:services",
    "manage:domains",
    "manage:integrations",
    "upload:data",
    "view:audit_log",
    "annotate:all",
  ],
  are_lead: [
    "read:all",
    "write:services",
    "write:incidents",
    "write:annotations",
    "upload:data",
    "view:audit_log",
    "annotate:all",
  ],
  sre_engineer: [
    "read:all",
    "write:incidents",
    "write:annotations",
    "upload:data",
    "annotate:all",
  ],
  platform_engineer: [
    "read:all",
    "write:services",
    "write:deployments",
    "upload:data",
    "annotate:all",
  ],
  executive: [
    "read:all",
    "read:reports",
  ],
  viewer: [
    "read:dashboard",
    "read:services",
    "read:incidents",
    "read:metrics",
  ],
} as const;

// ============================================================
// Application Metadata
// ============================================================

export const APP_CONFIG = {
  NAME: "ARE Observability Dashboard",
  SHORT_NAME: "ARE Dashboard",
  DESCRIPTION: "Application Reliability Engineering Observability Dashboard",
  VERSION: "0.1.0",
  DEFAULT_TIMEZONE: "America/New_York",
  DATE_FORMAT: "MMM dd, yyyy",
  DATETIME_FORMAT: "MMM dd, yyyy HH:mm:ss",
  TIME_FORMAT: "HH:mm:ss",
} as const;