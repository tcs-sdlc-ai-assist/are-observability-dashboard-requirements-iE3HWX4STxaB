import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ROUTES } from "@/constants/constants"

// ============================================================
// Home Page
// ============================================================

/**
 * Application root page.
 *
 * Server component that checks the current authentication state:
 * - Authenticated users are redirected to the executive overview dashboard.
 * - Unauthenticated users are redirected to the sign-in page.
 *
 * This page never renders UI — it always performs a server-side redirect.
 */
export default async function HomePage() {
  const session = await getServerSession(authOptions)

  if (session?.user) {
    redirect(ROUTES.DASHBOARD)
  }

  redirect(ROUTES.LOGIN)
}