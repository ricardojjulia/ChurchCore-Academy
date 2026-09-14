import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { AcademyQueryClient } from "@/lib/academy-database-context";
import {
  assignFormationAdvisor,
  listStudentsWithFormationSummary,
  getStudentFormationRecord,
  getFormationPageMetadata,
} from "@/modules/ministry-formation/service";
import { createMockDb } from "./service.test-helpers";

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

test("eligible-advisors picker query excludes inactive people (source assertion — the mock DB doesn't execute real SQL, so this locks in the WHERE clause itself)", async () => {
  const source = await readFile(
    join(process.cwd(), "src/modules/ministry-formation/service.ts"),
    "utf8",
  );
  const pickerQueryStart = source.indexOf("Fetch eligible advisors for the person picker");
  assert.ok(pickerQueryStart !== -1, "could not locate the eligible-advisors picker query");
  const pickerQuerySnippet = source.slice(pickerQueryStart, pickerQueryStart + 600);
  assert.match(pickerQuerySnippet, /p\.person_status\s*=\s*'active'/);
});

test("assignFormationAdvisor rejects when studentPersonId is not actually a student", async () => {
  const actor: AcademyActor = {
    userId: "admin-1",
    tenantId: "tenant-a",
    roles: ["institution_admin"],
  };

  const db = createMockDb();

  // "advisor-1" exists in academy_people but has no academy_student_profiles row.
  await assert.rejects(
    async () => {
      await assignFormationAdvisor(
        actor,
        {
          studentPersonId: "advisor-1",
          advisorPersonId: "faculty-1",
        },
        db,
      );
    },
    { message: /Student not found/i },
  );
});

test("assignFormationAdvisor rejects an inactive student", async () => {
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
          studentPersonId: "inactive-student",
          advisorPersonId: "advisor-1",
        },
        db,
      );
    },
    { message: /Student is not active/i },
  );
});

test("assignFormationAdvisor rejects an inactive advisor even with an eligible role", async () => {
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
          advisorPersonId: "inactive-advisor",
        },
        db,
      );
    },
    { message: /Advisor is not active/i },
  );
});

// Package B: Role-scoped access and pastoral notes tests

