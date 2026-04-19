import Link from "next/link"
import { FileQuestion, Home, ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { APP_CONFIG, ROUTES } from "@/constants/constants"

// ============================================================
// Not Found Page
// ============================================================

/**
 * Custom 404 Not Found page with Horizon branding.
 *
 * Displays a centered error message with navigation options
 * to return to the dashboard or go back to the previous page.
 *
 * This is a server component rendered by Next.js when no route matches.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        {/* Brand Icon */}
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <FileQuestion className="h-10 w-10 text-primary" />
        </div>

        {/* Error Code */}
        <h1 className="horizon-text-gradient text-7xl font-bold tracking-tight">
          404
        </h1>

        {/* Title */}
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
          Page Not Found
        </h2>

        {/* Description */}
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Check the URL or navigate back to the dashboard.
        </p>

        {/* Actions */}
        <div className="mt-8 flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link href="javascript:history.back()">
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Link>
          </Button>
          <Button size="sm" className="gap-1.5" asChild>
            <Link href={ROUTES.DASHBOARD}>
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </div>

        {/* Footer */}
        <p className="mt-12 text-2xs text-muted-foreground">
          {APP_CONFIG.NAME} &middot; v{APP_CONFIG.VERSION}
        </p>
      </div>
    </div>
  )
}