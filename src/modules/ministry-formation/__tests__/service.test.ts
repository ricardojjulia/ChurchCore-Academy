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
} from "@/modules/ministry-formation/service";
import { PermanentRecordError } from "@/modules/ministry-formation/errors";

function createMockDb(): AcademyQueryClient {
  const store = new Map<string, unknown[]>();
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
        return { rows: [] };
      }

      if (text.includes("select * from public.ministry_faith_milestones")) {
        return { rows: [] };
      }

      if (text.includes("select * from public.ministry_formation_evaluations")) {
        const studentId = values![0];
        const rows = Array.from(store.values()).filter(
          (record: unknown) =>
            (record as { student_person_id?: string }).student_person_id === studentId,
        );
        return { rows };
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
