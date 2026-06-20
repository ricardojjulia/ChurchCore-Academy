import Link from "next/link";
import { AlertTriangle, CheckCircle2, IdCard, Link2, ShieldCheck, UserRoundCheck, UsersRound } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StaffInviteForm } from "@/components/staff-invite-form";
import { RoleAssignmentForm } from "@/components/role-assignment-form";
import { AcademyPeopleRepository } from "@/modules/people/postgres-repository";
import { loadPeopleReviewModel } from "@/modules/people/review-loader";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import {
  AccountLinkReviewItem,
  PeopleCoverageReviewItem,
  PeopleReviewItem,
  PeopleReviewMetric,
  PeopleReviewModel,
  RelationshipReviewItem,
  StaffReviewItem,
  StudentReviewItem,
} from "@/modules/people/review-view";

export const dynamic = "force-dynamic";

interface PersonRow {
  id: string;
  display_name: string;
  email: string;
}

export default async function PeopleSettingsPage() {
  const actor = await requireActor();
  const [model, people] = await Promise.all([
    loadPeopleReviewModel(new AcademyPeopleRepository(), actor.tenantId),
    withAcademyDatabaseContext(actor, async (client) => {
      const result = await client.query(
        `select id, display_name, email from academy_people
          where tenant_id = $1 and person_status = 'active'
          order by display_name`,
        [actor.tenantId],
      ) as { rows: PersonRow[] };
      return result.rows;
    }),
  ]);

  return (
    <AdminShell
      activeSection="system"
      eyebrow="People And Roles"
      title="People and role review"
      subtitle="Read-only review for students, guardians, faculty, staff, role coverage, account links, and privacy validation."
    >
      <p className="ops-page-action-link">
        <Link href="/admin/staff" className="underline">View staff directory →</Link>
      </p>

      <section className="ops-stats-grid">
        {model.metrics.map((metric) => (
          <PeopleMetric key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="ops-content-grid people-review-primary">
        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <UsersRound />
              </div>
              <div>
                <CardTitle>People Profile</CardTitle>
                <CardDescription>Tenant-level people rules, portals, and guardian posture.</CardDescription>
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
                <ShieldCheck />
              </div>
              <div>
                <CardTitle>Role Coverage</CardTitle>
                <CardDescription>Active role assignments that drive API and future PWA access boundaries.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="people-coverage-grid">
            <CoverageGroup title="Active roles" items={model.roleCoverage} />
            <CoverageGroup title="Person status" items={model.statusCoverage} />
          </CardContent>
        </Card>

        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <IdCard />
              </div>
              <div>
                <CardTitle>Students</CardTitle>
                <CardDescription>Student profile readiness for children&apos;s school, Bible school, college, and university modes.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="people-review-stack">
            {model.students.map((student) => (
              <StudentCard key={student.id} student={student} />
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="ops-content-grid people-review-secondary">
        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <UserRoundCheck />
              </div>
              <div>
                <CardTitle>Faculty And Staff</CardTitle>
                <CardDescription>Instructional and administrative profiles with primary role and load posture.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="people-card-grid">
            {model.staff.map((staff) => (
              <StaffCard key={staff.id} staff={staff} />
            ))}
          </CardContent>
        </Card>

        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <UsersRound />
              </div>
              <div>
                <CardTitle>Relationships</CardTitle>
                <CardDescription>Guardian, advisor, and assigned-staff visibility rules for student records.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="people-review-stack">
            {model.relationships.map((relationship) => (
              <RelationshipCard key={relationship.id} relationship={relationship} />
            ))}
          </CardContent>
        </Card>

        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon">
                <Link2 />
              </div>
              <div>
                <CardTitle>Account Links</CardTitle>
                <CardDescription>Provider-neutral identity references without storing LMS or auth credentials.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="people-review-stack">
            {model.accountLinks.map((accountLink) => (
              <AccountLinkCard key={accountLink.id} accountLink={accountLink} />
            ))}
          </CardContent>
        </Card>

        <ValidationPanel model={model} />
      </section>

      <StaffInviteForm />

      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon"><UserRoundCheck /></div>
            <div>
              <CardTitle>Assign Role</CardTitle>
              <CardDescription>Add a role assignment to an existing person in this institution.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <RoleAssignmentForm
            people={people.map((p) => ({
              id: p.id,
              displayName: p.display_name,
              email: p.email,
            }))}
          />
        </CardContent>
      </Card>
    </AdminShell>
  );
}

function PeopleMetric({ metric }: { metric: PeopleReviewMetric }) {
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

function ReviewRow({ item }: { item: PeopleReviewItem }) {
  return (
    <div className="ops-readiness-row">
      <span>{item.label}</span>
      <strong>{item.value}</strong>
    </div>
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

function StudentCard({ student }: { student: StudentReviewItem }) {
  return (
    <div className="people-review-card">
      <div>
        <strong>{student.displayName}</strong>
        <span>
          {student.studentNumber} · {student.studentType}
        </span>
      </div>
      <div className="people-card-meta">
        <Badge variant="secondary">{student.enrollmentStatus}</Badge>
        <Badge variant={student.guardianStatus === "Guardian linked" ? "secondary" : "outline"}>{student.guardianStatus}</Badge>
      </div>
      <div className="people-detail-grid">
        <Detail label="Subdivision" value={student.subdivision} />
        <Detail label="Grade band" value={student.gradeBand} />
        <Detail label="Advisor" value={student.advisor} />
      </div>
    </div>
  );
}

function StaffCard({ staff }: { staff: StaffReviewItem }) {
  return (
    <div className="people-review-card">
      <div>
        <strong>{staff.displayName}</strong>
        <span>
          {staff.staffNumber} · {staff.title}
        </span>
      </div>
      <div className="people-card-meta">
        <Badge variant="secondary">{staff.primaryRole}</Badge>
        <span>{staff.employmentStatus}</span>
      </div>
      <div className="people-detail-grid">
        <Detail label="Subdivision" value={staff.subdivision} />
        <Detail label="Load policy" value={staff.loadPolicy} />
      </div>
    </div>
  );
}

function RelationshipCard({ relationship }: { relationship: RelationshipReviewItem }) {
  return (
    <div className="people-review-card">
      <div>
        <strong>{relationship.relatedPerson}</strong>
        <span>
          {relationship.relationshipType} for {relationship.student}
        </span>
      </div>
      <div className="people-card-meta">
        <Badge variant="outline">{relationship.visibility}</Badge>
        <span>{relationship.authority}</span>
        <span>{relationship.status}</span>
      </div>
    </div>
  );
}

function AccountLinkCard({ accountLink }: { accountLink: AccountLinkReviewItem }) {
  return (
    <div className="people-review-card">
      <div>
        <strong>{accountLink.person}</strong>
        <span>
          {accountLink.provider} · {accountLink.externalSubject}
        </span>
      </div>
      <div className="people-card-meta">
        <Badge variant="outline">{accountLink.status}</Badge>
        <span>{accountLink.secretPosture}</span>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="people-detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ValidationPanel({ model }: { model: PeopleReviewModel }) {
  return (
    <Card className="ops-panel people-validation-panel">
      <CardHeader>
        <div className="ops-heading">
          <div className="ops-icon">{model.validation.length === 0 ? <CheckCircle2 /> : <AlertTriangle />}</div>
          <div>
            <CardTitle>Validation Review</CardTitle>
            <CardDescription>Tenant, guardian, advisor, staff, and account-link privacy checks.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="ops-list">
        {model.validation.length === 0 ? (
          <div className="ops-readiness-row">
            <span>No people warnings</span>
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
  );
}
