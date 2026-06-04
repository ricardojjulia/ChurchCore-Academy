import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, FileText, GraduationCap, LibraryBig, ShieldCheck } from "lucide-react";
import { StudentDashboardReadModel } from "@/modules/student-pwa/dashboard-read-model";

const summaryDefinitions = [
  { key: "schedule", href: "/student/schedule", label: "Schedule", icon: CalendarDays },
  { key: "courses", href: "/student/courses", label: "Courses", icon: BookOpen },
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

  return (
    <>
      <section className="student-pwa-summary-grid" aria-label="Student Academy areas">
        {summaryDefinitions.map(({ key, href, label, icon: Icon }) => (
          <Link key={href} href={href} className="student-pwa-summary-card">
            <span className="student-pwa-summary-icon">
              <Icon />
            </span>
            <span>
              <strong>{label}</strong>
              <small>{counts[key]} released {counts[key] === 1 ? "item" : "items"}</small>
            </span>
            <ArrowRight />
          </Link>
        ))}
      </section>

      <section className="student-pwa-dashboard-grid">
        <article className="student-pwa-panel">
          <div className="student-pwa-panel-heading">
            <div>
              <p>Next meetings</p>
              <h2>Schedule</h2>
            </div>
            <CalendarDays />
          </div>
          <div className="student-pwa-record-list">
            {model.schedule.slice(0, 2).map((item) => (
              <div className="student-pwa-record-row" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{formatStudentDate(item.startsAt)}</span>
                </div>
                <small>{item.location ?? "Location pending"}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="student-pwa-panel">
          <div className="student-pwa-panel-heading">
            <div>
              <p>Current study</p>
              <h2>Courses</h2>
            </div>
            <BookOpen />
          </div>
          <div className="student-pwa-record-list">
            {model.courses.slice(0, 2).map((item) => (
              <div className="student-pwa-record-row" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.courseCode}</span>
                </div>
                <small>Current</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="student-pwa-privacy-banner">
        <ShieldCheck />
        <div>
          <strong>Student-scoped by design</strong>
          <span>Showing released Academy records for {model.student.displayName}. Draft, held, provider-secret, and cross-student records are excluded.</span>
        </div>
      </section>

      <section className="student-pwa-learning-status">
        <LibraryBig />
        <div>
          <strong>Course learning</strong>
          <span>{model.learning.status === "available" ? `${model.learning.availableCourseCount} course learning spaces available.` : "No course learning spaces are available yet."}</span>
        </div>
      </section>
    </>
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
