import Link from "next/link";
import { ArrowLeft, BarChart3, BookOpenCheck, CalendarDays, GraduationCap, LayoutDashboard, LibraryBig, ListChecks, LogOut, Server, Settings, Star, UserRound, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AcademyShellProps {
  title: string;
  subtitle: string;
  eyebrow?: string;
  badge?: string;
  activeHref?: string;
  controlHref?: string;
  controlLabel?: string;
  userEmail?: string | null;
  signOutAction?: () => Promise<void>;
  children: React.ReactNode;
}

const navItems = [
  { href: "/", label: "Dashboard", caption: "Academic operations", icon: LayoutDashboard },
  { href: "/workflows", label: "ShepherdAI Recommendations", caption: "Review queue", icon: ListChecks },
  { href: "/students", label: "Students", caption: "Records and insights", icon: UsersRound },
  { href: "/programs", label: "Programs", caption: "Progress and readiness", icon: GraduationCap },
  { href: "/faculty", label: "Faculty/Admin", caption: "Load and setup", icon: BookOpenCheck },
  { href: "/settings/institution", label: "Institution", caption: "Configuration review", icon: Settings },
  { href: "/settings/calendar", label: "Calendar", caption: "Years and periods", icon: CalendarDays },
  { href: "/settings/courses", label: "Courses", caption: "Catalog setup", icon: LibraryBig },
  { href: "/settings/grading", label: "Grading", caption: "Records and standing", icon: Star },
  { href: "/settings/people", label: "People", caption: "Roles and guardians", icon: UsersRound },
  { href: "/settings/demo-feedback", label: "Demo Feedback", caption: "Platform triage", icon: ListChecks },
  { href: "/platform/control", label: "Platform Control", caption: "Tenant lifecycle", icon: Server },
];

export function AcademyShell({
  title,
  subtitle,
  eyebrow,
  badge,
  activeHref = "/",
  controlHref = "/platform/control",
  controlLabel = "Return to control",
  userEmail,
  signOutAction,
  children,
}: AcademyShellProps) {
  return (
    <div className="academy-app">
      <aside className="academy-sidebar">
        <div className="sidebar-heading">
          <div>
            <h1>ChurchCore Academy</h1>
            <p>Faith-based SIS</p>
          </div>
        </div>

        <div className="sidebar-context">
          <strong>Academy</strong>
          <span>Education management</span>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          <div className="sidebar-section-label">
            <BarChart3 />
            Academic Admin
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === activeHref;
            return (
              <Link key={item.href} href={item.href} className={`sidebar-link ${isActive ? "is-active" : ""}`}>
                <Icon />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.caption}</small>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-icon">
              <UserRound />
            </div>
            <div>
              <strong>{userEmail ?? "Signed-in user"}</strong>
              <span>Institution staff</span>
            </div>
          </div>
          {signOutAction ? (
            <form action={signOutAction}>
              <button type="submit">
                <LogOut size={18} />
                Log out
              </button>
            </form>
          ) : null}
        </div>
      </aside>

      <main className="academy-main">
        <header className="academy-titlebar">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
        </header>

        <section className="tenant-toolbar">
          <div className="tenant-left">
            <Badge variant="secondary" className="tenant-badge">
              <GraduationCap />
              {eyebrow ?? "ChurchCore Academy"}
            </Badge>
            <span>{badge ?? "Tenant view · academy-admin"}</span>
          </div>
          <Link href={controlHref}>
            <Button variant="outline" size="lg">
              <ArrowLeft />
              {controlLabel}
            </Button>
          </Link>
        </section>

        <section className="page-shell">{children}</section>
      </main>
    </div>
  );
}
