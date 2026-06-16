import Link from "next/link";
import { redirect } from "next/navigation";
import {
  GradebookTable,
  OverrideAuditLog,
} from "@/components/academy/gradebook";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { assertGradebookAdminAccess } from "@/lib/gradebook/policy";
import { resolveAcademyActorForServerComponent } from "@/modules/academy-auth/request-context";
import type { InstructorGradeRow } from "@/types/gradebook";

export const dynamic = "force-dynamic";

const rows: InstructorGradeRow[] = [];

export default async function AdminGradebookPage() {
  try {
    const actor = await resolveAcademyActorForServerComponent();
    assertGradebookAdminAccess(actor);
  } catch {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">ChurchCore Academy</p>
            <h1 className="mt-2 text-3xl font-bold text-foreground">Gradebook Administration</h1>
            <p className="mt-2 text-muted-foreground">
              Govern grade records, overrides, audit evidence, and sensitivity controls.
            </p>
          </div>
          <Link href="/" className="text-sm font-semibold text-primary hover:underline">
            Back to dashboard
          </Link>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Institution Gradebook</CardTitle>
            <CardDescription>
              Admin view includes audit-sensitive operational columns. Data wiring follows the Phase 1 schema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GradebookTable rows={rows} visibilityTier="admin" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Override Audit</CardTitle>
            <CardDescription>Append-only override evidence for review and accreditation.</CardDescription>
          </CardHeader>
          <CardContent>
            <OverrideAuditLog entries={[]} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
