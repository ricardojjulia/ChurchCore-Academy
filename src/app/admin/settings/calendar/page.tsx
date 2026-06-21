import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, GitBranch, Landmark, ListChecks } from "lucide-react";
import type React from "react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { AcademyCalendarRepository } from "@/modules/academic-calendar/postgres-repository";
import {
  AcademicPeriodReviewItem,
  AcademicYearReviewItem,
  CalendarReviewItem,
  CalendarReviewMetric,
  EnrollmentWindowReviewItem,
  GradingWindowReviewItem,
  SubdivisionReviewItem,
  TranscriptPeriodReviewItem,
  buildAcademicCalendarReviewModel,
} from "@/modules/academic-calendar/review-view";

type RepoPool = { query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }> };

export default async function CalendarSettingsPage() {
  const actor = await requireActor();
  const academicCalendar = await withAcademyDatabaseContext(actor, async (client) =>
    new AcademyCalendarRepository(asAcademyDatabase<RepoPool>(client)).fetchAcademicCalendarConfiguration(actor.tenantId),
  );
  const model = buildAcademicCalendarReviewModel(academicCalendar);

  return (
    <AdminShell
      activeSection="system"
      eyebrow="Academic Calendar"
      title="Calendar configuration review"
      subtitle="Read-only review for academic years, periods, windows, transcript readiness, and institution subdivisions."
    >
      <section className="ops-stats-grid">
        {model.metrics.map((metric) => (
          <CalendarMetric key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="ops-content-grid calendar-review-primary">
        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <CalendarDays />
              </div>
              <div>
                <CardTitle>Calendar Profile</CardTitle>
                <CardDescription>Tenant-level calendar rules for this faith-based institution.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="ops-list">
            {model.profile.map((item) => (
              <ReviewRow key={item.label} item={item} />
            ))}
          </CardContent>
        </Card>

        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <Landmark />
              </div>
              <div>
                <CardTitle>Academic Years</CardTitle>
                <CardDescription>Reporting years scoped to branches, schools, and institution-wide records.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="calendar-review-stack">
            {model.academicYears.map((year) => (
              <AcademicYearCard key={year.code} year={year} />
            ))}
          </CardContent>
        </Card>

        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <Clock3 />
              </div>
              <div>
                <CardTitle>Periods</CardTitle>
                <CardDescription>Terms, modules, sessions, and reporting periods tied to academic years.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="calendar-review-stack">
            {model.periods.map((period) => (
              <PeriodCard key={`${period.code}-${period.sequence}`} period={period} />
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="ops-content-grid calendar-review-secondary">
        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <ListChecks />
              </div>
              <div>
                <CardTitle>Operational Windows</CardTitle>
                <CardDescription>Enrollment, grading, and official record posting windows.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="calendar-window-grid">
            <WindowGroup title="Enrollment" items={model.enrollmentWindows} renderItem={(item) => <EnrollmentWindowRow item={item} />} />
            <WindowGroup title="Grading" items={model.gradingWindows} renderItem={(item) => <GradingWindowRow item={item} />} />
            <WindowGroup title="Official records" items={model.transcriptPeriods} renderItem={(item) => <TranscriptWindowRow item={item} />} />
          </CardContent>
        </Card>

        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <GitBranch />
              </div>
              <div>
                <CardTitle>Subdivisions</CardTitle>
                <CardDescription>Schools, grade bands, cohorts, and other branches used to scope calendars.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="calendar-subdivision-grid">
            {model.subdivisions.map((subdivision) => (
              <SubdivisionTile key={subdivision.code} subdivision={subdivision} />
            ))}
          </CardContent>
        </Card>

        <Card className="ops-panel calendar-validation-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                {model.validation.length === 0 ? <CheckCircle2 /> : <AlertTriangle />}
              </div>
              <div>
                <CardTitle>Validation Review</CardTitle>
                <CardDescription>Calendar checks for overlapping periods, windows, records, and mixed-mode branches.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="ops-list">
            {model.validation.length === 0 ? (
              <div className="ops-readiness-row">
                <span>No calendar warnings</span>
                <Badge variant="secondary">Clear</Badge>
              </div>
            ) : (
              model.validation.map((warning) => (
                <div key={warning} className="ops-list-item">
                  <div className="ops-list-icon">
                    <AlertTriangle />
                  </div>
                  <div>
                    <strong>Warning</strong>
                    <span>{warning}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </AdminShell>
  );
}

function CalendarMetric({ metric }: { metric: CalendarReviewMetric }) {
  return (
    <Card className="ops-metric">
      <CardContent>
        <div className="ops-metric-label">{metric.label}</div>
        <div className="ops-metric-value institution-metric-value">{metric.value}</div>
        <div className="ops-metric-detail">{metric.detail}</div>
      </CardContent>
    </Card>
  );
}

function ReviewRow({ item }: { item: CalendarReviewItem }) {
  return (
    <div className="ops-readiness-row">
      <span>{item.label}</span>
      <strong>{item.value}</strong>
    </div>
  );
}

function AcademicYearCard({ year }: { year: AcademicYearReviewItem }) {
  return (
    <div className="calendar-review-card">
      <div>
        <strong>{year.name}</strong>
        <span>
          {year.code} · {year.range}
        </span>
      </div>
      <div className="calendar-card-meta">
        <Badge variant="secondary">{year.status}</Badge>
        <span>{year.subdivision}</span>
        <span>{year.calendarSystem}</span>
      </div>
    </div>
  );
}

function PeriodCard({ period }: { period: AcademicPeriodReviewItem }) {
  return (
    <div className="calendar-review-card">
      <div>
        <strong>{period.name}</strong>
        <span>
          {period.code} · {period.type} · {period.range}
        </span>
      </div>
      <div className="calendar-card-meta">
        <Badge variant={period.status === "Active" ? "secondary" : "outline"}>{period.status}</Badge>
        <span>{period.academicYear}</span>
        <span>{period.subdivision}</span>
      </div>
    </div>
  );
}

function WindowGroup<T>({ title, items, renderItem }: { title: string; items: T[]; renderItem: (item: T) => React.ReactNode }) {
  return (
    <div className="calendar-window-group">
      <div className="calendar-window-heading">{title}</div>
      {items.length === 0 ? <span className="calendar-empty-state">No windows configured</span> : items.map((item, index) => <div key={index}>{renderItem(item)}</div>)}
    </div>
  );
}

function EnrollmentWindowRow({ item }: { item: EnrollmentWindowReviewItem }) {
  return (
    <div className="calendar-window-row">
      <strong>{item.type}</strong>
      <span>{item.period}</span>
      <small>{item.range}</small>
    </div>
  );
}

function GradingWindowRow({ item }: { item: GradingWindowReviewItem }) {
  return (
    <div className="calendar-window-row">
      <strong>{item.policy}</strong>
      <span>{item.period}</span>
      <small>{item.range}</small>
    </div>
  );
}

function TranscriptWindowRow({ item }: { item: TranscriptPeriodReviewItem }) {
  return (
    <div className="calendar-window-row">
      <strong>{item.recordType}</strong>
      <span>{item.period}</span>
      <small>{item.range}</small>
    </div>
  );
}

function SubdivisionTile({ subdivision }: { subdivision: SubdivisionReviewItem }) {
  return (
    <div className="calendar-subdivision-tile">
      <div>
        <strong>{subdivision.name}</strong>
        <span>{subdivision.code}</span>
      </div>
      <div className="calendar-card-meta">
        <Badge variant="outline">{subdivision.type}</Badge>
        <span>{subdivision.mode}</span>
        <span>{subdivision.parent}</span>
      </div>
    </div>
  );
}
