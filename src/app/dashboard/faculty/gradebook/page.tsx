import Link from "next/link";
import { redirect } from "next/navigation";
import { ContextualSelectionHeader, GradebookTable } from "@/components/academy/gradebook";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { assertGradebookWriteAccess } from "@/lib/gradebook/policy";
import { resolveAcademyActorForServerComponent } from "@/modules/academy-auth/request-context";
import type { InstructorGradeRow } from "@/types/gradebook";

export const dynamic = "force-dynamic";

const rows: InstructorGradeRow[] = [];

export default async function FacultyGradebookPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; studentName?: string }>;
}) {
  try {
    const actor = await resolveAcademyActorForServerComponent();
    assertGradebookWriteAccess(actor);
  } catch {
    redirect("/login");
  }

  const context = await searchParams;

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">ChurchCore Academy</p>
            <h1 className="mt-2 text-3xl font-bold text-foreground">Faculty Gradebook</h1>
            <p className="mt-2 text-muted-foreground">
              Submit grades, review learner progress, and prepare override requests with documented reasons.
            </p>
          </div>
          <Link href="/" className="text-sm font-semibold text-primary hover:underline">
            Back to dashboard
          </Link>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Course Grades</CardTitle>
            <CardDescription>
              Instructor view includes status, sensitivity, and behavioral signal context.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ContextualSelectionHeader
              baseHref="/dashboard/faculty/gradebook"
              studentId={context.student}
              studentName={context.studentName}
            />
            <GradebookTable rows={rows} visibilityTier="instructor" />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
