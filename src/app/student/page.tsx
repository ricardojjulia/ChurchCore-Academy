import { StudentDashboardView } from "@/components/student-dashboard-view";
import { StudentPwaShell } from "@/components/student-pwa-shell";
import { loadStudentPwaPageModel } from "@/modules/student-pwa/server-read-model";

export const dynamic = "force-dynamic";

export default async function StudentHomePage() {
  const model = await loadStudentPwaPageModel();

  return (
    <StudentPwaShell
     
      title="Student dashboard"
      description={`Released Academy records for ${model.student.displayName}.`}
    >
      <StudentDashboardView model={model} />
    </StudentPwaShell>
  );
}
