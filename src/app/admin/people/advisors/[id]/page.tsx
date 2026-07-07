import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { CovenantRecordTab } from "@/components/covenant-record-tab";
import type { CovenantRecord } from "@/modules/people/types";

export const dynamic = "force-dynamic";

interface Person {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  person_status: string;
}

interface RoleAssignment {
  id: string;
  role: string;
  status: string;
}

interface AssignedStudent {
  student_id: string;
  student_person_id: string;
  student_name: string;
  enrollment_status: string;
  email: string | null;
}

interface AuditEvent {
  id: string;
  action: string;
  created_at: string;
}

export default async function AdvisorDetailPage({ params }: { params: { id: string } }) {
  const actor = await requireActor();
  const personId = params.id;

  const data = await withAcademyDatabaseContext(actor, async (client) => {
    const personResult = await client.query(
      `select id, display_name, email, phone, person_status
       from academy_people
       where id = $1 and tenant_id = $2`,
      [personId, actor.tenantId],
    ) as { rows: Person[] };

    if (personResult.rows.length === 0) {
      return null;
    }

    const person = personResult.rows[0];

    const rolesResult = await client.query(
      `select id, role, status
       from academy_person_role_assignments
       where person_id = $1 and tenant_id = $2 and status = 'active'`,
      [personId, actor.tenantId],
    ) as { rows: RoleAssignment[] };

    const assignedStudentsResult = await client.query(
      `select sp.id as student_id,
              p.id as student_person_id,
              p.display_name as student_name,
              sp.enrollment_status,
              p.email
       from academy_student_profiles sp
       join academy_people p on p.id = sp.person_id
       where sp.advisor_person_id = $1 and sp.tenant_id = $2
       order by p.display_name`,
      [personId, actor.tenantId],
    ) as { rows: AssignedStudent[] };

    let auditEvents: AuditEvent[] = [];
    try {
      const auditResult = await client.query(
        `select id, action, created_at
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

    return {
      person,
      roles: rolesResult.rows,
      assignedStudents: assignedStudentsResult.rows,
      auditEvents,
      covenantEnabled,
      covenantRecord,
    };
  });

  if (!data) {
    notFound();
  }

  const { person, roles, assignedStudents, auditEvents, covenantEnabled, covenantRecord } = data;
  const canEditNotes = actor.roles.some(r => ['institution_admin', 'dean', 'academic_admin'].includes(r));

  return (
    <AdminShell
      activeSection="records"
      eyebrow="Advisor"
      title={person.display_name}
    >
      <div className="mb-4">
        <Link href="/admin/people/advisors" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
          <ArrowLeft size={16} /> All Advisors
        </Link>
      </div>

      <Tabs defaultValue="profile" className="student-tabs">
        <TabsList className="student-tabs-list">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="students">Assigned Students</TabsTrigger>
          {covenantEnabled && (
            <TabsTrigger value="covenant">Covenant Record</TabsTrigger>
          )}
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="ops-panel">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Core person fields for this advisor.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="student-field-list">
                <div className="ops-readiness-row">
                  <span>Display name</span>
                  <strong>{person.display_name}</strong>
                </div>
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
                {roles.length > 0 && (
                  <div className="ops-readiness-row">
                    <span>Active roles</span>
                    <strong>
                      <div className="flex flex-wrap gap-1">
                        {roles.map((r) => (
                          <Badge key={r.id} variant="secondary" className="capitalize">
                            {r.role.replaceAll("_", " ")}
                          </Badge>
                        ))}
                      </div>
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

        <TabsContent value="students">
          <Card className="ops-panel">
            <CardHeader>
              <CardTitle>Assigned Students</CardTitle>
              <CardDescription>
                {assignedStudents.length > 0
                  ? `${assignedStudents.length} student${assignedStudents.length !== 1 ? "s" : ""} assigned`
                  : "No students assigned"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assignedStudents.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Enrollment Status</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignedStudents.map((s) => (
                      <TableRow key={s.student_id}>
                        <TableCell className="font-medium">{s.student_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {s.enrollment_status.replaceAll("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.email || "—"}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/admin/people/students/${s.student_person_id}`}
                            className="text-sm font-semibold text-blue-600 hover:underline"
                          >
                            View
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No students assigned to this advisor.
                </p>
              )}
              <div className="button-row">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      Reassign students
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Student Advisor Reassignment</DialogTitle>
                      <DialogDescription>
                        Student advisor reassignment is available in a future release.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end">
                      <Button variant="outline">Close</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
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
                Recent activity for this advisor.
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
