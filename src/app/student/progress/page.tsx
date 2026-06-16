import { StudentProgressView } from "@/components/student-progress-view";
import { StudentPwaShell } from "@/components/student-pwa-shell";
import { loadStudentPwaPageModel } from "@/modules/student-pwa/server-read-model";

export const dynamic = "force-dynamic";

export default async function StudentProgressPage() {
  const model = await loadStudentPwaPageModel();

  return (
    <StudentPwaShell activeHref="/student/progress" title="Academic progress" description="Review released progress and completion summaries.">
      <StudentProgressView model={model} />
    </StudentPwaShell>
  );
}
