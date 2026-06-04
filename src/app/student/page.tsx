import { StudentDashboardView } from "@/components/student-dashboard-view";
import { StudentPwaShell } from "@/components/student-pwa-shell";
import { loadBootstrapStudentDashboard } from "@/modules/student-pwa/bootstrap-dashboard";

export default function StudentHomePage() {
  const model = loadBootstrapStudentDashboard();

  return (
    <StudentPwaShell
      activeHref="/student"
      title={`Welcome, ${model.student.displayName}`}
      description={`${model.institutionName} · ${model.student.studentNumber} · ${formatLabel(model.student.enrollmentStatus)}`}
    >
      <StudentDashboardView model={model} />
    </StudentPwaShell>
  );
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}
