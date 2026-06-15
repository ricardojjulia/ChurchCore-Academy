"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type ContentContainerWidth = "narrow" | "default" | "wide" | "full";
interface NavLink {
  label: string;
  href: string;
  roles?: string[]; // If provided, only show to users with these roles
}

interface TopNavbarProps {
  links: NavLink[];
  userRole?: string;
  isAuthenticated?: boolean;
  signOutAction?: () => Promise<void>;
}

/**
 * Top Navigation Bar following LMS UI spec section 8
 * 
 * sticky top-0 z-40 w-full bg-slate-900 border-b border-slate-800 h-14
 * 
 * Nav links (horizontal, scrollable on mobile):
 * px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
 * text-slate-400 hover:text-white hover:bg-slate-800 (default)
 * bg-slate-800 text-white (active)
 */
export function TopNavbar({
  links,
  userRole = "student",
  isAuthenticated = false,
  signOutAction,
}: TopNavbarProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (!isAuthenticated && isLoginPage) {
    return null;
  }

  // Filter links based on user role for authenticated sessions only.
  const visibleLinks = isAuthenticated
    ? links.filter((link) => {
        if (!link.roles) return true;
        return link.roles.includes(userRole);
      })
    : [];

  return (
    <>
      <nav className="sticky top-0 z-40 w-full bg-slate-900 border-b border-slate-800 h-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-slate-400 hover:text-white hover:bg-slate-800 whitespace-nowrap"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated && signOutAction ? (
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Log out
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Log in
              </Link>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
}

/**
 * Main page layout wrapper following LMS UI spec section 6
 * 
 * <main class="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
 */
export function PageLayout({ children, className = "" }: PageLayoutProps) {
  return (
    <main
      id="main-content"
      className={`min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 ${className}`}
    >
      {children}
    </main>
  );
}

interface ContentContainerProps {
  children: ReactNode;
  width?: ContentContainerWidth;
}

/**
 * Content container with max-width constraints following LMS UI spec section 6
 * 
 * - narrow: max-w-xl
 * - default: max-w-2xl
 * - wide: max-w-5xl
 * - full: max-w-6xl
 */
export function ContentContainer({
  children,
  width = "default",
}: ContentContainerProps) {
  const widthClass = {
    narrow: "max-w-xl",
    default: "max-w-2xl",
    wide: "max-w-5xl",
    full: "max-w-6xl",
  }[width];

  return <div className={`${widthClass} mx-auto`}>{children}</div>;
}
