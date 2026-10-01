import Link from "next/link";
import { AlertTriangle, BookOpenCheck, ClipboardList, Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { requireActor } from "@/lib/require-actor";
import { fetchAdvisingWorkspace } from "@/modules/people/advising";

export const dynamic = "force-dynamic";

export default async function AdvisingPage({ searchParams }: { searchParams: Promise<{ advisorId?: string }> }) {
  const actor = await requireActor();
  requireActor(actor, ["institution_admin", "dean", "academic_admin", "registrar", "advisor"]);
  const { advisorId } = await searchParams;
  const workspace = await withAcademyDatabaseContext(actor, (client) =>
    fetchAdvisingWorkspace(actor, advisorId, {
      async query(sql, values) {
        return await client.query(sql, values) as { rows: Record<string, unknown>[] };
      },
    }),
  );
  const urgent = workspace.advisees.filter((student) => student.riskTier === "critical" || student.riskTier === "high").length;
  const held = workspace.advisees.filter((student) => student.activeHoldCount > 0).length;

  return (
    <AdminShell activeSection="records" eyebrow="Advising" title="Advisor Caseload" subtitle="Assigned students, evidence-backed concerns, and existing record workflows.">
      {workspace.oversight && (
        <form className="mb-5 flex flex-wrap items-end gap-3" method="get">
          <label className="grid gap-1 text-sm font-medium" htmlFor="advisorId">
            Advisor
            <select id="advisorId" name="advisorId" defaultValue={workspace.selectedAdvisor?.personId ?? ""} className="h-10 min-w-64 rounded-md border border-border bg-background px-3">
              <option value="">Select an advisor</option>
              {workspace.advisors.map((advisor) => <option key={advisor.personId} value={advisor.personId}>{advisor.name} ({advisor.adviseeCount})</option>)}
            </select>
          </label>
          <Button type="submit" size="sm">View caseload</Button>
        </form>
      )}

      <section className="ops-stats-grid">
        <Metric label="Assigned students" value={workspace.advisees.length} detail={workspace.selectedAdvisor?.name ?? "No advisor selected"} icon={<Users size={14} />} />
        <Metric label="High attention" value={urgent} detail="High or critical latest risk" icon={<AlertTriangle size={14} />} />
        <Metric label="Active holds" value={held} detail="Students with unresolved holds" icon={<ClipboardList size={14} />} />
      </section>

      <Card className="ops-panel">
        <CardHeader><CardTitle>Caseload</CardTitle><CardDescription>{workspace.selectedAdvisor ? `Prioritized advising context for ${workspace.selectedAdvisor.name}.` : "Select an advisor to inspect their assigned students."}</CardDescription></CardHeader>
        <CardContent>
          {workspace.advisees.length === 0 ? <p className="text-sm text-muted-foreground">{workspace.selectedAdvisor ? "No students are currently assigned to this advisor." : "No caseload selected."}</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Program</TableHead><TableHead>Academic</TableHead><TableHead>Attention</TableHead><TableHead>Last note</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
              <TableBody>{workspace.advisees.map((student) => (
                <TableRow key={student.studentPersonId}>
                  <TableCell><div className="font-medium">{student.studentName}</div><div className="text-sm text-muted-foreground">{student.studentNumber} · {label(student.enrollmentStatus)}</div></TableCell>
                  <TableCell>{student.programName}</TableCell>
                  <TableCell>{student.gpa == null ? "No GPA" : `${student.gpa.toFixed(2)} GPA`}</TableCell>
                  <TableCell><div className="flex flex-wrap gap-1">{student.riskTier && <Badge variant={student.riskTier === "critical" || student.riskTier === "high" ? "destructive" : "outline"}>{label(student.riskTier)}{student.riskScore == null ? "" : ` ${student.riskScore}`}</Badge>}{student.activeHoldCount > 0 && <Badge variant="outline">{student.activeHoldCount} hold{student.activeHoldCount === 1 ? "" : "s"}</Badge>}{student.openSignalCount > 0 && <Badge variant="secondary">{student.openSignalCount} signal{student.openSignalCount === 1 ? "" : "s"}</Badge>}</div></TableCell>
                  <TableCell>{student.lastAdvisorNoteAt ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(student.lastAdvisorNoteAt)) : "No notes"}</TableCell>
                  <TableCell>{workspace.oversight
                    ? <Button render={<Link href={`/admin/people/students/${student.studentPersonId}`} />} variant="ghost" size="sm"><BookOpenCheck size={16} /> Open record</Button>
                    : <Button render={<Link href="/admin/workflows/watchlist" />} variant="ghost" size="sm"><BookOpenCheck size={16} /> Open signals</Button>}
                  </TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}

function Metric({ label: title, value, detail, icon }: { label: string; value: number; detail: string; icon: React.ReactNode }) {
  return <Card className="ops-metric"><CardContent><div className="ops-metric-label">{title}</div><div className="ops-metric-value">{value}</div><div className="ops-metric-detail">{icon}{detail}</div></CardContent></Card>;
}

function label(value: string) { return value.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase()); }
