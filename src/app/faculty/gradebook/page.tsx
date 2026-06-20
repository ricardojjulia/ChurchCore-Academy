import { BookOpen, ClipboardCheck, GraduationCap } from "lucide-react";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { FacultyShell } from "@/components/faculty-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import {
  GradebookPostgresRepository,
  type GradebookDatabase,
} from "@/modules/gradebook/postgres-repository";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FacultyGradebookPage() {
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const actor = await requireActor();

  const gradebook = await withAcademyDatabaseContext(actor, async (client) => {
    const repo = new GradebookPostgresRepository(
      asAcademyDatabase<GradebookDatabase>(client),
    );
    return repo.fetchInstructorGradebook(actor.tenantId, actor.userId);
  });

  const records = gradebook.records;
  const targets = gradebook.gradingTargets ?? [];

  const studentSet = new Map<string, { name: string; graded: number; pending: number }>();
  for (const r of records) {
    const existing = studentSet.get(r.learnerPersonId) ?? { name: r.learnerDisplayName, graded: 0, pending: 0 };
    existing.graded += 1;
    studentSet.set(r.learnerPersonId, existing);
  }
  for (const t of targets) {
    const existing = studentSet.get(t.learnerPersonId) ?? { name: t.learnerDisplayName, graded: 0, pending: 0 };
    existing.pending += 1;
    studentSet.set(t.learnerPersonId, existing);
  }

  const students = [...studentSet.entries()].map(([id, v]) => ({ id, ...v }));

  return (
    <FacultyShell
      eyebrow="Grading"
      title="Gradebook"
      subtitle="Grade records for your assigned sections."
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      {records.length === 0 && targets.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="ops-empty-state">
              <BookOpen size={32} className="ops-empty-icon-inline" />
              <p className="ops-empty-copy">
                No grade records found for your sections. Grade records appear here after students submit work and grades are entered.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {targets.length > 0 && (
            <Card style={{ marginBottom: "1rem" }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck size={18} />
                  Pending Grade Entry
                  <span className="text-sm font-normal text-muted-foreground ml-1">({targets.length})</span>
                </CardTitle>
                <CardDescription>Submissions awaiting grades.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Assignment</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Max pts</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targets.map((t) => (
                      <TableRow key={t.submissionId}>
                        <TableCell className="font-medium">{t.learnerDisplayName}</TableCell>
                        <TableCell>{t.assignmentTitle}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.courseTitle}</TableCell>
                        <TableCell className="font-mono text-sm">{t.sectionCode}</TableCell>
                        <TableCell>{t.maxPoints}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{t.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {records.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap size={18} />
                  Graded Records
                  <span className="text-sm font-normal text-muted-foreground ml-1">({records.length})</span>
                </CardTitle>
                <CardDescription>
                  {students.length} student{students.length !== 1 ? "s" : ""} across your sections.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Assignment</TableHead>
                      <TableHead>Course / Section</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Passing</TableHead>
                      <TableHead>Graded</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.learnerDisplayName}</TableCell>
                        <TableCell>{r.assignmentTitle}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.courseTitle}
                          {r.sectionCode && <span className="ml-1 font-mono">· {r.sectionCode}</span>}
                        </TableCell>
                        <TableCell>
                          {r.pointsEarned !== null ? `${r.pointsEarned} / ${r.maxPoints}` : `— / ${r.maxPoints}`}
                        </TableCell>
                        <TableCell>{r.letterGrade ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={r.isPassing === true ? "secondary" : r.isPassing === false ? "destructive" : "outline"}>
                            {r.isPassing === true ? "Yes" : r.isPassing === false ? "No" : "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(r.gradedAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </FacultyShell>
  );
}
