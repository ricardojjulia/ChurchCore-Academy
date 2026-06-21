import { StudentConsentControls } from "@/components/student-consent-controls";
import { StudentPwaShell } from "@/components/student-pwa-shell";

export default function StudentPrivacyPage() {
  return (
    <StudentPwaShell
     
      title="Privacy controls"
      description="Choose which learner intelligence features may use your Academy activity."
    >
      <StudentConsentControls />
    </StudentPwaShell>
  );
}
