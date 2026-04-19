import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ROUTES } from "@/constants/constants"
import { DashboardShell } from "@/components/layout/dashboard-shell"

// ============================================================
// Dashboard Layout
// ============================================================

/**
 * Authenticated dashboard layout wrapper.
 *
 * Server component that enforces authentication for all dashboard routes.
 * Unauthenticated users are redirected to the login page. Authenticated
 * users see the full dashboard shell with header, collapsible sidebar,
 * and footer wrapping the page content.
 *
 * This layout applies to all routes under /dashboard/*.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(ROUTES.LOGIN)
  }

  // Redirect inactive users to login
  if (!session.user.is_active) {
    redirect(ROUTES.LOGIN)
  }

  return <DashboardShell>{children}</DashboardShell>
}