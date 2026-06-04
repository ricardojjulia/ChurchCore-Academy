import { StudentPwaPlaceholder, StudentPwaShell } from "@/components/student-pwa-shell";

export default function StudentCoursesPage() {
  return (
    <StudentPwaShell activeHref="/student/courses" title="Courses" description="Review your current Academy courses and sections.">
      <StudentPwaPlaceholder activeHref="/student/courses" actionLabel="Your courses will appear here" />
    </StudentPwaShell>
  );
}
