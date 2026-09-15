"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type {
  PeopleReviewModel,
  PeopleReviewMetric,
  PeopleReviewItem,
  PeopleCoverageReviewItem,
  StudentReviewItem,
  StaffReviewItem,
  RelationshipReviewItem,
  AccountLinkReviewItem,
} from "@/modules/people/review-view";

export function PeopleMetricTiles({ model }: { model: PeopleReviewModel }) {
  const [m0, m1, m2, m3] = model.metrics;
  return (
    <>
      <PeopleTile
        metric={m0}
        profile={model.profile}
        roleCoverage={model.roleCoverage}
        statusCoverage={model.statusCoverage}
        accountLinks={model.accountLinks}
      />
      <StudentsTile metric={m1} students={model.students} />
      <StaffTile metric={m2} staff={model.staff} />
      <GuardiansTile metric={m3} relationships={model.relationships} />
      <PeopleValidationTile validationCount={model.validation.length} validation={model.validation} />
    </>
  );
}

function MetricTileShell({
  metric,
  onClick,
  children,
}: {
  metric: PeopleReviewMetric;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className="ops-metric-link" aria-label={`${metric.label} — view details`}>
      <Card className="ops-metric">
        <CardContent>
          <div className="ops-metric-inner">
            <div className="ops-metric-label">{metric.label}</div>
            <div className="ops-metric-value institution-metric-value">{metric.value}</div>
            <div className="ops-metric-detail">{children ?? metric.detail}</div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function PeopleTile({
  metric,
  profile,
  roleCoverage,
  statusCoverage,
  accountLinks,
}: {
  metric: PeopleReviewMetric;
  profile: PeopleReviewItem[];
  roleCoverage: PeopleCoverageReviewItem[];
  statusCoverage: PeopleCoverageReviewItem[];
  accountLinks: AccountLinkReviewItem[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <MetricTileShell metric={metric} onClick={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] w-[min(94vw,52rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>People Directory</DialogTitle>
            <DialogDescription>Tenant profile, role coverage, and account links.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6">
            <section>
              <h3 className="mb-3 text-sm font-semibold text-foreground">Tenant Profile</h3>
              <div className="ops-list">
                {profile.map((item) => (
                  <div key={item.label} className="ops-readiness-row">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h3 className="mb-3 text-sm font-semibold text-foreground">Role Coverage</h3>
              <div className="people-coverage-grid">
                <CoverageGroup title="Active roles" items={roleCoverage} />
                <CoverageGroup title="Person status" items={statusCoverage} />
              </div>
            </section>
            {accountLinks.length > 0 && (
              <section>
                <h3 className="mb-3 text-sm font-semibold text-foreground">Account Links</h3>
                <div className="ops-list">
                  {accountLinks.map((link) => (
                    <div key={link.id} className="ops-readiness-row">
                      <span>{link.person} · {link.provider}</span>
                      <Badge variant="outline">{link.status}</Badge>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StudentsTile({ metric, students }: { metric: PeopleReviewMetric; students: StudentReviewItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <MetricTileShell metric={metric} onClick={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] w-[min(94vw,52rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Students</DialogTitle>
            <DialogDescription>Student profiles, enrollment status, and guardian links.</DialogDescription>
          </DialogHeader>
          <div className="people-review-stack">
            {students.map((student) => (
              <div key={student.id} className="people-review-card">
                <div>
                  <strong>{student.displayName}</strong>
                  <span>{student.studentNumber} · {student.studentType}</span>
                </div>
                <div className="people-card-meta">
                  <Badge variant="secondary">{student.enrollmentStatus}</Badge>
                  <Badge variant={student.guardianStatus === "Guardian linked" ? "secondary" : "outline"}>
                    {student.guardianStatus}
                  </Badge>
                </div>
                <div className="people-detail-grid">
                  <DetailRow label="Subdivision" value={student.subdivision} />
                  <DetailRow label="Grade band" value={student.gradeBand} />
                  <DetailRow label="Advisor" value={student.advisor} />
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StaffTile({ metric, staff }: { metric: PeopleReviewMetric; staff: StaffReviewItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <MetricTileShell metric={metric} onClick={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] w-[min(94vw,52rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Faculty and Staff</DialogTitle>
            <DialogDescription>Instructional and administrative profiles.</DialogDescription>
          </DialogHeader>
          <div className="people-card-grid">
            {staff.map((member) => (
              <div key={member.id} className="people-review-card">
                <div>
                  <strong>{member.displayName}</strong>
                  <span>{member.staffNumber} · {member.title}</span>
                </div>
                <div className="people-card-meta">
                  <Badge variant="secondary">{member.primaryRole}</Badge>
                  <span>{member.employmentStatus}</span>
                </div>
                <div className="people-detail-grid">
                  <DetailRow label="Subdivision" value={member.subdivision} />
                  <DetailRow label="Load policy" value={member.loadPolicy} />
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function GuardiansTile({
  metric,
  relationships,
}: {
  metric: PeopleReviewMetric;
  relationships: RelationshipReviewItem[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <MetricTileShell metric={metric} onClick={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] w-[min(94vw,48rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Guardians and Relationships</DialogTitle>
            <DialogDescription>Guardian, advisor, and staff visibility rules for student records.</DialogDescription>
          </DialogHeader>
          <div className="people-review-stack">
            {relationships.length === 0 ? (
              <div className="ops-readiness-row">
                <span>No relationships on record</span>
                <Badge variant="outline">None</Badge>
              </div>
            ) : (
              relationships.map((rel) => (
                <div key={rel.id} className="people-review-card">
                  <div>
                    <strong>{rel.relatedPerson}</strong>
                    <span>{rel.relationshipType} for {rel.student}</span>
                  </div>
                  <div className="people-card-meta">
                    <Badge variant="outline">{rel.visibility}</Badge>
                    <span>{rel.authority}</span>
                    <span>{rel.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PeopleValidationTile({
  validationCount,
  validation,
}: {
  validationCount: number;
  validation: string[];
}) {
  const [open, setOpen] = useState(false);
  const isClear = validationCount === 0;
  const metric: PeopleReviewMetric = {
    label: "Validation",
    value: isClear ? "Clear" : String(validationCount),
    detail: isClear ? "No warnings" : "Warnings found",
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ops-metric-link"
        aria-label="Validation — view details"
      >
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-inner">
              <div className="ops-metric-label">{metric.label}</div>
              <div className="ops-metric-value institution-metric-value">{metric.value}</div>
              <div className="ops-metric-detail">
                <span>{isClear ? <CheckCircle2 /> : <AlertTriangle />}</span>
                {metric.detail}
              </div>
            </div>
          </CardContent>
        </Card>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] w-[min(94vw,48rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>People Validation</DialogTitle>
            <DialogDescription>Tenant, guardian, advisor, staff, and account-link privacy checks.</DialogDescription>
          </DialogHeader>
          <div className="ops-list">
            {isClear ? (
              <div className="ops-readiness-row">
                <span>No people warnings</span>
                <Badge variant="secondary">Clear</Badge>
              </div>
            ) : (
              validation.map((warning) => (
                <div key={warning} className="ops-list-item">
                  <div className="ops-list-icon"><AlertTriangle /></div>
                  <div>
                    <strong>Warning</strong>
                    <span>{warning}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CoverageGroup({ title, items }: { title: string; items: PeopleCoverageReviewItem[] }) {
  return (
    <div className="people-coverage-group">
      <div className="people-section-heading">{title}</div>
      {items.map((item) => (
        <div key={item.label} className="people-coverage-row">
          <span>{item.label}</span>
          <Badge variant="secondary">{item.count}</Badge>
        </div>
      ))}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="people-detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
