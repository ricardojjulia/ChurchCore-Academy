import { StudentPwaPlaceholder, StudentPwaShell } from "@/components/student-pwa-shell";

export default function StudentHomePage() {
  return (
    <StudentPwaShell
      activeHref="/student"
      title="Student dashboard"
      description="Your released Academy records will appear after persistent student read models are connected."
    >
      <StudentPwaPlaceholder activeHref="/student" actionLabel="Your dashboard is not available yet" />
    </StudentPwaShell>
  );
}
