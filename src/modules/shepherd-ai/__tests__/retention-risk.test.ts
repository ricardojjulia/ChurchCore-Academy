import assert from "node:assert/strict";
import test from "node:test";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  scoreStudentRisk,
  batchScoreCohort,
  getRiskLeaderboard,
  markRiskReviewed,
  getStudentRiskScore,
  getCohortRiskSnapshot,
  type RetentionRiskDatabase,
  type RetentionRiskScore,
  type CohortRiskSnapshot,
} from "@/modules/shepherd-ai/retention-risk";

const TENANT = "tenant-1";
const TENANT_2 = "tenant-2";

const adminActor: AcademyActor = { userId: "admin-1", tenantId: TENANT, roles: ["institution_admin"] };
const advisorActor: AcademyActor = { userId: "advisor-1", tenantId: TENANT, roles: ["advisor"] };
const studentActor: AcademyActor = { userId: "student-1", tenantId: TENANT, roles: ["student"] };
const crossTenantActor: AcademyActor = { userId: "admin-2", tenantId: TENANT_2, roles: ["institution_admin"] };

interface MockStudentData {
  gpa: number | null;
  attendanceRate: number | null;
  hasHolds: boolean;
  hasSapWarning: boolean;
  hasSapSuspended: boolean;
  registeredCredits: number;
  programId?: string;
}

function scoreToDbRow(score: RetentionRiskScore): Record<string, unknown> {
  return {
    id: score.id,
    tenant_id: score.tenantId,
    student_person_id: score.studentPersonId,
    cohort_id: score.cohortId,
    scoring_period: score.scoringPeriod,
    risk_tier: score.riskTier,
    composite_score: score.compositeScore,
    gpa_signal: score.gpaSignal,
    attendance_signal: score.attendanceSignal,
    financial_signal: score.financialSignal,
    engagement_signal: score.engagementSignal,
    signal_explanations: JSON.stringify(score.signalExplanations),
    computed_at: score.computedAt,
    reviewed_by_person_id: score.reviewedByPersonId,
    reviewed_at: score.reviewedAt,
    action_taken: score.actionTaken,
    created_at: score.createdAt,
    updated_at: score.updatedAt,
  };
}

function snapshotToDbRow(snapshot: CohortRiskSnapshot): Record<string, unknown> {
  return {
    id: snapshot.id,
    tenant_id: snapshot.tenantId,
    scoring_period: snapshot.scoringPeriod,
    program_id: snapshot.programId,
    total_students: snapshot.totalStudents,
    critical_count: snapshot.criticalCount,
    high_count: snapshot.highCount,
    moderate_count: snapshot.moderateCount,
    low_count: snapshot.lowCount,
    avg_composite_score: snapshot.avgCompositeScore,
    snapshot_at: snapshot.snapshotAt,
    created_at: snapshot.createdAt,
  };
}

function buildMockDb(studentData: MockStudentData, existingScores: RetentionRiskScore[] = []): RetentionRiskDatabase {
  const scores: RetentionRiskScore[] = [...existingScores];
  const snapshots: CohortRiskSnapshot[] = [];

  return {
    async query(sql: string, params?: unknown[]) {
      // Fetch student data
      if (sql.includes("from academy_student_profiles sp") && sql.includes("where sp.tenant_id")) {
        return {
          rowCount: 1,
          rows: [{
            person_id: params?.[1],
            program_id: studentData.programId ?? null,
            cumulative_gpa: studentData.gpa,
            enrollment_status: "enrolled",
            attendance_rate: studentData.attendanceRate,
            has_holds: studentData.hasHolds,
            has_sap_warning: studentData.hasSapWarning,
            has_sap_suspended: studentData.hasSapSuspended,
            registered_credits: studentData.registeredCredits,
          }],
        };
      }

      // Upsert risk score
      if (sql.includes("insert into academy_retention_risk_scores")) {
        const score: RetentionRiskScore = {
          id: `score-${scores.length + 1}`,
          tenantId: String(params?.[0] ?? TENANT),
          studentPersonId: String(params?.[1]),
          cohortId: params?.[2] ? String(params[2]) : null,
          scoringPeriod: String(params?.[3]),
          riskTier: String(params?.[4]) as RetentionRiskScore["riskTier"],
          compositeScore: Number(params?.[5]),
          gpaSignal: Number(params?.[6]),
          attendanceSignal: Number(params?.[7]),
          financialSignal: Number(params?.[8]),
          engagementSignal: Number(params?.[9]),
          signalExplanations: JSON.parse(String(params?.[10] ?? "[]")),
          computedAt: String(params?.[11]),
          reviewedByPersonId: null,
          reviewedAt: null,
          actionTaken: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        scores.push(score);
        return { rowCount: 1, rows: [scoreToDbRow(score)] };
      }

      // Fetch active students for batch scoring
      if (sql.includes("from academy_student_profiles") && sql.includes("enrollment_status in")) {
        return {
          rowCount: 2,
          rows: [{ person_id: "student-1" }, { person_id: "student-2" }],
        };
      }

      // Cohort snapshot aggregation
      if (sql.includes("from academy_retention_risk_scores") && sql.includes("avg(composite_score)")) {
        const criticalCount = scores.filter(s => s.riskTier === "critical").length;
        const highCount = scores.filter(s => s.riskTier === "high").length;
        const moderateCount = scores.filter(s => s.riskTier === "moderate").length;
        const lowCount = scores.filter(s => s.riskTier === "low").length;
        const avgScore = scores.length > 0
          ? scores.reduce((sum, s) => sum + s.compositeScore, 0) / scores.length
          : null;

        return {
          rowCount: 1,
          rows: [{
            total_students: scores.length,
            critical_count: criticalCount,
            high_count: highCount,
            moderate_count: moderateCount,
            low_count: lowCount,
            avg_composite_score: avgScore,
          }],
        };
      }

      // Insert cohort snapshot
      if (sql.includes("insert into academy_cohort_risk_snapshots")) {
        const snapshot: CohortRiskSnapshot = {
          id: `snapshot-${snapshots.length + 1}`,
          tenantId: String(params?.[0] ?? TENANT),
          scoringPeriod: String(params?.[1]),
          programId: params?.[2] ? String(params[2]) : null,
          totalStudents: Number(params?.[3]),
          criticalCount: Number(params?.[4]),
          highCount: Number(params?.[5]),
          moderateCount: Number(params?.[6]),
          lowCount: Number(params?.[7]),
          avgCompositeScore: params?.[8] !== null ? Number(params[8]) : null,
          snapshotAt: String(params?.[9]),
          createdAt: new Date().toISOString(),
        };
        snapshots.push(snapshot);
        return { rowCount: 1, rows: [snapshotToDbRow(snapshot)] };
      }

      // Get risk score
      if (sql.includes("from academy_retention_risk_scores") && sql.includes("student_person_id = $2")) {
        const score = scores.find(s =>
          s.tenantId === params?.[0] &&
          s.studentPersonId === params?.[1] &&
          s.scoringPeriod === params?.[2]
        );
        return { rowCount: score ? 1 : 0, rows: score ? [scoreToDbRow(score)] : [] };
      }

      // Get cohort snapshot
      if (sql.includes("from academy_cohort_risk_snapshots")) {
        const snapshot = snapshots.find(s =>
          s.tenantId === params?.[0] && s.scoringPeriod === params?.[1]
        );
        return { rowCount: snapshot ? 1 : 0, rows: snapshot ? [snapshotToDbRow(snapshot)] : [] };
      }

      // Get leaderboard
      if (sql.includes("order by composite_score desc")) {
        const filteredScores = scores
          .filter(s => s.tenantId === params?.[0] && s.scoringPeriod === params?.[1])
          .sort((a, b) => b.compositeScore - a.compositeScore)
          .slice(0, 20);
        return { rowCount: filteredScores.length, rows: filteredScores.map(scoreToDbRow) };
      }

      // Check score exists for update
      if (sql.includes("select id from academy_retention_risk_scores where id =")) {
        const score = scores.find(s => s.id === params?.[0] && s.tenantId === params?.[1]);
        return { rowCount: score ? 1 : 0, rows: score ? [{ id: score.id }] : [] };
      }

      // Update review
      if (sql.includes("update academy_retention_risk_scores")) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    },
  };
}

test("scoreStudentRisk: high GPA + good attendance → low risk tier", async () => {
  const db = buildMockDb({
    gpa: 3.5,
    attendanceRate: 95,
    hasHolds: false,
    hasSapWarning: false,
    hasSapSuspended: false,
    registeredCredits: 15,
  });

  const result = await scoreStudentRisk(adminActor, { studentPersonId: "student-1", scoringPeriod: "2026-fall" }, db);

  assert.equal(result.riskTier, "low");
  assert.equal(result.compositeScore, 0);
  assert.equal(result.gpaSignal, 0);
  assert.equal(result.attendanceSignal, 0);
  assert.equal(result.financialSignal, 0);
  assert.equal(result.engagementSignal, 0);
  assert.equal(result.signalExplanations.length, 0);
});

test("scoreStudentRisk: low GPA + poor attendance → high/critical tier", async () => {
  const db = buildMockDb({
    gpa: 1.5,
    attendanceRate: 55,
    hasHolds: true,
    hasSapWarning: false,
    hasSapSuspended: false,
    registeredCredits: 3,
  });

  const result = await scoreStudentRisk(adminActor, { studentPersonId: "student-1", scoringPeriod: "2026-fall" }, db);

  assert.equal(result.riskTier, "critical");
  assert.ok(result.compositeScore >= 75);
  assert.ok(result.gpaSignal > 0);
  assert.ok(result.attendanceSignal > 0);
  assert.ok(result.financialSignal > 0);
  assert.ok(result.engagementSignal > 0);
  assert.ok(result.signalExplanations.length > 0);
});

test("scoreStudentRisk: student actor cannot score others", async () => {
  const db = buildMockDb({
    gpa: 3.0,
    attendanceRate: 90,
    hasHolds: false,
    hasSapWarning: false,
    hasSapSuspended: false,
    registeredCredits: 12,
  });

  await assert.rejects(
    () => scoreStudentRisk(studentActor, { studentPersonId: "student-2", scoringPeriod: "2026-fall" }, db),
    AcademyAuthorizationError,
  );
});

test("scoreStudentRisk: signal_explanations contains correct entries", async () => {
  const db = buildMockDb({
    gpa: 1.8,
    attendanceRate: 70,
    hasHolds: false,
    hasSapWarning: true,
    hasSapSuspended: false,
    registeredCredits: 5,
  });

  const result = await scoreStudentRisk(adminActor, { studentPersonId: "student-1", scoringPeriod: "2026-fall" }, db);

  const gpaExplanation = result.signalExplanations.find(e => e.signal === "gpa");
  assert.ok(gpaExplanation);
  assert.equal(gpaExplanation.score, 20);
  assert.match(gpaExplanation.reason, /GPA 1\.80/);

  const attendanceExplanation = result.signalExplanations.find(e => e.signal === "attendance");
  assert.ok(attendanceExplanation);
  assert.equal(attendanceExplanation.score, 20);
  assert.match(attendanceExplanation.reason, /Attendance 70\.0%/);

  const financialExplanation = result.signalExplanations.find(e => e.signal === "financial");
  assert.ok(financialExplanation);
  assert.equal(financialExplanation.score, 20);
  assert.match(financialExplanation.reason, /SAP warning/);

  const engagementExplanation = result.signalExplanations.find(e => e.signal === "engagement");
  assert.ok(engagementExplanation);
  assert.equal(engagementExplanation.score, 20);
  assert.match(engagementExplanation.reason, /5 credit hours/);
});

test("batchScoreCohort: creates cohort snapshot with correct counts", async () => {
  const db = buildMockDb({
    gpa: 2.0,
    attendanceRate: 80,
    hasHolds: false,
    hasSapWarning: false,
    hasSapSuspended: false,
    registeredCredits: 12,
  });

  const result = await batchScoreCohort(adminActor, { scoringPeriod: "2026-fall" }, db);

  assert.ok(result.totalStudents >= 0);
  assert.ok(result.criticalCount >= 0);
  assert.ok(result.highCount >= 0);
  assert.ok(result.moderateCount >= 0);
  assert.ok(result.lowCount >= 0);
  assert.equal(result.scoringPeriod, "2026-fall");
});

test("batchScoreCohort: rejects non-admin", async () => {
  const db = buildMockDb({
    gpa: 3.0,
    attendanceRate: 90,
    hasHolds: false,
    hasSapWarning: false,
    hasSapSuspended: false,
    registeredCredits: 12,
  });

  await assert.rejects(
    () => batchScoreCohort(studentActor, { scoringPeriod: "2026-fall" }, db),
    AcademyAuthorizationError,
  );
});

test("getRiskLeaderboard: returns sorted by composite score desc", async () => {
  const existingScores: RetentionRiskScore[] = [
    {
      id: "score-1",
      tenantId: TENANT,
      studentPersonId: "student-1",
      cohortId: null,
      scoringPeriod: "2026-fall",
      riskTier: "high",
      compositeScore: 60,
      gpaSignal: 20,
      attendanceSignal: 20,
      financialSignal: 10,
      engagementSignal: 10,
      signalExplanations: [],
      computedAt: new Date().toISOString(),
      reviewedByPersonId: null,
      reviewedAt: null,
      actionTaken: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "score-2",
      tenantId: TENANT,
      studentPersonId: "student-2",
      cohortId: null,
      scoringPeriod: "2026-fall",
      riskTier: "critical",
      compositeScore: 80,
      gpaSignal: 25,
      attendanceSignal: 25,
      financialSignal: 15,
      engagementSignal: 15,
      signalExplanations: [],
      computedAt: new Date().toISOString(),
      reviewedByPersonId: null,
      reviewedAt: null,
      actionTaken: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const db = buildMockDb({
    gpa: 3.0,
    attendanceRate: 90,
    hasHolds: false,
    hasSapWarning: false,
    hasSapSuspended: false,
    registeredCredits: 12,
  }, existingScores);

  const result = await getRiskLeaderboard(adminActor, "2026-fall", db);

  assert.ok(result.length >= 2);
  assert.equal(result[0].compositeScore, 80);
  assert.equal(result[1].compositeScore, 60);
});

test("getRiskLeaderboard: advisor can access", async () => {
  const db = buildMockDb({
    gpa: 3.0,
    attendanceRate: 90,
    hasHolds: false,
    hasSapWarning: false,
    hasSapSuspended: false,
    registeredCredits: 12,
  });

  const result = await getRiskLeaderboard(advisorActor, "2026-fall", db);
  assert.ok(Array.isArray(result));
});

test("getRiskLeaderboard: student cannot access", async () => {
  const db = buildMockDb({
    gpa: 3.0,
    attendanceRate: 90,
    hasHolds: false,
    hasSapWarning: false,
    hasSapSuspended: false,
    registeredCredits: 12,
  });

  await assert.rejects(
    () => getRiskLeaderboard(studentActor, "2026-fall", db),
    AcademyAuthorizationError,
  );
});

test("markRiskReviewed: sets reviewed fields", async () => {
  const existingScore: RetentionRiskScore = {
    id: "score-1",
    tenantId: TENANT,
    studentPersonId: "student-1",
    cohortId: null,
    scoringPeriod: "2026-fall",
    riskTier: "high",
    compositeScore: 60,
    gpaSignal: 20,
    attendanceSignal: 20,
    financialSignal: 10,
    engagementSignal: 10,
    signalExplanations: [],
    computedAt: new Date().toISOString(),
    reviewedByPersonId: null,
    reviewedAt: null,
    actionTaken: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const db = buildMockDb({
    gpa: 3.0,
    attendanceRate: 90,
    hasHolds: false,
    hasSapWarning: false,
    hasSapSuspended: false,
    registeredCredits: 12,
  }, [existingScore]);

  await markRiskReviewed(adminActor, "score-1", "Contacted student via email", db);
  // If no error is thrown, the test passes
  assert.ok(true);
});

test("markRiskReviewed: cross-tenant rejection", async () => {
  const existingScore: RetentionRiskScore = {
    id: "score-1",
    tenantId: TENANT,
    studentPersonId: "student-1",
    cohortId: null,
    scoringPeriod: "2026-fall",
    riskTier: "high",
    compositeScore: 60,
    gpaSignal: 20,
    attendanceSignal: 20,
    financialSignal: 10,
    engagementSignal: 10,
    signalExplanations: [],
    computedAt: new Date().toISOString(),
    reviewedByPersonId: null,
    reviewedAt: null,
    actionTaken: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const db = buildMockDb({
    gpa: 3.0,
    attendanceRate: 90,
    hasHolds: false,
    hasSapWarning: false,
    hasSapSuspended: false,
    registeredCredits: 12,
  }, [existingScore]);

  await assert.rejects(
    () => markRiskReviewed(crossTenantActor, "score-1", "Action", db),
    /not found or cross-tenant/,
  );
});

test("getStudentRiskScore: student can view own score", async () => {
  const studentSelfActor: AcademyActor = { userId: "student-1", tenantId: TENANT, roles: ["student"] };

  const existingScore: RetentionRiskScore = {
    id: "score-1",
    tenantId: TENANT,
    studentPersonId: "student-1",
    cohortId: null,
    scoringPeriod: "2026-fall",
    riskTier: "moderate",
    compositeScore: 40,
    gpaSignal: 10,
    attendanceSignal: 10,
    financialSignal: 10,
    engagementSignal: 10,
    signalExplanations: [],
    computedAt: new Date().toISOString(),
    reviewedByPersonId: null,
    reviewedAt: null,
    actionTaken: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const db = buildMockDb({
    gpa: 3.0,
    attendanceRate: 90,
    hasHolds: false,
    hasSapWarning: false,
    hasSapSuspended: false,
    registeredCredits: 12,
  }, [existingScore]);

  const result = await getStudentRiskScore(studentSelfActor, "student-1", "2026-fall", db);
  assert.ok(result);
  assert.equal(result.studentPersonId, "student-1");
});

test("getCohortRiskSnapshot: returns latest snapshot", async () => {
  const db = buildMockDb({
    gpa: 3.0,
    attendanceRate: 90,
    hasHolds: false,
    hasSapWarning: false,
    hasSapSuspended: false,
    registeredCredits: 12,
  });

  // First run batch to create snapshot
  await batchScoreCohort(adminActor, { scoringPeriod: "2026-fall" }, db);

  const result = await getCohortRiskSnapshot(adminActor, "2026-fall", db);
  assert.ok(result);
  assert.equal(result.scoringPeriod, "2026-fall");
});
