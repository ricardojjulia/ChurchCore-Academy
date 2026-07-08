import Link from "next/link";
import { ArrowRight, BookOpenCheck, GraduationCap, ShieldCheck, UsersRound } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import {
  PostgresAcademicProgramRepository,
  type AcademicProgramDatabase,
} from "@/modules/academic-programs/postgres-repository";
import { ProgramRowActions } from "./ProgramRowActions";

export const dynamic = "force-dynamic";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

function formatCode(value: string) {
  return value.replaceAll("_", " ");
}

export default async function ProgramsPage() {
  const actor = await requireActor();
  const { programs, enrollmentCounts } = await withAcademyDatabaseContext(actor, async (client) => {
    const repo = new PostgresAcademicProgramRepository(asAcademyDatabase<AcademicProgramDatabase>(client));
    const programs = await repo.list(actor.tenantId, {});

    const enrollmentRows = await (asAcademyDatabase<Queryable>(client)).query(
      `select academic_program_id, status, count(*) as count
         from academy_program_enrollments
        where tenant_id = $1 and academic_program_id is not null
        group by academic_program_id, status`,
      [actor.tenantId],
    );

    const counts = new Map<string, { active: number; total: number }>();
    for (const row of enrollmentRows.rows) {
      const programId = String(row.academic_program_id);
      const entry = counts.get(programId) ?? { active: 0, total: 0 };
      const rowCount = Number(row.count);
      entry.total += rowCount;
      if (row.status === "active") entry.active += rowCount;
      counts.set(programId, entry);
    }

    return { programs, enrollmentCounts: counts };
  });

  const totals = [...enrollmentCounts.values()].reduce(
    (acc, entry) => ({ active: acc.active + entry.active, total: acc.total + entry.total }),
    { active: 0, total: 0 },
  );

  return (
    <AdminShell
      activeSection="academics"
      eyebrow="Programs"
      title="Program Index"
      subtitle="Program, credential, credit requirement, and student-progress entry points for registrar and academic review."
    >
      <p className="sis-route-page-action">
        <Link href="/admin/programs/new" className="underline">Create new program →</Link>
      </p>

      <section className="sis-route-stats-grid">
        <ProgramIndexMetric label="Programs" value={programs.length} detail="Tracked academic programs" icon={<GraduationCap />} />
        <ProgramIndexMetric label="Assigned students" value={totals.total} detail="Students with program enrollments" icon={<UsersRound />} />
        <ProgramIndexMetric label="Active students" value={totals.active} detail="Current academic records" icon={<BookOpenCheck />} />
      </section>

      <Card className="sis-route-card">
        <CardHeader>
          <CardTitle>Program Readiness</CardTitle>
          <CardDescription>
            Open a program panel for graduation readiness, academic progress, and requirement review summaries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {programs.length === 0 ? (
            <div className="sis-route-empty">
              <ShieldCheck />
              <span>No programs exist for this tenant yet. Configure courses and programs before reviewing progress.</span>
              <Link href="/admin/settings/courses" className="sis-route-action-link">
                Open course settings
                <ArrowRight />
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Program</TableHead>
                  <TableHead>Credential</TableHead>
                  <TableHead>Institution Mode</TableHead>
                  <TableHead>Required credits</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programs.map((program) => {
                  const counts = enrollmentCounts.get(program.id) ?? { active: 0, total: 0 };

                  return (
                    <TableRow key={program.id}>
                      <TableCell className="whitespace-normal">
                        <Link href={`/admin/programs/${program.id}`} className="hover:underline">
                          <div className="font-medium">{program.title}</div>
                        </Link>
                        <div className="text-sm text-muted-foreground">{program.id}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {formatCode(program.credentialType)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCode(program.institutionMode)}</TableCell>
                      <TableCell>{program.requiredCredits}</TableCell>
                      <TableCell>
                        {counts.active} active / {counts.total} assigned
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/programs/${program.id}`} className="sis-route-action-link">
                          Open program
                          <ArrowRight />
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        <ProgramRowActions program={{ id: program.id, name: program.title }} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}

function ProgramIndexMetric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="sis-route-metric">
      <CardContent>
        <div className="sis-route-metric-label">{label}</div>
        <div className="sis-route-metric-value">{value}</div>
        <div className="sis-route-metric-detail">
          <span>{icon}</span>
          {detail}
        </div>
      </CardContent>
    </Card>
  );
}
