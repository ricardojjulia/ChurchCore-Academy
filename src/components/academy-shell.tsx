import Link from "next/link";
import { ArrowLeft, BarChart3, BookOpenCheck, GraduationCap, LayoutDashboard, ListChecks, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AcademyShellProps {
  title: string;
  subtitle: string;
  eyebrow?: string;
  badge?: string;
  children: React.ReactNode;
}

const navItems = [
  { href: "/", label: "Dashboard", caption: "Academic operations", icon: LayoutDashboard, active: true },
  { href: "/workflows", label: "Workflows", caption: "Review queue", icon: ListChecks },
  { href: "/students/stu-maya-bennett", label: "Students", caption: "Records and insights", icon: UsersRound },
  { href: "/programs/prog-biblical-studies", label: "Programs", caption: "Progress and readiness", icon: GraduationCap },
  { href: "/faculty", label: "Faculty/Admin", caption: "Load and setup", icon: BookOpenCheck },
];

export function AcademyShell({ title, subtitle, eyebrow, badge, children }: AcademyShellProps) {
  return (
    <div className="academy-app">
      <aside className="academy-sidebar">
        <div className="sidebar-heading">
          <div>
            <h1>ChurchCore Academy</h1>
            <p>Academic SIS</p>
          </div>
        </div>

        <div className="sidebar-product">
          <div className="sidebar-product-icon">
            <ShieldCheck />
          </div>
          <div>
            <strong>ShepherdAI Academy</strong>
            <span>Workflow recommendations</span>
          </div>
        </div>

        <div className="sidebar-context">
          <strong>Academy</strong>
          <span>SIS and college management</span>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          <div className="sidebar-section-label">
            <BarChart3 />
            Academic Admin
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`sidebar-link ${item.active ? "is-active" : ""}`}>
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
              <strong>Registrar Admin</strong>
              <span>Institution staff</span>
            </div>
          </div>
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
          <Button variant="outline" size="lg">
            <ArrowLeft />
            Return to control
          </Button>
        </section>

        <section className="page-shell">{children}</section>
      </main>
    </div>
  );
}

