"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  LogOut,
  MessageSquare,
  School,
  Sparkles,
  Users,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
}

interface NavSection {
  id: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  items: NavItem[];
}

const FACULTY_NAV: NavSection[] = [
  {
    id: "today",
    label: "Today",
    Icon: CalendarDays,
    items: [
      { label: "My Schedule", href: "/faculty/schedule" },
      { label: "Attendance", href: "/faculty/attendance" },
    ],
  },
  {
    id: "sections",
    label: "Sections",
    Icon: School,
    items: [
      { label: "Active Sections", href: "/faculty/sections" },
      { label: "Roster", href: "/faculty/roster" },
    ],
  },
  {
    id: "grading",
    label: "Grading",
    Icon: BookOpen,
    items: [
      { label: "Grade Entry", href: "/faculty/gradebook" },
      { label: "Grade History", href: "/faculty/gradebook/history" },
    ],
  },
  {
    id: "students",
    label: "My Students",
    Icon: Users,
    items: [
      { label: "Student List", href: "/faculty/students" },
      { label: "Progress Notes", href: "/faculty/notes" },
    ],
  },
  {
    id: "shepherd",
    label: "ShepherdAI",
    Icon: Sparkles,
    items: [
      { label: "Flagged Students", href: "/faculty/shepherd" },
      { label: "Recommendations", href: "/faculty/shepherd/recommendations" },
    ],
  },
  {
    id: "messages",
    label: "Messages",
    Icon: MessageSquare,
    items: [{ label: "Inbox", href: "/faculty/messages" }],
  },
  {
    id: "academics",
    label: "Academics",
    Icon: ClipboardList,
    items: [
      { label: "Syllabi", href: "/faculty/syllabi" },
      { label: "Assignments", href: "/faculty/assignments" },
    ],
  },
];

function sectionForPath(pathname: string): string | null {
  for (const s of FACULTY_NAV) {
    if (s.items.some((item) => pathname.startsWith(item.href))) return s.id;
  }
  return null;
}

export interface FacultyShellProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: React.ReactNode;
  signOutAction?: () => Promise<void>;
  userEmail?: string | null;
}

export function FacultyShell({
  title,
  subtitle,
  eyebrow,
  children,
  signOutAction,
  userEmail,
}: FacultyShellProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<string | null>(
    sectionForPath(pathname) ?? "today",
  );

  const userInitials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "FC";

  return (
    <div className="admin-app">
      <aside className={`admin-sidebar ${expanded ? "is-open" : ""}`}>
        <Link href="/faculty" className="admin-brand">
          <span className="admin-brand-mark">
            <GraduationCap size={18} strokeWidth={2.5} />
          </span>
          <span className="admin-brand-name">
            Faculty
            <br />
            Portal
          </span>
        </Link>

        <nav className="admin-nav" aria-label="Faculty navigation">
          {FACULTY_NAV.map((section) => {
            const { Icon } = section;
            const isExpanded = expanded === section.id;
            const isActive = sectionForPath(pathname) === section.id;

            return (
              <div key={section.id} className="admin-nav-section">
                <button
                  type="button"
                  className={`admin-nav-trigger ${isActive || isExpanded ? "is-active" : ""}`}
                  onClick={() =>
                    setExpanded(isExpanded ? null : section.id)
                  }
                  title={section.label}
                  aria-expanded={isExpanded ? "true" : "false"}
                >
                  <span className="admin-nav-icon">
                    <Icon size={18} strokeWidth={1.8} />
                  </span>
                  <span className="admin-nav-label">{section.label}</span>
                  <span
                    className={`admin-nav-chevron ${isExpanded ? "is-open" : ""}`}
                  >
                    <ChevronRight size={14} strokeWidth={2} />
                  </span>
                </button>

                {isExpanded && (
                  <div className="admin-nav-items">
                    {section.items.map((item) => {
                      const itemActive =
                        pathname === item.href ||
                        pathname.startsWith(item.href + "/");
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`admin-nav-item ${itemActive ? "is-active" : ""}`}
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
              <strong>{userEmail ?? "Faculty"}</strong>
              <small>Instructor</small>
            </span>
          </div>
          {signOutAction && (
            <form action={signOutAction}>
              <button type="submit" className="admin-signout">
                <LogOut size={15} strokeWidth={2} />
                Sign out
              </button>
            </form>
          )}
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <p className="admin-eyebrow">{eyebrow ?? "Faculty"}</p>
            <h1 className="admin-title">{title}</h1>
          </div>
          <div className="admin-topbar-right">
            <Link href="/admin" className="faculty-switch-link">
              Admin Engine Room →
            </Link>
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

