/**
 * Faculty Assignment Grade Entry Page — ADR-0054
 *
 * Grade entry grid for individual assignment.
 * Faculty can enter points for each student and submit grades in bulk.
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { FacultyShell } from "@/components/faculty-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AssignmentGradeEntryForm } from "./AssignmentGradeEntryForm";
import {
  getAssignments,
  getAssignmentGrades,
  type AssignmentGradingDatabase,
} from "@/modules/grading-records/assignment-grading-service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ sectionId: string; assignmentId: string }>;
}

export default async function FacultyAssignmentGradePage({ params }: PageProps) {
  const { sectionId, assignmentId } = await params;
  const user = await getCurrentUser();
  const actor = await requireActor();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  // Fetch assignment details and existing grades
  const [assignments, grades] = await withAcademyDatabaseContext(actor, async (client) => {
    const db = asAcademyDatabase<AssignmentGradingDatabase>(client);
    return Promise.all([
      getAssignments(db, actor, sectionId),
      getAssignmentGrades(db, actor, assignmentId),
    ]);
  });

  const assignment = assignments.find((a) => a.id === assignmentId);
  if (!assignment) {
    notFound();
  }

  return (
    <FacultyShell
      eyebrow="Gradebook"
      title={assignment.title}
      subtitle={`Grade entry for ${assignment.gradingType} assignment`}
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Assignment Details</CardTitle>
                <CardDescription>{assignment.description}</CardDescription>
              </div>
              {assignment.locked && (
                <Badge variant="secondary">Locked</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Max Points:</span>{" "}
                <span className="font-medium">{assignment.maxPoints}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Weight:</span>{" "}
                <span className="font-medium">{assignment.weight}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Grading Type:</span>{" "}
                <span className="font-medium">{assignment.gradingType}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Due Date:</span>{" "}
                <span className="font-medium">
                  {assignment.dueDate
                    ? new Date(assignment.dueDate).toLocaleDateString()
                    : "No due date"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Grade Entry</CardTitle>
            <CardDescription>
              Enter grades for each student. Click &ldquo;Save Grades&rdquo; when done.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AssignmentGradeEntryForm
              sectionId={sectionId}
              assignmentId={assignmentId}
              assignment={assignment}
              grades={grades}
            />
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Link href={`/faculty/gradebook/${sectionId}`}>
            <Button variant="outline">Back to Assignments</Button>
          </Link>
        </div>
      </div>
    </FacultyShell>
  );
}
