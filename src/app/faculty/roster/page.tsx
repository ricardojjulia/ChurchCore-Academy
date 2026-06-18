import { redirect } from "next/navigation";
import { Users, GraduationCap } from "lucide-react";
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

export default async function FacultyRosterPage({ searchParams }: Props) {
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
      title={section ? `Roster — ${section.code}` : "Roster"}
      subtitle={section ? section.title : "Select a section from My Sections."}
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      {!section ? (
        <Card className="ops-panel">
          <CardContent>
            <div className="student-empty-state">
              <Users />
              <span>No section selected. Go to My Sections and click Roster.</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon"><Users /></div>
              <div>
                <CardTitle>{section.code} — {section.title}</CardTitle>
                <CardDescription>
                  {section.rosterCount} enrolled / {section.rosterCapacity} capacity
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {activeStudents.length === 0 ? (
              <div className="student-empty-state">
                <GraduationCap />
                <span>No active students on record yet.</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>GPA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeStudents.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.fullName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.email}</TableCell>
                      <TableCell>
                        <Badge variant={s.enrollmentStatus === "active" ? "secondary" : "outline"}>
                          {s.enrollmentStatus.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{s.gpa != null ? s.gpa.toFixed(2) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </FacultyShell>
  );
}
