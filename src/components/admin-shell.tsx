"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  CircleDollarSign,
  BookOpen,
  ChevronRight,
  FolderOpen,
  GraduationCap,
  LogOut,
  Menu,
  Search,
  Settings2,
  Users,
  X,
} from "lucide-react";
import {
  StudentContextProvider,
  useStudentContext,
} from "@/contexts/student-context";
import { useAcademicContextData } from "@/contexts/academic-context";
import { AcademicContextPicker } from "@/components/AcademicContextPicker";

export type AdminSection =
  | "admissions"
  | "records"
  | "academics"
  | "dailyops"
  | "finance"
  | "reports"
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
      { label: "Enrollment", href: "/admin/admissions/matriculation" },
    ],
  },
  {
    id: "records",
    label: "Registrar",
    Icon: FolderOpen,
    items: [
      { label: "Student Center", href: "/admin/students" },
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
      { label: "Faculty", href: "/admin/faculty" },
      { label: "Staff Directory", href: "/admin/staff" },
      { label: "Communications", href: "/admin/communications" },
      { label: "ShepherdAI Queue", href: "/admin/workflows" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    Icon: CircleDollarSign,
    items: [
      { label: "Billing", href: "/admin/billing" },
      { label: "Financial Aid", href: "/admin/financial-aid" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    Icon: BarChart3,
    items: [
      { label: "Reporting", href: "/admin/reporting" },
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
      { label: "LMS Providers", href: "/admin/settings/lms" },
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
  title?: string;
  subtitle?: string;
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
  const academicContextData = useAcademicContextData();

  const [expanded, setExpanded] = useState<AdminSection | null>(
    activeSectionProp ?? derivedSection,
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
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
    <div className={`admin-app ${sidebarOpen ? "sidebar-mobile-open" : ""}`}>
      {/* Sidebar */}
      <aside id="admin-sidebar-nav" className={`admin-sidebar ${expanded ? "is-open" : ""}`}>
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
                          aria-current={itemActive ? "page" : undefined}
                          onClick={() => setSidebarOpen(false)}
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
          <button
            type="button"
            className="admin-mobile-menu-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={sidebarOpen}
            aria-controls="admin-sidebar-nav"
          >
            {sidebarOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
          </button>
          <div className="admin-topbar-left">
            <p className="admin-eyebrow">{eyebrow ?? "Admin"}</p>
            {(title || studentName) && (
              <h1 className="admin-title">
                {title}
                {studentName ? (
                  <span className="admin-title-context"> · {studentName}</span>
                ) : null}
              </h1>
            )}
          </div>

          <div className="admin-topbar-right">
            {/* Academic Context Picker */}
            {academicContextData && academicContextData.years.length > 0 && (
              <AcademicContextPicker
                context={academicContextData.context}
                years={academicContextData.years}
                periods={academicContextData.periods}
              />
            )}

            {/* Search */}
            <div className="admin-search-wrapper">
              <div className="admin-search">
                <Search size={14} strokeWidth={2} />
                <input
                  ref={searchRef}
                  role="combobox"
                  aria-haspopup="listbox"
                  aria-autocomplete="list"
                  aria-expanded={searchOpen && filtered.length > 0}
                  aria-controls="admin-search-listbox"
                  aria-activedescendant={
                    activeResultIndex >= 0
                      ? `search-result-${filtered[activeResultIndex]?.id}`
                      : undefined
                  }
                  value={searchQuery}
                  placeholder="Search students, courses…"
                  aria-label="Search students"
                  title="Search students, courses, or people"
                  autoComplete="off"
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                    setActiveResultIndex(-1);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => {
                    setSearchOpen(false);
                    setActiveResultIndex(-1);
                  }, 150)}
                  onKeyDown={(e) => {
                    if (!searchOpen || filtered.length === 0) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActiveResultIndex((i) => Math.min(i + 1, filtered.length - 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActiveResultIndex((i) => Math.max(i - 1, 0));
                    } else if (e.key === "Enter" && activeResultIndex >= 0) {
                      e.preventDefault();
                      const entry = filtered[activeResultIndex];
                      if (entry) {
                        setStudent(entry.id, entry.name, entry.program, entry.status);
                        setSearchQuery("");
                        setSearchOpen(false);
                        setActiveResultIndex(-1);
                      }
                    } else if (e.key === "Escape") {
                      setSearchOpen(false);
                      setActiveResultIndex(-1);
                    }
                  }}
                />
                <kbd>⌘K</kbd>
              </div>

              {searchOpen && filtered.length > 0 && (
                <div
                  id="admin-search-listbox"
                  className="admin-search-dropdown"
                  role="listbox"
                  aria-label="Student search results"
                >
                  {filtered.map((entry, index) => (
                    <div
                      key={entry.id}
                      id={`search-result-${entry.id}`}
                      role="option"
                      tabIndex={-1}
                      aria-selected={activeResultIndex === index}
                      className={`admin-search-result ${studentId === entry.id ? "is-active" : ""} ${activeResultIndex === index ? "is-focused" : ""}`}
                      onClick={() => {
                        setStudent(entry.id, entry.name, entry.program, entry.status);
                        setSearchQuery("");
                        setSearchOpen(false);
                        setActiveResultIndex(-1);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setStudent(entry.id, entry.name, entry.program, entry.status);
                          setSearchQuery("");
                          setSearchOpen(false);
                          setActiveResultIndex(-1);
                        }
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
                    </div>
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

export type AdminShellProps = AdminShellInnerProps;

export function AdminShell(props: AdminShellProps) {
  return (
    <StudentContextProvider>
      <AdminShellInner {...props} />
    </StudentContextProvider>
  );
}
