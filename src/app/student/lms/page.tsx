import { StudentPwaPlaceholder, StudentPwaShell } from "@/components/student-pwa-shell";

export default function StudentLearningPage() {
  return (
    <StudentPwaShell activeHref="/student/lms" title="Course learning" description="Open available course learning spaces from an Academy-controlled launch.">
      <StudentPwaPlaceholder activeHref="/student/lms" actionLabel="Course launch is not configured yet" />
    </StudentPwaShell>
  );
}
