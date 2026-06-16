import Link from "next/link";
import { ContextualSelectionHeader, GradebookTable } from "@/components/academy/gradebook";
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
