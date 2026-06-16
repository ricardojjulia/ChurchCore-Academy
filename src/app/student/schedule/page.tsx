import { CalendarDays, ShieldCheck } from "lucide-react";
import { StudentPwaShell } from "@/components/student-pwa-shell";
import { loadStudentPwaPageModel } from "@/modules/student-pwa/server-read-model";

export const dynamic = "force-dynamic";

export default async function StudentSchedulePage() {
  const model = await loadStudentPwaPageModel();

  return (
    <StudentPwaShell activeHref="/student/schedule" title="Schedule" description="Review released meetings, dates, and academic windows.">
      <section className="student-pwa-surface" aria-labelledby="student-schedule-heading">
        <div className="student-pwa-surface-heading">
          <div>
            <p>Upcoming meetings</p>
            <h2 id="student-schedule-heading">{model.schedule.length} released schedule items</h2>
          </div>
          <CalendarDays />
        </div>
        <div className="student-pwa-surface-list">
          {model.schedule.map((item) => (
            <article className="student-pwa-surface-row" key={item.id}>
              <span className="student-pwa-surface-icon">
                <CalendarDays />
              </span>
              <div>
                <strong>{item.title}</strong>
                <span>{formatScheduleDate(item.startsAt)}</span>
              </div>
              <small>{item.location ?? "Location pending"}</small>
            </article>
          ))}
        </div>
        <div className="student-pwa-safe-state">
          <ShieldCheck />
          <span>Draft meetings, staff-only setup notes, and cross-student records are excluded.</span>
        </div>
      </section>
    </StudentPwaShell>
  );
}

function formatScheduleDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value));
}
