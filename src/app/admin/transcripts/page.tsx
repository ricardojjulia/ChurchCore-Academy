import { AdminShell } from "@/components/admin-shell";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { TranscriptIssuanceForm } from "@/components/admin/transcript-issuance-form";

export const dynamic = "force-dynamic";

export default async function TranscriptsPage() {
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const actor = await requireActor();
  const students = await withAcademyDatabaseContext(actor, async (client) => {
    const result = await client.query(
      `select
         sp.person_id as id,
         p.display_name as full_name,
         sp.enrollment_status
       from academy_student_profiles sp
       join academy_people p
         on p.tenant_id = sp.tenant_id
        and p.id = sp.person_id
       where sp.tenant_id = $1
       order by sp.student_number asc`,
      [actor.tenantId],
    );

    return (result as { rows: Record<string, unknown>[] }).rows.map((row) => ({
      id: String(row.id),
      fullName: String(row.full_name),
      enrollmentStatus: String(row.enrollment_status),
    }));
  });

  return (
    <AdminShell
      eyebrow="Records"
      title="Transcript Issuance"
      subtitle="Issue official transcripts to students and recipients. All issuances are logged and tenant-scoped."
      activeSection="records"
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <TranscriptIssuanceForm students={students} />
    </AdminShell>
  );
}
