import type React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  FileText,
  GraduationCap,
  LibraryBig,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { StudentDashboardReadModel } from "@/modules/student-pwa/dashboard-read-model";

const summaryDefinitions = [
  { key: "schedule", href: "/student/schedule", label: "Schedule", icon: CalendarDays },
  { key: "courses", href: "/student/courses", label: "My Courses", icon: BookOpen },
  { key: "progress", href: "/student/progress", label: "Progress", icon: GraduationCap },
  { key: "documents", href: "/student/documents", label: "Documents", icon: FileText },
] as const;

export function StudentDashboardView({ model }: { model: StudentDashboardReadModel }) {
  const counts = {
    schedule: model.schedule.length,
    courses: model.courses.length,
    progress: model.progress.length,
    documents: model.documents.length,
  };

  const nextScheduleItem = model.schedule[0];
  const nextCourse = model.courses[0];
  const hasWhatsNext = nextScheduleItem ?? nextCourse;

  return (
    <>
      {/* Summary cards */}
      <section className="student-pwa-summary-grid" aria-label="Student Academy areas">
        {summaryDefinitions.map(({ key, href, label, icon: Icon }) => (
          <Link key={href} href={href} className="student-pwa-summary-card">
            <span className="student-pwa-summary-icon">
              <Icon />
            </span>
            <span>
              <strong>{label}</strong>
              <small>
                {counts[key] === 0
                  ? "Nothing released yet"
                  : `${counts[key]} released ${counts[key] === 1 ? "item" : "items"}`}
              </small>
            </span>
            <ArrowRight />
          </Link>
        ))}
      </section>

      {/* What's next card */}
      {hasWhatsNext && (
        <section className="student-pwa-whats-next" aria-label="What's next">
          <div className="student-pwa-whats-next-heading">
            <Sparkles />
            <h2>What&rsquo;s next</h2>
          </div>
          <div className="student-pwa-whats-next-items">
            {nextScheduleItem && (
              <Link href="/student/schedule" className="student-pwa-next-item">
                <span className="student-pwa-next-item-icon"><CalendarDays /></span>
                <span>
                  <strong>{nextScheduleItem.title}</strong>
                  <small>{formatStudentDate(nextScheduleItem.startsAt)}{nextScheduleItem.location ? ` · ${nextScheduleItem.location}` : ""}</small>
                </span>
                <ArrowRight />
              </Link>
            )}
            {nextCourse && (
              <Link href="/student/courses" className="student-pwa-next-item">
                <span className="student-pwa-next-item-icon"><BookOpen /></span>
                <span>
                  <strong>{nextCourse.title}</strong>
                  <small>{nextCourse.courseCode} · Currently enrolled</small>
                </span>
                <ArrowRight />
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="student-pwa-dashboard-grid">
        {/* Schedule panel */}
        <article className="student-pwa-panel">
          <div className="student-pwa-panel-heading">
            <div>
              <p>Upcoming</p>
              <h2>Schedule</h2>
            </div>
            <CalendarDays />
          </div>
          <div className="student-pwa-record-list">
            {model.schedule.length === 0 ? (
              <StudentEmptyState
                icon={<CalendarDays />}
                message="Your schedule will appear here once it's released by your institution."
                href="/student/schedule"
                linkLabel="Go to Schedule"
              />
            ) : (
              model.schedule.slice(0, 2).map((item) => (
                <div className="student-pwa-record-row" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{formatStudentDate(item.startsAt)}</span>
                  </div>
                  <small>{item.location ?? "Location pending"}</small>
                </div>
              ))
            )}
          </div>
        </article>

        {/* Courses panel */}
        <article className="student-pwa-panel">
          <div className="student-pwa-panel-heading">
            <div>
              <p>Currently enrolled</p>
              <h2>My Courses</h2>
            </div>
            <BookOpen />
          </div>
          <div className="student-pwa-record-list">
            {model.courses.length === 0 ? (
              <StudentEmptyState
                icon={<BookOpen />}
                message="Your enrolled courses will appear here once records are released."
                href="/student/courses"
                linkLabel="Go to My Courses"
              />
            ) : (
              model.courses.slice(0, 2).map((item) => (
                <div className="student-pwa-record-row" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.courseCode}</span>
                  </div>
                  <small>Active</small>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      {/* Learning Snapshot */}
      <section className="student-pwa-learning-snapshot" aria-label="Learning snapshot">
        <div className="student-pwa-learning-snapshot-heading">
          <LibraryBig />
          <h2>Learning Snapshot</h2>
        </div>
        <div className="student-pwa-learning-snapshot-body">
          {model.learning.status === "available" ? (
            <>
              <p>
                <strong>{model.learning.availableCourseCount}</strong>{" "}
                course learning {model.learning.availableCourseCount === 1 ? "space" : "spaces"} ready for you.
              </p>
              <Link href="/student/lms" className="student-pwa-learning-launch">
                Launch learning →
              </Link>
            </>
          ) : (
            <p className="student-pwa-learning-pending">
              Course learning becomes available after your institution connects a learning platform.
              Your instructor will let you know when it&rsquo;s ready.
            </p>
          )}
        </div>
      </section>

      {/* Privacy banner */}
      <section className="student-pwa-privacy-banner">
        <ShieldCheck />
        <div>
          <strong>Private by design</strong>
          <span>
            Showing released Academy records for {model.student.displayName}. Draft, held,
            provider-secret, and cross-student records are excluded.
          </span>
        </div>
      </section>

      {/* Progress snapshot */}
      {model.progress.length > 0 && (
        <section className="student-pwa-progress-snapshot">
          <div className="student-pwa-panel-heading">
            <div>
              <p>Academic standing</p>
              <h2>My Progress</h2>
            </div>
            <GraduationCap />
          </div>
          <div className="student-pwa-record-list">
            {model.progress.slice(0, 3).map((item) => (
              <div className="student-pwa-record-row" key={item.id}>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.category === "grades" ? "Grade" : "Progress"}</span>
                </div>
                <span className="student-pwa-progress-badge">{item.value}</span>
              </div>
            ))}
          </div>
          <div className="student-pwa-safe-state">
            <CheckCircle2 />
            <span>Official records only — no draft or contested values shown.</span>
          </div>
        </section>
      )}
    </>
  );
}

function StudentEmptyState({
  icon,
  message,
  href,
  linkLabel,
}: {
  icon: React.ReactNode;
  message: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="student-pwa-empty-state">
      <span className="student-pwa-empty-icon">{icon}</span>
      <p>{message}</p>
      <Link href={href} className="student-pwa-empty-link">
        {linkLabel} →
      </Link>
    </div>
  );
}

function formatStudentDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value));
}
