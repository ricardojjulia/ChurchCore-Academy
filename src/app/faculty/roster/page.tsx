import Link from "next/link";
import { GraduationCap, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { FacultyShell } from "@/components/faculty-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";

export const dynamic = "force-dynamic";

interface SectionMeta {
  section_code: string;
  course_title: string;
  capacity: number | null;
  roster_count: number | null;
  primary_instructor_id: string;
}

interface RosterRow {
  student_person_id: string;
  display_name: string;
  email: string;
  status: string;
  registered_at: string;
}

function statusVariant(status: string): "secondary" | "outline" | "destructive" {
  if (status === "registered") return "secondary";
  if (status === "withdrawn" || status === "waitlisted") return "outline";
  if (status === "completed") return "outline";
  return "outline";
}

interface Props {
  searchParams: Promise<{ section?: string }>;
}

export default async function FacultyRosterPage({ searchParams }: Props) {
  const { section: sectionId } = await searchParams;
  const actor = await requireActor();

  // No section selected — show prompt
  if (!sectionId) {
    return (
      <FacultyShell eyebrow="Teaching" title="Roster">
        <Card>
          <CardContent className="pt-6">
            <div className="ops-empty-state">
              <p className="ops-empty-copy">
                No section selected.{" "}
                <Link href="/faculty/sections" className="academy-action-link">
                  Go to My Sections
                </Link>{" "}
                and click &ldquo;View roster →&rdquo; for the section you want to see.
              </p>
            </div>
          </CardContent>
        </Card>
      </FacultyShell>
    );
  }

  const { meta, roster } = await withAcademyDatabaseContext(actor, async (client) => {
    // Verify section exists in this tenant
    const metaResult = await client.query(
      `select
         cs.section_code,
         c.title             as course_title,
         cs.capacity,
         cs.roster_count,
         cs.primary_instructor_id
       from academy_course_sections cs
       join academy_courses c
         on c.id        = cs.course_id
        and c.tenant_id = cs.tenant_id
       where cs.id         = $1
         and cs.tenant_id  = $2`,
      [sectionId, actor.tenantId],
    );
    const sectionMeta = (metaResult as { rows: SectionMeta[] }).rows[0];

    // Section doesn't exist in this tenant — 404
    if (!sectionMeta) return { meta: null, roster: [] };

    // Faculty can only view their own sections
    if (sectionMeta.primary_instructor_id !== actor.userId) return { meta: null, roster: [] };

    const rosterResult = await client.query(
      `select
         r.student_person_id,
         p.display_name,
         p.email,
         r.status,
         r.registered_at::text
       from academy_course_section_registrations r
       join academy_people p
         on p.id         = r.student_person_id
        and p.tenant_id  = r.tenant_id
       where r.course_section_id = $1
         and r.tenant_id         = $2
       order by p.display_name`,
      [sectionId, actor.tenantId],
    );
    return {
      meta: sectionMeta,
      roster: (rosterResult as { rows: RosterRow[] }).rows,
    };
  });

  // Not found or not the instructor — 404 (no information leakage)
  if (!meta) return notFound();

  return (
    <FacultyShell
      eyebrow="Teaching"
      title={`Roster — ${meta.section_code}`}
      subtitle={meta.course_title}
    >
      <div style={{ marginBottom: "0.75rem" }}>
        <Link href="/faculty/sections" className="ops-page-action-link">
          ← Back to My Sections
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={18} />
            {meta.section_code} — {meta.course_title}
          </CardTitle>
          <CardDescription>
            {roster.length} registered
            {meta.capacity != null && ` · capacity ${meta.capacity}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roster.length === 0 ? (
            <div className="ops-empty-state">
              <GraduationCap size={32} className="ops-empty-icon-inline" />
              <p className="ops-empty-copy">No students registered for this section yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.map((row) => (
                  <TableRow key={row.student_person_id}>
                    <TableCell className="font-medium">{row.display_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.email}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row.status)}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(row.registered_at).toLocaleDateString()}
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
