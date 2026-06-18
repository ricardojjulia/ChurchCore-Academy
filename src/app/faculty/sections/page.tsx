import Link from "next/link";
import { BookOpen, Users } from "lucide-react";
import { FacultyShell } from "@/components/faculty-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";

export const dynamic = "force-dynamic";

interface SectionRow {
  id: string;
  section_code: string;
  course_title: string;
  delivery_mode: string;
  status: string;
  capacity: number | null;
  roster_count: number | null;
  schedule_pattern: string | null;
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

function statusVariant(status: string): "secondary" | "outline" | "destructive" {
  if (status === "open") return "secondary";
  if (status === "closed" || status === "cancelled") return "destructive";
  return "outline";
}

export default async function FacultySectionsPage() {
  const { actor } = await loadProtectedAcademyDataset();

  const sections = await withAcademyDatabaseContext(actor, async (client) => {
    const result = await client.query(
      `select
         cs.id,
         cs.section_code,
         c.title          as course_title,
         cs.delivery_mode,
         cs.status,
         cs.capacity,
         cs.roster_count,
         cs.schedule_pattern
       from academy_course_sections cs
       join academy_courses c
         on c.id        = cs.course_id
        and c.tenant_id = cs.tenant_id
       where cs.tenant_id             = $1
         and cs.primary_instructor_id = $2
       order by cs.status, cs.section_code`,
      [actor.tenantId, actor.userId],
    );
    return (result as { rows: SectionRow[] }).rows;
  });

  return (
    <FacultyShell
      eyebrow="Teaching"
      title="My Sections"
      subtitle="Sections where you are the primary instructor. Click a section to view its enrolled students."
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen size={18} />
            Assigned Sections
            <span className="text-sm font-normal text-muted-foreground ml-1">
              ({sections.length})
            </span>
          </CardTitle>
          <CardDescription>
            {sections.length === 0
              ? "No sections assigned this term."
              : "Select a section to view its roster."}
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
                  <TableHead>Delivery</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Enrollment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Roster</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((section) => (
                  <TableRow key={section.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {section.section_code}
                    </TableCell>
                    <TableCell>{section.course_title}</TableCell>
                    <TableCell className="text-sm">{deliveryLabel(section.delivery_mode)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {section.schedule_pattern ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <Users size={13} />
                        {section.roster_count ?? 0}
                        {section.capacity != null && ` / ${section.capacity}`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(section.status)}>
                        {section.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/faculty/roster?section=${section.id}`}
                        className="academy-action-link"
                      >
                        View roster →
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
