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

  const computedGrades = await withAcademyDatabaseContext(actor, async (client) => {
    try {
      return await computeSectionGrades(
        asAcademyDatabase<AssignmentGradingDatabase>(client),
        actor,
        sectionId,
      );
    } catch (error) {
      console.error("Failed to compute section grades:", error);
      return [];
    }
  });

  const finalGradeStatus = await withAcademyDatabaseContext(actor, async (client) => {
    try {
      return await getSectionFinalGradeStatus(
        asAcademyDatabase<AssignmentDatabase>(client),
        actor,
        sectionId,
      );
    } catch (error) {
      console.error("Failed to load final grade status:", error);
      return [];
    }
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
                      <TableCell className="font-medium">{grade.learnerPersonId}</TableCell>
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
