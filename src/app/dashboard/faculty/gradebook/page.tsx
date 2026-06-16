import Link from "next/link";
import { ContextualSelectionHeader, GradebookTable, GradeEntryForm, OverrideForm } from "@/components/academy/gradebook";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadGradebookPageState } from "@/modules/gradebook/page-state";
import { createGradebookPageDependencies } from "@/modules/gradebook/server-page-state";

export const dynamic = "force-dynamic";

export default async function FacultyGradebookPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; studentName?: string }>;
}) {
  const context = await searchParams;
  const state = await loadGradebookPageState(
    "instructor",
    createGradebookPageDependencies({ learnerPersonId: context.student }),
  );

  if (state.kind === "denied") {
    return <GradebookDenied badge={state.badge} message={state.message} />;
  }

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

        <section className="grid gap-4 md:grid-cols-4">
          {state.model.metrics.map((metric) => (
            <Card key={metric.label}>
              <CardHeader>
                <CardDescription>{metric.label}</CardDescription>
                <CardTitle>{metric.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{metric.detail}</p>
              </CardContent>
            </Card>
          ))}
        </section>

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
            <GradebookTable rows={state.model.records} visibilityTier="instructor" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Grade Entry Queue</CardTitle>
            <CardDescription>
              Instructor-owned submissions ready for grade entry. Ownership is checked again server-side before write.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.model.gradingTargets[0] ? (
              <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    {state.model.gradingTargets[0].assignmentTitle}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {state.model.gradingTargets[0].courseTitle} · {state.model.gradingTargets[0].sectionCode}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Learner: {state.model.gradingTargets[0].learnerDisplayName}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Status: {state.model.gradingTargets[0].status}
                  </p>
                </div>
                <GradeEntryForm
                  defaultValues={{
                    submissionId: state.model.gradingTargets[0].submissionId,
                    assignmentId: state.model.gradingTargets[0].assignmentId,
                    learnerPersonId: state.model.gradingTargets[0].learnerPersonId,
                    maxPoints: state.model.gradingTargets[0].maxPoints,
                  }}
                />
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No ungraded submissions are ready for this instructor context.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Override Workflow</CardTitle>
            <CardDescription>
              Adjust a posted grade with a mandatory reason and immutable audit evidence.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.model.records[0] ? (
              <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    {state.model.records[0].assignmentTitle}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {state.model.records[0].learnerDisplayName} · {state.model.records[0].displayGrade}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Override requests are rechecked server-side against instructor-owned sections.
                  </p>
                </div>
                <OverrideForm gradeRecordId={state.model.records[0].id} />
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No posted grades are available for override in this instructor context.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function GradebookDenied({ badge, message }: { badge: string; message: string }) {
  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardDescription>{badge}</CardDescription>
          <CardTitle>Gradebook unavailable</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </main>
  );
}
