"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LogOut, Menu, X } from "lucide-react";

export interface PortalNavSection {
  id: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  items: { label: string; href: string }[];
}

export interface PortalShellProps {
  /** Short portal name shown in the brand block, e.g. ["Guardian", "Portal"]. */
  brand: [string, string];
  brandHref: string;
  BrandIcon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  navLabel: string;
  nav: PortalNavSection[];
  roleLabel: string;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: React.ReactNode;
  signOutAction?: () => Promise<void>;
  userEmail?: string | null;
}

/** A portal's navigation shell (same layout and classes as the admin and faculty shells). */
export function PortalShell({
  brand,
  brandHref,
  BrandIcon,
  navLabel,
  nav,
  roleLabel,
  title,
  subtitle,
  eyebrow,
  children,
  signOutAction,
  userEmail,
}: PortalShellProps) {
  const pathname = usePathname();
  const sectionForPath = (path: string) =>
    nav.find((section) => section.items.some((item) => path === item.href || path.startsWith(`${item.href}/`)))?.id ?? null;
  const [expanded, setExpanded] = useState<string | null>(sectionForPath(pathname) ?? nav[0]?.id ?? null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarId = `${brand[0].toLowerCase()}-sidebar-nav`;
  const userInitials = userEmail ? userEmail.slice(0, 2).toUpperCase() : brand[0].slice(0, 2).toUpperCase();

  return (
    <div className={`admin-app ${sidebarOpen ? "sidebar-mobile-open" : ""}`}>
      <aside id={sidebarId} className={`admin-sidebar ${expanded ? "is-open" : ""}`}>
        <Link href={brandHref} className="admin-brand">
          <span className="admin-brand-mark">
            <BrandIcon size={18} strokeWidth={2.5} />
          </span>
          <span className="admin-brand-name">
            {brand[0]}
            <br />
            {brand[1]}
          </span>
        </Link>

        <nav className="admin-nav" aria-label={navLabel}>
          {nav.map((section) => {
            const { Icon } = section;
            const isExpanded = expanded === section.id;
            const isActive = sectionForPath(pathname) === section.id;
            return (
              <div key={section.id} className="admin-nav-section">
                <button
                  type="button"
                  className={`admin-nav-trigger ${isActive || isExpanded ? "is-active" : ""}`}
                  onClick={() => setExpanded(isExpanded ? null : section.id)}
                  title={section.label}
                  aria-expanded={isExpanded}
                >
                  <span className="admin-nav-icon">
                    <Icon size={18} strokeWidth={1.8} />
                  </span>
                  <span className="admin-nav-label">{section.label}</span>
                  <span className={`admin-nav-chevron ${isExpanded ? "is-open" : ""}`}>
                    <ChevronRight size={14} strokeWidth={2} />
                  </span>
                </button>
                {isExpanded && (
                  <div className="admin-nav-items">
                    {section.items.map((item) => {
                      const itemActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`admin-nav-item ${itemActive ? "is-active" : ""}`}
                          title={item.label}
                          aria-current={itemActive ? "page" : undefined}
                          onClick={() => setSidebarOpen(false)}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user">
            <span className="admin-user-avatar">{userInitials}</span>
            <span className="admin-user-info">
              <strong>{userEmail ?? roleLabel}</strong>
              <small>{roleLabel}</small>
            </span>
          </div>
          {signOutAction && (
            <form action={signOutAction}>
              <button type="submit" className="admin-signout" title="Sign out">
                <LogOut size={15} strokeWidth={2} />
                <span className="admin-signout-label">Sign out</span>
              </button>
            </form>
          )}
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-mobile-menu-toggle"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={sidebarOpen}
            aria-controls={sidebarId}
          >
            {sidebarOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
          </button>
          <div className="admin-topbar-left">
            {eyebrow && <p className="admin-eyebrow">{eyebrow}</p>}
            <h1 className="admin-title">{title}</h1>
          </div>
        </header>

        {subtitle && (
          <div className="admin-page-header">
            <p className="admin-subtitle">{subtitle}</p>
          </div>
        )}

        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
