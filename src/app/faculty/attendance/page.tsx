import { FacultyShell } from "@/components/faculty-shell";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";
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

  const { dataset } = await loadProtectedAcademyDataset();
  const sections = dataset.sections.map((s) => ({
    id: s.id,
    code: s.code,
    title: s.title,
    rosterCount: s.rosterCount,
  }));
  const students = dataset.students
    .filter((s) => s.enrollmentStatus === "active" || s.enrollmentStatus === "admitted")
    .map((s) => ({ id: s.id, name: s.fullName }));

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
