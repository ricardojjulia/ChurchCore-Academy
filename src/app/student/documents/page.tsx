import { StudentPwaPlaceholder, StudentPwaShell } from "@/components/student-pwa-shell";

export default function StudentDocumentsPage() {
  return (
    <StudentPwaShell activeHref="/student/documents" title="Documents" description="Review Academy-owned documents and requests.">
      <StudentPwaPlaceholder activeHref="/student/documents" actionLabel="Your documents are not available yet" />
    </StudentPwaShell>
  );
}
