import { StudentPwaPlaceholder, StudentPwaShell } from "@/components/student-pwa-shell";

export default function StudentSchedulePage() {
  return (
    <StudentPwaShell activeHref="/student/schedule" title="Schedule" description="Review released meetings, dates, and academic windows.">
      <StudentPwaPlaceholder activeHref="/student/schedule" actionLabel="Your schedule will appear here" />
    </StudentPwaShell>
  );
}
