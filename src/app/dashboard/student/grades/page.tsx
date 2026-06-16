import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadGradebookPageState } from "@/modules/gradebook/page-state";
import { createGradebookPageDependencies } from "@/modules/gradebook/server-page-state";

export const dynamic = "force-dynamic";

export default async function StudentGradesPage() {
  const state = await loadGradebookPageState(
    "student",
    createGradebookPageDependencies(),
  );

  if (state.kind === "denied") {
    return <GradebookDenied badge={state.badge} message={state.message} />;
  }

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto grid max-w-4xl gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">ChurchCore Academy</p>
            <h1 className="mt-2 text-3xl font-bold text-foreground">My Grades</h1>
            <p className="mt-2 text-muted-foreground">
              Growth-framed academic feedback for learning progress and formation conversations.
            </p>
          </div>
          <Link href="/" className="text-sm font-semibold text-primary hover:underline">
            Back to dashboard
          </Link>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Grade Feedback</CardTitle>
            <CardDescription>
              Student view avoids raw score framing and keeps pastoral items growth-oriented.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {state.model.records.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No posted grades yet.
              </p>
            ) : (
              state.model.records.map((record) => {
                const display = record.studentDisplay;

                return display ? (
                  <article key={record.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{record.courseTitle}</p>
                        <h2 className="mt-1 text-lg font-semibold text-foreground">{display.assignmentTitle}</h2>
                      </div>
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                        {display.displayPercentage}
                      </span>
                    </div>
                    <p className="mt-3 font-semibold text-foreground">{display.primaryLabel}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{display.contextStatement}</p>
                    {display.feedbackDisplay ? (
                      <p className="mt-3 rounded-lg bg-muted p-3 text-sm text-foreground">
                        {display.feedbackDisplay}
                      </p>
                    ) : null}
                  </article>
                ) : null;
              })
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
          <CardTitle>Grades unavailable</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </main>
  );
}
