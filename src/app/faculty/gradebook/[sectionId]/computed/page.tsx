/**
 * Faculty Computed Grades Page — ADR-0054
 *
 * Read-only weighted-grade preview across all assignments in a section.
 * Advisory only — does not post or write any record; see computeSectionGrades.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { FacultyShell } from "@/components/faculty-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  computeSectionGrades,
  type AssignmentGradingDatabase,
} from "@/modules/grading-records/assignment-grading-service";
import {
  getSectionFinalGradeStatus,
  type AssignmentDatabase,
} from "@/modules/grading-records/assignment-service";
import { SubmitFinalGradeForm } from "./SubmitFinalGradeForm";

export const dynamic = "force-dynamic";

interface PeopleNameDatabase {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Array<{ id: unknown; display_name: unknown }> }>;
}

interface PageProps {
  params: Promise<{ sectionId: string }>;
}

export default async function FacultyComputedGradesPage({ params }: PageProps) {
  const { sectionId } = await params;
  const user = await getCurrentUser();
  const actor = await requireActor();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  // Errors here (authorization, a missing section, a database outage) must reach the
  // faculty error boundary (src/app/faculty/error.tsx), not be swallowed into an empty
  // table — "no grades yet" and "the read failed" are different states, and faculty
  // acting on the former when it's actually the latter can make an incorrect grading
  // decision. Both functions already return [] on their own for the legitimate
  // no-registrations-yet case; there is nothing else worth catching here.
  const computedGrades = await withAcademyDatabaseContext(actor, async (client) =>
    await computeSectionGrades(
      asAcademyDatabase<AssignmentGradingDatabase>(client),
      actor,
      sectionId,
    ),
  );

  const finalGradeStatus = await withAcademyDatabaseContext(actor, async (client) =>
    await getSectionFinalGradeStatus(
      asAcademyDatabase<AssignmentDatabase>(client),
      actor,
      sectionId,
    ),
  );

  const learnerPersonIds = Array.from(
    new Set([
      ...computedGrades.map((grade) => grade.learnerPersonId),
      ...finalGradeStatus.map((status) => status.learnerPersonId),
    ]),
  );

  const studentNames = await withAcademyDatabaseContext(actor, async (client) => {
    if (learnerPersonIds.length === 0) return {} as Record<string, string>;
    const database = asAcademyDatabase<PeopleNameDatabase>(client);
    const result = await database.query(
      `select id, display_name
         from academy_people
        where tenant_id = $1 and id = any($2::text[])`,
      [actor.tenantId, learnerPersonIds],
    );
    return Object.fromEntries(
      result.rows.map((row) => [String(row.id), String(row.display_name)]),
    );
  });

  return (
    <FacultyShell
      eyebrow="Gradebook"
      title="Computed Grades"
      subtitle={`Weighted grade preview across all assignments for section ${sectionId}`}
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Weighted Grades</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Advisory only, based on graded assignment weight. Post a student&apos;s official grade
              from that assignment&apos;s grade entry page.
            </p>
          </CardHeader>
          <CardContent>
            {computedGrades.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No computed grades yet. Enter grades on an assignment to see weighted results here.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Weighted Grade</TableHead>
                    <TableHead>Weight Graded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {computedGrades.map((grade) => (
                    <TableRow key={grade.studentRegistrationId}>
                      <TableCell className="font-medium">
                        {studentNames[grade.learnerPersonId] ?? grade.learnerPersonId}
                      </TableCell>
                      <TableCell>{(grade.weightedPercentage * 100).toFixed(1)}%</TableCell>
                      <TableCell>{grade.totalWeightUsed}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Submit Final Grades</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              This is the section&apos;s official final grade — per ADR-0054, faculty post it manually
              using the weighted grade above as a reference, not an automatic conversion.
              Submitting marks the student&apos;s registration complete and makes it eligible for the
              registrar to post an official transcript entry from the student&apos;s record.
            </p>
          </CardHeader>
          <CardContent>
            <SubmitFinalGradeForm
              sectionId={sectionId}
              computedGrades={computedGrades}
              finalGradeStatus={finalGradeStatus}
              studentNames={studentNames}
            />
          </CardContent>
        </Card>

        <Link href={`/faculty/gradebook/${sectionId}`}>
          <Button variant="outline">Back to Assignments</Button>
        </Link>
      </div>
    </FacultyShell>
  );
}
