import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Users } from "lucide-react";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { FacultyShell } from "@/components/faculty-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";

export const dynamic = "force-dynamic";

export default async function FacultySectionsPage() {
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const { dataset } = await loadProtectedAcademyDataset();
  const sections = dataset.sections;

  return (
    <FacultyShell
      eyebrow="Faculty"
      title="My Sections"
      subtitle="All course sections assigned to you this term."
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <Card className="ops-panel">
        <CardHeader>
          <div className="ops-heading">
            <div className="ops-icon"><BookOpen /></div>
            <div>
              <CardTitle>Course Sections</CardTitle>
              <CardDescription>
                {sections.length} section{sections.length !== 1 ? "s" : ""} on record.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sections.length === 0 ? (
            <div className="student-empty-state">
              <BookOpen />
              <span>No sections found for this tenant.</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono font-medium">{s.code}</TableCell>
                    <TableCell className="whitespace-normal">{s.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.programId}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <Users size={13} />
                        {s.rosterCount}/{s.rosterCapacity}
                      </span>
                    </TableCell>
                    <TableCell>
                      {s.setupAlerts.length > 0 ? (
                        <Badge variant="destructive">Setup needed</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/faculty/roster?section=${s.id}`}
                        className="academy-action-link"
                      >
                        Roster <ArrowRight size={13} />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </FacultyShell>
  );
}
