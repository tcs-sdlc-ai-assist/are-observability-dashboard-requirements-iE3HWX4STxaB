"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Layers,
  Network,
  PieChart,
  Plug,
  Rocket,
  Server,
  Settings,
  Signal,
  Upload,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { NAV_ITEMS, ADMIN_NAV_ITEMS, ROUTES } from "@/constants/constants"

// ============================================================
// Icon Mapping
// ============================================================

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  Activity,
  Signal,
  PieChart,
  AlertTriangle,
  Rocket,
  Network,
  Settings,
  Users,
  Server,
  Layers,
  Plug,
  Upload,
  FileText,
}

// ============================================================
// Types
// ============================================================

interface SidebarProps {
  defaultCollapsed?: boolean
}

// ============================================================
// Sidebar Component
// ============================================================

/**
 * Collapsible sidebar navigation with links to all dashboard modules.
 * Supports role-based visibility for admin links. Collapses to icon-only
 * mode with tooltips for labels. Highlights the active route.
 */
export function Sidebar({ defaultCollapsed = false }: SidebarProps) {
  const pathname = usePathname()
  const {
    isLoading,
    isAuthenticated,
    isAdmin,
    isARELead,
  } = useAuth()

  const [collapsed, setCollapsed] = React.useState(defaultCollapsed)

  const showAdminSection = isAdmin || isARELead

  /**
   * Determines if a nav item is currently active based on the pathname.
   */
  const isActive = React.useCallback(
    (href: string): boolean => {
      if (href === ROUTES.DASHBOARD) {
        return pathname === ROUTES.DASHBOARD
      }
      if (href === ROUTES.ADMIN) {
        return pathname === ROUTES.ADMIN && !pathname.startsWith(ROUTES.ADMIN + "/")
      }
      return pathname.startsWith(href)
    },
    [pathname]
  )

  if (!isAuthenticated) {
    return null
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "sticky top-14 z-40 flex h-[calc(100vh-3.5rem)] flex-col border-r bg-background transition-all duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Collapse Toggle */}
        <div
          className={cn(
            "flex items-center border-b px-3 py-2",
            collapsed ? "justify-center" : "justify-end"
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation Content */}
        <nav className="flex-1 overflow-y-auto py-3">
          {isLoading ? (
            <SidebarSkeleton collapsed={collapsed} />
          ) : (
            <>
              {/* Dashboard Section Label */}
              {!collapsed && (
                <div className="px-4 pb-1 pt-2">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Dashboard
                  </span>
                </div>
              )}

              {/* Dashboard Navigation Items */}
              <div className="space-y-0.5 px-2">
                {NAV_ITEMS.map((item) => {
                  const Icon = ICON_MAP[item.icon]
                  const active = isActive(item.href)

                  return (
                    <SidebarLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={Icon}
                      active={active}
                      collapsed={collapsed}
                    />
                  )
                })}
              </div>

              {/* Admin Section */}
              {showAdminSection && (
                <>
                  <div className="my-3 mx-3 h-px bg-border" />

                  {!collapsed && (
                    <div className="px-4 pb-1 pt-1">
                      <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Administration
                      </span>
                    </div>
                  )}

                  <div className="space-y-0.5 px-2">
                    {ADMIN_NAV_ITEMS.map((item) => {
                      const Icon = ICON_MAP[item.icon]
                      const active = isActive(item.href)

                      return (
                        <SidebarLink
                          key={item.href}
                          href={item.href}
                          label={item.label}
                          icon={Icon}
                          active={active}
                          collapsed={collapsed}
                        />
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="border-t px-4 py-3">
            <p className="text-2xs text-muted-foreground">
              ARE Dashboard v0.1.0
            </p>
          </div>
        )}
      </aside>
    </TooltipProvider>
  )
}

// ============================================================
// SidebarLink Component
// ============================================================

interface SidebarLinkProps {
  href: string
  label: string
  icon?: React.ElementType
  active: boolean
  collapsed: boolean
}

/**
 * Individual sidebar navigation link. When the sidebar is collapsed,
 * renders an icon-only button with a tooltip showing the label.
 */
function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: SidebarLinkProps) {
  const linkContent = (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return linkContent
}

// ============================================================
// SidebarSkeleton Component
// ============================================================

interface SidebarSkeletonProps {
  collapsed: boolean
}

/**
 * Loading skeleton for the sidebar navigation while auth state is resolving.
 */
function SidebarSkeleton({ collapsed }: SidebarSkeletonProps) {
  return (
    <div className="space-y-1 px-2 pt-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2",
            collapsed && "justify-center px-2"
          )}
        >
          <Skeleton className="h-4 w-4 shrink-0 rounded" />
          {!collapsed && <Skeleton className="h-4 w-24" />}
        </div>
      ))}
    </div>
  )
}

export default Sidebar