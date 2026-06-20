import { AdminShell } from "@/components/admin-shell";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { fetchStudentRecords } from "@/lib/academy-read-models";
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
  const allStudents = await withAcademyDatabaseContext(actor, (client) =>
    fetchStudentRecords(actor.tenantId, client),
  );
  const students = allStudents.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    enrollmentStatus: s.enrollmentStatus,
  }));

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
