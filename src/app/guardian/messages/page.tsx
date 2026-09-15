import { redirect } from "next/navigation";
import { MessageSquare, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { RecipientMessageCenter } from "@/components/recipient-message-center";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { getCurrentUser } from "@/lib/auth";
import { requireActor } from "@/lib/require-actor";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CommunicationsDatabase,
  PostgresCommunicationsRepository,
} from "@/modules/communications/postgres-repository";
import { CommunicationsService } from "@/modules/communications/service";

export const dynamic = "force-dynamic";

export default async function GuardianMessagesPage() {
  const actor = await requireActor();
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const messages = await withAcademyDatabaseContext(actor, async (client) => {
    const repository = new PostgresCommunicationsRepository(
      asAcademyDatabase<CommunicationsDatabase>(client),
    );
    const service = new CommunicationsService(repository);
    return service.listMyMessages(actor);
  });

  return (
    <AdminShell
      eyebrow="Guardian Portal"
      title="Guardian Messages"
      subtitle="Messages addressed to your guardian account from the Academy."
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <section className="student-pwa-surface" aria-labelledby="guardian-messages-heading">
        <div className="student-pwa-surface-heading">
          <div>
            <p>Academy reminders</p>
            <h2 id="guardian-messages-heading">Messages</h2>
          </div>
          <MessageSquare />
        </div>
        <RecipientMessageCenter initialMessages={messages} />
        <div className="student-pwa-safe-state">
          <ShieldCheck />
          <span>Guardian messages are scoped to your account and active student relationships.</span>
        </div>
      </section>
    </AdminShell>
  );
}
