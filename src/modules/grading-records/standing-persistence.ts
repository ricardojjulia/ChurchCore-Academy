import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import type { AcademyQueryClient } from "@/lib/academy-database-context";
import { evaluateAcademicStanding } from "@/modules/grading-records/academic-standing-evaluator";
import type { OfficialRecordEntryEvaluation } from "@/modules/grading-records/official-record-evaluator";
import { AcademyGradingRecordsRepository } from "@/modules/grading-records/postgres-repository";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import type { StandingType } from "@/modules/grading-records/types";
import { TranscriptEntryService } from "@/modules/transcript-entries/service";
import { PostgresTranscriptEntryRepository } from "@/modules/transcript-entries/postgres-repository";
import type { TranscriptEntry } from "@/modules/transcript-entries/types";

// Best-effort adapter: the grading-records evaluator pipeline
// (official-record-evaluator.ts -> academic-standing-evaluator.ts) was built for a rule-set-based
// grading model (competency/narrative grading, shipped same-day as this feature) that has no real
// data anywhere in this codebase yet — nothing has ever written an EvaluationResultInput. The
// actual posted student grades live in the older, structurally different `academy_transcript_entries`
// table (letter grade, GPA points, credits earned — no ruleSetId, no clock hours, no inclusion
// flags). This function maps that real data into the evaluator's expected
// OfficialRecordEntryEvaluation shape so standing evaluations reflect real academic history
// instead of always being empty. Documented, deliberate approximations, chosen by the product
// owner over shipping a persistence-only feature that never evaluates real data:
//   - ruleSetId is a placeholder ("legacy-transcript-entry") since transcript entries aren't tied
//     to a rule set; it only matters for competency/completion-record substring matching, which
//     correctly finds nothing for transcript-derived entries (they aren't competency records).
//   - creditsAttempted comes from the course's own default_credits (falling back to creditsEarned
//     if a course record is missing/has no default) rather than from creditsEarned directly —
//     using creditsEarned would silently zero out GPA-weighted credit for FAILING grades (0
//     credits earned), which is exactly backwards: failing grades are what should pull GPA down.
//   - clockHoursAttempted/clockHoursEarned are always 0 — academy_transcript_entries has no clock-
//     hour columns anywhere in this schema. A clock-hour-based standing rule (minimumClockHours)
//     will therefore always report a blocker for every student evaluated through this adapter.
//     This is a known, real limitation, not a bug — there is no clock-hour data source to draw on.
//   - includedInPromotion/includedInGraduationAudit are set true (a posted transcript grade should
//     count toward promotion/graduation eligibility); includedInProgressReport/includedInCompletionRecord
//     are false (transcript entries are letter-grade records, not progress or completion records).
async function loadOfficialRecordEntriesFromTranscript(
  actor: AcademyActor,
  studentProfileId: string,
  db: AcademyQueryClient,
): Promise<OfficialRecordEntryEvaluation[]> {
  const transcriptService = new TranscriptEntryService(
    new PostgresTranscriptEntryRepository(asAcademyDatabase(db)),
  );
  const entries: TranscriptEntry[] = await transcriptService.listByStudent(actor, studentProfileId);

  if (entries.length === 0) return [];

  const courseIds = [...new Set(entries.map((entry) => entry.courseId))];
  const courseCreditsResult = await db.query(
    `select id, default_credits from academy_courses where tenant_id = $1 and id = any($2::text[])`,
    [actor.tenantId, courseIds],
  ) as { rows: Array<{ id: string; default_credits: string | number | null }> };
  const courseCredits = new Map<string, number>(
    courseCreditsResult.rows
      .filter((row) => row.default_credits !== null)
      .map((row) => [row.id, Number(row.default_credits)]),
  );

  return entries.map((entry): OfficialRecordEntryEvaluation => ({
    evaluationResultId: entry.id,
    tenantId: actor.tenantId,
    studentPersonId: entry.studentPersonId,
    ruleSetId: "legacy-transcript-entry",
    courseId: entry.courseId,
    academicYearId: entry.catalogAcademicYearId,
    academicPeriodId: entry.academicPeriodId,
    recordType: "transcript",
    recordValue: entry.finalLetterGrade ?? (entry.finalPercentage !== undefined ? String(entry.finalPercentage) : ""),
    gradePoints: entry.gpaPoints,
    creditsAttempted: courseCredits.get(entry.courseId) ?? entry.creditsEarned,
    creditsEarned: entry.creditsEarned,
    clockHoursAttempted: 0,
    clockHoursEarned: 0,
    guardianVisible: true,
    includedInTranscript: true,
    includedInProgressReport: false,
    includedInCompletionRecord: false,
    includedInPromotion: true,
    includedInGraduationAudit: true,
    status: "posted",
  }));
}

const STANDING_EVALUATION_ROLES = new Set<AcademyRole>(["registrar", "academic_admin"]);

function assertStandingEvaluationAccess(actor: AcademyActor): void {
  if (!actor.roles.some((r) => STANDING_EVALUATION_ROLES.has(r))) {
    throw new AcademyAuthorizationError("Registrar or academic admin role required for academic standing evaluation.");
  }
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export interface StandingEvaluationInput {
  studentPersonId: string;
  academicYearId?: string;
  periodId?: string;
}

export interface StandingEvaluation {
  id: string;
  tenantId: string;
  studentPersonId: string;
  academicYearId: string | null;
  periodId: string | null;
  evaluatedAt: string;
  evaluatedByPersonId: string;
  computedStandingTypes: StandingType[];
  blockers: string[];
  summary: {
    gpa?: number;
    creditsAttempted: number;
    creditsEarned: number;
    clockHoursAttempted: number;
    clockHoursEarned: number;
    transcriptEntries: number;
    progressEntries: number;
    completionEntries: number;
    heldEntries: number;
    releasedEntries: number;
  };
  promotionReady: boolean;
  graduationReady: boolean;
  graduationBlocked: boolean;
}

function mapEvaluationRow(row: Record<string, unknown>): StandingEvaluation {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentPersonId: String(row.student_person_id),
    academicYearId: row.academic_year_id ? String(row.academic_year_id) : null,
    periodId: row.period_id ? String(row.period_id) : null,
    evaluatedAt: toIsoString(row.evaluated_at),
    evaluatedByPersonId: String(row.evaluated_by_person_id),
    computedStandingTypes: typeof row.computed_standing_types === "string"
      ? JSON.parse(row.computed_standing_types)
      : (row.computed_standing_types as StandingType[]),
    blockers: typeof row.blockers === "string"
      ? JSON.parse(row.blockers)
      : (row.blockers as string[]),
    summary: typeof row.summary === "string"
      ? JSON.parse(row.summary)
      : (row.summary as StandingEvaluation["summary"]),
    promotionReady: Boolean(row.promotion_ready),
    graduationReady: Boolean(row.graduation_ready),
    graduationBlocked: Boolean(row.graduation_blocked),
  };
}

export async function createStandingEvaluation(
  actor: AcademyActor,
  input: StandingEvaluationInput,
  db: AcademyQueryClient,
): Promise<StandingEvaluation> {
  assertStandingEvaluationAccess(actor);

  if (!input.studentPersonId) {
    throw new Error("studentPersonId is required.");
  }

  // Verify the student exists in this tenant
  const studentCheck = await db.query(
    `select sp.id, sp.person_id
     from academy_student_profiles sp
     where sp.tenant_id = $1 and sp.person_id = $2`,
    [actor.tenantId, input.studentPersonId],
  ) as { rows: Array<{ id: string; person_id: string }> };

  if (!studentCheck.rows.length) {
    throw new AcademyAuthorizationError(`Student ${input.studentPersonId} not found in tenant.`);
  }
  const studentProfileId = studentCheck.rows[0].id;

  // Load grading configuration
  const repository = new AcademyGradingRecordsRepository(asAcademyDatabase(db));
  const config = await repository.fetchGradingRecordsConfiguration(actor.tenantId);

  // Load the student's real posted grades from academy_transcript_entries, adapted into the
  // evaluator's expected shape — see loadOfficialRecordEntriesFromTranscript's doc comment for
  // why this adapter exists and what it approximates.
  const entries = await loadOfficialRecordEntriesFromTranscript(actor, studentProfileId, db);

  // Evaluate academic standing directly from the real entries — evaluateOfficialRecords() is not
  // used here since transcript entries are already-posted official records, not raw draft
  // evaluation-results pending posting through a rule set (the `summary` field on this input is
  // unused by evaluateAcademicStanding, which recomputes summary internally from `entries`).
  const standingResult = evaluateAcademicStanding(config, {
    entries,
    summary: {
      creditsAttempted: 0,
      creditsEarned: 0,
      clockHoursAttempted: 0,
      clockHoursEarned: 0,
      transcriptEntries: 0,
      progressEntries: 0,
      completionEntries: 0,
      heldEntries: 0,
      releasedEntries: 0,
    },
    warnings: [],
  });

  // Find the student's result (should be exactly one since we filtered to one student)
  const studentStanding = standingResult.students.find(s => s.studentPersonId === input.studentPersonId);

  if (!studentStanding) {
    // No records means empty standing evaluation (valid case)
    const emptyStanding = {
      standingTypes: [],
      blockers: [],
      summary: {
        creditsAttempted: 0,
        creditsEarned: 0,
        clockHoursAttempted: 0,
        clockHoursEarned: 0,
        transcriptEntries: 0,
        progressEntries: 0,
        completionEntries: 0,
        heldEntries: 0,
        releasedEntries: 0,
      },
      promotionReady: false,
      graduationReady: false,
      graduationBlocked: false,
    };

    // Insert the evaluation
    const result = await db.query(
      `insert into academy_standing_evaluations
         (tenant_id, student_person_id, academic_year_id, period_id, evaluated_by_person_id,
          computed_standing_types, blockers, summary, promotion_ready, graduation_ready, graduation_blocked)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10, $11)
       returning *`,
      [
        actor.tenantId,
        input.studentPersonId,
        input.academicYearId ?? null,
        input.periodId ?? null,
        actor.userId,
        JSON.stringify(emptyStanding.standingTypes),
        JSON.stringify(emptyStanding.blockers),
        JSON.stringify(emptyStanding.summary),
        emptyStanding.promotionReady,
        emptyStanding.graduationReady,
        emptyStanding.graduationBlocked,
      ],
    ) as { rows: Record<string, unknown>[] };

    const row = result.rows[0];
    if (!row) throw new Error("Failed to create standing evaluation.");
    return mapEvaluationRow(row);
  }

  // Insert the evaluation
  const result = await db.query(
    `insert into academy_standing_evaluations
       (tenant_id, student_person_id, academic_year_id, period_id, evaluated_by_person_id,
        computed_standing_types, blockers, summary, promotion_ready, graduation_ready, graduation_blocked)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10, $11)
     returning *`,
    [
      actor.tenantId,
      input.studentPersonId,
      input.academicYearId ?? null,
      input.periodId ?? null,
      actor.userId,
      JSON.stringify(studentStanding.standingTypes),
      JSON.stringify(studentStanding.blockers),
      JSON.stringify(studentStanding.summary),
      studentStanding.promotionReady,
      studentStanding.graduationReady,
      studentStanding.graduationBlocked,
    ],
  ) as { rows: Record<string, unknown>[] };

  const row = result.rows[0];
  if (!row) throw new Error("Failed to create standing evaluation.");
  return mapEvaluationRow(row);
}

export interface StandingEvaluationListResult {
  evaluations: StandingEvaluation[];
  total: number;
}

export async function listStandingEvaluations(
  actor: AcademyActor,
  studentPersonId: string,
  db: AcademyQueryClient,
  limit = 10,
  offset = 0,
): Promise<StandingEvaluationListResult> {
  assertStandingEvaluationAccess(actor);

  if (!studentPersonId) {
    throw new Error("studentPersonId is required.");
  }

  // Verify the student exists in this tenant
  const studentCheck = await db.query(
    `select person_id from academy_student_profiles where tenant_id = $1 and person_id = $2`,
    [actor.tenantId, studentPersonId],
  ) as { rows: Array<{ person_id: string }> };

  if (!studentCheck.rows.length) {
    throw new AcademyAuthorizationError(`Student ${studentPersonId} not found in tenant.`);
  }

  // Get the evaluations
  const result = await db.query(
    `select *, count(*) over() as total_count
     from academy_standing_evaluations
     where tenant_id = $1 and student_person_id = $2
     order by evaluated_at desc
     limit $3 offset $4`,
    [actor.tenantId, studentPersonId, limit, offset],
  ) as { rows: Record<string, unknown>[] };

  const evaluations = result.rows.map(mapEvaluationRow);
  const total = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;

  return { evaluations, total };
}
