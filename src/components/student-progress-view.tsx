import { CheckCircle2, GraduationCap, ShieldCheck } from "lucide-react";
import { StudentDashboardReadModel } from "@/modules/student-pwa/dashboard-read-model";

export function StudentProgressView({ model }: { model: StudentDashboardReadModel }) {
  return (
    <section className="student-pwa-surface" aria-labelledby="student-progress-heading">
      <div className="student-pwa-surface-heading">
        <div>
          <p>Released academic records</p>
          <h2 id="student-progress-heading">{model.progress.length} progress updates</h2>
        </div>
        <GraduationCap />
      </div>

      <div className="student-pwa-progress-grid">
        {model.progress.map((item) => (
          <article className="student-pwa-progress-card" key={item.id}>
            <div className="student-pwa-progress-label">
              <CheckCircle2 />
              <span>{item.category === "grades" ? "Released grade" : "Progress"}</span>
            </div>
            <h3>{item.label}</h3>
            <p>{item.value}</p>
          </article>
        ))}
      </div>

      <div className="student-pwa-safe-state">
        <ShieldCheck />
        <span>Draft and held academic records are excluded before this page renders.</span>
      </div>
    </section>
  );
}
