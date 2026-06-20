import { AdminShell } from "@/components/admin-shell";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";
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

  const { dataset } = await loadProtectedAcademyDataset();
  const students = dataset.students.map((s) => ({
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
