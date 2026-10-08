import { FacultyShell } from "@/components/faculty-shell";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { fetchSectionList, fetchSectionRosters } from "@/lib/academy-read-models";
import { sectionsForActor } from "@/lib/faculty-section-scope";
import { FacultyAttendanceForm } from "./faculty-attendance-form";

export const dynamic = "force-dynamic";

export default async function FacultyAttendancePage() {
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const actor = await requireActor();
  const { sections, rosters } = await withAcademyDatabaseContext(actor, async (client) => {
    // Only sections the attendance service will accept from this actor.
    const allSections = await fetchSectionList(actor.tenantId, client);
    const visibleSections = sectionsForActor(allSections, actor);
    // Only each section's own roster, by person id: the service records attendance only for
    // students registered in that section, and a form that listed every student in the school
    // (keyed by profile id) both exposed names and failed on save (2026-10-06 pilot dry run).
    const rosterRows = await fetchSectionRosters(actor.tenantId, visibleSections.map((s) => s.id), client);
    const rosters: Record<string, { personId: string; name: string }[]> = {};
    for (const row of rosterRows) {
      (rosters[row.courseSectionId] ??= []).push({ personId: row.studentPersonId, name: row.fullName });
    }
    return {
      sections: visibleSections.map((s) => ({ id: s.id, code: s.code, title: s.title, rosterCount: s.rosterCount })),
      rosters,
    };
  });

  return (
    <FacultyShell
      eyebrow="ChurchCore Academy"
      title="Attendance Entry"
      subtitle="Record daily attendance for your course sections."
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <FacultyAttendanceForm sections={sections} rosters={rosters} />
    </FacultyShell>
  );
}
