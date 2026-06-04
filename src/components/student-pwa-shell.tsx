import Link from "next/link";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  FileText,
  GraduationCap,
  Home,
  LibraryBig,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { studentPwaDestinations, type StudentPwaDestination } from "@/modules/student-pwa/shell-config";

const iconByName = {
  home: Home,
  courses: BookOpen,
  schedule: CalendarDays,
  progress: GraduationCap,
  documents: FileText,
  messages: MessageSquare,
  learning: LibraryBig,
};

export function StudentPwaShell({
  activeHref,
  title,
  description,
  children,
}: {
  activeHref: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="student-pwa">
      <header className="student-pwa-header">
        <Link href="/student" className="student-pwa-brand" aria-label="ChurchCore Academy student home">
          <span className="student-pwa-mark">
            <GraduationCap />
          </span>
          <span>
            <strong>ChurchCore Academy</strong>
            <small>Student</small>
          </span>
        </Link>
        <div className="student-pwa-status">
          <ShieldCheck />
          <span>Student view</span>
        </div>
      </header>

      <div className="student-pwa-frame">
        <aside className="student-pwa-sidebar">
          <p className="student-pwa-nav-label">My Academy</p>
          <StudentPwaNavigation activeHref={activeHref} />
          <div className="student-pwa-sidebar-note">
            <CheckCircle2 />
            <div>
              <strong>Private by design</strong>
              <span>Only released, student-visible Academy records will appear here.</span>
            </div>
          </div>
        </aside>

        <main className="student-pwa-main">
          <section className="student-pwa-page-heading">
            <div>
              <p>My Academy</p>
              <h1>{title}</h1>
              <span>{description}</span>
            </div>
            <button className="student-pwa-alert-button" type="button" aria-label="Notifications unavailable">
              <Bell />
              <span>Notifications</span>
            </button>
          </section>
          {children}
        </main>
      </div>

      <nav className="student-pwa-bottom-nav" aria-label="Student mobile navigation">
        {studentPwaDestinations.map((destination) => (
          <StudentPwaNavLink key={destination.href} destination={destination} activeHref={activeHref} compact />
        ))}
      </nav>
    </div>
  );
}

export function StudentPwaPlaceholder({
  activeHref,
  actionLabel,
}: {
  activeHref: string;
  actionLabel: string;
}) {
  const destination = studentPwaDestinations.find(({ href }) => href === activeHref);

  if (!destination) return null;

  const Icon = iconByName[destination.icon];

  return (
    <section className="student-pwa-placeholder" aria-labelledby="placeholder-title">
      <div className="student-pwa-placeholder-icon">
        <Icon />
      </div>
      <p>Student records are not connected in this sprint</p>
      <h2 id="placeholder-title">{actionLabel}</h2>
      <span>{destination.description}</span>
      <div className="student-pwa-safe-state">
        <ShieldCheck />
        <span>This page does not expose draft, held, provider-secret, or cross-student records.</span>
      </div>
    </section>
  );
}

function StudentPwaNavigation({ activeHref }: { activeHref: string }) {
  return (
    <nav className="student-pwa-nav" aria-label="Student">
      {studentPwaDestinations.map((destination) => (
        <StudentPwaNavLink key={destination.href} destination={destination} activeHref={activeHref} />
      ))}
    </nav>
  );
}

function StudentPwaNavLink({
  destination,
  activeHref,
  compact = false,
}: {
  destination: StudentPwaDestination;
  activeHref: string;
  compact?: boolean;
}) {
  const Icon = iconByName[destination.icon];
  const isActive = destination.href === activeHref;

  return (
    <Link
      href={destination.href}
      className={`student-pwa-nav-link ${isActive ? "is-active" : ""} ${compact ? "is-compact" : ""}`}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon />
      <span>{destination.label}</span>
    </Link>
  );
}
