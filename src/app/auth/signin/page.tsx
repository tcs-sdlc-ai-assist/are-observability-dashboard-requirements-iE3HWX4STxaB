"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, LogIn, ShieldAlert } from "lucide-react"

import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { APP_CONFIG, ROUTES } from "@/constants/constants"

// ============================================================
// Constants
// ============================================================

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "An error occurred while initiating sign-in. Please try again.",
  OAuthCallback: "An error occurred during the authentication callback. Please try again.",
  OAuthCreateAccount: "Could not create your account. Please contact your administrator.",
  EmailCreateAccount: "Could not create your account. Please contact your administrator.",
  Callback: "An error occurred during authentication. Please try again.",
  OAuthAccountNotLinked: "This email is already associated with another account. Please sign in with the original provider.",
  CredentialsSignin: "Invalid credentials. Please check your email and password.",
  SessionRequired: "You must be signed in to access this page.",
  AccessDenied: "Access denied. Your account may be inactive or you do not have permission.",
  default: "An unexpected error occurred during sign-in. Please try again.",
}

// ============================================================
// Sign-In Page
// ============================================================

/**
 * Authentication sign-in page with Azure AD SSO button, Horizon branding,
 * and automatic redirect to the dashboard on successful authentication.
 *
 * Displays error messages from NextAuth callback errors via the `error`
 * query parameter. Redirects authenticated users to the dashboard
 * automatically.
 *
 * This page is rendered at /auth/signin and is configured as the
 * custom sign-in page in the NextAuth configuration.
 */
export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading, isAuthenticated, signIn } = useAuth()

  const [isSigningIn, setIsSigningIn] = React.useState(false)

  // Extract error and callbackUrl from query parameters
  const errorParam = searchParams.get("error")
  const callbackUrl = searchParams.get("callbackUrl") || ROUTES.DASHBOARD

  const errorMessage = errorParam
    ? ERROR_MESSAGES[errorParam] || ERROR_MESSAGES.default
    : null

  // Redirect authenticated users to the dashboard (or callbackUrl)
  React.useEffect(() => {
    if (isAuthenticated && user) {
      router.replace(callbackUrl)
    }
  }, [isAuthenticated, user, router, callbackUrl])

  /**
   * Handles the Azure AD sign-in button click.
   * Sets a loading state and triggers the NextAuth sign-in flow.
   */
  const handleSignIn = React.useCallback(async () => {
    setIsSigningIn(true)

    try {
      await signIn()
    } catch {
      // signIn handles the redirect internally; errors are surfaced
      // via the error query parameter on redirect back to this page.
      setIsSigningIn(false)
    }
  }, [signIn])

  const isBusy = isLoading || isSigningIn

  // Show a minimal loading state while the session is being resolved
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    )
  }

  // If already authenticated, show a brief redirect message
  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Redirecting to dashboard…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center">
        {/* Brand Logo & Title */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl horizon-gradient text-white font-bold text-xl shadow-dashboard-md">
            A
          </div>
          <h1 className="horizon-text-gradient text-2xl font-bold tracking-tight">
            {APP_CONFIG.SHORT_NAME}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {APP_CONFIG.DESCRIPTION}
          </p>
        </div>

        {/* Sign-In Card */}
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-lg font-semibold tracking-tight">
              Sign In
            </CardTitle>
            <CardDescription>
              Sign in with your organization account to access the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Error Alert */}
            {errorMessage && (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Authentication Error</AlertTitle>
                <AlertDescription className="text-sm">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}

            {/* Azure AD SSO Button */}
            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleSignIn}
              disabled={isBusy}
            >
              {isSigningIn ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign in with Microsoft
                </>
              )}
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Azure AD Single Sign-On
                </span>
              </div>
            </div>

            {/* Info Text */}
            <p className="text-center text-2xs text-muted-foreground leading-relaxed">
              Access is restricted to authorized organization members.
              Your role and permissions are managed through Azure Active Directory.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-2 border-t bg-muted/20 px-6 py-4">
            <p className="text-2xs text-muted-foreground">
              By signing in, you agree to the organization&apos;s security policies.
            </p>
            <p className="text-2xs text-muted-foreground">
              All actions are recorded in the audit log for compliance.
            </p>
          </CardFooter>
        </Card>

        {/* Footer */}
        <p className="mt-8 text-2xs text-muted-foreground">
          {APP_CONFIG.NAME} &middot; v{APP_CONFIG.VERSION}
        </p>
      </div>
    </div>
  )
}