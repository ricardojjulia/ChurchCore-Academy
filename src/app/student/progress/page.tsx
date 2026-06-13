import { StudentPwaPlaceholder, StudentPwaShell } from "@/components/student-pwa-shell";

export default function StudentProgressPage() {
  return (
    <StudentPwaShell activeHref="/student/progress" title="Academic progress" description="Review released progress and completion summaries.">
      <StudentPwaPlaceholder activeHref="/student/progress" actionLabel="Your progress is not available yet" />
    </StudentPwaShell>
  );
}
