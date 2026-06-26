import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Download, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { getCurrentUser } from "@/lib/auth";
import { requireActor } from "@/lib/require-actor";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PostgresReportRepository,
  type ReportingDatabase,
} from "@/modules/reporting/postgres-repository";
import {
  IPEDS_REVIEW_DISCLAIMER,
  ReportingService,
  reportDefinitions,
} from "@/modules/reporting/service";
import type { ReportRowValue } from "@/modules/reporting/types";

export const dynamic = "force-dynamic";

function displayValue(value: ReportRowValue) {
  if (value == null || value === "") return "—";
  return String(value);
}

export default async function ReportingPage() {
  const actor = await requireActor();
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const dashboard = await withAcademyDatabaseContext(actor, async (client) => {
    const repository = new PostgresReportRepository(
      asAcademyDatabase<ReportingDatabase>(client),
    );
    const service = new ReportingService(repository);
    return service.readDashboard(actor);
  });

  return (
    <AdminShell
      eyebrow="Reports"
      title="Reporting And Exports"
      subtitle="Tenant-scoped operational exports for administrators, board reporting, and accreditation preparation."
      activeSection="reports"
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <section className="ops-stats-grid">
        {dashboard.cards.map((card) => (
          <div key={card.label} className="ops-metric">
            <CardContent>
              <div className="ops-metric-label">{card.label}</div>
              <div className="ops-metric-value">{card.value}</div>
              <div className="ops-metric-detail"><BarChart3 size={13} /> {card.detail}</div>
            </CardContent>
          </div>
        ))}
      </section>

      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon"><ShieldCheck /></div>
            <div>
              <CardTitle>Export Boundary</CardTitle>
              <CardDescription>
                These CSV files are ATS/IPEDS-ready foundations, not certified regulatory filings.
                Tenant scope comes from the verified session, not URL input.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon"><ShieldCheck /></div>
            <div>
              <CardTitle>IPEDS-formatted Export</CardTitle>
              <CardDescription>{IPEDS_REVIEW_DISCLAIMER}</CardDescription>
            </div>
          </div>
          <Link
            className="ops-btn-primary"
            href="/api/academy/reporting/ipeds?format=csv"
          >
            <Download size={14} />
            Export IPEDS Review CSV
          </Link>
        </CardHeader>
        <CardContent>
          <p className="admin-signal-empty">
            Configure UNITID, full-time credit thresholds, and program CIP codes in compliance settings before submission review.
          </p>
          <Link href="/admin/settings/compliance" className="ops-page-action-link">
            Open compliance settings →
          </Link>
        </CardContent>
      </Card>

      <div className="admin-dashboard-grid">
        {reportDefinitions.map((definition) => {
          const section = dashboard.reports[definition.id];
          const previewRows = section.rows.slice(0, 5);
          return (
            <Card key={definition.id} className="ops-panel">
              <CardHeader className="ops-card-header">
                <div className="ops-heading">
                  <div className="ops-icon"><FileSpreadsheet /></div>
                  <div>
                    <CardTitle>{definition.label}</CardTitle>
                    <CardDescription>{definition.description}</CardDescription>
                  </div>
                </div>
                <Link
                  className="ops-btn-primary"
                  href={`/api/academy/reports?report=${definition.id}&format=csv`}
                >
                  <Download size={14} />
                  Export CSV
                </Link>
              </CardHeader>
              <CardContent>
                {previewRows.length === 0 ? (
                  <p className="admin-signal-empty">No rows available for this report yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {definition.columns.slice(0, 4).map((column) => (
                          <TableHead key={column.key}>{column.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, index) => (
                        <TableRow key={`${definition.id}-${index}`}>
                          {definition.columns.slice(0, 4).map((column) => (
                            <TableCell key={column.key}>
                              {displayValue(row[column.key])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AdminShell>
  );
}
