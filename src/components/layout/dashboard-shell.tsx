"use client"

import * as React from "react"

import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Footer } from "@/components/layout/footer"

// ============================================================
// Types
// ============================================================

interface DashboardShellProps {
  children: React.ReactNode
  /** Whether the sidebar should start collapsed (default: false) */
  defaultCollapsed?: boolean
}

// ============================================================
// DashboardShell Component
// ============================================================

/**
 * Dashboard layout shell that wraps page content with the global header,
 * collapsible sidebar, and footer. Provides a consistent layout structure
 * for all dashboard and admin pages.
 *
 * The sidebar is sticky and scrolls independently of the main content area.
 * The main content area fills the remaining horizontal space and scrolls
 * vertically as needed.
 *
 * @example
 * ```tsx
 * // In a dashboard page:
 * export default function DashboardPage() {
 *   return (
 *     <DashboardShell>
 *       <h1>Overview</h1>
 *       <DashboardContent />
 *     </DashboardShell>
 *   );
 * }
 * ```
 */
export function DashboardShell({
  children,
  defaultCollapsed = false,
}: DashboardShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Global Header */}
      <Header />

      {/* Body: Sidebar + Main Content */}
      <div className="flex flex-1">
        {/* Collapsible Sidebar */}
        <Sidebar defaultCollapsed={defaultCollapsed} />

        {/* Main Content Area */}
        <main className="flex flex-1 flex-col">
          <div className="container flex-1 py-6">{children}</div>

          {/* Global Footer */}
          <Footer />
        </main>
      </div>
    </div>
  )
}

export default DashboardShell