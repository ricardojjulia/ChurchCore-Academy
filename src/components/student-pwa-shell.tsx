"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import {
  Award,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  HandCoins,
  Home,
  LibraryBig,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { studentPwaDestinations, type StudentPwaDestination } from "@/modules/student-pwa/shell-config";
import { useStudentCapabilities } from "@/components/student-capability-context";

const iconByName = {
  home: Home,
  courses: BookOpen,
  schedule: CalendarDays,
  progress: GraduationCap,
  documents: FileText,
  messages: MessageSquare,
  learning: LibraryBig,
  attendance: ClipboardCheck,
  privacy: ShieldCheck,
  account: CreditCard,
  aid: HandCoins,
  formation: Award,
};

export function StudentPwaShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const { ministryFormationEnabled } = useStudentCapabilities();

  const visibleDestinations = useMemo(() => {
    return studentPwaDestinations.filter((destination) => {
      // Filter out formation destination if capability is disabled
      if (destination.href === "/student/formation" && !ministryFormationEnabled) {
        return false;
      }
      return true;
    });
  }, [ministryFormationEnabled]);

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
          <StudentPwaNavigation destinations={visibleDestinations} />
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
            <Link className="student-pwa-alert-button" href="/student/messages" aria-label="Open messages">
              <Bell />
              <span>Messages</span>
            </Link>
          </section>
          {children}
        </main>
      </div>

      <nav className="student-pwa-bottom-nav" aria-label="Student mobile navigation">
        {visibleDestinations.map((destination) => (
          <StudentPwaNavLink key={destination.href} destination={destination} compact />
        ))}
      </nav>
    </div>
  );
}

function StudentPwaNavigation({ destinations }: { destinations: StudentPwaDestination[] }) {
  return (
    <nav className="student-pwa-nav" aria-label="Student">
      {destinations.map((destination) => (
        <StudentPwaNavLink key={destination.href} destination={destination} />
      ))}
    </nav>
  );
}

function StudentPwaNavLink({
  destination,
  compact = false,
}: {
  destination: StudentPwaDestination;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const Icon = iconByName[destination.icon];
  const isActive =
    pathname === destination.href || pathname.startsWith(destination.href + "/");

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
