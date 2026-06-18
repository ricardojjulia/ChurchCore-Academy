import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, FileX2, Inbox } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { resolveAcademyActorForServerComponent } from "@/modules/academy-auth/request-context";
import {
  AdmissionsDatabase,
  PostgresAdmissionsRepository,
} from "@/modules/admissions/postgres-repository";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  submitted:     { label: "Submitted",    variant: "secondary" },
  under_review:  { label: "Under Review", variant: "default" },
};

function daysSince(iso?: string) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
}

export default async function AdmissionsDecisionsPage() {
  const actor = await resolveAcademyActorForServerComponent();

  const applications = await withAcademyDatabaseContext(actor, (client) =>
    new PostgresAdmissionsRepository(
      asAcademyDatabase<AdmissionsDatabase>(client),
    ).list(actor.tenantId),
  );

  const pending = applications.filter(
    (a) => a.status === "submitted" || a.status === "under_review",
  );
  const submitted   = pending.filter((a) => a.status === "submitted");
  const underReview = pending.filter((a) => a.status === "under_review");

  const avgDays =
    submitted.length > 0
      ? Math.round(
          submitted.reduce((sum, a) => sum + (daysSince(a.submittedAt) ?? 0), 0) /
            submitted.length,
        )
      : null;

  return (
    <AdminShell
      activeSection="admissions"
      eyebrow="Admissions"
      title="Decisions Queue"
      subtitle="Applications awaiting review or a formal admissions decision."
    >
      <section className="ops-stats-grid">
        <MetricCard label="Awaiting review" value={submitted.length} icon={<Inbox />} detail="Submitted, not yet opened" />
        <MetricCard label="Under review"    value={underReview.length} icon={<Clock />} detail="In active review" />
        <MetricCard label="Avg. days waiting" value={avgDays ?? "—"} icon={<Clock />} detail="From submission to today" />
        <MetricCard label="Total pending" value={pending.length} icon={<CheckCircle2 />} detail="Needing a decision" />
      </section>

      {pending.length === 0 ? (
        <Card className="ops-panel">
          <CardContent>
            <div className="student-empty-state">
              <FileX2 />
              <span>No applications are awaiting a decision.</span>
              <Link href="/admin/admissions" className="academy-action-link">
                View all applications <ArrowRight />
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon"><Inbox /></div>
              <div>
                <CardTitle>Pending Applications</CardTitle>
                <CardDescription>Open each application to review documents and enter a decision.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Days waiting</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((app) => {
                  const days = daysSince(app.submittedAt);
                  const badge = STATUS_BADGE[app.status];
                  return (
                    <TableRow key={app.id}>
                      <TableCell className="whitespace-normal">
                        <div className="font-medium">{app.legalName}</div>
                        <div className="text-sm text-muted-foreground">{app.email}</div>
                      </TableCell>
                      <TableCell>{app.programId}</TableCell>
                      <TableCell>
                        {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        {days !== null ? (
                          <span className={days > 14 ? "text-destructive font-medium" : ""}>{days}d</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Link href="/admin/admissions" className="academy-action-link">
                          Open <ArrowRight />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}

function MetricCard({ label, value, icon, detail }: {
  label: string; value: string | number; icon: React.ReactNode; detail: string;
}) {
  return (
    <Card className="ops-metric">
      <CardContent>
        <div className="ops-metric-label">{label}</div>
        <div className="ops-metric-value">{value}</div>
        <div className="ops-metric-detail"><span>{icon}</span>{detail}</div>
      </CardContent>
    </Card>
  );
}
