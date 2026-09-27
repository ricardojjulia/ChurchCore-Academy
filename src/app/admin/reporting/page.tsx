import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { BarChart3, Download, FileSpreadsheet, PlusCircle, ShieldCheck } from "lucide-react";
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
import type { CustomReportFilter, ReportId, ReportRowValue } from "@/modules/reporting/types";

export const dynamic = "force-dynamic";

function displayValue(value: ReportRowValue) {
  if (value == null || value === "") return "—";
  return String(value);
}

function reportingRoles() {
  return ["institution_admin", "dean", "registrar", "academic_admin", "finance"] as const;
}

function selectedColumnLabels(reportId: ReportId, selectedColumns: string[]) {
  const definition = reportDefinitions.find((item) => item.id === reportId);
  const labels = new Map((definition?.columns ?? []).map((column) => [column.key, column.label]));
  return selectedColumns.map((column) => labels.get(column) ?? column).join(", ");
}

function customReportExportHref(id: string) {
  return `/api/academy/reports?customReportId=${encodeURIComponent(id)}&format=csv`;
}

export default async function ReportingPage() {
  const actor = await requireActor();
  requireActor(actor, [...reportingRoles()]);
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  async function createCustomReportAction(formData: FormData) {
    "use server";
    const actionActor = await requireActor();
    requireActor(actionActor, [...reportingRoles()]);

    const baseReportId = String(formData.get("baseReportId") ?? "") as ReportId;
    const selectedColumns = formData.getAll("selectedColumns")
      .map((value) => String(value))
      .filter((value) => value.startsWith(`${baseReportId}:`))
      .map((value) => value.slice(baseReportId.length + 1));
    const filterColumnValue = String(formData.get("filterColumn") ?? "");
    const filterOperator = String(formData.get("filterOperator") ?? "");
    const filterValue = String(formData.get("filterValue") ?? "");
    const filters: CustomReportFilter[] = filterColumnValue.startsWith(`${baseReportId}:`) && filterOperator
      ? [{
        columnKey: filterColumnValue.slice(baseReportId.length + 1),
        operator: filterOperator === "equals" || filterOperator === "contains" ? filterOperator : "not_empty",
        value: filterOperator === "not_empty" ? undefined : filterValue,
      }]
      : [];

    await withAcademyDatabaseContext(actionActor, async (client) => {
      const repository = new PostgresReportRepository(
        asAcademyDatabase<ReportingDatabase>(client),
      );
      const service = new ReportingService(repository, repository);
      await service.createCustomReport(actionActor, {
        name: String(formData.get("name") ?? ""),
        baseReportId,
        selectedColumns,
        filters,
      });
    });
    revalidatePath("/admin/reporting");
  }

  const dashboard = await withAcademyDatabaseContext(actor, async (client) => {
    const repository = new PostgresReportRepository(
      asAcademyDatabase<ReportingDatabase>(client),
    );
    const service = new ReportingService(repository, repository);
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
            <div className="ops-icon"><PlusCircle /></div>
            <div>
              <CardTitle>Saved Custom Reports</CardTitle>
              <CardDescription>
                Save a constrained view from approved report fields, then export it as a tenant-scoped CSV.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form action={createCustomReportAction} className="ops-form">
            <div className="ops-form-row">
              <div className="ops-field">
                <label htmlFor="custom-report-name">Name</label>
                <input
                  id="custom-report-name"
                  name="name"
                  className="ops-input"
                  placeholder="Active ministry students"
                  minLength={3}
                  maxLength={80}
                  required
                />
              </div>
              <div className="ops-field">
                <label htmlFor="custom-report-base">Base report</label>
                <select id="custom-report-base" name="baseReportId" className="ops-input" required>
                  {reportDefinitions.map((definition) => (
                    <option key={definition.id} value={definition.id}>{definition.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ops-field">
              <label>Columns</label>
              <div className="admin-dashboard-grid">
                {reportDefinitions.map((definition) => (
                  <div key={definition.id} className="custom-report-column-group">
                    <strong>{definition.label}</strong>
                    <div className="custom-report-column-list">
                      {definition.columns.map((column) => (
                        <label key={column.key} className="custom-report-column-option">
                          <input
                            type="checkbox"
                            name="selectedColumns"
                            value={`${definition.id}:${column.key}`}
                          />
                          <span>{column.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ops-form-row">
              <div className="ops-field">
                <label htmlFor="custom-report-filter-column">Filter column</label>
                <select id="custom-report-filter-column" name="filterColumn" className="ops-input">
                  <option value="">No filter</option>
                  {reportDefinitions.flatMap((definition) =>
                    definition.columns.map((column) => (
                      <option key={`${definition.id}:${column.key}`} value={`${definition.id}:${column.key}`}>
                        {definition.label}: {column.label}
                      </option>
                    )),
                  )}
                </select>
              </div>
              <div className="ops-field">
                <label htmlFor="custom-report-filter-operator">Filter</label>
                <select id="custom-report-filter-operator" name="filterOperator" className="ops-input">
                  <option value="">None</option>
                  <option value="equals">Equals</option>
                  <option value="contains">Contains</option>
                  <option value="not_empty">Is not empty</option>
                </select>
              </div>
              <div className="ops-field">
                <label htmlFor="custom-report-filter-value">Value</label>
                <input id="custom-report-filter-value" name="filterValue" className="ops-input" />
              </div>
            </div>

            <div className="ops-form-actions">
              <button className="ops-btn-primary" type="submit">
                <PlusCircle size={14} />
                Save Custom Report
              </button>
            </div>
          </form>

          {dashboard.customReports.length === 0 ? (
            <p className="admin-signal-empty">No saved custom reports yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>Columns</TableHead>
                  <TableHead>Export</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.customReports.map((customReport) => {
                  const base = reportDefinitions.find((definition) => definition.id === customReport.baseReportId);
                  return (
                    <TableRow key={customReport.id}>
                      <TableCell>{customReport.name}</TableCell>
                      <TableCell>{base?.label ?? customReport.baseReportId}</TableCell>
                      <TableCell>{selectedColumnLabels(customReport.baseReportId, customReport.selectedColumns)}</TableCell>
                      <TableCell>
                        <Link className="ops-page-action-link" href={customReportExportHref(customReport.id)}>
                          Export CSV
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
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
