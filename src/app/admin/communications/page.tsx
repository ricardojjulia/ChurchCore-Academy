import { redirect } from "next/navigation";
import { Mail, MessageSquare, Send, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { CommunicationsActionForm } from "@/components/admin/communications-action-form";
import { CardContent } from "@/components/ui/card";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { getCurrentUser } from "@/lib/auth";
import { requireActor } from "@/lib/require-actor";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CommunicationsDatabase,
  PostgresCommunicationsRepository,
} from "@/modules/communications/postgres-repository";
import { CommunicationsService } from "@/modules/communications/service";
import type { AcademyRole } from "@/modules/academy-auth/policy";

export const dynamic = "force-dynamic";

interface RecipientRow {
  id: string;
  display_name: string;
  email: string | null;
  roles: AcademyRole[];
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default async function AdminCommunicationsPage() {
  const actor = await requireActor();
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const { messages, recipients } = await withAcademyDatabaseContext(actor, async (client) => {
    const repository = new PostgresCommunicationsRepository(
      asAcademyDatabase<CommunicationsDatabase>(client),
    );
    const service = new CommunicationsService(repository);
    const tenantMessages = await service.listTenantMessages(actor);
    const recipientResult = await client.query(
      `select
         person.id,
         person.display_name,
         person.email,
         coalesce(array_agg(role.role) filter (where role.status = 'active'), '{}'::text[]) as roles
       from academy_people person
       left join academy_person_role_assignments role
         on role.tenant_id = person.tenant_id
        and role.person_id = person.id
       where person.tenant_id = $1
         and person.person_status = 'active'
       group by person.id, person.display_name, person.email
       order by person.display_name asc`,
      [actor.tenantId],
    ) as { rows: RecipientRow[] };
    return {
      messages: tenantMessages,
      recipients: recipientResult.rows,
    };
  });

  const queued = messages.filter((message) => message.status === "queued").length;
  const failed = messages.filter((message) => message.status === "failed").length;
  const emailQueued = messages.filter((message) => message.channel === "email").length;

  return (
    <AdminShell
      eyebrow="Daily Ops"
      title="Communications"
      subtitle="Create and review workflow communications with in-app delivery and provider-safe email queue records."
      activeSection="dailyops"
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <section className="ops-stats-grid">
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Messages</div>
            <div className="ops-metric-value">{messages.length}</div>
            <div className="ops-metric-detail"><MessageSquare size={13} /> Tenant records</div>
          </CardContent>
        </div>
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Queued</div>
            <div className="ops-metric-value">{queued}</div>
            <div className="ops-metric-detail"><Send size={13} /> Awaiting review or worker</div>
          </CardContent>
        </div>
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Email queue</div>
            <div className="ops-metric-value">{emailQueued}</div>
            <div className="ops-metric-detail"><Mail size={13} /> Provider boundary</div>
          </CardContent>
        </div>
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Failures</div>
            <div className="ops-metric-value">{failed}</div>
            <div className="ops-metric-detail"><ShieldCheck size={13} /> Retry evidence</div>
          </CardContent>
        </div>
      </section>

      <div className="admin-dashboard-grid">
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Queue communication</h2>
          </div>
          <CommunicationsActionForm
            recipients={recipients.map((recipient) => ({
              id: recipient.id,
              displayName: recipient.display_name,
              email: recipient.email ?? undefined,
              roles: recipient.roles,
            }))}
          />
        </div>

        <div className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Recent messages</h2>
            <span className="sections-roster-count">{messages.length} records</span>
          </div>
          {messages.length === 0 ? (
            <p className="admin-signal-empty">No communications have been queued yet.</p>
          ) : (
            <div className="faculty-section-list">
              {messages.slice(0, 30).map((message) => (
                <div key={message.id} className="faculty-section-row">
                  <span className="faculty-section-title">{message.recipientDisplayName}</span>
                  <span className="faculty-section-roster">{message.subject}</span>
                  <span className="faculty-section-code">{statusLabel(message.channel)}</span>
                  <span className="faculty-section-code">{statusLabel(message.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
