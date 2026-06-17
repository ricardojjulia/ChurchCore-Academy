import { AdminShell } from "@/components/admin-shell";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { ClipboardCheck, BookOpen } from "lucide-react";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";

export const dynamic = "force-dynamic";

export default async function AdminAttendancePage() {
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const { dataset } = await loadProtectedAcademyDataset();
  const sections = dataset.sections;

  return (
    <AdminShell
      eyebrow="Daily Ops"
      title="Attendance"
      subtitle="Attendance records by section and student, entered by faculty."
      activeSection="dailyops"
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <div className="admin-dashboard-grid">
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <h2>
              <ClipboardCheck size={16} strokeWidth={2} aria-hidden="true" />
              Faculty Attendance Entry
            </h2>
          </div>
          <p className="admin-signal-empty">
            Faculty members enter attendance via the Faculty Portal. Records appear
            in the API once submitted.
          </p>
          <div className="sections-actions">
            <Link href="/faculty/attendance" className="faculty-grade-link">
              Open faculty attendance entry →
            </Link>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-heading">
            <h2>
              <BookOpen size={16} strokeWidth={2} aria-hidden="true" />
              Attendance by Section
            </h2>
          </div>
          {sections.length === 0 ? (
            <p className="admin-signal-empty">No sections found for this tenant.</p>
          ) : (
            <div className="sections-list">
              {sections.map((section) => (
                <div key={section.id} className="sections-actions">
                  <span className="faculty-section-code">{section.code}</span>
                  <span className="faculty-section-title">{section.title}</span>
                  <Link
                    href={`/api/academy/attendance?sectionId=${section.id}`}
                    className="faculty-grade-link"
                  >
                    View records →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
