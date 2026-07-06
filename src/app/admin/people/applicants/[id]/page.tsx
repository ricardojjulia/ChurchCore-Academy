import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApplicantProfileTab } from "./ApplicantProfileTab";
import { ApplicationTab } from "./ApplicationTab";
import { CovenantRecordTab } from "@/components/covenant-record-tab";
import type { CovenantRecord } from "@/modules/people/types";

export const dynamic = "force-dynamic";

interface PersonRecord {
  id: string;
  displayName: string;
  givenName: string | null;
  familyName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  personStatus: string;
}

interface StudentProfileRecord {
  id: string;
  studentNumber: string;
  studentType: string;
  enrollmentStatus: string;
}

interface AuditEventRecord {
  id: string;
  action: string;
  actorPersonId: string;
  createdAt: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicantDetailPage(props: PageProps) {
  const params = await props.params;
  const actor = await requireActor();

  const { person, studentProfile, auditEvents, covenantEnabled, covenantRecord } = await withAcademyDatabaseContext(
    actor,
    async (client) => {
      const personResult = await client.query(
        `SELECT id, display_name, given_name, family_name, email, phone, date_of_birth, person_status
         FROM academy_people
         WHERE id = $2 AND tenant_id = $1`,
        [actor.tenantId, params.id],
      );

      if ((personResult as { rowCount: number | null }).rowCount === 0) {
        return { person: null, studentProfile: null, auditEvents: [] };
      }

      const person = (personResult as { rows: PersonRecord[] }).rows[0];

      let studentProfile: StudentProfileRecord | null = null;
      try {
        const profileResult = await client.query(
          `SELECT id, student_number, student_type, enrollment_status
           FROM academy_student_profiles
           WHERE person_id = $2 AND tenant_id = $1`,
          [actor.tenantId, params.id],
        );

        if ((profileResult as { rowCount: number | null }).rowCount! > 0) {
          studentProfile = (profileResult as { rows: StudentProfileRecord[] }).rows[0];
        }
      } catch (error) {
        console.warn("Student profile query failed:", error);
      }

      let auditEvents: AuditEventRecord[] = [];
      try {
        const auditResult = await client.query(
          `SELECT id, action, actor_person_id, created_at
           FROM academy_audit_log
           WHERE entity_id = $2 AND tenant_id = $1
           ORDER BY created_at DESC
           LIMIT 30`,
          [actor.tenantId, params.id],
        );
        auditEvents = (auditResult as { rows: AuditEventRecord[] }).rows;
      } catch (error) {
        console.warn("Audit log not available:", error);
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
            [actor.tenantId, params.id]
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

      return { person, studentProfile, auditEvents, covenantEnabled, covenantRecord };
    },
  );

  if (!person || !studentProfile) {
    notFound();
  }

  const canEditNotes = actor.roles.some(r => ['institution_admin', 'dean', 'academic_admin'].includes(r));

  const progressedStatuses = ["active", "graduated", "withdrawn", "inactive"];
  if (progressedStatuses.includes(studentProfile.enrollmentStatus)) {
    redirect(`/admin/people/students/${params.id}`);
  }

  return (
    <AdminShell
      activeSection="records"
      eyebrow="Applicant"
      title={person.displayName}
    >
      <Tabs defaultValue="profile" className="student-tabs">
        <TabsList className="student-tabs-list">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="application">Application</TabsTrigger>
          {covenantEnabled && (
            <TabsTrigger value="covenant">Covenant Record</TabsTrigger>
          )}
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ApplicantProfileTab person={person} />
        </TabsContent>

        <TabsContent value="application">
          <ApplicationTab personId={params.id} studentProfile={studentProfile} />
        </TabsContent>

        <TabsContent value="covenant">
          <CovenantRecordTab
            covenantEnabled={covenantEnabled}
            record={covenantRecord}
            canEditNotes={canEditNotes}
            personId={params.id}
          />
        </TabsContent>

        <TabsContent value="audit">
          <Card className="ops-panel">
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>Recent activity for this applicant record.</CardDescription>
            </CardHeader>
            <CardContent>
              {auditEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Audit logging available when module is enabled.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Actor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>{new Date(event.createdAt).toLocaleString()}</TableCell>
                        <TableCell>{event.action}</TableCell>
                        <TableCell>{event.actorPersonId}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
