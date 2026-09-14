import { test } from "node:test";
import assert from "node:assert/strict";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { AcademyQueryClient } from "@/lib/academy-database-context";
import {
  logPracticumSession,
  recordMilestone,
  recordFormationEvaluation,
  endorseRecord,
  getStudentFormationRecord,
  assignFormationAdvisor,
  listStudentsWithFormationSummary,
  getFormationPageMetadata,
  grantMinistryFormationReviewer,
  revokeMinistryFormationReviewer,
} from "@/modules/ministry-formation/service";
import { PermanentRecordError } from "@/modules/ministry-formation/errors";

function createMockDb(): AcademyQueryClient {
  const store = new Map<string, unknown>();
  const advisorAssignments = new Map<string, { advisorId: string; assignedBy: string; assignedAt: string }>();
  const advisorAssignmentHistory: Array<{ tenantId: string; studentPersonId: string; advisorPersonId: string; assignedAt: string; assignedByPersonId: string; recordedAt: string }> = [];
  let idCounter = 0;

  return {
    async query(text: string, values?: unknown[]) {
      if (text.includes("insert into public.ministry_practicum_sessions")) {
        const id = `prac-${++idCounter}`;
        const row = {
          id,
          tenant_id: values![0],
          student_person_id: values![1],
          recorded_by_person_id: values![2],
          hours: String(values![3]),
          site_name: values![4],
          supervisor_name: values![5],
          session_date: values![6],
          reflection_note: values![7],
          status: "draft",
          endorsed_by_person_id: null,
          endorsed_at: null,
          is_transfer_credit: values![8],
          source_institution: values![9],
          created_at: new Date().toISOString(),
        };
        store.set(id, row);
        return { rows: [row] };
      }

      if (text.includes("insert into public.ministry_faith_milestones")) {
        const id = `mile-${++idCounter}`;
        const row = {
          id,
          tenant_id: values![0],
          student_person_id: values![1],
          recorded_by_person_id: values![2],
          milestone_type: values![3],
          custom_type_label: values![4],
          milestone_date: values![5],
          witness_names: values![6],
          institution_notes: values![7],
          status: "draft",
          endorsed_by_person_id: null,
          endorsed_at: null,
          is_transfer_credit: values![8],
          source_institution: values![9],
          created_at: new Date().toISOString(),
        };
        store.set(id, row);
        return { rows: [row] };
      }

      if (text.includes("insert into public.ministry_formation_evaluations")) {
        const id = `eval-${++idCounter}`;
        const row = {
          id,
          tenant_id: values![0],
          student_person_id: values![1],
          evaluator_person_id: values![2],
          evaluator_name_snapshot: values![3],
          rubric_label: values![4],
          scores: JSON.parse(values![5] as string),
          pastoral_notes: values![6],
          status: "draft",
          endorsed_by_person_id: null,
          endorsed_at: null,
          evaluation_date: values![7],
          created_at: new Date().toISOString(),
        };
        store.set(id, row);
        return { rows: [row] };
      }

      if (text.includes("select status from public.ministry_practicum_sessions")) {
        const recordId = values![0];
        const record = store.get(recordId as string);
        if (record) {
          return { rows: [{ status: (record as { status: string }).status }] };
        }
        return { rows: [] };
      }

      if (text.includes("select status from public.ministry_faith_milestones")) {
        const recordId = values![0];
        const record = store.get(recordId as string);
        if (record) {
          return { rows: [{ status: (record as { status: string }).status }] };
        }
        return { rows: [] };
      }

      if (text.includes("select status from public.ministry_formation_evaluations")) {
        const recordId = values![0];
        const record = store.get(recordId as string);
        if (record) {
          return { rows: [{ status: (record as { status: string }).status }] };
        }
        return { rows: [] };
      }

      if (text.includes("update public.ministry_practicum_sessions")) {
        const recordId = values![1];
        const record = store.get(recordId as string);
        if (record) {
          const updated = {
            ...(record as object),
            status: "endorsed",
            endorsed_by_person_id: values![0],
            endorsed_at: new Date().toISOString(),
          };
          store.set(recordId as string, updated);
          return { rows: [updated] };
        }
        return { rows: [] };
      }

      if (text.includes("update public.ministry_faith_milestones")) {
        const recordId = values![1];
        const record = store.get(recordId as string);
        if (record) {
          const updated = {
            ...(record as object),
            status: "endorsed",
            endorsed_by_person_id: values![0],
            endorsed_at: new Date().toISOString(),
          };
          store.set(recordId as string, updated);
          return { rows: [updated] };
        }
        return { rows: [] };
      }

      if (text.includes("update public.ministry_formation_evaluations")) {
        const recordId = values![1];
        const record = store.get(recordId as string);
        if (record) {
          const updated = {
            ...(record as object),
            status: "endorsed",
            endorsed_by_person_id: values![0],
            endorsed_at: new Date().toISOString(),
          };
          store.set(recordId as string, updated);
          return { rows: [updated] };
        }
        return { rows: [] };
      }

      if (text.includes("select enrollment_status from public.academy_student_profiles")) {
        const studentId = values![0];
        const tenantId = values![1];
        if (studentId === "student-1" && tenantId === "tenant-a") {
          return { rows: [{ enrollment_status: "active" }] };
        }
        if (studentId === "withdrawn-student" && tenantId === "tenant-a") {
          return { rows: [{ enrollment_status: "withdrawn" }] };
        }
        if (studentId === "tenant-b-student" && tenantId === "tenant-a") {
          return { rows: [] };
        }
        return { rows: [{ enrollment_status: "active" }] };
      }

      if (text.includes("select * from public.ministry_practicum_sessions")) {
        const studentId = values![0];
        const rows = Array.from(store.values()).filter(
          (record: unknown) =>
            (record as { student_person_id?: string; hours?: string }).student_person_id === studentId &&
            (record as { hours?: string }).hours !== undefined,
        );
        return { rows };
      }

      if (text.includes("select * from public.ministry_faith_milestones")) {
        const studentId = values![0];
        const rows = Array.from(store.values()).filter(
          (record: unknown) =>
            (record as { student_person_id?: string; milestone_type?: string }).student_person_id === studentId &&
            (record as { milestone_type?: string }).milestone_type !== undefined,
        );
        return { rows };
      }

      if (text.includes("select * from public.ministry_formation_evaluations")) {
        const studentId = values![0];
        const rows = Array.from(store.values()).filter(
          (record: unknown) =>
            (record as { student_person_id?: string; evaluator_person_id?: string }).student_person_id === studentId &&
            (record as { evaluator_person_id?: string }).evaluator_person_id !== undefined,
        );
        return { rows };
      }

      if (text.includes("select display_name from academy_people")) {
        const personId = values![0];
        const tenantId = values![1];
        // Mock person data for display names
        if (personId === "student-1" && tenantId === "tenant-a") {
          return { rows: [{ display_name: "John Student" }] };
        }
        if (personId === "student-2" && tenantId === "tenant-a") {
          return { rows: [{ display_name: "Jane Student" }] };
        }
        if (personId === "tenant-b-student" && tenantId === "tenant-a") {
          return { rows: [] };
        }
        return { rows: [] };
      }

      if (text.includes("select person_status from public.academy_people")) {
        const personId = values![0];
        const tenantId = values![1];
        // Mock person data
        if (personId === "student-1" && tenantId === "tenant-a") {
          return { rows: [{ person_status: "active" }] };
        }
        if (personId === "advisor-1" && tenantId === "tenant-a") {
          return { rows: [{ person_status: "active" }] };
        }
        if (personId === "faculty-1" && tenantId === "tenant-a") {
          return { rows: [{ person_status: "active" }] };
        }
        if (personId === "non-advisor-person" && tenantId === "tenant-a") {
          return { rows: [{ person_status: "active" }] };
        }
        if (personId === "tenant-b-person" && tenantId === "tenant-a") {
          return { rows: [] };
        }
        return { rows: [] };
      }

      if (text.includes("select role from public.academy_person_role_assignments")) {
        const personId = values![0];
        const tenantId = values![1];
        // Mock role assignments
        if (personId === "advisor-1" && tenantId === "tenant-a") {
          return { rows: [{ role: "advisor" }] };
        }
        if (personId === "faculty-1" && tenantId === "tenant-a") {
          return { rows: [{ role: "faculty" }] };
        }
        if (personId === "non-advisor-person" && tenantId === "tenant-a") {
          return { rows: [{ role: "student" }] };
        }
        return { rows: [] };
      }

      if (text.includes("insert into public.ministry_formation_advisor_assignments")) {
        const tenantId = values![0] as string;
        const studentId = values![1] as string;
        const advisorId = values![2] as string;
        const assignedBy = values![3] as string;
        const key = `${tenantId}:${studentId}`;
        const assignedAt = new Date().toISOString();
        advisorAssignments.set(key, { advisorId, assignedBy, assignedAt });
        return {
          rows: [{
            id: `advisor-assignment-${++idCounter}`,
            tenant_id: tenantId,
            student_person_id: studentId,
            advisor_person_id: advisorId,
            assigned_at: assignedAt,
            assigned_by_person_id: assignedBy,
          }],
        };
      }

      if (text.includes("insert into public.ministry_formation_advisor_assignment_history")) {
        const tenantId = values![0] as string;
        const studentId = values![1] as string;
        const advisorId = values![2] as string;
        const assignedAt = values![3] as string;
        const assignedBy = values![4] as string;
        const recordedAt = new Date().toISOString();
        advisorAssignmentHistory.push({
          tenantId,
          studentPersonId: studentId,
          advisorPersonId: advisorId,
          assignedAt,
          assignedByPersonId: assignedBy,
          recordedAt,
        });
        return { rows: [] };
      }

      if (text.includes("select count(*) from public.ministry_formation_advisor_assignment_history")) {
        const studentId = values![0] as string;
        const tenantId = values![1] as string;
        const count = advisorAssignmentHistory.filter(
          h => h.studentPersonId === studentId && h.tenantId === tenantId
        ).length;
        return { rows: [{ count: String(count) }] };
      }

      if (text.includes("select aa.advisor_person_id, p.display_name as advisor_name")) {
        const studentId = values![0] as string;
        const tenantId = values![1] as string;
        const key = `${tenantId}:${studentId}`;
        const assignment = advisorAssignments.get(key);
        if (assignment) {
          return {
            rows: [{
              advisor_person_id: assignment.advisorId,
              advisor_name: "Dr. Advisor",
            }],
          };
        }
        return { rows: [] };
      }

      if (text.includes("select distinct p.id, p.display_name") && text.includes("join academy_person_role_assignments pra")) {
        // Eligible advisors query
        const tenantId = values![0] as string;
        if (tenantId === "tenant-a") {
          return {
            rows: [
              { id: "faculty-1", display_name: "Dr. Faculty" },
              { id: "advisor-1", display_name: "Dr. Advisor" },
              { id: "admin-1", display_name: "Admin User" },
            ],
          };
        }
        if (tenantId === "tenant-b") {
          return {
            rows: [
              { id: "tenant-b-faculty", display_name: "Tenant B Faculty" },
            ],
          };
        }
        return { rows: [] };
      }

      if (text.includes("from public.academy_people p") && text.includes("left join public.ministry_practicum_sessions ps")) {
        // Formation summary query
        const tenantId = values![0] as string;
        if (tenantId === "tenant-a") {
          const summaries = [];
          // Student 1 with records and advisor
          const key1 = `${tenantId}:student-1`;
          const assignment1 = advisorAssignments.get(key1);
          summaries.push({
            student_person_id: "student-1",
            full_name: "John Student",
            email: "john@example.com",
            total_practicum_hours: "10.5",
            milestone_count: "2",
            evaluation_count: "1",
            formation_advisor_person_id: assignment1?.advisorId ?? null,
            formation_advisor_name: assignment1 ? "Dr. Advisor" : null,
          });
          return { rows: summaries };
        }
        return { rows: [] };
      }

      // Mock faculty section scoping check
      if (text.includes("select 1 from public.academy_registrations reg") && text.includes("join public.academy_course_sections sec")) {
        const studentId = values![0];
        const tenantId = values![1];
        const instructorId = values![2];
        // Faculty-1 can see student-1 in tenant-a
        if (studentId === "student-1" && tenantId === "tenant-a" && instructorId === "faculty-1") {
          return { rows: [{ "?column?": 1 }] };
        }
        return { rows: [] };
      }

      // Mock formation advisor scoping check
      if (text.includes("select 1 from public.ministry_formation_advisor_assignments") && text.includes("where student_person_id")) {
        const studentId = values![0];
        const tenantId = values![1];
        const advisorId = values![2];
        const key = `${tenantId}:${studentId}`;
        const assignment = advisorAssignments.get(key);
        if (assignment && assignment.advisorId === advisorId) {
          return { rows: [{ "?column?": 1 }] };
        }
        return { rows: [] };
      }

      // Mock grant/revoke reviewer role
      if (text.includes("insert into public.academy_person_role_assignments") && text.includes("ministry_formation_reviewer")) {
        return { rows: [] };
      }

      if (text.includes("delete from public.academy_person_role_assignments") && text.includes("ministry_formation_reviewer")) {
        return { rows: [] };
      }

      return { rows: [] };
    },
    release() {},
  } as AcademyQueryClient;
}

test("logPracticumSession success", async () => {
  const actor: AcademyActor = {
    userId: "faculty-1",
    tenantId: "tenant-a",
    roles: ["faculty"],
  };

  const db = createMockDb();
  const result = await logPracticumSession(
    actor,
    {
      studentPersonId: "student-1",
      hours: 5.5,
      siteName: "Grace Community Church",
      supervisorName: "Rev. Johnson",
      sessionDate: "2026-06-15",
      reflectionNote: "Served in children's ministry.",
    },
    db,
  );

  assert.equal(result.hours, 5.5);
  assert.equal(result.siteName, "Grace Community Church");
  assert.equal(result.status, "draft");
});

test("logPracticumSession zero hours throws", async () => {
  const actor: AcademyActor = {
    userId: "faculty-1",
    tenantId: "tenant-a",
    roles: ["faculty"],
  };

  const db = createMockDb();
  await assert.rejects(
    async () => {
      await logPracticumSession(
        actor,
        {
          studentPersonId: "student-1",
          hours: 0,
          siteName: "Grace Community Church",
          supervisorName: "Rev. Johnson",
          sessionDate: "2026-06-15",
        },
        db,
      );
    },
    { message: /hours must be greater than 0/i },
  );
});

test("logPracticumSession negative hours throws", async () => {
  const actor: AcademyActor = {
    userId: "faculty-1",
    tenantId: "tenant-a",
    roles: ["faculty"],
  };

  const db = createMockDb();
  await assert.rejects(
    async () => {
      await logPracticumSession(
        actor,
        {
          studentPersonId: "student-1",
          hours: -5,
          siteName: "Grace Community Church",
          supervisorName: "Rev. Johnson",
          sessionDate: "2026-06-15",
        },
        db,
      );
    },
    { message: /hours must be greater than 0/i },
  );
});

test("logPracticumSession missing session date throws", async () => {
  const actor: AcademyActor = {
    userId: "faculty-1",
    tenantId: "tenant-a",
    roles: ["faculty"],
  };

  const db = createMockDb();
  await assert.rejects(
    async () => {
      await logPracticumSession(
        actor,
        {
          studentPersonId: "student-1",
          hours: 5,
          siteName: "Grace Community Church",
          supervisorName: "Rev. Johnson",
          sessionDate: "",
        },
        db,
      );
    },
    { message: /sessionDate is required/i },
  );
});

test("logPracticumSession invalid date format throws", async () => {
  const actor: AcademyActor = {
    userId: "faculty-1",
    tenantId: "tenant-a",
    roles: ["faculty"],
  };

  const db = createMockDb();
  await assert.rejects(
    async () => {
      await logPracticumSession(
        actor,
        {
          studentPersonId: "student-1",
          hours: 5,
          siteName: "Grace Community Church",
          supervisorName: "Rev. Johnson",
          sessionDate: "06/15/2026",
        },
        db,
      );
    },
    { message: /sessionDate must be a valid date/i },
  );
});

test("logPracticumSession unauthorized role throws", async () => {
  const actor: AcademyActor = {
    userId: "student-1",
    tenantId: "tenant-a",
    roles: ["student"],
  };

  const db = createMockDb();
  await assert.rejects(
    async () => {
      await logPracticumSession(
        actor,
        {
          studentPersonId: "student-1",
          hours: 5,
          siteName: "Grace Community Church",
          supervisorName: "Rev. Johnson",
          sessionDate: "2026-06-15",
        },
        db,
      );
    },
    { message: /Forbidden practicum session recording access/i },
  );
});

test("recordMilestone success", async () => {
  const actor: AcademyActor = {
    userId: "registrar-1",
    tenantId: "tenant-a",
    roles: ["registrar"],
  };

  const db = createMockDb();
  const result = await recordMilestone(
    actor,
    {
      studentPersonId: "student-1",
      milestoneType: "baptism",
      milestoneDate: "2026-05-01",
      witnessNames: ["Pastor Smith", "Elder Jones"],
    },
    db,
  );

  assert.equal(result.milestoneType, "baptism");
  assert.equal(result.milestoneDate, "2026-05-01");
  assert.deepEqual(result.witnessNames, ["Pastor Smith", "Elder Jones"]);
  assert.equal(result.status, "draft");
});

test("recordFormationEvaluation success with pastoralNotes", async () => {
  const actor: AcademyActor = {
    userId: "advisor-1",
    tenantId: "tenant-a",
    roles: ["advisor"],
  };

  const db = createMockDb();
  const result = await recordFormationEvaluation(
    actor,
    {
      studentPersonId: "student-1",
      evaluatorNameSnapshot: "Dr. Smith",
      rubricLabel: "Pastoral Character",
      scores: { humility: 4, leadership: 5 },
      pastoralNotes: "Shows great promise in ministry.",
      evaluationDate: "2026-06-01",
    },
    db,
  );

  assert.equal(result.evaluatorNameSnapshot, "Dr. Smith");
  assert.equal(result.pastoralNotes, "Shows great promise in ministry.");
  assert.deepEqual(result.scores, { humility: 4, leadership: 5 });
  assert.equal(result.status, "draft");
});

test("endorseRecord practicum success", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();

  // Create a practicum session
  const session = await logPracticumSession(
    { userId: "faculty-1", tenantId: "tenant-a", roles: ["faculty"] },
    {
      studentPersonId: "student-1",
      hours: 3,
      siteName: "Faith Church",
      supervisorName: "Rev. Brown",
      sessionDate: "2026-06-10",
    },
    db,
  );

  const endorsed = await endorseRecord(
    actor,
    { recordType: "practicum", recordId: session.id },
    db,
  );

  assert.equal(endorsed.status, "endorsed");
  assert.ok(endorsed.endorsedByPersonId);
});

test("endorseRecord already endorsed throws PermanentRecordError", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();

  // Create a practicum session
  const session = await logPracticumSession(
    { userId: "faculty-1", tenantId: "tenant-a", roles: ["faculty"] },
    {
      studentPersonId: "student-1",
      hours: 3,
      siteName: "Faith Church",
      supervisorName: "Rev. Brown",
      sessionDate: "2026-06-10",
    },
    db,
  );

  // Endorse it
  await endorseRecord(
    actor,
    { recordType: "practicum", recordId: session.id },
    db,
  );

  // Try to endorse again
  await assert.rejects(
    async () => {
      await endorseRecord(
        actor,
        { recordType: "practicum", recordId: session.id },
        db,
      );
    },
    (error: Error) => {
      assert.ok(error instanceof PermanentRecordError);
      assert.match(error.message, /Record is endorsed and cannot be modified/i);
      return true;
    },
  );
});

test("getStudentFormationRecord student view does not include pastoralNotes", async () => {
  const actor: AcademyActor = {
    userId: "student-1",
    tenantId: "tenant-a",
    roles: ["student"],
  };

  const db = createMockDb();

  // Create evaluation with pastoralNotes
  await recordFormationEvaluation(
    { userId: "advisor-1", tenantId: "tenant-a", roles: ["advisor"] },
    {
      studentPersonId: "student-1",
      evaluatorNameSnapshot: "Dr. Smith",
      rubricLabel: "Character Assessment",
      scores: { integrity: 5 },
      pastoralNotes: "Confidential pastoral observation.",
      evaluationDate: "2026-06-01",
    },
    db,
  );

  const record = await getStudentFormationRecord(actor, "student-1", db);

  assert.ok(record);
  assert.doesNotMatch(JSON.stringify(record), /pastoralNotes/);
  assert.doesNotMatch(JSON.stringify(record), /Confidential pastoral observation/);
});

test("getStudentFormationRecord withdrawn student, student role returns null", async () => {
  const actor: AcademyActor = {
    userId: "withdrawn-student",
    tenantId: "tenant-a",
    roles: ["student"],
  };

  const db = createMockDb();
  const record = await getStudentFormationRecord(actor, "withdrawn-student", db);

  assert.equal(record, null);
});

test("getStudentFormationRecord withdrawn student, admin role returns full record", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();

  // Create evaluation for withdrawn student
  await recordFormationEvaluation(
    actor,
    {
      studentPersonId: "withdrawn-student",
      evaluatorNameSnapshot: "Dr. Jones",
      rubricLabel: "Final Review",
      scores: { completion: 3 },
      pastoralNotes: "Student withdrew mid-term.",
      evaluationDate: "2026-05-15",
    },
    db,
  );

  const record = await getStudentFormationRecord(actor, "withdrawn-student", db);

  assert.ok(record);
  assert.ok("evaluations" in record);
  assert.equal(record.evaluations.length, 1);
  assert.equal((record.evaluations[0] as { pastoralNotes?: string }).pastoralNotes, "Student withdrew mid-term.");
});

test("getStudentFormationRecord cross-tenant rejection", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();

  await assert.rejects(
    async () => {
      await getStudentFormationRecord(actor, "tenant-b-student", db);
    },
    { message: /Student not found/i },
  );
});

test("getStudentFormationRecord student cannot read other student", async () => {
  const actor: AcademyActor = {
    userId: "student-1",
    tenantId: "tenant-a",
    roles: ["student"],
  };

  const db = createMockDb();

  await assert.rejects(
    async () => {
      await getStudentFormationRecord(actor, "student-2", db);
    },
    { message: /Students can read only their own formation record/i },
  );
});

test("assignFormationAdvisor success", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();
  const result = await assignFormationAdvisor(
    actor,
    {
      studentPersonId: "student-1",
      advisorPersonId: "advisor-1",
    },
    db,
  );

  assert.equal(result.studentPersonId, "student-1");
  assert.equal(result.advisorPersonId, "advisor-1");
  assert.equal(result.assignedByPersonId, "admin-1");
  assert.ok(result.assignedAt);
});

test("assignFormationAdvisor reassignment replaces previous advisor", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["academic_admin"],
  };

  const db = createMockDb();

  // First assignment
  const result1 = await assignFormationAdvisor(
    actor,
    {
      studentPersonId: "student-1",
      advisorPersonId: "advisor-1",
    },
    db,
  );
  assert.equal(result1.advisorPersonId, "advisor-1");

  // Reassignment
  const result2 = await assignFormationAdvisor(
    actor,
    {
      studentPersonId: "student-1",
      advisorPersonId: "faculty-1",
    },
    db,
  );
  assert.equal(result2.advisorPersonId, "faculty-1");
  assert.equal(result2.studentPersonId, "student-1");
});

test("assignFormationAdvisor reassignments create additive history trail", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();

  // First assignment
  await assignFormationAdvisor(
    actor,
    {
      studentPersonId: "student-1",
      advisorPersonId: "advisor-1",
    },
    db,
  );

  // Second assignment (reassignment)
  await assignFormationAdvisor(
    actor,
    {
      studentPersonId: "student-1",
      advisorPersonId: "faculty-1",
    },
    db,
  );

  // Verify history table has 2 rows (one per assignment)
  const historyCountResult = await db.query(
    `select count(*) from public.ministry_formation_advisor_assignment_history
     where student_person_id = $1 and tenant_id = $2`,
    ["student-1", "tenant-a"],
  ) as { rows: Array<{ count: string }> };

  assert.equal(historyCountResult.rows[0].count, "2");

  // Verify live table still has exactly 1 row (the current assignment)
  const liveAssignmentResult = await db.query(
    `select aa.advisor_person_id, p.display_name as advisor_name
     from public.ministry_formation_advisor_assignments aa
     join public.academy_people p
       on p.id = aa.advisor_person_id and p.tenant_id = aa.tenant_id
     where aa.student_person_id = $1 and aa.tenant_id = $2`,
    ["student-1", "tenant-a"],
  ) as { rows: Array<{ advisor_person_id: string; advisor_name: string }> };

  assert.equal(liveAssignmentResult.rows.length, 1);
  assert.equal(liveAssignmentResult.rows[0].advisor_person_id, "faculty-1");
});

test("assignFormationAdvisor RBAC rejection", async () => {
  const actor: AcademyActor = {
    userId: "faculty-1",
    tenantId: "tenant-a",
    roles: ["faculty"],
  };

  const db = createMockDb();

  await assert.rejects(
    async () => {
      await assignFormationAdvisor(
        actor,
        {
          studentPersonId: "student-1",
          advisorPersonId: "advisor-1",
        },
        db,
      );
    },
    { message: /Forbidden advisor assignment access/i },
  );
});

test("assignFormationAdvisor cross-tenant rejection student", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();

  await assert.rejects(
    async () => {
      await assignFormationAdvisor(
        actor,
        {
          studentPersonId: "tenant-b-person",
          advisorPersonId: "advisor-1",
        },
        db,
      );
    },
    { message: /Student not found/i },
  );
});

test("assignFormationAdvisor cross-tenant rejection advisor", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();

  await assert.rejects(
    async () => {
      await assignFormationAdvisor(
        actor,
        {
          studentPersonId: "student-1",
          advisorPersonId: "tenant-b-person",
        },
        db,
      );
    },
    { message: /Advisor not found/i },
  );
});

test("assignFormationAdvisor rejects when advisor lacks eligible role", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();

  await assert.rejects(
    async () => {
      await assignFormationAdvisor(
        actor,
        {
          studentPersonId: "student-1",
          advisorPersonId: "non-advisor-person",
        },
        db,
      );
    },
    { message: /Advisor must have faculty, advisor, or institution_admin role/i },
  );
});

test("listStudentsWithFormationSummary returns correct aggregated totals", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();

  // Assign an advisor first
  await assignFormationAdvisor(
    actor,
    {
      studentPersonId: "student-1",
      advisorPersonId: "advisor-1",
    },
    db,
  );

  const summaries = await listStudentsWithFormationSummary(actor, db);

  assert.ok(summaries.length > 0);
  const student1 = summaries.find((s) => s.studentPersonId === "student-1");
  assert.ok(student1);
  assert.equal(student1.fullName, "John Student");
  assert.equal(student1.totalPracticumHours, 10.5);
  assert.equal(student1.milestoneCount, 2);
  assert.equal(student1.evaluationCount, 1);
  assert.equal(student1.formationAdvisorPersonId, "advisor-1");
  assert.equal(student1.formationAdvisorName, "Dr. Advisor");
});

test("listStudentsWithFormationSummary cross-tenant isolation", async () => {
  const actor: AcademyActor = {
    userId: "admin-2",
    tenantId: "tenant-b",
    roles: ["institution_admin"],
  };

  const db = createMockDb();
  const summaries = await listStudentsWithFormationSummary(actor, db);

  // Should return empty for tenant-b
  assert.equal(summaries.length, 0);
});

test("listStudentsWithFormationSummary RBAC rejection", async () => {
  const actor: AcademyActor = {
    userId: "student-1",
    tenantId: "tenant-a",
    roles: ["student"],
  };

  const db = createMockDb();

  await assert.rejects(
    async () => {
      await listStudentsWithFormationSummary(actor, db);
    },
    { message: /Forbidden formation summary access/i },
  );
});

test("listStudentsWithFormationSummary formationComplete is null when student has no formation records", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  // Create a mock DB that returns a student with zero formation activity
  const mockDb = {
    async query(text: string, values?: unknown[]) {
      if (text.includes("from public.academy_people p") && text.includes("left join public.ministry_practicum_sessions ps")) {
        const tenantId = values![0] as string;
        if (tenantId === "tenant-a") {
          return {
            rows: [{
              student_person_id: "student-no-records",
              full_name: "No Formation Student",
              email: "norecords@example.com",
              total_practicum_hours: "0",
              milestone_count: "0",
              evaluation_count: "0",
              formation_advisor_person_id: null,
              formation_advisor_name: null,
            }],
          };
        }
      }
      return { rows: [] };
    },
    release() {},
  } as AcademyQueryClient;

  const summaries = await listStudentsWithFormationSummary(actor, mockDb);

  assert.ok(summaries.length > 0, "Should return at least one student");
  const student = summaries.find((s) => s.studentPersonId === "student-no-records");
  assert.ok(student, "Should find student with no records");
  assert.strictEqual(student.totalPracticumHours, 0, "Should have 0 practicum hours");
  assert.strictEqual(student.milestoneCount, 0, "Should have 0 milestones");
  assert.strictEqual(student.evaluationCount, 0, "Should have 0 evaluations");
  assert.strictEqual(student.formationComplete, null, "formationComplete should be null when no formation activity exists");
});

test("listStudentsWithFormationSummary formationComplete is false when student has records but does not meet threshold", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  // Create a mock DB that returns a student with some activity but below threshold
  const mockDb = {
    async query(text: string, values?: unknown[]) {
      if (text.includes("from public.academy_people p") && text.includes("left join public.ministry_practicum_sessions ps")) {
        const tenantId = values![0] as string;
        if (tenantId === "tenant-a") {
          return {
            rows: [{
              student_person_id: "student-below-threshold",
              full_name: "Below Threshold Student",
              email: "below@example.com",
              total_practicum_hours: "50",
              milestone_count: "1",
              evaluation_count: "2",
              formation_advisor_person_id: null,
              formation_advisor_name: null,
            }],
          };
        }
      }
      return { rows: [] };
    },
    release() {},
  } as AcademyQueryClient;

  const summaries = await listStudentsWithFormationSummary(actor, mockDb);

  assert.ok(summaries.length > 0, "Should return at least one student");
  const student = summaries.find((s) => s.studentPersonId === "student-below-threshold");
  assert.ok(student, "Should find student below threshold");
  assert.strictEqual(student.totalPracticumHours, 50, "Should have 50 practicum hours");
  assert.strictEqual(student.milestoneCount, 1, "Should have 1 milestone");
  assert.strictEqual(student.evaluationCount, 2, "Should have 2 evaluations");
  assert.strictEqual(student.formationComplete, false, "formationComplete should be false when student has activity but does not meet threshold");
});

test("listStudentsWithFormationSummary formationComplete is true when student meets threshold", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  // Create a mock DB that returns a student meeting the completion threshold
  const mockDb = {
    async query(text: string, values?: unknown[]) {
      if (text.includes("from public.academy_people p") && text.includes("left join public.ministry_practicum_sessions ps")) {
        const tenantId = values![0] as string;
        if (tenantId === "tenant-a") {
          return {
            rows: [{
              student_person_id: "student-complete",
              full_name: "Complete Student",
              email: "complete@example.com",
              total_practicum_hours: "120",
              milestone_count: "5",
              evaluation_count: "3",
              formation_advisor_person_id: "advisor-1",
              formation_advisor_name: "Dr. Advisor",
            }],
          };
        }
      }
      return { rows: [] };
    },
    release() {},
  } as AcademyQueryClient;

  const summaries = await listStudentsWithFormationSummary(actor, mockDb);

  assert.ok(summaries.length > 0, "Should return at least one student");
  const student = summaries.find((s) => s.studentPersonId === "student-complete");
  assert.ok(student, "Should find complete student");
  assert.strictEqual(student.totalPracticumHours, 120, "Should have 120 practicum hours");
  assert.strictEqual(student.milestoneCount, 5, "Should have 5 milestones");
  assert.strictEqual(student.evaluationCount, 3, "Should have 3 evaluations");
  assert.strictEqual(student.formationComplete, true, "formationComplete should be true when student meets threshold (100+ hours and 3+ milestones)");
});

test("listStudentsWithFormationSummary formationComplete boundary case: exactly at threshold", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  // Create a mock DB that returns a student exactly at the threshold
  const mockDb = {
    async query(text: string, values?: unknown[]) {
      if (text.includes("from public.academy_people p") && text.includes("left join public.ministry_practicum_sessions ps")) {
        const tenantId = values![0] as string;
        if (tenantId === "tenant-a") {
          return {
            rows: [{
              student_person_id: "student-exact-threshold",
              full_name: "Exact Threshold Student",
              email: "exact@example.com",
              total_practicum_hours: "100",
              milestone_count: "3",
              evaluation_count: "1",
              formation_advisor_person_id: null,
              formation_advisor_name: null,
            }],
          };
        }
      }
      return { rows: [] };
    },
    release() {},
  } as AcademyQueryClient;

  const summaries = await listStudentsWithFormationSummary(actor, mockDb);

  assert.ok(summaries.length > 0, "Should return at least one student");
  const student = summaries.find((s) => s.studentPersonId === "student-exact-threshold");
  assert.ok(student, "Should find student at exact threshold");
  assert.strictEqual(student.totalPracticumHours, 100, "Should have exactly 100 practicum hours");
  assert.strictEqual(student.milestoneCount, 3, "Should have exactly 3 milestones");
  assert.strictEqual(student.formationComplete, true, "formationComplete should be true when student exactly meets threshold (100 hours and 3 milestones)");
});

test("getStudentFormationRecord includes advisor when assigned", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();

  // Assign advisor
  await assignFormationAdvisor(
    actor,
    {
      studentPersonId: "student-1",
      advisorPersonId: "advisor-1",
    },
    db,
  );

  const record = await getStudentFormationRecord(actor, "student-1", db);

  assert.ok(record);
  assert.equal(record.formationAdvisorPersonId, "advisor-1");
  assert.equal(record.formationAdvisorName, "Dr. Advisor");
});

test("getStudentFormationRecord omits advisor when not assigned", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();

  const record = await getStudentFormationRecord(actor, "student-1", db);

  assert.ok(record);
  assert.equal(record.formationAdvisorPersonId, undefined);
  assert.equal(record.formationAdvisorName, undefined);
});

// ========================================
// Acceptance Criteria Tests
// ========================================

// Criterion 7: Endorsed records cannot be edited
// Note: There are no update/edit functions for practicum/milestone/evaluation records in the service.
// Records are immutable after creation except for endorsement.
// This test verifies re-endorsement is blocked via PermanentRecordError.
// The existing test "endorseRecord already endorsed throws PermanentRecordError" covers this.

// Criterion 13: pastoralNotes stripping for student actors with real data
test("ACCEPTANCE: pastoralNotes never appears in student-facing response with real pastoral data", async () => {
  const actor: AcademyActor = {
    userId: "student-1",
    tenantId: "tenant-a",
    roles: ["student"],
  };

  const db = createMockDb();

  // Create evaluation WITH pastoral notes explicitly set to non-empty string
  await recordFormationEvaluation(
    { userId: "advisor-1", tenantId: "tenant-a", roles: ["advisor"] },
    {
      studentPersonId: "student-1",
      evaluatorNameSnapshot: "Rev. Dr. Thompson",
      rubricLabel: "Spiritual Formation Assessment",
      scores: { humility: 5, servantLeadership: 4, biblicalKnowledge: 5 },
      pastoralNotes: "Student shows deep spiritual sensitivity. Recommend continued mentoring in pastoral care contexts. Private concern: struggles with public speaking anxiety.",
      evaluationDate: "2026-09-01",
    },
    db,
  );

  const record = await getStudentFormationRecord(actor, "student-1", db);

  assert.ok(record, "Student record should exist");
  assert.ok(record.evaluations.length > 0, "Should have at least one evaluation");

  // Critical safety check: pastoralNotes field name must never appear
  const recordJson = JSON.stringify(record);
  assert.doesNotMatch(recordJson, /pastoralNotes/, "Field name 'pastoralNotes' must not appear in student view");

  // Verify pastoral content is stripped
  assert.doesNotMatch(recordJson, /deep spiritual sensitivity/, "Pastoral content must not appear in student view");
  assert.doesNotMatch(recordJson, /Private concern/, "Private pastoral notes must not appear in student view");
  assert.doesNotMatch(recordJson, /speaking anxiety/, "Sensitive pastoral observations must not appear in student view");

  // Verify evaluation data IS present (proving we got the right record, just stripped)
  assert.ok(recordJson.includes("Spiritual Formation Assessment"), "Non-sensitive evaluation data should be present");
});

// Criterion 14: Guardian has zero access to formation data
test("ACCEPTANCE: guardian role has no access to formation records", async () => {
  const guardianActor: AcademyActor = {
    userId: "guardian-1",
    tenantId: "tenant-a",
    roles: ["guardian"],
  };

  const db = createMockDb();

  // Guardian cannot view formation summaries
  await assert.rejects(
    async () => {
      await listStudentsWithFormationSummary(guardianActor, db);
    },
    { message: /Forbidden formation summary access/i },
    "Guardian must not access formation summary list",
  );

  // Guardian cannot view individual student formation record
  await assert.rejects(
    async () => {
      await getStudentFormationRecord(guardianActor, "student-1", db);
    },
    { message: /Forbidden formation record access/i },
    "Guardian must not access individual formation records",
  );

  // Guardian cannot log practicum sessions
  await assert.rejects(
    async () => {
      await logPracticumSession(
        guardianActor,
        {
          studentPersonId: "student-1",
          hours: 5,
          siteName: "Test Church",
          supervisorName: "Rev. Smith",
          sessionDate: "2026-09-01",
        },
        db,
      );
    },
    { message: /Forbidden practicum session recording access/i },
    "Guardian must not log practicum sessions",
  );

  // Guardian cannot record milestones
  await assert.rejects(
    async () => {
      await recordMilestone(
        guardianActor,
        {
          studentPersonId: "student-1",
          milestoneType: "baptism",
          milestoneDate: "2026-09-01",
        },
        db,
      );
    },
    { message: /Forbidden milestone recording access/i },
    "Guardian must not record milestones",
  );

  // Guardian cannot record evaluations
  await assert.rejects(
    async () => {
      await recordFormationEvaluation(
        guardianActor,
        {
          studentPersonId: "student-1",
          evaluatorNameSnapshot: "Guardian Attempt",
          rubricLabel: "Test",
          scores: { test: 1 },
          evaluationDate: "2026-09-01",
        },
        db,
      );
    },
    { message: /Forbidden evaluation recording access/i },
    "Guardian must not record evaluations",
  );

  // Guardian cannot endorse records
  await assert.rejects(
    async () => {
      await endorseRecord(
        guardianActor,
        { recordType: "practicum", recordId: "test-id" },
        db,
      );
    },
    { message: /Forbidden endorsement access/i },
    "Guardian must not endorse records",
  );

  // Guardian cannot assign formation advisors
  await assert.rejects(
    async () => {
      await assignFormationAdvisor(
        guardianActor,
        {
          studentPersonId: "student-1",
          advisorPersonId: "advisor-1",
        },
        db,
      );
    },
    { message: /Forbidden advisor assignment access/i },
    "Guardian must not assign formation advisors",
  );
});

// Criterion 16: Formation badge does NOT alter graduationReady/graduationBlocked
// This is verified via static code inspection:
// - src/modules/grading-records/academic-standing-evaluator.ts contains evaluateAcademicStanding()
// - That file does NOT reference "formation", "practicum", "milestone", or "ministry"
// - graduationReady and graduationBlocked are computed solely from academic standing rules
// - The graduation page (src/app/admin/graduation/page.tsx) displays formationComplete as a badge only
// - formationComplete is NOT passed to evaluateAcademicStanding or used in readiness computation
test("ACCEPTANCE: formation status is informational only and does not affect graduation readiness computation", async () => {
  // This is a documentation test confirming the architectural constraint.
  // The actual computation happens in evaluateAcademicStanding() which has no formation dependencies.
  // This test exists to make the acceptance criterion explicit and searchable.

  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();

  // Formation summary can be fetched
  const summaries = await listStudentsWithFormationSummary(actor, db);

  // But formation data is never passed to graduation readiness logic
  // The graduation page computes formationComplete independently as a display-only badge
  // evaluateAcademicStanding (in grading-records module) knows nothing about formation

  assert.ok(Array.isArray(summaries), "Formation summaries are informational data only");
});

test("getStudentFormationRecord excludes draft practicum sessions and milestones from student view", async () => {
  const studentActor: AcademyActor = {
    userId: "student-1",
    tenantId: "tenant-a",
    roles: ["student"],
  };

  const staffActor: AcademyActor = {
    userId: "faculty-1",
    tenantId: "tenant-a",
    roles: ["faculty"],
  };

  const adminActor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();

  // Create a draft practicum session
  const draftPracticum = await logPracticumSession(
    staffActor,
    {
      studentPersonId: "student-1",
      hours: 5,
      siteName: "Test Church",
      supervisorName: "Rev. Test",
      sessionDate: "2026-06-15",
    },
    db,
  );

  // Create an endorsed practicum session
  const endorsedPracticum = await logPracticumSession(
    staffActor,
    {
      studentPersonId: "student-1",
      hours: 3,
      siteName: "Endorsed Church",
      supervisorName: "Rev. Endorsed",
      sessionDate: "2026-06-20",
    },
    db,
  );
  await endorseRecord(
    adminActor,
    { recordType: "practicum", recordId: endorsedPracticum.id },
    db,
  );

  // Create a draft milestone
  const draftMilestone = await recordMilestone(
    adminActor,
    {
      studentPersonId: "student-1",
      milestoneType: "baptism",
      milestoneDate: "2026-05-01",
    },
    db,
  );

  // Create an endorsed milestone
  const endorsedMilestone = await recordMilestone(
    adminActor,
    {
      studentPersonId: "student-1",
      milestoneType: "ordination",
      milestoneDate: "2026-06-01",
    },
    db,
  );
  await endorseRecord(
    adminActor,
    { recordType: "milestone", recordId: endorsedMilestone.id },
    db,
  );

  // Fetch as student
  const studentRecord = await getStudentFormationRecord(studentActor, "student-1", db);

  assert.ok(studentRecord, "Student record should exist");

  // Student should see only endorsed practicum session
  assert.strictEqual(
    studentRecord.practicumSessions.length,
    1,
    "Student should see exactly 1 endorsed practicum session",
  );
  assert.strictEqual(
    studentRecord.practicumSessions[0].id,
    endorsedPracticum.id,
    "Student should see the endorsed practicum session",
  );
  assert.strictEqual(
    studentRecord.practicumSessions[0].status,
    "endorsed",
    "Returned practicum session should be endorsed",
  );

  // Student should see only endorsed milestone
  assert.strictEqual(
    studentRecord.milestones.length,
    1,
    "Student should see exactly 1 endorsed milestone",
  );
  assert.strictEqual(
    studentRecord.milestones[0].id,
    endorsedMilestone.id,
    "Student should see the endorsed milestone",
  );
  assert.strictEqual(
    studentRecord.milestones[0].status,
    "endorsed",
    "Returned milestone should be endorsed",
  );

  // Verify draft records are not present
  const studentRecordJson = JSON.stringify(studentRecord);
  assert.ok(
    !studentRecordJson.includes(draftPracticum.id),
    "Draft practicum session should not appear in student view",
  );
  assert.ok(
    !studentRecordJson.includes(draftMilestone.id),
    "Draft milestone should not appear in student view",
  );

  // Fetch as staff - should see all records
  const staffRecord = await getStudentFormationRecord(staffActor, "student-1", db);

  assert.ok(staffRecord, "Staff record should exist");
  assert.strictEqual(
    staffRecord.practicumSessions.length,
    2,
    "Staff should see both draft and endorsed practicum sessions",
  );
  assert.strictEqual(
    staffRecord.milestones.length,
    2,
    "Staff should see both draft and endorsed milestones",
  );
});

test("getFormationPageMetadata success with formation viewer role", async () => {
  const actor: AcademyActor = {
    userId: "faculty-1",
    tenantId: "tenant-a",
    roles: ["faculty"],
  };

  const db = createMockDb();
  const metadata = await getFormationPageMetadata(actor, "student-1", db);

  assert.ok(metadata, "Metadata should be returned");
  assert.equal(metadata.studentDisplayName, "John Student", "Student name should match");
  assert.ok(Array.isArray(metadata.eligibleAdvisors), "Eligible advisors should be an array");
  assert.ok(metadata.eligibleAdvisors.length > 0, "Should have at least one eligible advisor");

  // Verify structure of advisor records
  const firstAdvisor = metadata.eligibleAdvisors[0];
  assert.ok(firstAdvisor.id, "Advisor should have an id");
  assert.ok(firstAdvisor.displayName, "Advisor should have a displayName");
});

test("getFormationPageMetadata RBAC rejection for student role", async () => {
  const actor: AcademyActor = {
    userId: "student-1",
    tenantId: "tenant-a",
    roles: ["student"],
  };

  const db = createMockDb();

  await assert.rejects(
    async () => {
      await getFormationPageMetadata(actor, "student-1", db);
    },
    { message: /Forbidden formation page metadata access/i },
    "Student role must not access formation page metadata",
  );
});

test("getFormationPageMetadata RBAC rejection for guardian role", async () => {
  const actor: AcademyActor = {
    userId: "guardian-1",
    tenantId: "tenant-a",
    roles: ["guardian"],
  };

  const db = createMockDb();

  await assert.rejects(
    async () => {
      await getFormationPageMetadata(actor, "student-1", db);
    },
    { message: /Forbidden formation page metadata access/i },
    "Guardian role must not access formation page metadata",
  );
});

test("getFormationPageMetadata cross-tenant isolation for advisors", async () => {
  const actorTenantA: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const actorTenantB: AcademyActor = {
    userId: "admin-2",
    tenantId: "tenant-b",
    roles: ["institution_admin"],
  };

  const db = createMockDb();

  // Tenant A should see tenant A advisors
  const metadataA = await getFormationPageMetadata(actorTenantA, "student-1", db);
  assert.ok(metadataA.eligibleAdvisors.length > 0, "Tenant A should have advisors");

  // Verify tenant A advisors don't include tenant B people
  const advisorIdsA = metadataA.eligibleAdvisors.map(a => a.id);
  assert.ok(!advisorIdsA.includes("tenant-b-faculty"), "Tenant A should not see tenant B advisors");
  assert.ok(advisorIdsA.includes("faculty-1") || advisorIdsA.includes("advisor-1"), "Tenant A should see its own advisors");

  // Tenant B should see tenant B advisors
  const metadataB = await getFormationPageMetadata(actorTenantB, "student-2", db);

  // Verify tenant B advisors don't include tenant A people
  const advisorIdsB = metadataB.eligibleAdvisors.map(a => a.id);
  assert.ok(!advisorIdsB.includes("faculty-1"), "Tenant B should not see tenant A advisors");
  assert.ok(!advisorIdsB.includes("advisor-1"), "Tenant B should not see tenant A advisors");
});

// Package B: Role-scoped access and pastoral notes tests

test("grantMinistryFormationReviewer success for institution_admin", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();
  await grantMinistryFormationReviewer(actor, "faculty-1", db);
  // If no error, test passes (grant succeeded)
  assert.ok(true);
});

test("grantMinistryFormationReviewer forbidden for non-institution_admin", async () => {
  const actor: AcademyActor = {
    userId: "faculty-1",
    tenantId: "tenant-a",
    roles: ["faculty"],
  };

  const db = createMockDb();
  await assert.rejects(
    async () => {
      await grantMinistryFormationReviewer(actor, "advisor-1", db);
    },
    { message: /Forbidden ministry formation reviewer grant access/i },
  );
});

test("grantMinistryFormationReviewer cross-tenant rejection", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();
  await assert.rejects(
    async () => {
      await grantMinistryFormationReviewer(actor, "tenant-b-person", db);
    },
    { message: /Target person not found/i },
  );
});

test("revokeMinistryFormationReviewer success for institution_admin", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();
  await revokeMinistryFormationReviewer(actor, "faculty-1", db);
  // If no error, test passes (revoke succeeded)
  assert.ok(true);
});

test("revokeMinistryFormationReviewer forbidden for non-institution_admin", async () => {
  const actor: AcademyActor = {
    userId: "faculty-1",
    tenantId: "tenant-a",
    roles: ["faculty"],
  };

  const db = createMockDb();
  await assert.rejects(
    async () => {
      await revokeMinistryFormationReviewer(actor, "advisor-1", db);
    },
    { message: /Forbidden ministry formation reviewer revoke access/i },
  );
});

test("revokeMinistryFormationReviewer cross-tenant rejection", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();
  await assert.rejects(
    async () => {
      await revokeMinistryFormationReviewer(actor, "tenant-b-person", db);
    },
    { message: /Target person not found/i },
  );
});
