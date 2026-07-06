import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { CovenantRecordTab } from "@/components/covenant-record-tab";
import type { CovenantRecord } from "@/modules/people/types";

export const dynamic = "force-dynamic";

interface Person {
  id: string;
  display_name: string;
  given_name: string | null;
  family_name: string | null;
  email: string | null;
  phone: string | null;
  person_status: string;
}

interface StaffProfile {
  id: string;
  staff_number: string;
  title: string;
  primary_role: string;
  primary_subdivision_id: string | null;
  employment_status: string;
  load_policy: string | null;
}

interface SectionRow {
  section_id: string;
  section_code: string;
  course_name: string;
  term_name: string | null;
  status: string;
}

interface AuditEvent {
  id: string;
  action: string;
  created_at: string;
  actor_person_id: string | null;
}

export default async function StaffDetailPage({ params }: { params: { id: string } }) {
  const actor = await requireActor();
  const personId = params.id;

  const data = await withAcademyDatabaseContext(actor, async (client) => {
    const personResult = await client.query(
      `select id, display_name, given_name, family_name, email, phone, person_status
       from academy_people
       where id = $1 and tenant_id = $2`,
      [personId, actor.tenantId],
    ) as { rows: Person[] };

    if (personResult.rows.length === 0) {
      return null;
    }

    const person = personResult.rows[0];

    const profileResult = await client.query(
      `select id, staff_number, title, primary_role, primary_subdivision_id, employment_status, load_policy
       from academy_staff_profiles
       where person_id = $1 and tenant_id = $2`,
      [personId, actor.tenantId],
    ) as { rows: StaffProfile[] };

    const profile = profileResult.rows[0] || null;

    let sections: SectionRow[] = [];
    try {
      const sectionsResult = await client.query(
        `select s.id as section_id, s.section_code, c.name as course_name, t.name as term_name, s.status
         from academy_course_sections s
         left join academy_courses c on c.id = s.course_id and c.tenant_id = s.tenant_id
         left join academy_calendar_periods t on t.id = s.term_id and t.tenant_id = s.tenant_id
         where s.instructor_person_id = $1 and s.tenant_id = $2 and s.status != 'archived'
         order by s.section_code`,
        [personId, actor.tenantId],
      ) as { rows: SectionRow[] };
      sections = sectionsResult.rows;
    } catch {
      sections = [];
    }

    let auditEvents: AuditEvent[] = [];
    try {
      const auditResult = await client.query(
        `select id, action, created_at, actor_person_id
         from academy_audit_log
         where entity_id = $1 and tenant_id = $2
         order by created_at desc
         limit 30`,
        [personId, actor.tenantId],
      ) as { rows: AuditEvent[] };
      auditEvents = auditResult.rows;
    } catch {
      auditEvents = [];
    }

    // Load covenant record capability and data
    let covenantEnabled = false;
    let covenantRecord: CovenantRecord | null = null;
    try {
      const profileResult = await client.query(
        `SELECT capabilities FROM academy_institution_profiles WHERE tenant_id = $1`,
        [actor.tenantId]
      ) as { rows: Array<{ capabilities: Record<string, boolean> }> };
      if (profileResult.rows[0]) {
        const caps = profileResult.rows[0].capabilities;
        covenantEnabled = caps.covenantRecords === true;
      }
      if (covenantEnabled) {
        const covenantResult = await client.query(
          `SELECT id, tenant_id, person_id, covenant_fields, created_at, updated_at
           FROM academy_covenant_records
           WHERE tenant_id = $1 AND person_id = $2`,
          [actor.tenantId, personId]
        ) as { rows: Array<Record<string, unknown>> };
        if (covenantResult.rows[0]) {
          const row = covenantResult.rows[0];
          covenantRecord = {
            id: String(row.id),
            tenantId: String(row.tenant_id),
            personId: String(row.person_id),
            covenantFields: (row.covenant_fields ?? {}) as CovenantRecord['covenantFields'],
            createdAt: String(row.created_at),
            updatedAt: String(row.updated_at),
          };
        }
      }
    } catch {
      // covenant record feature not available
    }

    return { person, profile, sections, auditEvents, covenantEnabled, covenantRecord };
  });

  if (!data) {
    notFound();
  }

  const { person, profile, sections, auditEvents, covenantEnabled, covenantRecord } = data;
  const canEditNotes = actor.roles.some(r => ['institution_admin', 'dean', 'academic_admin'].includes(r));

  return (
    <AdminShell
      activeSection="records"
      eyebrow="Staff Member"
      title={person.display_name}
    >
      <div className="mb-4">
        <Link href="/admin/people/staff" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
          <ArrowLeft size={16} /> All Staff
        </Link>
      </div>

      <Tabs defaultValue="profile" className="student-tabs">
        <TabsList className="student-tabs-list">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="assignment">Assignment</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="ministry">Ministry Formation</TabsTrigger>
          {covenantEnabled && (
            <TabsTrigger value="covenant">Covenant Record</TabsTrigger>
          )}
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="ops-panel">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Core person fields for this staff member.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="student-field-list">
                <div className="ops-readiness-row">
                  <span>Display name</span>
                  <strong>{person.display_name}</strong>
                </div>
                {person.given_name && (
                  <div className="ops-readiness-row">
                    <span>Given name</span>
                    <strong>{person.given_name}</strong>
                  </div>
                )}
                {person.family_name && (
                  <div className="ops-readiness-row">
                    <span>Family name</span>
                    <strong>{person.family_name}</strong>
                  </div>
                )}
                {person.email && (
                  <div className="ops-readiness-row">
                    <span>Email</span>
                    <strong>{person.email}</strong>
                  </div>
                )}
                {person.phone && (
                  <div className="ops-readiness-row">
                    <span>Phone</span>
                    <strong>{person.phone}</strong>
                  </div>
                )}
                <div className="ops-readiness-row">
                  <span>Person status</span>
                  <strong className="capitalize">{person.person_status}</strong>
                </div>
                {profile && (
                  <div className="ops-readiness-row">
                    <span>Staff number</span>
                    <strong className="font-mono text-sm">{profile.staff_number}</strong>
                  </div>
                )}
                {profile && (
                  <div className="ops-readiness-row">
                    <span>Title</span>
                    <strong>{profile.title}</strong>
                  </div>
                )}
                {profile && (
                  <div className="ops-readiness-row">
                    <span>Primary role</span>
                    <strong>
                      <Badge variant="outline" className="capitalize">
                        {profile.primary_role.replaceAll("_", " ")}
                      </Badge>
                    </strong>
                  </div>
                )}
              </div>
              <div className="button-row">
                <Button variant="outline" size="sm">
                  Edit Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignment">
          <Card className="ops-panel">
            <CardHeader>
              <CardTitle>Assignment Details</CardTitle>
              <CardDescription>Employment status and subdivision assignment.</CardDescription>
            </CardHeader>
            <CardContent>
              {profile ? (
                <div className="student-field-list">
                  <div className="ops-readiness-row">
                    <span>Employment status</span>
                    <strong>
                      <Badge
                        variant={profile.employment_status === "active" ? "secondary" : "outline"}
                        className="capitalize"
                      >
                        {profile.employment_status}
                      </Badge>
                    </strong>
                  </div>
                  {profile.primary_subdivision_id && (
                    <div className="ops-readiness-row">
                      <span>Primary subdivision</span>
                      <strong>{profile.primary_subdivision_id}</strong>
                    </div>
                  )}
                  {profile.load_policy && (
                    <div className="ops-readiness-row">
                      <span>Load policy</span>
                      <strong className="capitalize">{profile.load_policy.replaceAll("_", " ")}</strong>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No staff profile found.</p>
              )}
              <div className="button-row">
                <Button variant="outline" size="sm">
                  Change Status
                </Button>
                <Button variant="outline" size="sm">
                  Edit Assignment
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections">
          <Card className="ops-panel">
            <CardHeader>
              <CardTitle>Section Assignments</CardTitle>
              <CardDescription>
                {sections.length > 0
                  ? `Teaching ${sections.length} section${sections.length !== 1 ? "s" : ""}.`
                  : "No section assignments."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sections.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Section Code</TableHead>
                      <TableHead>Course Name</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sections.map((s) => (
                      <TableRow key={s.section_id}>
                        <TableCell className="font-mono text-sm">{s.section_code}</TableCell>
                        <TableCell>{s.course_name}</TableCell>
                        <TableCell>{s.term_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {s.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Section assignments available when module is configured.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ministry">
          <div className="grid gap-4">
            <Card className="ops-panel">
              <CardHeader>
                <CardTitle>Ordination & Credentials</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  View ordination and credential records via the ministry profile module.
                </p>
              </CardContent>
            </Card>
            <Card className="ops-panel">
              <CardHeader>
                <CardTitle>Denomination Memberships</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Denomination membership records are available in the ministry profile module.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="covenant">
          <CovenantRecordTab
            covenantEnabled={covenantEnabled}
            record={covenantRecord}
            canEditNotes={canEditNotes}
            personId={personId}
          />
        </TabsContent>

        <TabsContent value="audit">
          <Card className="ops-panel">
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>
                Recent activity for this staff member.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditEvents.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditEvents.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="capitalize">{e.action.replaceAll("_", " ")}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(e.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Audit logging available when module is enabled.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
