import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { AcademyGradingRecordsRepository } from "@/modules/grading-records/postgres-repository";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { GradingProfile } from "@/modules/grading-records/types";

interface MockQueryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

function createMockActor(tenantId = "tenant-1"): AcademyActor {
  return {
    userId: "user-1",
    tenantId,
    roles: ["institution_admin"],
  };
}

function createMockGradingProfile(tenantId = "tenant-1"): GradingProfile {
  return {
    tenantId,
    defaultEvaluationType: "letter_grade",
    defaultOfficialRecordType: "transcript",
    supportsGpa: true,
    supportsCredits: true,
    supportsClockHours: false,
    supportsCompetencies: true,
    supportsNarrativeEvaluation: true,
    supportsPromotion: false,
    supportsGraduationAudit: false,
    gradeReleasePolicy: "registrar_release",
    guardianVisibilityPolicy: "not_applicable",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

function buildEvaluationScaleRow(id: string, tenantId: string) {
  return {
    id,
    tenant_id: tenantId,
    name: "Test Scale",
    scale_type: "letter_grade",
    applies_to_record_type: "transcript",
    narrative_required: false,
    status: "active",
    created_at: new Date(),
    updated_at: new Date(),
  };
}

function buildScaleBandRow(id: string, tenantId: string, scaleId: string) {
  return {
    id,
    tenant_id: tenantId,
    scale_id: scaleId,
    label: "A",
    minimum_value: 90,
    maximum_value: 100,
    grade_points: 4.0,
    is_passing: true,
    is_completion: true,
    official_record_value: "A",
    sequence: 1,
  };
}

function buildRuleSetRow(id: string, tenantId: string, scaleId: string, courseId: string) {
  return {
    id,
    tenant_id: tenantId,
    course_id: courseId,
    section_id: null,
    evaluation_type: "letter_grade",
    scale_id: scaleId,
    record_type: "transcript",
    gpa_policy: "included",
    credit_policy: "attempted_and_earned",
    clock_hour_policy: "not_applicable",
    competency_policy: "not_applicable",
    narrative_policy: "not_required",
    posting_policy: "registrar_posting",
    lms_grade_return_policy: "manual_entry_only",
    status: "active",
    created_at: new Date(),
    updated_at: new Date(),
  };
}

function buildOfficialRecordRuleRow(id: string, tenantId: string) {
  return {
    id,
    tenant_id: tenantId,
    record_type: "transcript",
    applies_to_institution_mode: "seminary",
    posting_authority: "registrar",
    release_policy: "registrar_release",
    included_in_transcript: true,
    included_in_progress_report: false,
    included_in_completion_record: false,
    included_in_promotion: false,
    included_in_graduation_audit: false,
    status: "active",
  };
}

describe("AcademyGradingRecordsRepository write operations", () => {
  describe("createEvaluationScale", () => {
    test("success case", async () => {
      const actor = createMockActor();
      const mockPool: MockQueryable = {
        query: async (sql, params) => {
          assert(sql.includes("insert into academy_evaluation_scales"));
          assert.equal(params[0], actor.tenantId);
          return {
            rowCount: 1,
            rows: [buildEvaluationScaleRow("scale-1", String(params[0]))],
          };
        },
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      const result = await repository.createEvaluationScale(actor, {
        name: "Test Scale",
        scaleType: "letter_grade",
        appliesToRecordType: "transcript",
        status: "active",
      });
      assert.equal(result.id, "scale-1");
      assert.equal(result.tenantId, actor.tenantId);
    });

    test("validation error - missing name", async () => {
      const actor = createMockActor();
      const mockPool: MockQueryable = { query: async () => ({ rowCount: 0, rows: [] }) };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      await assert.rejects(
        async () => repository.createEvaluationScale(actor, {
          name: "",
          scaleType: "letter_grade",
          appliesToRecordType: "transcript",
          status: "active",
        }),
        /name is required/,
      );
    });
  });

  describe("updateEvaluationScale", () => {
    test("success case", async () => {
      const actor = createMockActor();
      const mockPool: MockQueryable = {
        query: async (sql, params) => {
          assert(sql.includes("update academy_evaluation_scales"));
          assert(params.includes(actor.tenantId));
          return {
            rowCount: 1,
            rows: [buildEvaluationScaleRow("scale-1", actor.tenantId)],
          };
        },
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      const result = await repository.updateEvaluationScale(actor, "scale-1", {
        name: "Updated Scale",
      });
      assert.equal(result.id, "scale-1");
    });

    test("cross-tenant rejection", async () => {
      const actor = createMockActor("tenant-1");
      const mockPool: MockQueryable = {
        query: async () => ({ rowCount: 0, rows: [] }),
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      await assert.rejects(
        async () => repository.updateEvaluationScale(actor, "scale-1", { name: "Updated" }),
        /not found or access denied/,
      );
    });
  });

  describe("deleteEvaluationScale", () => {
    test("success case - unreferenced scale", async () => {
      const actor = createMockActor();
      const mockPool: MockQueryable = {
        query: async (sql) => {
          if (sql.includes("select id from academy_evaluation_rule_sets")) {
            return { rowCount: 0, rows: [] };
          }
          assert(sql.includes("delete from academy_evaluation_scales"));
          return { rowCount: 1, rows: [] };
        },
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      await repository.deleteEvaluationScale(actor, "scale-1");
    });

    test("blocked when scale is referenced by rule set", async () => {
      const actor = createMockActor();
      const mockPool: MockQueryable = {
        query: async (sql) => {
          if (sql.includes("select id from academy_evaluation_rule_sets")) {
            return { rowCount: 1, rows: [{ id: "rule-1" }] };
          }
          return { rowCount: 0, rows: [] };
        },
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      await assert.rejects(
        async () => repository.deleteEvaluationScale(actor, "scale-1"),
        /must not be referenced by any evaluation rule sets/,
      );
    });

    test("cross-tenant rejection", async () => {
      const actor = createMockActor("tenant-1");
      const mockPool: MockQueryable = {
        query: async (sql) => {
          if (sql.includes("select id from academy_evaluation_rule_sets")) {
            return { rowCount: 0, rows: [] };
          }
          return { rowCount: 0, rows: [] };
        },
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      await assert.rejects(
        async () => repository.deleteEvaluationScale(actor, "scale-1"),
        /not found or access denied/,
      );
    });
  });

  describe("createScaleBand", () => {
    test("success case", async () => {
      const actor = createMockActor();
      const mockPool: MockQueryable = {
        query: async (sql, params) => {
          if (sql.includes("select id from academy_evaluation_scales")) {
            return { rowCount: 1, rows: [{ id: "scale-1" }] };
          }
          assert(sql.includes("insert into academy_evaluation_scale_bands"));
          assert.equal(params[0], actor.tenantId);
          return {
            rowCount: 1,
            rows: [buildScaleBandRow("band-1", String(params[0]), String(params[1]))],
          };
        },
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      const result = await repository.createScaleBand(actor, {
        scaleId: "scale-1",
        label: "A",
        minimumValue: 90,
        maximumValue: 100,
        gradePoints: 4.0,
        isPassing: true,
        isCompletion: true,
        officialRecordValue: "A",
        sequence: 1,
      });
      assert.equal(result.id, "band-1");
      assert.equal(result.tenantId, actor.tenantId);
    });

    test("validation error - missing label", async () => {
      const actor = createMockActor();
      const mockPool: MockQueryable = { query: async () => ({ rowCount: 0, rows: [] }) };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      await assert.rejects(
        async () => repository.createScaleBand(actor, {
          scaleId: "scale-1",
          label: "",
          isPassing: true,
          isCompletion: false,
          officialRecordValue: "A",
          sequence: 1,
        }),
        /label is required/,
      );
    });

    test("cross-tenant rejection - scaleId belongs to another tenant", async () => {
      const actor = createMockActor("tenant-1");
      const mockPool: MockQueryable = {
        query: async (sql) => {
          if (sql.includes("select id from academy_evaluation_scales")) {
            return { rowCount: 0, rows: [] };
          }
          throw new Error(`Unexpected query in cross-tenant test: ${sql}`);
        },
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      await assert.rejects(
        async () => repository.createScaleBand(actor, {
          scaleId: "tenant-2-scale",
          label: "A",
          isPassing: true,
          isCompletion: false,
          officialRecordValue: "A",
          sequence: 1,
        }),
        /Invalid scaleId: no evaluation scale with that id exists for this tenant/,
      );
    });
  });

  describe("updateScaleBand", () => {
    test("success case", async () => {
      const actor = createMockActor();
      const mockPool: MockQueryable = {
        query: async (sql, params) => {
          assert(sql.includes("update academy_evaluation_scale_bands"));
          assert(params.includes(actor.tenantId));
          return {
            rowCount: 1,
            rows: [buildScaleBandRow("band-1", actor.tenantId, "scale-1")],
          };
        },
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      const result = await repository.updateScaleBand(actor, "band-1", { label: "A+" });
      assert.equal(result.id, "band-1");
    });

    test("cross-tenant rejection", async () => {
      const actor = createMockActor("tenant-1");
      const mockPool: MockQueryable = {
        query: async () => ({ rowCount: 0, rows: [] }),
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      await assert.rejects(
        async () => repository.updateScaleBand(actor, "band-1", { label: "A+" }),
        /not found or access denied/,
      );
    });
  });

  describe("deleteScaleBand", () => {
    test("success case", async () => {
      const actor = createMockActor();
      const mockPool: MockQueryable = {
        query: async (sql) => {
          assert(sql.includes("delete from academy_evaluation_scale_bands"));
          return { rowCount: 1, rows: [] };
        },
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      await repository.deleteScaleBand(actor, "band-1");
    });

    test("cross-tenant rejection", async () => {
      const actor = createMockActor("tenant-1");
      const mockPool: MockQueryable = {
        query: async () => ({ rowCount: 0, rows: [] }),
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      await assert.rejects(
        async () => repository.deleteScaleBand(actor, "band-1"),
        /not found or access denied/,
      );
    });
  });

  describe("createEvaluationRuleSet", () => {
    test("success case", async () => {
      const actor = createMockActor();
      const mockPool: MockQueryable = {
        query: async (sql, params) => {
          if (sql.includes("select id from academy_courses")) {
            return { rowCount: 1, rows: [{ id: "course-1" }] };
          }
          if (sql.includes("select id from academy_evaluation_scales")) {
            return { rowCount: 1, rows: [{ id: "scale-1" }] };
          }
          assert(sql.includes("insert into academy_evaluation_rule_sets"));
          assert.equal(params[0], actor.tenantId);
          return {
            rowCount: 1,
            rows: [buildRuleSetRow("rule-1", String(params[0]), String(params[4]), String(params[1]))],
          };
        },
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      const result = await repository.createEvaluationRuleSet(
        actor,
        {
          courseId: "course-1",
          evaluationType: "letter_grade",
          scaleId: "scale-1",
          recordType: "transcript",
          gpaPolicy: "included",
          creditPolicy: "attempted_and_earned",
          clockHourPolicy: "not_applicable",
          competencyPolicy: "not_applicable",
          narrativePolicy: "not_required",
          postingPolicy: "registrar_posting",
          lmsGradeReturnPolicy: "manual_entry_only",
          status: "active",
        },
        createMockGradingProfile(),
      );
      assert.equal(result.id, "rule-1");
      assert.equal(result.tenantId, actor.tenantId);
    });

    test("validation error - competencyPolicy set when not supported", async () => {
      const actor = createMockActor();
      const mockPool: MockQueryable = { query: async () => ({ rowCount: 0, rows: [] }) };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      const profile = createMockGradingProfile();
      profile.supportsCompetencies = false;
      await assert.rejects(
        async () => repository.createEvaluationRuleSet(
          actor,
          {
            courseId: "course-1",
            evaluationType: "letter_grade",
            scaleId: "scale-1",
            recordType: "transcript",
            gpaPolicy: "included",
            creditPolicy: "attempted_and_earned",
            clockHourPolicy: "not_applicable",
            competencyPolicy: "checklist",
            narrativePolicy: "not_required",
            postingPolicy: "registrar_posting",
            lmsGradeReturnPolicy: "manual_entry_only",
            status: "active",
          },
          profile,
        ),
        /competencyPolicy can only be set when the grading profile supports competencies/,
      );
    });

    test("validation error - narrativePolicy set when not supported", async () => {
      const actor = createMockActor();
      const mockPool: MockQueryable = { query: async () => ({ rowCount: 0, rows: [] }) };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      const profile = createMockGradingProfile();
      profile.supportsNarrativeEvaluation = false;
      await assert.rejects(
        async () => repository.createEvaluationRuleSet(
          actor,
          {
            courseId: "course-1",
            evaluationType: "letter_grade",
            scaleId: "scale-1",
            recordType: "transcript",
            gpaPolicy: "included",
            creditPolicy: "attempted_and_earned",
            clockHourPolicy: "not_applicable",
            competencyPolicy: "not_applicable",
            narrativePolicy: "required",
            postingPolicy: "registrar_posting",
            lmsGradeReturnPolicy: "manual_entry_only",
            status: "active",
          },
          profile,
        ),
        /narrativePolicy can only be 'not_required' when the grading profile does not support narrative evaluation/,
      );
    });

    test("cross-tenant rejection - courseId belongs to another tenant", async () => {
      const actor = createMockActor("tenant-1");
      // The course lookup is always scoped to actor.tenantId in the query itself, so a
      // course that only exists under a different tenant correctly comes back empty here —
      // this simulates that by always returning no rows for the course check.
      const mockPool: MockQueryable = {
        query: async (sql) => {
          if (sql.includes("select id from academy_courses")) {
            return { rowCount: 0, rows: [] };
          }
          throw new Error(`Unexpected query in cross-tenant test: ${sql}`);
        },
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      await assert.rejects(
        async () => repository.createEvaluationRuleSet(
          actor,
          {
            courseId: "tenant-2-course",
            evaluationType: "letter_grade",
            scaleId: "scale-1",
            recordType: "transcript",
            gpaPolicy: "included",
            creditPolicy: "attempted_and_earned",
            clockHourPolicy: "not_applicable",
            competencyPolicy: "not_applicable",
            narrativePolicy: "not_required",
            postingPolicy: "registrar_posting",
            lmsGradeReturnPolicy: "manual_entry_only",
            status: "active",
          },
          createMockGradingProfile("tenant-1"),
        ),
        /Invalid courseId: no course with that id exists for this tenant/,
      );
    });

    test("cross-tenant rejection - scaleId belongs to another tenant", async () => {
      const actor = createMockActor("tenant-1");
      const mockPool: MockQueryable = {
        query: async (sql) => {
          if (sql.includes("select id from academy_courses")) {
            return { rowCount: 1, rows: [{ id: "course-1" }] };
          }
          if (sql.includes("select id from academy_evaluation_scales")) {
            return { rowCount: 0, rows: [] };
          }
          throw new Error(`Unexpected query in cross-tenant test: ${sql}`);
        },
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      await assert.rejects(
        async () => repository.createEvaluationRuleSet(
          actor,
          {
            courseId: "course-1",
            evaluationType: "letter_grade",
            scaleId: "tenant-2-scale",
            recordType: "transcript",
            gpaPolicy: "included",
            creditPolicy: "attempted_and_earned",
            clockHourPolicy: "not_applicable",
            competencyPolicy: "not_applicable",
            narrativePolicy: "not_required",
            postingPolicy: "registrar_posting",
            lmsGradeReturnPolicy: "manual_entry_only",
            status: "active",
          },
          createMockGradingProfile("tenant-1"),
        ),
        /Invalid scaleId: no evaluation scale with that id exists for this tenant/,
      );
    });
  });

  describe("updateEvaluationRuleSet", () => {
    test("success case", async () => {
      const actor = createMockActor();
      const mockPool: MockQueryable = {
        query: async (sql, params) => {
          assert(sql.includes("update academy_evaluation_rule_sets"));
          assert(params.includes(actor.tenantId));
          return {
            rowCount: 1,
            rows: [buildRuleSetRow("rule-1", actor.tenantId, "scale-1", "course-1")],
          };
        },
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      const result = await repository.updateEvaluationRuleSet(
        actor,
        "rule-1",
        { status: "inactive" },
        createMockGradingProfile(),
      );
      assert.equal(result.id, "rule-1");
    });

    test("cross-tenant rejection", async () => {
      const actor = createMockActor("tenant-1");
      const mockPool: MockQueryable = {
        query: async () => ({ rowCount: 0, rows: [] }),
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      await assert.rejects(
        async () => repository.updateEvaluationRuleSet(actor, "rule-1", { status: "inactive" }, createMockGradingProfile()),
        /not found or access denied/,
      );
    });
  });

  describe("deleteEvaluationRuleSet", () => {
    test("success case", async () => {
      const actor = createMockActor();
      const mockPool: MockQueryable = {
        query: async (sql) => {
          assert(sql.includes("delete from academy_evaluation_rule_sets"));
          return { rowCount: 1, rows: [] };
        },
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      await repository.deleteEvaluationRuleSet(actor, "rule-1");
    });

    test("cross-tenant rejection", async () => {
      const actor = createMockActor("tenant-1");
      const mockPool: MockQueryable = {
        query: async () => ({ rowCount: 0, rows: [] }),
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      await assert.rejects(
        async () => repository.deleteEvaluationRuleSet(actor, "rule-1"),
        /not found or access denied/,
      );
    });
  });

  describe("createOfficialRecordRule", () => {
    test("success case", async () => {
      const actor = createMockActor();
      const mockPool: MockQueryable = {
        query: async (sql, params) => {
          assert(sql.includes("insert into academy_official_record_rules"));
          assert.equal(params[0], actor.tenantId);
          return {
            rowCount: 1,
            rows: [buildOfficialRecordRuleRow("rule-1", String(params[0]))],
          };
        },
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      const result = await repository.createOfficialRecordRule(actor, {
        recordType: "transcript",
        appliesToInstitutionMode: "seminary",
        postingAuthority: "registrar",
        releasePolicy: "registrar_release",
        includedInTranscript: true,
        includedInProgressReport: false,
        includedInCompletionRecord: false,
        includedInPromotion: false,
        includedInGraduationAudit: false,
        status: "active",
      });
      assert.equal(result.id, "rule-1");
      assert.equal(result.tenantId, actor.tenantId);
    });

    test("validation error - missing recordType", async () => {
      const actor = createMockActor();
      const mockPool: MockQueryable = { query: async () => ({ rowCount: 0, rows: [] }) };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      await assert.rejects(
        async () => repository.createOfficialRecordRule(actor, {
          recordType: "" as never,
          appliesToInstitutionMode: "seminary",
          postingAuthority: "registrar",
          releasePolicy: "registrar_release",
          includedInTranscript: true,
          includedInProgressReport: false,
          includedInCompletionRecord: false,
          includedInPromotion: false,
          includedInGraduationAudit: false,
          status: "active",
        }),
        /recordType is required/,
      );
    });
  });

  describe("updateOfficialRecordRule", () => {
    test("success case", async () => {
      const actor = createMockActor();
      const mockPool: MockQueryable = {
        query: async (sql, params) => {
          assert(sql.includes("update academy_official_record_rules"));
          assert(params.includes(actor.tenantId));
          return {
            rowCount: 1,
            rows: [buildOfficialRecordRuleRow("rule-1", actor.tenantId)],
          };
        },
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      const result = await repository.updateOfficialRecordRule(actor, "rule-1", {
        status: "inactive",
      });
      assert.equal(result.id, "rule-1");
    });

    test("cross-tenant rejection", async () => {
      const actor = createMockActor("tenant-1");
      const mockPool: MockQueryable = {
        query: async () => ({ rowCount: 0, rows: [] }),
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      await assert.rejects(
        async () => repository.updateOfficialRecordRule(actor, "rule-1", { status: "inactive" }),
        /not found or access denied/,
      );
    });
  });

  describe("deleteOfficialRecordRule", () => {
    test("success case", async () => {
      const actor = createMockActor();
      const mockPool: MockQueryable = {
        query: async (sql) => {
          assert(sql.includes("delete from academy_official_record_rules"));
          return { rowCount: 1, rows: [] };
        },
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      await repository.deleteOfficialRecordRule(actor, "rule-1");
    });

    test("cross-tenant rejection", async () => {
      const actor = createMockActor("tenant-1");
      const mockPool: MockQueryable = {
        query: async () => ({ rowCount: 0, rows: [] }),
      };
      const repository = new AcademyGradingRecordsRepository(mockPool);
      await assert.rejects(
        async () => repository.deleteOfficialRecordRule(actor, "rule-1"),
        /not found or access denied/,
      );
    });
  });
});
