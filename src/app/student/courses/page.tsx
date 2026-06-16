import { BookOpen, ShieldCheck } from "lucide-react";
import { StudentPwaShell } from "@/components/student-pwa-shell";
import { loadStudentPwaPageModel } from "@/modules/student-pwa/server-read-model";

export const dynamic = "force-dynamic";

export default async function StudentCoursesPage() {
  const model = await loadStudentPwaPageModel();

  return (
    <StudentPwaShell activeHref="/student/courses" title="Courses" description="Review your current Academy courses and sections.">
      <section className="student-pwa-surface" aria-labelledby="student-courses-heading">
        <div className="student-pwa-surface-heading">
          <div>
            <p>Current study</p>
            <h2 id="student-courses-heading">{model.courses.length} released courses</h2>
          </div>
          <BookOpen />
        </div>
        <div className="student-pwa-surface-list">
          {model.courses.map((course) => (
            <article className="student-pwa-surface-row" key={course.id}>
              <span className="student-pwa-surface-icon">
                <BookOpen />
              </span>
              <div>
                <strong>{course.title}</strong>
                <span>{course.courseCode}</span>
              </div>
              <small>Current</small>
            </article>
          ))}
        </div>
        <div className="student-pwa-safe-state">
          <ShieldCheck />
          <span>Only released student-scoped course records are shown.</span>
        </div>
      </section>
    </StudentPwaShell>
  );
}
