import Link from "next/link";
import type React from "react";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  ClipboardList,
  GraduationCap,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WithdrawRegistrationButton } from "@/components/withdraw-registration-button";
import { CovenantRecordTab } from "@/components/covenant-record-tab";
import { PersonEditTrigger } from "@/app/admin/people/students/[id]/PersonEditTrigger";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { fetchStudentRecords, fetchProgramList, fetchAdministrators, fetchSectionList } from "@/lib/academy-read-models";
import { ShepherdAiPostgresRepository } from "@/modules/shepherd-ai/postgres-repository";
import type { ShepherdAiDatabase } from "@/modules/shepherd-ai/postgres-repository";
import {
  PostgresStudentProgramMembershipRepository,
  type StudentProgramMembershipDatabase,
} from "@/modules/student-program-memberships/postgres-repository";
import type { StudentProgramMembership } from "@/modules/student-program-memberships/types";
import {
  PostgresStudentSectionEnrollmentRepository,
  type StudentSectionEnrollmentDatabase,
} from "@/modules/student-section-enrollments/postgres-repository";
import type { AvailableStudentSection } from "@/modules/student-section-enrollments/types";
import {
  PostgresStudentProgramProgressRepository,
  type StudentProgramProgressDatabase,
} from "@/modules/student-program-progress/postgres-repository";
import {
  PostgresTranscriptEntryRepository,
  type TranscriptEntryDatabase,
} from "@/modules/transcript-entries/postgres-repository";
import {
  PostgresStudentGroupRepository,
  type StudentGroupDatabase,
} from "@/modules/student-groups/postgres-repository";
import { ShepherdAiSuggestion, WorkflowRecord } from "@/modules/shepherd-ai/types";
import { CovenantRecord } from "@/modules/people/types";
import {
  StudentProgramMembershipDialog,
  type StudentAcademicYearOption,
  type StudentProgramOption,
} from "./StudentProgramMembershipDialog";
import { StudentSectionEnrollmentDialog } from "./StudentSectionEnrollmentDialog";
import { StudentProgramProgressCard } from "./StudentProgramProgressCard";
import { StudentTranscriptEntriesCard } from "./StudentTranscriptEntriesCard";
import { StudentGroupsCard } from "./StudentGroupsCard";

interface RegistrationRow {
  id: string;
  course_section_id: string;
  status: string;
  registered_at: string;
}

type StudentPageDatabase =
  ShepherdAiDatabase &
  StudentProgramMembershipDatabase &
  StudentSectionEnrollmentDatabase &
  StudentProgramProgressDatabase &
  TranscriptEntryDatabase &
  StudentGroupDatabase;

function formatCode(value: string) {
  return value.replaceAll("_", " ");
}

function urgencyVariant(urgency: string) {
  if (urgency === "critical" || urgency === "high") return "destructive";
  if (urgency === "medium") return "secondary";
  return "outline";
}

function statusVariant(status: string) {
  return status === "completed" || status === "good_standing" ? "secondary" : "outline";
}

export default async function StudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await requireActor();

  const { students, programs, administrators, sections, allSuggestions, allWorkflows, registrations, person, personId, relationships, covenantEnabled, covenantRecord, programMemberships, programProgress, transcriptEntries, transcriptEntryCandidates, studentGroupMemberships, academicProgramOptions, academicYearOptions, availableSectionOptions } =
    await withAcademyDatabaseContext(actor, async (client) => {
      const database = asAcademyDatabase<StudentPageDatabase>(client);
      const shepherdRepo = new ShepherdAiPostgresRepository(database);
      const membershipRepo = new PostgresStudentProgramMembershipRepository(database);
      const sectionEnrollmentRepo = new PostgresStudentSectionEnrollmentRepository(database);
      const progressRepo = new PostgresStudentProgramProgressRepository(database);
      const transcriptEntryRepo = new PostgresTranscriptEntryRepository(database);
      const studentGroupRepo = new PostgresStudentGroupRepository(database);
      const s = await fetchStudentRecords(actor.tenantId, client);
      const p = await fetchProgramList(actor.tenantId, client);
      const a = await fetchAdministrators(actor.tenantId, client);
      const sec = await fetchSectionList(actor.tenantId, client);
      const sugg = await shepherdRepo.fetchSuggestions(actor.tenantId);
      const wflow = await shepherdRepo.fetchWorkflows(actor.tenantId);

      // id param is the student profile id (sp.id); join to get the person record
      const personResult = await client.query(
        `SELECT p.id, p.display_name, p.given_name, p.family_name, p.preferred_name, p.email, p.phone, p.date_of_birth, p.person_status
         FROM academy_people p
         JOIN academy_student_profiles sp ON sp.person_id = p.id AND sp.tenant_id = p.tenant_id
         WHERE sp.tenant_id = $1 AND sp.id = $2`,
        [actor.tenantId, id]
      ) as { rows: Record<string, unknown>[] };
      const personRow = personResult.rows[0];
      const personId = personRow ? String(personRow.id) : null;

      const regs = personId ? await client.query(
        `select id, course_section_id, status, registered_at
           from academy_course_section_registrations
          where tenant_id = $1 and student_person_id = $2
          order by registered_at desc`,
        [actor.tenantId, personId],
      ) as { rows: RegistrationRow[] } : { rows: [] };

      const relationshipsResult = personId ? await client.query(
        `SELECT r.id, r.relationship_type, r.authority, r.visibility, r.status,
                p.id as related_person_id, p.display_name as related_person_name
         FROM academy_student_relationships r
         JOIN academy_people p ON p.id = r.related_person_id AND p.tenant_id = r.tenant_id
         WHERE r.tenant_id = $1 AND r.student_person_id = $2
         ORDER BY r.created_at DESC`,
        [actor.tenantId, personId]
      ) as { rows: Record<string, unknown>[] } : { rows: [] };

      const programOptionResult = await client.query(
        `select id, program_code, title, status
           from academy_academic_programs
          where tenant_id = $1 and status != 'archived'
          order by program_code asc, title asc`,
        [actor.tenantId],
      ) as { rows: Record<string, unknown>[] };
      const yearOptionResult = await client.query(
        `select id, name, code, status
           from academy_academic_years
          where tenant_id = $1
          order by starts_on desc, name asc`,
        [actor.tenantId],
      ) as { rows: Record<string, unknown>[] };
      const programMemberships = await membershipRepo.listByStudent(actor.tenantId, id);
      const availableSectionOptions = await sectionEnrollmentRepo.listAvailableSections(actor.tenantId, id);
      const programProgress = await progressRepo.getProgress(actor.tenantId, id);
      const transcriptEntries = await transcriptEntryRepo.listByStudent(actor.tenantId, id);
      const transcriptEntryCandidates = await transcriptEntryRepo.listCandidates(actor.tenantId, id);
      const studentGroupMemberships = await studentGroupRepo.listByStudent(actor.tenantId, id);

      let covenantEnabled = false;
      let covenantRecord: CovenantRecord | null = null;
      try {
        const profileResult = await client.query(
          `SELECT capabilities FROM academy_institution_profiles WHERE tenant_id = $1`,
          [actor.tenantId]
        ) as { rows: Record<string, unknown>[] };
        if (profileResult.rows[0]) {
          const caps = profileResult.rows[0].capabilities as Record<string, boolean>;
          covenantEnabled = caps.covenantRecords === true;
        }
        if (covenantEnabled && personId) {
          const cr = await client.query(
            `SELECT id, tenant_id, person_id, covenant_fields, created_at, updated_at FROM academy_covenant_records WHERE tenant_id = $1 AND person_id = $2`,
            [actor.tenantId, personId]
          ) as { rows: Record<string, unknown>[] };
          if (cr.rows[0]) {
            const row = cr.rows[0];
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
        /* covenant not available */
      }

      return {
        students: s,
        programs: p,
        administrators: a,
        sections: sec,
        allSuggestions: sugg,
        allWorkflows: wflow,
        registrations: regs.rows,
        person: personRow ? {
          displayName: String(personRow.display_name ?? ""),
          givenName: personRow.given_name ? String(personRow.given_name) : null,
          familyName: personRow.family_name ? String(personRow.family_name) : null,
          preferredName: personRow.preferred_name ? String(personRow.preferred_name) : null,
          email: personRow.email ? String(personRow.email) : null,
          phone: personRow.phone ? String(personRow.phone) : null,
          dateOfBirth: personRow.date_of_birth ? String(personRow.date_of_birth) : null,
        } : null,
        personId,
        relationships: relationshipsResult.rows.map((r) => ({
          id: String(r.id),
          relationshipType: String(r.relationship_type),
          authority: String(r.authority),
          visibility: String(r.visibility),
          status: String(r.status),
          relatedPersonId: String(r.related_person_id),
          relatedPersonName: String(r.related_person_name),
        })),
        programMemberships,
        programProgress,
        transcriptEntries,
        transcriptEntryCandidates,
        studentGroupMemberships,
        academicProgramOptions: programOptionResult.rows.map((row) => ({
          id: String(row.id),
          programCode: String(row.program_code),
          title: String(row.title),
          status: String(row.status),
        })) satisfies StudentProgramOption[],
        academicYearOptions: yearOptionResult.rows.map((row) => ({
          id: String(row.id),
          name: String(row.name),
          code: String(row.code),
          status: String(row.status),
        })) satisfies StudentAcademicYearOption[],
        availableSectionOptions,
        covenantEnabled,
        covenantRecord,
      };
    });

  const student = students.find((item) => item.id === id);
  if (!student || !person || !personId) notFound();

  const canEditNotes = actor.roles.some(r => ['institution_admin', 'dean', 'academic_admin'].includes(r));

  const activeMembership = programMemberships.find((item: StudentProgramMembership) => item.status === "active");
  const program = programs.find((item) => item.id === student.programId);
  const programDisplayName = activeMembership?.programTitle ?? program?.name ?? "Pending program assignment";
  const advisor = administrators.find((item) => item.id === student.advisorUserId);
  const suggestions = allSuggestions.filter((s) => s.entityType === "student" && s.entityId === id);
  const suggestionIds = new Set(suggestions.map((s) => s.id));
  const workflows = allWorkflows.filter((w) => w.suggestionId != null && suggestionIds.has(w.suggestionId));
  const progressPercent = program ? Math.min(100, Math.round((student.creditsEarned / program.requiredCredits) * 100)) : 0;
  const administrativeSignals = [
    ...student.missingEnrollmentSteps.map((value) => ({ category: "Enrollment", value })),
    ...student.documentationNotes.map((value) => ({ category: "Documentation", value })),
    ...student.transcriptAlerts.map((value) => ({ category: "Transcript", value })),
    ...student.recordAlerts.map((value) => ({ category: "Record", value })),
  ];

  const sectionById = new Map(sections.map((s) => [s.id, s]));

  return (
    <AdminShell
      eyebrow="Student Profile"
      title={student.fullName}
      subtitle={`${programDisplayName} · ShepherdAI Insights use Academy SIS and academic-record data only.`}
    >
      <Card className="ops-panel student-identity-card">
        <CardContent>
          <div className="student-identity-layout">
            <div className="student-avatar">{student.fullName.split(" ").map((part) => part[0]).join("")}</div>
            <div className="student-identity-main">
              <div className="student-identity-kicker">Academic Record</div>
              <h2>{student.fullName}</h2>
              <p>{student.email}</p>
              <div className="student-badge-row">
                <Badge variant={statusVariant(student.statusFlag)} className="capitalize">
                  {formatCode(student.statusFlag)}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {formatCode(student.enrollmentStatus)}
                </Badge>
                <Badge variant="outline">{programDisplayName}</Badge>
              </div>
            </div>
            <div className="student-identity-actions">
              <PersonEditTrigger personId={personId} person={person} />
              <Link href="/workflows" className="academy-action-link">
                Open workflow queue
                <ArrowRight />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="ops-stats-grid">
        <StudentMetric label="Credits earned" value={student.creditsEarned} detail={`${progressPercent}% of required credits`} icon={<GraduationCap />} />
        <StudentMetric label="Expected credits" value={student.expectedCreditsByNow} detail="Academic pace benchmark" icon={<BookOpenCheck />} />
        <StudentMetric label="Open suggestions" value={suggestions.length} detail="Suggested Academic Workflows" icon={<Sparkles />} />
        <StudentMetric label="Active workflows" value={workflows.length} detail="Human-reviewed workflow items" icon={<ListChecks />} />
      </section>

      <Tabs defaultValue="insights" className="student-tabs">
        <TabsList className="student-tabs-list">
          <TabsTrigger value="insights">ShepherdAI Insights</TabsTrigger>
          <TabsTrigger value="record">Academic Record</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
          {covenantEnabled && <TabsTrigger value="covenant">Covenant Record</TabsTrigger>}
          <TabsTrigger value="signals">Administrative Signals</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
        </TabsList>

        <TabsContent value="insights">
          <Card className="ops-panel">
            <CardHeader className="ops-card-header">
              <div className="ops-heading">
                <div className="ops-icon">
                  <Sparkles />
                </div>
                <div>
                  <CardTitle>ShepherdAI Insights</CardTitle>
                  <CardDescription>Explainable academic workflow recommendations for registrar or advisor review.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="student-insight-list">
              {suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No current ShepherdAI suggestions for this student.</p>
              ) : (
                suggestions.map((suggestion) => <SuggestionPanel key={suggestion.id} suggestion={suggestion} />)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="record">
          <section className="ops-content-grid">
            <Card className="ops-panel">
              <CardHeader>
                <CardTitle>Enrollment</CardTitle>
                <CardDescription>Administrative status and ownership fields.</CardDescription>
              </CardHeader>
              <CardContent className="student-field-list">
                <FieldRow label="Enrollment status" value={formatCode(student.enrollmentStatus)} />
                <FieldRow label="Program" value={programDisplayName} />
                <FieldRow label="Advisor" value={advisor?.name ?? "Pending assignment"} />
                <FieldRow label="Active term" value={student.activeTerm ?? "Not active"} />
              </CardContent>
            </Card>

            <Card className="ops-panel">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Program Membership</CardTitle>
                    <CardDescription>Canonical academic program and catalog year for this student.</CardDescription>
                  </div>
                  <StudentProgramMembershipDialog
                    studentProfileId={student.id}
                    currentAcademicProgramId={activeMembership?.academicProgramId}
                    currentAcademicYearId={activeMembership?.catalogAcademicYearId}
                    academicProgramOptions={academicProgramOptions}
                    academicYearOptions={academicYearOptions}
                  />
                </div>
              </CardHeader>
              <CardContent className="student-field-list">
                <FieldRow label="Active program" value={activeMembership?.programTitle ?? "Pending assignment"} />
                <FieldRow label="Program code" value={activeMembership?.programCode ?? "n/a"} />
                <FieldRow label="Catalog year" value={activeMembership?.catalogAcademicYearName ?? "Pending assignment"} />
                <FieldRow label="Started" value={activeMembership?.startedOn ?? "Not started"} />
              </CardContent>
            </Card>

            <StudentProgramProgressCard progress={programProgress} />

            <StudentGroupsCard memberships={studentGroupMemberships} />

            <StudentTranscriptEntriesCard
              studentProfileId={student.id}
              entries={transcriptEntries}
              candidates={transcriptEntryCandidates}
            />

            <Card className="ops-panel">
              <CardHeader>
                <CardTitle>Documentation</CardTitle>
                <CardDescription>Required student record completion state.</CardDescription>
              </CardHeader>
              <CardContent>
                {student.missingDocuments.length === 0 ? (
                  <div className="student-empty-state">
                    <ShieldCheck />
                    <span>No missing required documents in this record.</span>
                  </div>
                ) : (
                  <div className="student-chip-list">
                    {student.missingDocuments.map((document) => (
                      <Badge key={document} variant="outline" className="capitalize">
                        {formatCode(document)}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="sections">
          <Card className="ops-panel">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="ops-heading">
                  <div className="ops-icon"><BookOpen /></div>
                  <div>
                    <CardTitle>Section Registrations</CardTitle>
                    <CardDescription>
                      All course section registrations for this student. Use Withdraw to drop a section.
                    </CardDescription>
                  </div>
                </div>
                <div>
                  <StudentSectionEnrollmentDialog
                    studentProfileId={student.id}
                    availableSectionOptions={availableSectionOptions as AvailableStudentSection[]}
                    hasActiveProgramMembership={Boolean(activeMembership)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {registrations.length === 0 ? (
                <div className="student-empty-state">
                  <BookOpen />
                  <span>No section registrations on record for this student.</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Section</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrations.map((reg) => {
                      const section = sectionById.get(reg.course_section_id);
                      return (
                        <TableRow key={reg.id}>
                          <TableCell className="font-mono font-medium">
                            {section?.code ?? reg.course_section_id.slice(0, 8)}
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            {section?.title ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                reg.status === "registered" ? "secondary"
                                  : reg.status === "withdrawn" ? "destructive"
                                  : "outline"
                              }
                            >
                              {reg.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(reg.registered_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <WithdrawRegistrationButton
                              registrationId={reg.id}
                              currentStatus={reg.status}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relationships">
          <Card className="ops-panel">
            <CardHeader>
              <div className="ops-heading">
                <div className="ops-icon"><Users /></div>
                <div>
                  <CardTitle>Student Relationships</CardTitle>
                  <CardDescription>
                    Guardians, parents, emergency contacts, and other relationships linked to this student.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {relationships.length === 0 ? (
                <div className="student-empty-state">
                  <Users />
                  <span>No relationships on record for this student.</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Relationship</TableHead>
                      <TableHead>Authority</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relationships.map((rel) => (
                      <TableRow key={rel.id}>
                        <TableCell className="font-medium">{rel.relatedPersonName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {formatCode(rel.relationshipType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{formatCode(rel.authority)}</TableCell>
                        <TableCell className="text-sm">{formatCode(rel.visibility)}</TableCell>
                        <TableCell>
                          <Badge variant={rel.status === "active" ? "secondary" : "outline"} className="capitalize">
                            {rel.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {covenantEnabled && (
          <TabsContent value="covenant">
            <CovenantRecordTab
              covenantEnabled={covenantEnabled}
              record={covenantRecord}
              canEditNotes={canEditNotes}
              personId={id}
            />
          </TabsContent>
        )}

        <TabsContent value="signals">
          <Card className="ops-panel">
            <CardHeader>
              <CardTitle>Recent Administrative Signals</CardTitle>
              <CardDescription>Academy-only record details that may require staff review.</CardDescription>
            </CardHeader>
            <CardContent>
              {administrativeSignals.length === 0 ? (
                <div className="student-empty-state">
                  <ShieldCheck />
                  <span>No administrative signals are currently attached to this record.</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Signal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {administrativeSignals.map((signal) => (
                      <TableRow key={`${signal.category}-${signal.value}`}>
                        <TableCell>
                          <Badge variant="outline">{signal.category}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-normal">{signal.value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows">
          <Card className="ops-panel">
            <CardHeader>
              <CardTitle>Academic Workflows</CardTitle>
              <CardDescription>Promoted workflow records connected to this student.</CardDescription>
            </CardHeader>
            <CardContent>
              {workflows.length === 0 ? (
                <div className="student-empty-state">
                  <ListChecks />
                  <span>No promoted workflows are currently attached to this student.</span>
                </div>
              ) : (
                <WorkflowTable workflows={workflows} suggestions={suggestions} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}

function StudentMetric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="ops-metric">
      <CardContent>
        <div className="ops-metric-label">{label}</div>
        <div className="ops-metric-value">{value}</div>
        <div className="ops-metric-detail">
          <span>{icon}</span>
          {detail}
        </div>
      </CardContent>
    </Card>
  );
}

function SuggestionPanel({ suggestion }: { suggestion: ShepherdAiSuggestion }) {
  return (
    <div className="student-insight-card">
      <div className="student-insight-top">
        <div>
          <h3>{suggestion.title}</h3>
          <p>{suggestion.summary}</p>
        </div>
        <div className="student-insight-badges">
          <Badge variant={urgencyVariant(suggestion.urgency)} className="capitalize">
            {suggestion.urgency}
          </Badge>
          <Badge variant="outline">{suggestion.confidenceScore}%</Badge>
        </div>
      </div>
      <Separator />
      <div className="student-insight-grid">
        <InsightBlock title="Why this surfaced" icon={<AlertTriangle />} items={suggestion.explanation.whySurfaced} />
        <InsightBlock title="Suggested next steps" icon={<ClipboardList />} items={suggestion.suggestedActions.map((action) => action.label)} />
        <InsightBlock title="Boundary note" icon={<ShieldCheck />} items={[suggestion.boundaryNote]} />
      </div>
    </div>
  );
}

function InsightBlock({ title, icon, items }: { title: string; icon: React.ReactNode; items: string[] }) {
  return (
    <div className="student-insight-block">
      <div className="student-insight-block-title">
        {icon}
        {title}
      </div>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="student-field-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WorkflowTable({ workflows, suggestions }: { workflows: WorkflowRecord[]; suggestions: ShepherdAiSuggestion[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Workflow</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Assigned To</TableHead>
          <TableHead>Due</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workflows.map((workflow) => {
          const suggestion = suggestions.find((item) => item.id === workflow.suggestionId);
          return (
            <TableRow key={workflow.id}>
              <TableCell className="whitespace-normal">
                <div className="font-medium">{suggestion?.title ?? formatCode(workflow.workflowCode)}</div>
                <div className="line-clamp-1 text-sm text-muted-foreground">{suggestion?.summary ?? "Workflow promoted from ShepherdAI suggestion."}</div>
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(workflow.status)} className="capitalize">
                  {workflow.status}
                </Badge>
              </TableCell>
              <TableCell>{workflow.assignedToUserId ?? "Unassigned"}</TableCell>
              <TableCell>{workflow.dueAt ? new Date(workflow.dueAt).toLocaleDateString("en-US") : "Not set"}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
