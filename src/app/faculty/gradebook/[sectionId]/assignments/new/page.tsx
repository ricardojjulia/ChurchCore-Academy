/**
 * New Assignment Page — ADR-0054
 *
 * The "Add Assignment" link on the section assignments page has always pointed here
 * (`/faculty/gradebook/[sectionId]/assignments/new`), but this route never existed — Next.js
 * matched "new" against the sibling `[assignmentId]` dynamic segment instead, and that page's
 * `select ... where id = $2` query crashed with "invalid input syntax for type uuid" on every
 * click. There was no way to create a gradebook assignment through the UI at all. The backend
 * (createAssignment, POST /api/academy/sections/[id]/assignments) was already fully built.
 * Found via the daily checkup's end-to-end walkthrough.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { requireActor } from "@/lib/require-actor";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { FacultyShell } from "@/components/faculty-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewAssignmentForm } from "./NewAssignmentForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ sectionId: string }>;
}

export default async function NewAssignmentPage({ params }: PageProps) {
  const { sectionId } = await params;
  const user = await getCurrentUser();
  await requireActor();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <FacultyShell
      eyebrow="Gradebook"
      title="Add Assignment"
      subtitle="Create a new gradable assignment for this section."
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Assignment Details</CardTitle>
            <CardDescription>
              Weight must not push this section&rsquo;s total assignment weight above 100%.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewAssignmentForm sectionId={sectionId} />
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
