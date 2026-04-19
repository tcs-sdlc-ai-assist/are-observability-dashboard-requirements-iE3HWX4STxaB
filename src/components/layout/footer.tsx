"use client"

import * as React from "react"
import Link from "next/link"
import { ExternalLink, FileText, Shield } from "lucide-react"

import { cn } from "@/lib/utils"
import { APP_CONFIG, ROUTES } from "@/constants/constants"

// ============================================================
// Footer Component
// ============================================================

/**
 * Global application footer with copyright, version info, and links
 * to documentation. Displayed at the bottom of every page layout.
 */
export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex flex-col items-center gap-4 py-6 md:h-14 md:flex-row md:justify-between md:py-0">
        {/* Left: Copyright & Version */}
        <div className="flex flex-col items-center gap-1 md:flex-row md:gap-2">
          <p className="text-2xs text-muted-foreground">
            &copy; {currentYear} {APP_CONFIG.NAME}. All rights reserved.
          </p>
          <span className="hidden text-muted-foreground md:inline">·</span>
          <p className="text-2xs text-muted-foreground">
            v{APP_CONFIG.VERSION}
          </p>
        </div>

        {/* Right: Links */}
        <nav className="flex items-center gap-4">
          <Link
            href={ROUTES.ADMIN_AUDIT_LOG}
            className={cn(
              "flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
            )}
          >
            <Shield className="h-3 w-3" />
            <span>Audit Log</span>
          </Link>
          <Link
            href={ROUTES.ADMIN_UPLOAD}
            className={cn(
              "flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
            )}
          >
            <FileText className="h-3 w-3" />
            <span>Data Upload</span>
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
            )}
          >
            <ExternalLink className="h-3 w-3" />
            <span>Documentation</span>
          </a>
        </nav>
      </div>
    </footer>
  )
}

export default Footer