/**
 * Faculty Gradebook Section Page — ADR-0054
 *
 * Shows assignment list for a section with "Add Assignment" button.
 * Links to individual assignment grade entry pages.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { FacultyShell } from "@/components/faculty-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  getAssignments,
  type AssignmentGradingDatabase,
} from "@/modules/grading-records/assignment-grading-service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ sectionId: string }>;
}

export default async function FacultyGradebookSectionPage({ params }: PageProps) {
  const { sectionId } = await params;
  const user = await getCurrentUser();
  const actor = await requireActor();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  // Fetch assignments for this section
  const assignments = await withAcademyDatabaseContext(actor, async (client) => {
    try {
      return await getAssignments(
        asAcademyDatabase<AssignmentGradingDatabase>(client),
        actor,
        sectionId
      );
    } catch (error) {
      console.error("Failed to fetch assignments:", error);
      return [];
    }
  });

  // Calculate total weight
  const totalWeight = assignments.reduce((sum, a) => sum + a.weight, 0);

  return (
    <FacultyShell
      eyebrow="Gradebook"
      title="Section Assignments"
      subtitle={`Manage assignments and grades for section ${sectionId}`}
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Assignments</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Total weight: {totalWeight}/100
              </p>
            </div>
            <Link href={`/faculty/gradebook/${sectionId}/assignments/new`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Assignment
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No assignments yet. Create your first assignment to get started.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Max Points</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">{assignment.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{assignment.gradingType}</Badge>
                      </TableCell>
                      <TableCell>{assignment.maxPoints}</TableCell>
                      <TableCell>{assignment.weight}%</TableCell>
                      <TableCell>
                        {assignment.dueDate
                          ? new Date(assignment.dueDate).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {assignment.locked ? (
                          <Badge variant="secondary">Locked</Badge>
                        ) : (
                          <Badge variant="default">Open</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link href={`/faculty/gradebook/${sectionId}/assignments/${assignment.id}`}>
                          <Button variant="ghost" size="sm">
                            Grade
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Link href="/faculty/gradebook">
            <Button variant="outline">Back to Gradebook</Button>
          </Link>
          {assignments.length > 0 && (
            <Link href={`/faculty/gradebook/${sectionId}/computed`}>
              <Button variant="secondary">View Computed Grades</Button>
            </Link>
          )}
        </div>
      </div>
    </FacultyShell>
  );
}
