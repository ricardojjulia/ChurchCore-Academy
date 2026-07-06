import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GuardianProfileTab } from "./GuardianProfileTab";
import { StudentsTab } from "./StudentsTab";
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

interface RelationshipRecord {
  id: string;
  studentPersonId: string;
  studentDisplayName: string;
  relationshipType: string;
  authority: string;
  visibility: string;
  status: string;
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

export default async function GuardianDetailPage(props: PageProps) {
  const params = await props.params;
  const actor = await requireActor();

  const { person, relationships, auditEvents, students, covenantEnabled, covenantRecord } = await withAcademyDatabaseContext(
    actor,
    async (client) => {
      const personResult = await client.query(
        `SELECT id, display_name, given_name, family_name, email, phone, date_of_birth, person_status
         FROM academy_people
         WHERE id = $2 AND tenant_id = $1`,
        [actor.tenantId, params.id],
      );

      if ((personResult as { rowCount: number | null }).rowCount === 0) {
        return { person: null, relationships: [], auditEvents: [], students: [] };
      }

      const person = (personResult as { rows: PersonRecord[] }).rows[0];

      let relationships: RelationshipRecord[] = [];
      try {
        const relResult = await client.query(
          `SELECT r.id, r.student_person_id, p.display_name as student_display_name,
                  r.relationship_type, r.authority, r.visibility, r.status
           FROM academy_student_relationships r
           JOIN academy_people p ON p.id = r.student_person_id AND p.tenant_id = r.tenant_id
           WHERE r.related_person_id = $2 AND r.tenant_id = $1
           ORDER BY p.display_name`,
          [actor.tenantId, params.id],
        );
        relationships = (relResult as { rows: RelationshipRecord[] }).rows;
      } catch (error) {
        console.warn("Relationships query failed:", error);
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

      let students: Array<{ id: string; displayName: string }> = [];
      try {
        const studentsResult = await client.query(
          `SELECT p.id, p.display_name
           FROM academy_people p
           JOIN academy_student_profiles sp ON sp.person_id = p.id AND sp.tenant_id = p.tenant_id
           WHERE p.tenant_id = $1
           ORDER BY p.display_name`,
          [actor.tenantId],
        );
        students = (studentsResult as { rows: Array<{ id: string; displayName: string }> }).rows;
      } catch (error) {
        console.warn("Students query failed:", error);
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

      return { person, relationships, auditEvents, students, covenantEnabled, covenantRecord };
    },
  );

  if (!person) {
    notFound();
  }

  const canEditNotes = actor.roles.some(r => ['institution_admin', 'dean', 'academic_admin'].includes(r));

  return (
    <AdminShell
      activeSection="records"
      eyebrow="Guardian"
      title={person.displayName}
    >
      <Tabs defaultValue="profile" className="student-tabs">
        <TabsList className="student-tabs-list">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="ferpa">FERPA / Privacy</TabsTrigger>
          <TabsTrigger value="notifications">Notification Preferences</TabsTrigger>
          {covenantEnabled && (
            <TabsTrigger value="covenant">Covenant Record</TabsTrigger>
          )}
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <GuardianProfileTab person={person} />
        </TabsContent>

        <TabsContent value="students">
          <StudentsTab
            guardianPersonId={params.id}
            relationships={relationships}
            students={students}
          />
        </TabsContent>

        <TabsContent value="ferpa">
          <Card className="ops-panel">
            <CardHeader>
              <CardTitle>FERPA / Privacy</CardTitle>
              <CardDescription>
                FERPA restriction management is available when the compliance module is enabled.
              </CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="ops-panel">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Guardian notification preferences are available when the guardian portal is enabled.
              </CardDescription>
            </CardHeader>
          </Card>
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
              <CardDescription>Recent activity for this guardian record.</CardDescription>
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
