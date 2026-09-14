import { test } from "node:test";
import assert from "node:assert/strict";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  getStudentFormationRecord,
  recordFormationEvaluation,
} from "@/modules/ministry-formation/service";
import { createMockDb } from "./service.test-helpers";

test("faculty section-scoping denial: cannot view student not in their sections", async () => {
  const facultyActor: AcademyActor = {
    userId: "faculty-1",
    tenantId: "tenant-a",
    roles: ["faculty"],
  };

  const db = createMockDb();

  // student-2 is NOT in faculty-1's sections (mock only allows student-1)
  await assert.rejects(
    async () => {
      await getStudentFormationRecord(facultyActor, "student-2", db);
    },
    { message: /Faculty can view only students in their sections/i },
  );
});

test("advisor advisee-scoping denial: cannot view student who is not their formation advisee", async () => {
  const advisorActor: AcademyActor = {
    userId: "advisor-1",
    tenantId: "tenant-a",
    roles: ["advisor"],
  };

  const db = createMockDb();

  // student-2 is NOT assigned to advisor-1 as formation advisee
  await assert.rejects(
    async () => {
      await getStudentFormationRecord(advisorActor, "student-2", db);
    },
    { message: /Advisor can view only their assigned formation advisees/i },
  );
});

test("registrar+reviewer cap: registrar with reviewer role must NOT see pastoral notes", async () => {
  const registrarReviewerActor: AcademyActor = {
    userId: "registrar-1",
    tenantId: "tenant-a",
    roles: ["registrar", "ministry_formation_reviewer"],
  };

  const db = createMockDb();

  // Create evaluation with pastoral notes
  const adminActor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  await recordFormationEvaluation(
    adminActor,
    {
      studentPersonId: "student-1",
      evaluatorNameSnapshot: "Admin User",
      rubricLabel: "Formation Progress",
      scores: { ministry: 4, theology: 5 },
      evaluationDate: "2026-06-20",
      pastoralNotes: "CONFIDENTIAL: student disclosed a private family crisis during pastoral care training.",
    },
    db,
  );

  // Fetch record as registrar+reviewer
  const record = await getStudentFormationRecord(registrarReviewerActor, "student-1", db);

  assert.ok(record, "Record should exist");
  const recordJson = JSON.stringify(record);

  // Registrar cap applies regardless of reviewer role
  assert.doesNotMatch(
    recordJson,
    /pastoralNotes/,
    "Registrar must not see pastoralNotes field even with reviewer role",
  );
  assert.doesNotMatch(
    recordJson,
    /CONFIDENTIAL/,
    "Registrar must not see pastoral content even with reviewer role",
  );
  assert.doesNotMatch(
    recordJson,
    /private family crisis/,
    "Registrar must not see sensitive pastoral observations even with reviewer role",
  );
});

test("academic_admin-only rejection: academic_admin without reviewer role cannot access formation records", async () => {
  const academicAdminActor: AcademyActor = {
    userId: "academic-admin-1",
    tenantId: "tenant-a",
    roles: ["academic_admin"],
  };

  const db = createMockDb();

  // academic_admin alone (without reviewer role) should be rejected
  await assert.rejects(
    async () => {
      await getStudentFormationRecord(academicAdminActor, "student-1", db);
    },
    { message: /Forbidden formation record access/i },
  );
});

test("evaluator-without-reviewer sees own pastoral notes", async () => {
  const facultyEvaluatorActor: AcademyActor = {
    userId: "faculty-evaluator",
    tenantId: "tenant-a",
    roles: ["faculty"],
  };

  const db = createMockDb();

  // Faculty evaluator records evaluation with pastoral notes
  await recordFormationEvaluation(
    facultyEvaluatorActor,
    {
      studentPersonId: "student-1",
      evaluatorNameSnapshot: "Faculty Evaluator",
      rubricLabel: "Ministry Readiness",
      scores: { preaching: 4 },
      evaluationDate: "2026-06-21",
      pastoralNotes: "Student shows excellent pastoral instincts.",
    },
    db,
  );

  // Fetch record as the same faculty evaluator (who is in student-1's sections per mock)
  const record = await getStudentFormationRecord(facultyEvaluatorActor, "student-1", db);

  assert.ok(record, "Record should exist");
  const recordJson = JSON.stringify(record);

  // Evaluator should see their own pastoral notes
  assert.match(
    recordJson,
    /excellent pastoral instincts/,
    "Evaluator should see their own pastoral notes",
  );
});

test("non-evaluator faculty does NOT see another evaluator's pastoral notes", async () => {
  const adminActor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();

  // Admin creates evaluation with pastoral notes (evaluator is admin-1)
  await recordFormationEvaluation(
    adminActor,
    {
      studentPersonId: "student-1",
      evaluatorNameSnapshot: "Admin User",
      rubricLabel: "Spiritual Formation",
      scores: { discipleship: 5 },
      evaluationDate: "2026-06-22",
      pastoralNotes: "PRIVATE: student requested prayer for family situation.",
    },
    db,
  );

  // Different faculty member tries to view (faculty-other is NOT the evaluator)
  // This will fail because faculty-other is not in the mock's allowed faculty list
  // So we need to use faculty-1 who IS in the list but is not the evaluator
  const faculty1Actor: AcademyActor = {
    userId: "faculty-1",
    tenantId: "tenant-a",
    roles: ["faculty"],
  };

  const record = await getStudentFormationRecord(faculty1Actor, "student-1", db);

  assert.ok(record, "Record should exist");
  const recordJson = JSON.stringify(record);

  // Faculty-1 is not the evaluator (admin-1 is), so should NOT see pastoral notes
  assert.doesNotMatch(
    recordJson,
    /PRIVATE/,
    "Non-evaluator faculty must not see other evaluator's pastoral notes",
  );
  assert.doesNotMatch(
    recordJson,
    /prayer for family situation/,
    "Non-evaluator faculty must not see sensitive pastoral content",
  );
});
