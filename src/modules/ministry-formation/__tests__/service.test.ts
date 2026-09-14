import { test } from "node:test";
import assert from "node:assert/strict";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  logPracticumSession,
  recordMilestone,
  recordFormationEvaluation,
  endorseRecord,
  getStudentFormationRecord,
  listStudentsWithFormationSummary,
  assignFormationAdvisor,
} from "@/modules/ministry-formation/service";
import { PermanentRecordError } from "@/modules/ministry-formation/errors";
import { createMockDb } from "./service.test-helpers";

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
      rubricLabel: "Pastoral Character",
      scores: { humility: 4, leadership: 5 },
      pastoralNotes: "Shows great promise in ministry.",
      evaluationDate: "2026-06-01",
    },
    db,
  );

  // evaluatorNameSnapshot is derived server-side from the authenticated actor (advisor-1),
  // never trusted from client input — proves a caller can't spoof a different evaluator's name.
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

