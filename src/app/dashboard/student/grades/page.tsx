import Link from "next/link";
import { redirect } from "next/navigation";
import { GradeDisplayCard } from "@/components/academy/gradebook";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { assertStudentPortalAccess } from "@/modules/academy-auth/policy";
import { resolveAcademyActorForServerComponent } from "@/modules/academy-auth/request-context";
import type { GradeRecord } from "@/types/gradebook";

export const dynamic = "force-dynamic";

const records: GradeRecord[] = [];

export default async function StudentGradesPage() {
  try {
    const actor = await resolveAcademyActorForServerComponent();
    assertStudentPortalAccess(actor);
  } catch {
    redirect("/login");
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
            {records.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No posted grades yet.
              </p>
            ) : (
              records.map((record) => <GradeDisplayCard key={record.id} record={record} />)
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
