"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  PieChart,
  Rocket,
  Settings,
  Signal,
  User,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { NAV_ITEMS, ADMIN_NAV_ITEMS, ROUTES, USER_ROLE_LABELS } from "@/constants/constants"

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
}

// ============================================================
// Header Component
// ============================================================

/**
 * Global application header with navigation links, user profile dropdown,
 * role display, and sign-out button. Responsive with a mobile hamburger menu.
 */
export function Header() {
  const pathname = usePathname()
  const {
    user,
    isLoading,
    isAuthenticated,
    role,
    isAdmin,
    isARELead,
    signIn,
    signOut,
  } = useAuth()

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  // Close mobile menu on route change
  React.useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const showAdminLink = isAdmin || isARELead

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* Logo */}
        <Link
          href={ROUTES.DASHBOARD}
          className="mr-6 flex items-center space-x-2"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-horizon-600 text-white font-bold text-sm">
            A
          </div>
          <span className="hidden font-semibold sm:inline-block">
            ARE Dashboard
          </span>
        </Link>

        {/* Desktop Navigation */}
        {isAuthenticated && (
          <nav className="hidden md:flex items-center space-x-1">
            {NAV_ITEMS.map((item) => {
              const Icon = ICON_MAP[item.icon]
              const isActive =
                item.href === ROUTES.DASHBOARD
                  ? pathname === ROUTES.DASHBOARD
                  : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              )
            })}

            {showAdminLink && (
              <Link
                href={ROUTES.ADMIN}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  pathname.startsWith(ROUTES.ADMIN)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
              >
                <Settings className="h-4 w-4" />
                <span className="hidden lg:inline">Admin</span>
              </Link>
            )}
          </nav>
        )}

        {/* Right Side: User Profile / Auth */}
        <div className="ml-auto flex items-center space-x-2">
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="hidden h-4 w-24 sm:block" />
            </div>
          ) : isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 px-2"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                    {user.name
                      ? user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)
                      : <User className="h-4 w-4" />}
                  </div>
                  <div className="hidden flex-col items-start sm:flex">
                    <span className="text-sm font-medium leading-none">
                      {user.name}
                    </span>
                    <span className="text-2xs text-muted-foreground leading-none mt-0.5">
                      {role ? USER_ROLE_LABELS[role] : "User"}
                    </span>
                  </div>
                  <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.name}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                    <div className="pt-1">
                      <Badge variant="secondary" className="text-2xs">
                        {role ? USER_ROLE_LABELS[role] : "User"}
                      </Badge>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {showAdminLink && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link
                        href={ROUTES.ADMIN}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Settings className="h-4 w-4" />
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" onClick={() => signIn()}>
              Sign In
            </Button>
          )}

          {/* Mobile Menu Toggle */}
          {isAuthenticated && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Navigation */}
      {isAuthenticated && mobileMenuOpen && (
        <div className="border-t md:hidden">
          <nav className="container flex flex-col space-y-1 py-3">
            {NAV_ITEMS.map((item) => {
              const Icon = ICON_MAP[item.icon]
              const isActive =
                item.href === ROUTES.DASHBOARD
                  ? pathname === ROUTES.DASHBOARD
                  : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {item.label}
                </Link>
              )
            })}

            {showAdminLink && (
              <>
                <div className="my-1 h-px bg-border" />
                <Link
                  href={ROUTES.ADMIN}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                    pathname.startsWith(ROUTES.ADMIN)
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <Settings className="h-4 w-4" />
                  Admin Panel
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}

export default Header