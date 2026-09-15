import { MessageSquare, ShieldCheck } from "lucide-react";
import { RecipientMessageCenter } from "@/components/recipient-message-center";
import { StudentPwaShell } from "@/components/student-pwa-shell";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { requireActor } from "@/lib/require-actor";
import {
  CommunicationsDatabase,
  PostgresCommunicationsRepository,
} from "@/modules/communications/postgres-repository";
import { CommunicationsService } from "@/modules/communications/service";

export const dynamic = "force-dynamic";

export default async function StudentMessagesPage() {
  const actor = await requireActor();
  const messages = await withAcademyDatabaseContext(actor, async (client) => {
    const repository = new PostgresCommunicationsRepository(
      asAcademyDatabase<CommunicationsDatabase>(client),
    );
    const service = new CommunicationsService(repository);
    return service.listMyMessages(actor);
  });

  return (
    <StudentPwaShell
      title="Messages"
      description="Administrative messages and Academy action reminders."
    >
      <section className="student-pwa-surface" aria-labelledby="student-messages-heading">
        <div className="student-pwa-surface-heading">
          <div>
            <p>Academy reminders</p>
            <h2 id="student-messages-heading">Messages</h2>
          </div>
          <MessageSquare />
        </div>
        <RecipientMessageCenter initialMessages={messages} />
        <div className="student-pwa-safe-state">
          <ShieldCheck />
          <span>Messages are generated from student-visible Academy state. Staff-only workflow notes stay hidden.</span>
        </div>
      </section>
    </StudentPwaShell>
  );
}
