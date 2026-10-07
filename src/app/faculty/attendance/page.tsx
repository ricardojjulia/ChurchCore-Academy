import { FacultyShell } from "@/components/faculty-shell";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { fetchSectionList, fetchStudentRecords } from "@/lib/academy-read-models";
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
  const { sections, students } = await withAcademyDatabaseContext(actor, async (client) => {
    const [allSections, allStudents] = await Promise.all([
      fetchSectionList(actor.tenantId, client),
      fetchStudentRecords(actor.tenantId, client),
    ]);
    return {
      // Only sections the attendance service will accept from this actor.
      sections: sectionsForActor(allSections, actor).map((s) => ({ id: s.id, code: s.code, title: s.title, rosterCount: s.rosterCount })),
      students: allStudents
        .filter((s) => s.enrollmentStatus === "active" || s.enrollmentStatus === "admitted")
        .map((s) => ({ id: s.id, name: s.fullName })),
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
      <FacultyAttendanceForm sections={sections} students={students} />
    </FacultyShell>
  );
}
