import { StudentPwaPlaceholder, StudentPwaShell } from "@/components/student-pwa-shell";

export default function StudentMessagesPage() {
  return (
    <StudentPwaShell activeHref="/student/messages" title="Messages" description="Review administrative messages and Academy action reminders.">
      <StudentPwaPlaceholder activeHref="/student/messages" actionLabel="Your Academy messages will appear here" />
    </StudentPwaShell>
  );
}
