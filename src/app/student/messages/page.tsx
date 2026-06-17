import { MessageSquare, ShieldCheck } from "lucide-react";
import { StudentPwaShell } from "@/components/student-pwa-shell";
import { loadStudentPwaPageModel } from "@/modules/student-pwa/server-read-model";

export const dynamic = "force-dynamic";

export default async function StudentMessagesPage() {
  // Confirm session is valid; no system-generated messages to show yet.
  await loadStudentPwaPageModel();

  return (
    <StudentPwaShell
      activeHref="/student/messages"
      title="Messages"
      description="Administrative messages and Academy action reminders."
    >
      <section className="student-pwa-surface" aria-labelledby="student-messages-heading">
        <div className="student-pwa-surface-heading">
          <div>
            <p>Academy reminders</p>
            <h2 id="student-messages-heading">No messages</h2>
          </div>
          <MessageSquare />
        </div>
        <div className="student-pwa-surface-list">
          <div className="student-pwa-empty">
            <MessageSquare />
            <p>No administrative messages at this time.</p>
            <small>
              When your institution sends enrollment confirmations, document
              requests, or deadline reminders, they will appear here.
            </small>
          </div>
        </div>
        <div className="student-pwa-safe-state">
          <ShieldCheck />
          <span>Messages are generated from student-visible Academy state. Staff-only workflow notes stay hidden.</span>
        </div>
      </section>
    </StudentPwaShell>
  );
}
