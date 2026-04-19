import * as React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"

import "@/app/globals.css"
import { Providers } from "@/app/providers"
import { Toaster } from "@/components/ui/toaster"
import { ErrorBoundary } from "@/components/shared/error-boundary"
import { APP_CONFIG } from "@/constants/constants"

// ============================================================
// Font Configuration
// ============================================================

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
})

// ============================================================
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: {
    default: APP_CONFIG.NAME,
    template: `%s | ${APP_CONFIG.SHORT_NAME}`,
  },
  description: APP_CONFIG.DESCRIPTION,
  applicationName: APP_CONFIG.SHORT_NAME,
  keywords: [
    "observability",
    "dashboard",
    "SRE",
    "reliability",
    "monitoring",
    "incidents",
    "SLA",
    "SLO",
    "error budget",
    "golden signals",
  ],
  authors: [{ name: "ARE Team" }],
  creator: "ARE Team",
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: "/favicon.ico",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a1a" },
  ],
}

// ============================================================
// Root Layout
// ============================================================

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <ErrorBoundary
          title="Application Error"
          description="An unexpected error occurred. Please refresh the page or contact support if the issue persists."
          variant="full"
        >
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  )
}