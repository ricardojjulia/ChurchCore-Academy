import { StudentDocumentsView } from "@/components/student-documents-view";
import { StudentPwaShell } from "@/components/student-pwa-shell";
import { loadBootstrapStudentDashboard } from "@/modules/student-pwa/bootstrap-dashboard";

export default function StudentDocumentsPage() {
  const model = loadBootstrapStudentDashboard();

  return (
    <StudentPwaShell activeHref="/student/documents" title="Documents" description="Review Academy-owned documents and requests.">
      <StudentDocumentsView model={model} />
    </StudentPwaShell>
  );
}
