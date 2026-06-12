import { StudentLmsLaunchPanel } from "@/components/student-lms-launch-panel";
import { StudentPwaShell } from "@/components/student-pwa-shell";

export default function StudentLearningPage() {
  return (
    <StudentPwaShell activeHref="/student/lms" title="Course learning" description="Open available course learning spaces from an Academy-controlled launch.">
      <StudentLmsLaunchPanel />
    </StudentPwaShell>
  );
}
