import { redirect } from "next/navigation";
import { CalendarDays, BookOpen } from "lucide-react";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { FacultyShell } from "@/components/faculty-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";

export const dynamic = "force-dynamic";

export default async function FacultySchedulePage() {
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const { dataset } = await loadProtectedAcademyDataset();
  const sections = dataset.sections;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <FacultyShell
      eyebrow="Faculty"
      title="Schedule"
      subtitle={`${today} — your active sections this term.`}
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <Card className="ops-panel">
        <CardHeader>
          <div className="ops-heading">
            <div className="ops-icon"><CalendarDays /></div>
            <div>
              <CardTitle>This Term</CardTitle>
              <CardDescription>
                {sections.length} active section{sections.length !== 1 ? "s" : ""}.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sections.length === 0 ? (
            <div className="student-empty-state">
              <CalendarDays />
              <span>No sections scheduled for this term.</span>
            </div>
          ) : (
            <div className="faculty-section-list">
              {sections.map((s) => (
                <div key={s.id} className="faculty-section-row">
                  <span className="faculty-section-code">{s.code}</span>
                  <span className="faculty-section-title">{s.title}</span>
                  <span className="faculty-section-roster">
                    {s.rosterCount} enrolled
                  </span>
                  {s.setupAlerts.length > 0 ? (
                    <Badge variant="destructive">Setup needed</Badge>
                  ) : (
                    <Badge variant="secondary">Active</Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          {sections.length === 0 && (
            <div className="student-empty-state" style={{ marginTop: "1.5rem" }}>
              <BookOpen />
              <span>
                Schedule details will appear here once sections are configured with meeting
                times.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </FacultyShell>
  );
}
