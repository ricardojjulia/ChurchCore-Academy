import { redirect } from "next/navigation";
import { BookOpen, ClipboardCheck, GraduationCap } from "lucide-react";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { FacultyShell } from "@/components/faculty-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ section?: string }>;
}

export default async function FacultyGradebookPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  const { section: sectionId } = await searchParams;

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const { dataset } = await loadProtectedAcademyDataset();

  const section = sectionId
    ? dataset.sections.find((s) => s.id === sectionId)
    : dataset.sections[0];

  const activeStudents = dataset.students.filter(
    (s) => s.enrollmentStatus === "active" || s.enrollmentStatus === "admitted",
  );

  return (
    <FacultyShell
      eyebrow="Faculty"
      title={section ? `Gradebook — ${section.code}` : "Gradebook"}
      subtitle={
        section
          ? `${section.title} — enter grades for enrolled students.`
          : "Select a section from My Sections."
      }
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      {!section ? (
        <Card className="ops-panel">
          <CardContent>
            <div className="student-empty-state">
              <BookOpen />
              <span>No section selected. Open from My Sections or the grade entry queue.</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon"><ClipboardCheck /></div>
              <div>
                <CardTitle>{section.code} — Grade Entry</CardTitle>
                <CardDescription>
                  {activeStudents.length} student{activeStudents.length !== 1 ? "s" : ""} ·{" "}
                  {section.rosterCount} enrolled / {section.rosterCapacity} capacity
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {activeStudents.length === 0 ? (
              <div className="student-empty-state">
                <GraduationCap />
                <span>No active students to grade yet.</span>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Grade assignments are managed through the grading module. The table below
                  shows current standing per student. Use the attendance page to record
                  participation.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Credits earned</TableHead>
                      <TableHead>GPA</TableHead>
                      <TableHead>Standing</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeStudents.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.fullName}</TableCell>
                        <TableCell>
                          <Badge variant={s.enrollmentStatus === "active" ? "secondary" : "outline"}>
                            {s.enrollmentStatus.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{s.creditsEarned}</TableCell>
                        <TableCell>{s.gpa != null ? s.gpa.toFixed(2) : "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              s.statusFlag === "good_standing"
                                ? "secondary"
                                : s.statusFlag === "probation"
                                  ? "destructive"
                                  : "outline"
                            }
                          >
                            {s.statusFlag.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </FacultyShell>
  );
}
