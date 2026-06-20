import { AdminShell } from "@/components/admin-shell";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { fetchSectionList } from "@/lib/academy-read-models";
import Link from "next/link";
import { BookOpen, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SectionsRosterPage() {
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const actor = await requireActor();
  const sections = await withAcademyDatabaseContext(actor, (client) =>
    fetchSectionList(actor.tenantId, client),
  );

  return (
    <AdminShell
      eyebrow="Academics"
      title="Sections & Roster"
      subtitle="Course sections, enrolled students, and registration status."
      activeSection="academics"
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      {sections.length === 0 ? (
        <div className="admin-panel">
          <p className="admin-signal-empty">No sections found for this tenant.</p>
        </div>
      ) : (
        <div className="sections-list">
          {sections.map((section) => (
            <div key={section.id} className="admin-panel">
              <div className="admin-panel-heading">
                <h2 className="sections-panel-title">
                  <BookOpen size={16} strokeWidth={2} aria-hidden="true" />
                  {section.code} — {section.title}
                </h2>
                <span className="sections-roster-count">
                  <Users size={13} strokeWidth={2} aria-hidden="true" />
                  {section.rosterCount}/{section.rosterCapacity} enrolled
                </span>
              </div>
              {section.setupAlerts.length > 0 && (
                <ul className="sections-alert-list">
                  {section.setupAlerts.map((alert, i) => (
                    <li key={i}>{alert}</li>
                  ))}
                </ul>
              )}
              <p className="sections-id-label">
                Section ID: <code className="sections-id-code">{section.id}</code>
              </p>
              <div className="sections-actions">
                <Link
                  href={`/api/academy/registrations?sectionId=${section.id}`}
                  className="faculty-grade-link"
                >
                  View registrations via API →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
