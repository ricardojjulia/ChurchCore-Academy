import { StudentProgressView } from "@/components/student-progress-view";
import { StudentPwaShell } from "@/components/student-pwa-shell";
import { loadBootstrapStudentDashboard } from "@/modules/student-pwa/bootstrap-dashboard";

export default function StudentProgressPage() {
  const model = loadBootstrapStudentDashboard();

  return (
    <StudentPwaShell activeHref="/student/progress" title="Academic progress" description="Review released progress and completion summaries.">
      <StudentProgressView model={model} />
    </StudentPwaShell>
  );
}
