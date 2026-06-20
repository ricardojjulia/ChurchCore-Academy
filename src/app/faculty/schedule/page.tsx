import { CalendarDays } from "lucide-react";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { FacultyShell } from "@/components/faculty-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface ScheduleRow {
  id: string;
  section_code: string;
  course_title: string;
  delivery_mode: string;
  schedule_pattern: string | null;
  status: string;
  capacity: number | null;
  roster_count: number | null;
}

function deliveryLabel(mode: string) {
  const map: Record<string, string> = {
    in_person: "In Person",
    online: "Online",
    hybrid: "Hybrid",
    field_practicum: "Field Practicum",
    self_paced: "Self-Paced",
  };
  return map[mode] ?? mode.replaceAll("_", " ");
}

function statusVariant(s: string): "secondary" | "outline" | "destructive" {
  if (s === "open" || s === "scheduled") return "secondary";
  if (s === "cancelled") return "destructive";
  return "outline";
}

export default async function FacultySchedulePage() {
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const { actor } = await loadProtectedAcademyDataset();

  const sections = await withAcademyDatabaseContext(actor, async (client) => {
    const result = await client.query(
      `select
         cs.id,
         cs.section_code,
         c.title          as course_title,
         cs.delivery_mode,
         cs.schedule_pattern,
         cs.status,
         cs.capacity,
         cs.roster_count
       from academy_course_sections cs
       join academy_courses c
         on c.id        = cs.course_id
        and c.tenant_id = cs.tenant_id
       where cs.tenant_id             = $1
         and cs.primary_instructor_id = $2
       order by cs.schedule_pattern nulls last, cs.section_code`,
      [actor.tenantId, actor.userId],
    );
    return (result as { rows: ScheduleRow[] }).rows;
  });

  return (
    <FacultyShell
      eyebrow="Today"
      title="Schedule"
      subtitle="Your assigned sections for this term, sorted by schedule pattern."
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays size={18} />
            Assigned Sections
            <span className="text-sm font-normal text-muted-foreground ml-1">
              ({sections.length})
            </span>
          </CardTitle>
          <CardDescription>
            {sections.length === 0
              ? "No sections assigned this term."
              : "Schedule patterns show your recurring meeting times."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sections.length === 0 ? (
            <div className="ops-empty-state">
              <p className="ops-empty-copy">
                No sections are assigned to you this term. Contact your registrar if you expect to see sections here.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Enrollment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm font-medium">{s.section_code}</TableCell>
                    <TableCell>{s.course_title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.schedule_pattern ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{deliveryLabel(s.delivery_mode)}</TableCell>
                    <TableCell className="text-sm">
                      {s.roster_count ?? 0}
                      {s.capacity != null && ` / ${s.capacity}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
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
