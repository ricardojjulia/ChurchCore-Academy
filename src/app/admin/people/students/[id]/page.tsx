import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { PersonEditTrigger } from "./PersonEditTrigger";
import { EnrollmentStatusTrigger } from "./EnrollmentStatusTrigger";
import { CovenantRecordTab } from "@/components/covenant-record-tab";
import type { CovenantRecord } from "@/modules/people/types";

export const dynamic = "force-dynamic";

interface PersonData {
  id: string;
  displayName: string;
  givenName: string | null;
  familyName: string | null;
  preferredName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  personStatus: string;
}

interface StudentProfileData {
  studentNumber: string;
  studentType: string;
  enrollmentStatus: string;
  programId: string | null;
  advisorPersonId: string | null;
  primarySubdivisionId: string | null;
  guardianRequired: boolean;
}

interface RelationshipRow {
  id: string;
  relatedPersonName: string;
  relationshipType: string;
  authority: string;
  visibility: string;
  status: string;
}

interface AuditEventRow {
  id: string;
  action: string;
  actorPersonId: string | null;
  actorName: string | null;
  createdAt: string;
}

function formatLabel(value: string | null) {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusVariant(status: string) {
  if (status === "active") return "secondary";
  if (status === "inactive" || status === "archived") return "outline";
  return "default";
}

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();

  const data = await withAcademyDatabaseContext(actor, async (client) => {
    const personResult = (await client.query(
      `SELECT id, display_name, given_name, family_name, preferred_name, email, phone, date_of_birth, person_status
       FROM academy_people
       WHERE id = $1 AND tenant_id = $2`,
      [id, actor.tenantId]
    )) as { rows: Array<Record<string, unknown>> };

    if (personResult.rows.length === 0) {
      return null;
    }

    const person = personResult.rows[0];

    const profileResult = (await client.query(
      `SELECT student_number, student_type, enrollment_status, program_id, advisor_person_id, primary_subdivision_id, guardian_required
       FROM academy_student_profiles
       WHERE person_id = $1 AND tenant_id = $2`,
      [id, actor.tenantId]
    )) as { rows: Array<Record<string, unknown>> };

    const profile = profileResult.rows[0] ?? null;

    const relationshipsResult = (await client.query(
      `SELECT
         sr.id,
         p.display_name AS related_person_name,
         sr.relationship_type,
         sr.authority,
         sr.visibility,
         sr.status
       FROM academy_student_relationships sr
       JOIN academy_people p ON p.id = sr.related_person_id AND p.tenant_id = sr.tenant_id
       WHERE sr.student_person_id = $1 AND sr.tenant_id = $2
       ORDER BY sr.created_at DESC`,
      [id, actor.tenantId]
    )) as { rows: Array<Record<string, unknown>> };

    const auditResult = (await client.query(
      `SELECT
         ae.id,
         ae.action,
         ae.actor_person_id,
         p.display_name AS actor_name,
         ae.created_at
       FROM academy_audit_events ae
       LEFT JOIN academy_people p ON p.id = ae.actor_person_id AND p.tenant_id = ae.tenant_id
       WHERE ae.entity_id = $1 AND ae.tenant_id = $2
       ORDER BY ae.created_at DESC
       LIMIT 30`,
      [id, actor.tenantId]
    ).catch(() => ({ rows: [] }))) as { rows: Array<Record<string, unknown>> };

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
          [actor.tenantId, id]
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
      person: {
        id: String(person.id),
        displayName: String(person.display_name),
        givenName: person.given_name ? String(person.given_name) : null,
        familyName: person.family_name ? String(person.family_name) : null,
        preferredName: person.preferred_name ? String(person.preferred_name) : null,
        email: person.email ? String(person.email) : null,
        phone: person.phone ? String(person.phone) : null,
        dateOfBirth: person.date_of_birth ? String(person.date_of_birth) : null,
        personStatus: String(person.person_status),
      } as PersonData,
      profile: profile ? {
        studentNumber: String(profile.student_number),
        studentType: String(profile.student_type),
        enrollmentStatus: String(profile.enrollment_status),
        programId: profile.program_id ? String(profile.program_id) : null,
        advisorPersonId: profile.advisor_person_id ? String(profile.advisor_person_id) : null,
        primarySubdivisionId: profile.primary_subdivision_id ? String(profile.primary_subdivision_id) : null,
        guardianRequired: Boolean(profile.guardian_required),
      } as StudentProfileData : null,
      relationships: relationshipsResult.rows.map((r) => ({
        id: String(r.id),
        relatedPersonName: String(r.related_person_name),
        relationshipType: String(r.relationship_type),
        authority: String(r.authority),
        visibility: String(r.visibility),
        status: String(r.status),
      })) as RelationshipRow[],
      auditEvents: auditResult.rows.map((a) => ({
        id: String(a.id),
        action: String(a.action),
        actorPersonId: a.actor_person_id ? String(a.actor_person_id) : null,
        actorName: a.actor_name ? String(a.actor_name) : null,
        createdAt: String(a.created_at),
      })) as AuditEventRow[],
      covenantEnabled,
      covenantRecord,
    };
  });

  if (!data || !data.profile) {
    notFound();
  }

  const { person, profile, relationships, auditEvents, covenantEnabled, covenantRecord } = data;
  const canEditNotes = actor.roles.some(r => ['institution_admin', 'dean', 'academic_admin'].includes(r));

  return (
    <AdminShell activeSection="records" eyebrow="Student">
      <div style={{ marginBottom: "1rem" }}>
        <Link href="/admin/people/students" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "var(--brand-accent)", textDecoration: "none" }}>
          <ArrowLeft size={16} strokeWidth={2} />
          All Students
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 className="admin-title">{person.displayName}</h1>
          <Badge variant={statusVariant(person.personStatus)} style={{ marginTop: "0.5rem" }}>
            {formatLabel(person.personStatus)}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="profile" className="student-tabs">
        <TabsList className="student-tabs-list">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="enrollment">Enrollment</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
          <TabsTrigger value="academic">Academic</TabsTrigger>
          {covenantEnabled && (
            <TabsTrigger value="covenant">Covenant Record</TabsTrigger>
          )}
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="ops-panel">
            <CardHeader>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <CardTitle>Profile</CardTitle>
                <PersonEditTrigger personId={person.id} person={person} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="student-field-list">
                <div className="ops-readiness-row">
                  <span>Display name</span>
                  <strong>{person.displayName}</strong>
                </div>
                <div className="ops-readiness-row">
                  <span>Given name</span>
                  <strong>{person.givenName ?? "—"}</strong>
                </div>
                <div className="ops-readiness-row">
                  <span>Family name</span>
                  <strong>{person.familyName ?? "—"}</strong>
                </div>
                <div className="ops-readiness-row">
                  <span>Preferred name</span>
                  <strong>{person.preferredName ?? "—"}</strong>
                </div>
                <div className="ops-readiness-row">
                  <span>Email</span>
                  <strong>{person.email ?? "—"}</strong>
                </div>
                <div className="ops-readiness-row">
                  <span>Phone</span>
                  <strong>{person.phone ?? "—"}</strong>
                </div>
                <div className="ops-readiness-row">
                  <span>Date of birth</span>
                  <strong>{person.dateOfBirth ? "On file" : "—"}</strong>
                </div>
                <div className="ops-readiness-row">
                  <span>Person status</span>
                  <strong>{formatLabel(person.personStatus)}</strong>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enrollment">
          <Card className="ops-panel">
            <CardHeader>
              <CardTitle>Enrollment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="student-field-list">
                <div className="ops-readiness-row">
                  <span>Enrollment status</span>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <Badge variant={statusVariant(profile.enrollmentStatus)}>{formatLabel(profile.enrollmentStatus)}</Badge>
                    <EnrollmentStatusTrigger studentId={person.id} currentStatus={profile.enrollmentStatus} />
                  </div>
                </div>
                <div className="ops-readiness-row">
                  <span>Student number</span>
                  <strong><code style={{ fontSize: "0.85rem" }}>{profile.studentNumber}</code></strong>
                </div>
                <div className="ops-readiness-row">
                  <span>Student type</span>
                  <strong>{formatLabel(profile.studentType)}</strong>
                </div>
                <div className="ops-readiness-row">
                  <span>Program</span>
                  <strong>{profile.programId ?? "—"}</strong>
                </div>
                <div className="ops-readiness-row">
                  <span>Advisor</span>
                  <strong>{profile.advisorPersonId ?? "—"}</strong>
                </div>
                <div className="ops-readiness-row">
                  <span>Primary subdivision</span>
                  <strong>{profile.primarySubdivisionId ?? "—"}</strong>
                </div>
                <div className="ops-readiness-row">
                  <span>Guardian required</span>
                  <strong>{profile.guardianRequired ? "Yes" : "No"}</strong>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relationships">
          <Card className="ops-panel">
            <CardHeader>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <CardTitle>Relationships</CardTitle>
                <Button variant="outline" size="sm" disabled>
                  <Users size={16} strokeWidth={2} />
                  Add Relationship
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {relationships.length === 0 ? (
                <div className="student-empty-state" style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)" }}>
                  <p>No relationships found.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Related Person</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Authority</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relationships.map((rel) => (
                      <TableRow key={rel.id}>
                        <TableCell>{rel.relatedPersonName}</TableCell>
                        <TableCell>{formatLabel(rel.relationshipType)}</TableCell>
                        <TableCell>{formatLabel(rel.authority)}</TableCell>
                        <TableCell>{formatLabel(rel.visibility)}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(rel.status)}>{formatLabel(rel.status)}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="academic">
          <Card className="ops-panel">
            <CardHeader>
              <CardTitle>Academic Records</CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: "1.5" }}>
                Academic records, holds, notes, and ShepherdAI recommendations are managed in the academic record view.
              </p>
              <Link href={`/admin/students/${person.id}`} className="academy-action-link" style={{ marginTop: "1rem", display: "inline-flex" }}>
                Open academic record →
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="covenant">
          <CovenantRecordTab
            covenantEnabled={covenantEnabled}
            record={covenantRecord}
            canEditNotes={canEditNotes}
            personId={person.id}
          />
        </TabsContent>

        <TabsContent value="audit">
          <Card className="ops-panel">
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>Last 30 events for this person</CardDescription>
            </CardHeader>
            <CardContent>
              {auditEvents.length === 0 ? (
                <div className="student-empty-state" style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)" }}>
                  <p>No audit events found. Audit logging available when module is enabled.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Actor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell style={{ fontSize: "0.8rem" }}>
                          {new Date(event.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>{formatLabel(event.action)}</TableCell>
                        <TableCell>{event.actorName ?? "System"}</TableCell>
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
