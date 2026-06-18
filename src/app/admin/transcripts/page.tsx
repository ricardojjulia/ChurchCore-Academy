import { AdminShell } from "@/components/admin-shell";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";
import Link from "next/link";
import { FileText, GraduationCap } from "lucide-react";

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
  const students = dataset.students;

  return (
    <AdminShell
      eyebrow="Records"
      title="Transcript Issuance"
      subtitle="Issue official transcripts to students and recipients. All issuances are logged and tenant-scoped."
      activeSection="records"
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <div className="admin-panel transcript-info-panel">
        <div className="admin-panel-heading">
          <h2 className="sections-panel-title">
            <GraduationCap size={16} strokeWidth={2} aria-hidden="true" />
            Issuance Overview
          </h2>
        </div>
        <p className="admin-signal-empty">
          Transcripts are issued via the API. Select a student below to view their
          issuance history, or POST to{" "}
          <code className="sections-id-code">/api/academy/transcripts</code> to
          issue a new transcript.
        </p>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-heading">
          <h2 className="sections-panel-title">
            <FileText size={16} strokeWidth={2} aria-hidden="true" />
            Student Roster
          </h2>
          <span className="sections-roster-count">{students.length} students</span>
        </div>
        {students.length === 0 ? (
          <p className="admin-signal-empty">No students found for this tenant.</p>
        ) : (
          <div className="faculty-section-list">
            {students.map((student) => (
              <div key={student.id} className="faculty-section-row">
                <span className="faculty-section-code transcript-student-number">
                  {student.id.slice(0, 8)}
                </span>
                <span className="faculty-section-title">{student.fullName}</span>
                <span className="faculty-section-roster">{student.enrollmentStatus}</span>
                <Link
                  href={`/api/academy/transcripts?studentId=${student.id}`}
                  className="faculty-grade-link"
                >
                  View issuances →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Student-Facing Transcripts</h2>
        </div>
        <p className="admin-signal-empty">
          Students view their released transcripts via the Student PWA at{" "}
          <Link href="/student/documents" className="faculty-grade-link">
            /student/documents
          </Link>
          .
        </p>
      </div>
    </AdminShell>
  );
}
