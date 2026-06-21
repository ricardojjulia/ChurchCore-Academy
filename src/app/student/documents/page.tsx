import { StudentDocumentsView } from "@/components/student-documents-view";
import { StudentPwaShell } from "@/components/student-pwa-shell";
import { loadStudentPwaPageModel } from "@/modules/student-pwa/server-read-model";

export const dynamic = "force-dynamic";

export default async function StudentDocumentsPage() {
  const model = await loadStudentPwaPageModel();

  return (
    <StudentPwaShell title="Documents" description="Review Academy-owned documents and requests.">
      <StudentDocumentsView model={model} />
    </StudentPwaShell>
  );
}
