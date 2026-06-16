import { MessageSquare, ShieldCheck } from "lucide-react";
import { StudentPwaShell } from "@/components/student-pwa-shell";
import { loadStudentPwaPageModel } from "@/modules/student-pwa/server-read-model";

export const dynamic = "force-dynamic";

export default async function StudentMessagesPage() {
  const model = await loadStudentPwaPageModel();
  const messages = [
    {
      id: "welcome",
      title: `Welcome, ${model.student.displayName}`,
      body: `Your ${model.institutionName} student workspace is active. Review your released courses, schedule, progress, and documents from this portal.`,
      status: "Unread",
    },
    {
      id: "privacy",
      title: "Privacy controls available",
      body: "You can review learner intelligence consent settings at any time from Privacy controls.",
      status: "Action",
    },
  ];

  return (
    <StudentPwaShell activeHref="/student/messages" title="Messages" description="Review administrative messages and Academy action reminders.">
      <section className="student-pwa-surface" aria-labelledby="student-messages-heading">
        <div className="student-pwa-surface-heading">
          <div>
            <p>Academy reminders</p>
            <h2 id="student-messages-heading">{messages.length} messages</h2>
          </div>
          <MessageSquare />
        </div>
        <div className="student-pwa-surface-list">
          {messages.map((message) => (
            <article className="student-pwa-surface-row" key={message.id}>
              <span className="student-pwa-surface-icon">
                <MessageSquare />
              </span>
              <div>
                <strong>{message.title}</strong>
                <span>{message.body}</span>
              </div>
              <small>{message.status}</small>
            </article>
          ))}
        </div>
        <div className="student-pwa-safe-state">
          <ShieldCheck />
          <span>Messages are generated from student-visible Academy state. Staff-only workflow notes stay hidden.</span>
        </div>
      </section>
    </StudentPwaShell>
  );
}
