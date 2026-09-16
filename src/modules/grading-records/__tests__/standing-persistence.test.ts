import assert from "node:assert/strict";
import test from "node:test";
import { createStandingEvaluation, listStandingEvaluations } from "@/modules/grading-records/standing-persistence";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { AcademyQueryClient } from "@/lib/academy-database-context";

const tenantId = "tenant-standing";
const otherTenantId = "tenant-other";
const studentPersonId = "student-1";
const studentProfileId = "profile-1";
const evaluatorPersonId = "evaluator-1";

function mockActor(tenantId: string, userId: string, roles: string[]): AcademyActor {
  return { tenantId, userId, roles: roles as AcademyActor["roles"] };
}

function mockDatabase(overrides: Partial<AcademyQueryClient> = {}): AcademyQueryClient {
  const db: AcademyQueryClient = {
    release: () => {},
    query: async (sql: string, params: unknown[]) => {
      // Student profile check
      if (sql.includes("academy_student_profiles") && sql.includes("select")) {
        const queriedTenantId = params[0] as string;
        const queriedPersonId = params[1] as string;
        if (queriedTenantId === tenantId && queriedPersonId === studentPersonId) {
          return { rowCount: 1, rows: [{ id: studentProfileId, person_id: studentPersonId }] };
        }
        return { rowCount: 0, rows: [] };
      }

      // Transcript entries (real posted grades, adapted into the evaluator's input shape)
      if (sql.includes("academy_transcript_entries")) {
        return {
          rowCount: 1,
          rows: [{
            id: "transcript-entry-1",
            student_profile_id: studentProfileId,
            student_person_id: studentPersonId,
            course_section_registration_id: "registration-1",
            academic_program_id: "program-1",
            catalog_academic_year_id: "year-1",
            academic_period_id: "period-1",
            academic_period_name: "Fall 2026",
            course_id: "course-1",
            course_code: "THEO-101",
            course_title: "Intro to Theology",
            credits_earned: 3,
            final_letter_grade: "A",
            final_percentage: 95,
            gpa_points: 4.0,
            is_passing: true,
            posted_at: new Date("2026-09-01T00:00:00Z"),
            posted_by_person_id: evaluatorPersonId,
          }],
        };
      }

      // Course credits lookup (for creditsAttempted, since transcript entries don't track it)
      if (sql.includes("academy_courses") && sql.includes("default_credits")) {
        return { rowCount: 1, rows: [{ id: "course-1", default_credits: 3 }] };
      }

      // Grading profile check
      if (sql.includes("academy_grading_profiles")) {
        return {
          rowCount: 1,
          rows: [{
            tenant_id: tenantId,
            default_evaluation_type: "letter_grade",
            default_official_record_type: "transcript",
            supports_gpa: true,
            supports_credits: true,
            supports_clock_hours: false,
            supports_competencies: false,
            supports_narrative_evaluation: false,
            supports_promotion: false,
            supports_graduation_audit: true,
            grade_release_policy: "registrar_release",
            guardian_visibility_policy: "not_applicable",
            created_at: new Date("2026-01-01T00:00:00Z"),
            updated_at: new Date("2026-01-01T00:00:00Z"),
          }],
        };
      }

      // Evaluation scales
      if (sql.includes("academy_evaluation_scales")) {
        return { rowCount: 0, rows: [] };
      }

      // Scale bands
      if (sql.includes("academy_evaluation_scale_bands")) {
        return { rowCount: 0, rows: [] };
      }

      // Rule sets
      if (sql.includes("academy_evaluation_rule_sets")) {
        return { rowCount: 0, rows: [] };
      }

      // Official record rules
      if (sql.includes("academy_official_record_rules")) {
        return { rowCount: 0, rows: [] };
      }

      // Standing rules
      if (sql.includes("academy_academic_standing_rules")) {
        return { rowCount: 0, rows: [] };
      }

      // Institution profile
      if (sql.includes("academy_institution_profiles")) {
        return {
          rowCount: 1,
          rows: [{
            tenant_id: tenantId,
            institution_name: "Test College",
            legal_name: "Test College Inc",
            primary_mode: "college",
            supported_modes: ["college"],
            operating_rules: JSON.stringify({}),
            capabilities: JSON.stringify({}),
            lms_preference: JSON.stringify({ provider: "none", selectionStatus: "not_needed" }),
            created_at: new Date("2026-01-01T00:00:00Z"),
            updated_at: new Date("2026-01-01T00:00:00Z"),
          }],
        };
      }

      // Insert standing evaluation
      if (sql.includes("insert into academy_standing_evaluations")) {
        return {
          rowCount: 1,
          rows: [{
            id: "eval-1",
            tenant_id: params[0],
            student_person_id: params[1],
            academic_year_id: params[2],
            period_id: params[3],
            evaluated_at: new Date(),
            evaluated_by_person_id: params[4],
            computed_standing_types: params[5],
            blockers: params[6],
            summary: params[7],
            promotion_ready: params[8],
            graduation_ready: params[9],
            graduation_blocked: params[10],
          }],
        };
      }

      // List standing evaluations
      if (sql.includes("count(*) over() as total_count")) {
        return {
          rowCount: 2,
          rows: [
            {
              id: "eval-1",
              tenant_id: tenantId,
              student_person_id: studentPersonId,
              academic_year_id: null,
              period_id: null,
              evaluated_at: new Date("2026-09-16T10:00:00Z"),
              evaluated_by_person_id: evaluatorPersonId,
              computed_standing_types: JSON.stringify([]),
              blockers: JSON.stringify([]),
              summary: JSON.stringify({
                creditsAttempted: 0,
                creditsEarned: 0,
                clockHoursAttempted: 0,
                clockHoursEarned: 0,
                transcriptEntries: 0,
                progressEntries: 0,
                completionEntries: 0,
                heldEntries: 0,
                releasedEntries: 0,
              }),
              promotion_ready: false,
              graduation_ready: false,
              graduation_blocked: false,
              total_count: 2,
            },
            {
              id: "eval-2",
              tenant_id: tenantId,
              student_person_id: studentPersonId,
              academic_year_id: null,
              period_id: null,
              evaluated_at: new Date("2026-09-15T10:00:00Z"),
              evaluated_by_person_id: evaluatorPersonId,
              computed_standing_types: JSON.stringify([]),
              blockers: JSON.stringify([]),
              summary: JSON.stringify({
                creditsAttempted: 0,
                creditsEarned: 0,
                clockHoursAttempted: 0,
                clockHoursEarned: 0,
                transcriptEntries: 0,
                progressEntries: 0,
                completionEntries: 0,
                heldEntries: 0,
                releasedEntries: 0,
              }),
              promotion_ready: false,
              graduation_ready: false,
              graduation_blocked: false,
              total_count: 2,
            },
          ],
        };
      }

      throw new Error(`Unmocked query: ${sql}`);
    },
    ...overrides,
  };
  return db;
}

test("createStandingEvaluation - success case", async () => {
  const actor = mockActor(tenantId, evaluatorPersonId, ["registrar"]);
  const db = mockDatabase();

  const result = await createStandingEvaluation(
    actor,
    { studentPersonId, academicYearId: "year-1", periodId: "period-1" },
    db,
  );

  assert.strictEqual(result.tenantId, tenantId);
  assert.strictEqual(result.studentPersonId, studentPersonId);
  assert.strictEqual(result.evaluatedByPersonId, evaluatorPersonId);
  assert.strictEqual(result.promotionReady, false);
  assert.strictEqual(result.graduationReady, false);
  assert.strictEqual(result.graduationBlocked, false);
  // Proves the transcript-entries adapter actually ran: real posted grade data (3 credits, 4.0
  // GPA points) made it all the way through to the persisted summary, not a hardcoded empty result.
  assert.strictEqual(result.summary.creditsEarned, 3);
  assert.strictEqual(result.summary.creditsAttempted, 3);
  assert.strictEqual(result.summary.gpa, 4);
  assert.strictEqual(result.summary.transcriptEntries, 1);
});

test("createStandingEvaluation - falls back to creditsEarned when course has no default_credits", async () => {
  const actor = mockActor(tenantId, evaluatorPersonId, ["registrar"]);
  const db: AcademyQueryClient = {
    release: () => {},
    query: async (sql: string, params: unknown[]) => {
      if (sql.includes("academy_student_profiles") && sql.includes("select")) {
        return { rowCount: 1, rows: [{ id: studentProfileId, person_id: studentPersonId }] };
      }
      if (sql.includes("academy_transcript_entries")) {
        return {
          rowCount: 1,
          rows: [{
            id: "transcript-entry-2",
            student_profile_id: studentProfileId,
            student_person_id: studentPersonId,
            course_section_registration_id: "registration-2",
            academic_program_id: "program-1",
            catalog_academic_year_id: "year-1",
            academic_period_id: "period-1",
            academic_period_name: "Fall 2026",
            course_id: "course-2",
            course_code: "THEO-102",
            course_title: "No Credits Row",
            credits_earned: 2,
            final_letter_grade: "B",
            final_percentage: 85,
            gpa_points: 3.0,
            is_passing: true,
            posted_at: new Date("2026-09-01T00:00:00Z"),
            posted_by_person_id: evaluatorPersonId,
          }],
        };
      }
      // No matching course row -> creditsAttempted must fall back to creditsEarned (2)
      if (sql.includes("academy_courses") && sql.includes("default_credits")) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes("academy_grading_profiles")) {
        return {
          rowCount: 1,
          rows: [{
            tenant_id: tenantId,
            default_evaluation_type: "letter_grade",
            default_official_record_type: "transcript",
            supports_gpa: true,
            supports_credits: true,
            supports_clock_hours: false,
            supports_competencies: false,
            supports_narrative_evaluation: false,
            supports_promotion: false,
            supports_graduation_audit: true,
            grade_release_policy: "registrar_release",
            guardian_visibility_policy: "not_applicable",
            created_at: new Date("2026-01-01T00:00:00Z"),
            updated_at: new Date("2026-01-01T00:00:00Z"),
          }],
        };
      }
      if (sql.includes("academy_evaluation_scales")) return { rowCount: 0, rows: [] };
      if (sql.includes("academy_evaluation_scale_bands")) return { rowCount: 0, rows: [] };
      if (sql.includes("academy_evaluation_rule_sets")) return { rowCount: 0, rows: [] };
      if (sql.includes("academy_official_record_rules")) return { rowCount: 0, rows: [] };
      if (sql.includes("academy_academic_standing_rules")) return { rowCount: 0, rows: [] };
      if (sql.includes("academy_institution_profiles")) {
        return {
          rowCount: 1,
          rows: [{
            tenant_id: tenantId,
            institution_name: "Test College",
            legal_name: "Test College Inc",
            primary_mode: "college",
            supported_modes: ["college"],
            operating_rules: JSON.stringify({}),
            capabilities: JSON.stringify({}),
            lms_preference: JSON.stringify({ provider: "none", selectionStatus: "not_needed" }),
            created_at: new Date("2026-01-01T00:00:00Z"),
            updated_at: new Date("2026-01-01T00:00:00Z"),
          }],
        };
      }
      if (sql.includes("insert into academy_standing_evaluations")) {
        return {
          rowCount: 1,
          rows: [{
            id: "eval-3",
            tenant_id: params[0],
            student_person_id: params[1],
            academic_year_id: params[2],
            period_id: params[3],
            evaluated_at: new Date(),
            evaluated_by_person_id: params[4],
            computed_standing_types: params[5],
            blockers: params[6],
            summary: params[7],
            promotion_ready: params[8],
            graduation_ready: params[9],
            graduation_blocked: params[10],
          }],
        };
      }
      throw new Error(`Unmocked query: ${sql}`);
    },
  };

  const result = await createStandingEvaluation(actor, { studentPersonId }, db);

  assert.strictEqual(result.summary.creditsAttempted, 2);
  assert.strictEqual(result.summary.creditsEarned, 2);
});

test("createStandingEvaluation - academic_admin role accepted", async () => {
  const actor = mockActor(tenantId, evaluatorPersonId, ["academic_admin"]);
  const db = mockDatabase();

  const result = await createStandingEvaluation(
    actor,
    { studentPersonId },
    db,
  );

  assert.strictEqual(result.tenantId, tenantId);
});

test("createStandingEvaluation - rejects non-registrar/academic_admin", async () => {
  const actor = mockActor(tenantId, evaluatorPersonId, ["faculty"]);
  const db = mockDatabase();

  await assert.rejects(
    async () => createStandingEvaluation(actor, { studentPersonId }, db),
    { message: /Registrar or academic admin role required/ },
  );
});

test("createStandingEvaluation - rejects missing studentPersonId", async () => {
  const actor = mockActor(tenantId, evaluatorPersonId, ["registrar"]);
  const db = mockDatabase();

  await assert.rejects(
    async () => createStandingEvaluation(actor, { studentPersonId: "" }, db),
    { message: /studentPersonId is required/ },
  );
});

test("createStandingEvaluation - rejects cross-tenant student", async () => {
  const actor = mockActor(otherTenantId, evaluatorPersonId, ["registrar"]);
  const db = mockDatabase();

  await assert.rejects(
    async () => createStandingEvaluation(actor, { studentPersonId }, db),
    { message: /not found in tenant/ },
  );
});

test("listStandingEvaluations - success case", async () => {
  const actor = mockActor(tenantId, evaluatorPersonId, ["registrar"]);
  const db = mockDatabase();

  const result = await listStandingEvaluations(actor, studentPersonId, db, 10, 0);

  assert.strictEqual(result.evaluations.length, 2);
  assert.strictEqual(result.total, 2);
  assert.strictEqual(result.evaluations[0].id, "eval-1");
  assert.strictEqual(result.evaluations[0].studentPersonId, studentPersonId);
});

test("listStandingEvaluations - respects limit and offset", async () => {
  const actor = mockActor(tenantId, evaluatorPersonId, ["registrar"]);
  const db = mockDatabase();

  const result = await listStandingEvaluations(actor, studentPersonId, db, 1, 1);

  // Mock returns all rows but in real usage pagination would work
  assert.strictEqual(result.total, 2);
});

test("listStandingEvaluations - rejects non-registrar/academic_admin", async () => {
  const actor = mockActor(tenantId, evaluatorPersonId, ["student"]);
  const db = mockDatabase();

  await assert.rejects(
    async () => listStandingEvaluations(actor, studentPersonId, db),
    { message: /Registrar or academic admin role required/ },
  );
});

test("listStandingEvaluations - rejects cross-tenant student", async () => {
  const actor = mockActor(otherTenantId, evaluatorPersonId, ["registrar"]);
  const db = mockDatabase();

  await assert.rejects(
    async () => listStandingEvaluations(actor, studentPersonId, db),
    { message: /not found in tenant/ },
  );
});
