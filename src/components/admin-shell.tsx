"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import {
  Activity,
  BookOpen,
  ChevronRight,
  FolderOpen,
  GraduationCap,
  LogOut,
  Search,
  Settings2,
  Users,
  X,
} from "lucide-react";
import {
  StudentContextProvider,
  useStudentContext,
} from "@/contexts/student-context";

export type AdminSection =
  | "admissions"
  | "records"
  | "academics"
  | "dailyops"
  | "system";

interface NavItem {
  label: string;
  href: string;
}

interface NavSection {
  id: AdminSection;
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    id: "admissions",
    label: "Admissions",
    Icon: Users,
    items: [
      { label: "Applications", href: "/admin/admissions" },
      { label: "Decisions", href: "/admin/admissions/decisions" },
      { label: "Matriculation", href: "/admin/admissions/matriculation" },
    ],
  },
  {
    id: "records",
    label: "Records",
    Icon: FolderOpen,
    items: [
      { label: "Student Index", href: "/admin/students" },
      { label: "Transcripts", href: "/admin/transcripts" },
      { label: "Graduation", href: "/admin/graduation" },
    ],
  },
  {
    id: "academics",
    label: "Academics",
    Icon: BookOpen,
    items: [
      { label: "Programs", href: "/admin/programs" },
      { label: "Course Catalog", href: "/admin/courses" },
      { label: "Sections & Schedule", href: "/admin/sections" },
    ],
  },
  {
    id: "dailyops",
    label: "Daily Ops",
    Icon: Activity,
    items: [
      { label: "Attendance", href: "/admin/attendance" },
      { label: "Gradebook", href: "/admin/gradebook" },
      { label: "ShepherdAI Queue", href: "/admin/workflows" },
    ],
  },
  {
    id: "system",
    label: "System",
    Icon: Settings2,
    items: [
      { label: "Institution", href: "/admin/settings/institution" },
      { label: "Calendar", href: "/admin/settings/calendar" },
      { label: "People & Roles", href: "/admin/settings/people" },
    ],
  },
];

function sectionForPath(pathname: string): AdminSection | null {
  for (const s of NAV_SECTIONS) {
    if (s.items.some((item) => pathname.startsWith(item.href))) return s.id;
  }
  return null;
}

export interface StudentSearchEntry {
  id: string;
  name: string;
  program: string;
  status: string;
}

interface AdminShellInnerProps {
  activeSection?: AdminSection;
  title: string;
  subtitle: string;
  eyebrow?: string;
  children: React.ReactNode;
  signOutAction?: () => Promise<void>;
  userEmail?: string | null;
  studentIndex?: StudentSearchEntry[];
}

function AdminShellInner({
  activeSection: activeSectionProp,
  title,
  subtitle,
  eyebrow,
  children,
  signOutAction,
  userEmail,
  studentIndex = [],
}: AdminShellInnerProps) {
  const pathname = usePathname();
  const derivedSection = sectionForPath(pathname);
  const [expanded, setExpanded] = useState<AdminSection | null>(
    activeSectionProp ?? derivedSection,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { studentId, studentName, programName, enrollmentStatus, setStudent, clearStudent } =
    useStudentContext();

  const userInitials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : "AD";

  const filtered = searchQuery.trim().length > 1
    ? studentIndex
        .filter((s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()),
        )
        .slice(0, 5)
    : [];

  function statusLabel(s: string) {
    return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return (
    <div className="admin-app">
      {/* Sidebar */}
      <aside className={`admin-sidebar ${expanded ? "is-open" : ""}`}>
        <Link href="/admin" className="admin-brand">
          <span className="admin-brand-mark">
            <GraduationCap size={18} strokeWidth={2.5} />
          </span>
          <span className="admin-brand-name">
            ChurchCore
            <br />
            Academy
          </span>
        </Link>

        <nav className="admin-nav" aria-label="Admin navigation">
          {NAV_SECTIONS.map((section) => {
            const { Icon } = section;
            const isExpanded = expanded === section.id;
            const isActive = derivedSection === section.id;

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
                      const labelSuffix =
                        studentName ? ` · ${studentName.split(" ")[0]}` : "";
                      return (
                        <Link
                          key={item.href}
                          href={
                            studentId
                              ? `${item.href}?studentId=${studentId}`
                              : item.href
                          }
                          className={`admin-nav-item ${itemActive ? "is-active" : ""}`}
                          title={item.label}
                        >
                          {item.label}
                          {studentName && (
                            <span className="admin-nav-item-context">
                              {labelSuffix}
                            </span>
                          )}
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
              <strong>{userEmail ?? "Staff"}</strong>
              <small>Institution staff</small>
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

      {/* Main */}
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <p className="admin-eyebrow">{eyebrow ?? "Admin"}</p>
            <h1 className="admin-title">
              {title}
              {studentName ? (
                <span className="admin-title-context"> · {studentName}</span>
              ) : null}
            </h1>
          </div>

          <div className="admin-topbar-right">
            {/* Search */}
            <div className="admin-search-wrapper">
              <div className="admin-search">
                <Search size={14} strokeWidth={2} />
                <input
                  ref={searchRef}
                  value={searchQuery}
                  placeholder="Search students, courses…"
                  aria-label="Search"
                  title="Search students, courses, or people"
                  autoComplete="off"
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                />
                <kbd>⌘K</kbd>
              </div>

              {searchOpen && filtered.length > 0 && (
                <div className="admin-search-dropdown" role="listbox">
                  {filtered.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      role="option"
                      aria-selected={studentId === entry.id ? "true" : "false"}
                      className={`admin-search-result ${studentId === entry.id ? "is-active" : ""}`}
                      onClick={() => {
                        setStudent(entry.id, entry.name, entry.program, entry.status);
                        setSearchQuery("");
                        setSearchOpen(false);
                      }}
                    >
                      <span className="admin-search-result-avatar">
                        {entry.name.charAt(0)}
                      </span>
                      <span className="admin-search-result-info">
                        <strong>{entry.name}</strong>
                        <small>{entry.program}</small>
                      </span>
                      <span className="admin-search-result-status">
                        {statusLabel(entry.status)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Active student context banner */}
        {studentId && studentName && (
          <div className="admin-context-banner">
            <span className="admin-context-avatar">
              {studentName.charAt(0)}
            </span>
            <span className="admin-context-info">
              <strong>{studentName}</strong>
              {programName && <span> · {programName}</span>}
              {enrollmentStatus && (
                <span className="admin-context-status">
                  {" "}· {statusLabel(enrollmentStatus)}
                </span>
              )}
            </span>
            <button
              type="button"
              className="admin-context-clear"
              onClick={clearStudent}
              aria-label="Clear student context"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
        )}

        <div className="admin-page-header">
          <p className="admin-subtitle">{subtitle}</p>
        </div>

        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}

export type AdminShellProps = AdminShellInnerProps;

export function AdminShell(props: AdminShellProps) {
  return (
    <StudentContextProvider>
      <AdminShellInner {...props} />
    </StudentContextProvider>
  );
}
