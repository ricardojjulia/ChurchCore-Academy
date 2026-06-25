import type { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";

export type RiskTier = "low" | "moderate" | "high" | "critical";

export interface SignalExplanation {
  signal: string;
  score: number;
  reason: string;
}

export interface RetentionRiskScore {
  id: string;
  tenantId: string;
  studentPersonId: string;
  cohortId: string | null;
  scoringPeriod: string;
  riskTier: RiskTier;
  compositeScore: number;
  gpaSignal: number;
  attendanceSignal: number;
  financialSignal: number;
  engagementSignal: number;
  signalExplanations: SignalExplanation[];
  computedAt: string;
  reviewedByPersonId: string | null;
  reviewedAt: string | null;
  actionTaken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CohortRiskSnapshot {
  id: string;
  tenantId: string;
  scoringPeriod: string;
  programId: string | null;
  totalStudents: number;
  criticalCount: number;
  highCount: number;
  moderateCount: number;
  lowCount: number;
  avgCompositeScore: number | null;
  snapshotAt: string;
  createdAt: string;
}

export interface ScoreStudentRiskInput {
  studentPersonId: string;
  scoringPeriod: string;
}

export interface BatchScoreCohortInput {
  scoringPeriod: string;
  programId?: string;
}

export interface RetentionRiskDatabase {
  query(sql: string, params?: unknown[]): Promise<{ rowCount: number; rows: Record<string, unknown>[] }>;
}

const adminRoles = new Set([
  "institution_admin",
  "academic_admin",
  "registrar",
]);

const advisorRole = "advisor";

function computeGpaSignal(gpa: number | null): { score: number; reason: string } {
  if (gpa === null) {
    return { score: 25, reason: "No grades recorded" };
  }
  if (gpa < 1.0) {
    return { score: 25, reason: `GPA ${gpa.toFixed(2)} is below 1.0` };
  }
  if (gpa < 2.0) {
    return { score: 20, reason: `GPA ${gpa.toFixed(2)} is below 2.0` };
  }
  if (gpa < 3.0) {
    return { score: 10, reason: `GPA ${gpa.toFixed(2)} is below 3.0` };
  }
  return { score: 0, reason: `GPA ${gpa.toFixed(2)} is acceptable` };
}

function computeAttendanceSignal(attendanceRate: number | null): { score: number; reason: string } {
  if (attendanceRate === null) {
    return { score: 0, reason: "No attendance data available" };
  }
  if (attendanceRate < 60) {
    return { score: 25, reason: `Attendance ${attendanceRate.toFixed(1)}% is below 60%` };
  }
  if (attendanceRate < 75) {
    return { score: 20, reason: `Attendance ${attendanceRate.toFixed(1)}% is below 75%` };
  }
  if (attendanceRate < 90) {
    return { score: 10, reason: `Attendance ${attendanceRate.toFixed(1)}% is below 90%` };
  }
  return { score: 0, reason: `Attendance ${attendanceRate.toFixed(1)}% is acceptable` };
}

function computeFinancialSignal(hasHolds: boolean, hasSapWarning: boolean, hasSapSuspended: boolean): { score: number; reason: string } {
  if (hasSapSuspended) {
    return { score: 25, reason: "SAP suspended or financial aid revoked" };
  }
  if (hasSapWarning) {
    return { score: 20, reason: "SAP warning active" };
  }
  if (hasHolds) {
    return { score: 10, reason: "Billing hold present" };
  }
  return { score: 0, reason: "No financial holds or SAP issues" };
}

function computeEngagementSignal(registeredCredits: number): { score: number; reason: string } {
  if (registeredCredits === 0) {
    return { score: 25, reason: "Registered but not attending any courses" };
  }
  if (registeredCredits < 6) {
    return { score: 20, reason: `Only ${registeredCredits} credit hours registered` };
  }
  if (registeredCredits < 12) {
    return { score: 10, reason: `${registeredCredits} credit hours registered (below full-time)` };
  }
  return { score: 0, reason: `${registeredCredits} credit hours registered (full-time)` };
}

function computeRiskTier(compositeScore: number): RiskTier {
  if (compositeScore >= 75) return "critical";
  if (compositeScore >= 50) return "high";
  if (compositeScore >= 25) return "moderate";
  return "low";
}

export async function scoreStudentRisk(
  actor: AcademyActor,
  input: ScoreStudentRiskInput,
  db: RetentionRiskDatabase,
): Promise<RetentionRiskScore> {
  // Enforce tenant isolation
  const tenantId = actor.tenantId;

  // Authorization: institution_admin, academic_admin, registrar only
  const isAdmin = actor.roles.some((role) => adminRoles.has(role));
  if (!isAdmin) {
    throw new AcademyAuthorizationError("Forbidden retention risk scoring access.");
  }

  // Fetch student data: GPA, attendance, financial holds, credit count
  const studentResult = await db.query(
    `select
       sp.person_id,
       sp.program_id,
       sp.cumulative_gpa,
       sp.enrollment_status,
       coalesce(
         (select avg(
           case
             when ar.attendance_status = 'present' then 100.0
             when ar.attendance_status = 'absent' then 0.0
             else 50.0
           end
         )
         from academy_attendance_records ar
         where ar.tenant_id = sp.tenant_id
           and ar.student_person_id = sp.person_id
           and ar.meeting_date >= current_date - interval '90 days'
         ), null
       ) as attendance_rate,
       exists (
         select 1 from academy_financial_holds fh
         where fh.tenant_id = sp.tenant_id
           and fh.person_id = sp.person_id
           and fh.status = 'active'
       ) as has_holds,
       exists (
         select 1 from academy_sap_reviews sap
         where sap.tenant_id = sp.tenant_id
           and sap.student_person_id = sp.person_id
           and sap.status = 'warning'
           and sap.reviewed_period = $3
       ) as has_sap_warning,
       exists (
         select 1 from academy_sap_reviews sap
         where sap.tenant_id = sp.tenant_id
           and sap.student_person_id = sp.person_id
           and sap.status in ('suspended', 'aid_revoked')
           and sap.reviewed_period = $3
       ) as has_sap_suspended,
       coalesce(
         (select sum(cs.credits)
         from academy_course_section_registrations csr
         join academy_course_sections cs on cs.id = csr.course_section_id and cs.tenant_id = csr.tenant_id
         where csr.tenant_id = sp.tenant_id
           and csr.student_person_id = sp.person_id
           and csr.registration_status = 'enrolled'
           and cs.term = $3
         ), 0
       ) as registered_credits
     from academy_student_profiles sp
     where sp.tenant_id = $1
       and sp.person_id = $2`,
    [tenantId, input.studentPersonId, input.scoringPeriod],
  );

  if (studentResult.rowCount === 0) {
    throw new Error("Student not found.");
  }

  const row = studentResult.rows[0];
  const gpa = row.cumulative_gpa !== null ? Number(row.cumulative_gpa) : null;
  const attendanceRate = row.attendance_rate !== null ? Number(row.attendance_rate) : null;
  const hasHolds = Boolean(row.has_holds);
  const hasSapWarning = Boolean(row.has_sap_warning);
  const hasSapSuspended = Boolean(row.has_sap_suspended);
  const registeredCredits = Number(row.registered_credits);

  // Compute signals
  const gpaResult = computeGpaSignal(gpa);
  const attendanceResult = computeAttendanceSignal(attendanceRate);
  const financialResult = computeFinancialSignal(hasHolds, hasSapWarning, hasSapSuspended);
  const engagementResult = computeEngagementSignal(registeredCredits);

  const compositeScore = gpaResult.score + attendanceResult.score + financialResult.score + engagementResult.score;
  const riskTier = computeRiskTier(compositeScore);

  const signalExplanations: SignalExplanation[] = [];
  if (gpaResult.score > 0) signalExplanations.push({ signal: "gpa", score: gpaResult.score, reason: gpaResult.reason });
  if (attendanceResult.score > 0) signalExplanations.push({ signal: "attendance", score: attendanceResult.score, reason: attendanceResult.reason });
  if (financialResult.score > 0) signalExplanations.push({ signal: "financial", score: financialResult.score, reason: financialResult.reason });
  if (engagementResult.score > 0) signalExplanations.push({ signal: "engagement", score: engagementResult.score, reason: engagementResult.reason });

  // Upsert score
  const now = new Date().toISOString();
  const upsertResult = await db.query(
    `insert into academy_retention_risk_scores (
       tenant_id, student_person_id, cohort_id, scoring_period, risk_tier, composite_score,
       gpa_signal, attendance_signal, financial_signal, engagement_signal, signal_explanations, computed_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
     on conflict (tenant_id, student_person_id, scoring_period)
     do update set
       risk_tier = excluded.risk_tier,
       composite_score = excluded.composite_score,
       gpa_signal = excluded.gpa_signal,
       attendance_signal = excluded.attendance_signal,
       financial_signal = excluded.financial_signal,
       engagement_signal = excluded.engagement_signal,
       signal_explanations = excluded.signal_explanations,
       computed_at = excluded.computed_at,
       updated_at = now()
     returning id, tenant_id, student_person_id, cohort_id, scoring_period, risk_tier, composite_score,
               gpa_signal, attendance_signal, financial_signal, engagement_signal, signal_explanations,
               computed_at, reviewed_by_person_id, reviewed_at, action_taken, created_at, updated_at`,
    [
      tenantId,
      input.studentPersonId,
      row.program_id ?? null,
      input.scoringPeriod,
      riskTier,
      compositeScore,
      gpaResult.score,
      attendanceResult.score,
      financialResult.score,
      engagementResult.score,
      JSON.stringify(signalExplanations),
      now,
    ],
  );

  const result = upsertResult.rows[0];
  return {
    id: String(result.id),
    tenantId: String(result.tenant_id),
    studentPersonId: String(result.student_person_id),
    cohortId: result.cohort_id ? String(result.cohort_id) : null,
    scoringPeriod: String(result.scoring_period),
    riskTier: String(result.risk_tier) as RiskTier,
    compositeScore: Number(result.composite_score),
    gpaSignal: Number(result.gpa_signal),
    attendanceSignal: Number(result.attendance_signal),
    financialSignal: Number(result.financial_signal),
    engagementSignal: Number(result.engagement_signal),
    signalExplanations: typeof result.signal_explanations === "string"
      ? JSON.parse(result.signal_explanations)
      : (result.signal_explanations as SignalExplanation[]),
    computedAt: result.computed_at instanceof Date ? result.computed_at.toISOString() : String(result.computed_at),
    reviewedByPersonId: result.reviewed_by_person_id ? String(result.reviewed_by_person_id) : null,
    reviewedAt: result.reviewed_at
      ? (result.reviewed_at instanceof Date ? result.reviewed_at.toISOString() : String(result.reviewed_at))
      : null,
    actionTaken: result.action_taken ? String(result.action_taken) : null,
    createdAt: result.created_at instanceof Date ? result.created_at.toISOString() : String(result.created_at),
    updatedAt: result.updated_at instanceof Date ? result.updated_at.toISOString() : String(result.updated_at),
  };
}

export async function batchScoreCohort(
  actor: AcademyActor,
  input: BatchScoreCohortInput,
  db: RetentionRiskDatabase,
): Promise<CohortRiskSnapshot> {
  // Enforce tenant isolation
  const tenantId = actor.tenantId;

  // Authorization: institution_admin, academic_admin only
  const isAdmin = actor.roles.some((role) => adminRoles.has(role));
  if (!isAdmin) {
    throw new AcademyAuthorizationError("Forbidden batch scoring access.");
  }

  // Fetch active students (optionally filtered by program)
  const studentQuery = input.programId
    ? `select person_id from academy_student_profiles
       where tenant_id = $1 and enrollment_status in ('enrolled', 'active') and program_id = $2`
    : `select person_id from academy_student_profiles
       where tenant_id = $1 and enrollment_status in ('enrolled', 'active')`;

  const studentResult = await db.query(
    studentQuery,
    input.programId ? [tenantId, input.programId] : [tenantId],
  );

  // Score each student
  for (const row of studentResult.rows) {
    await scoreStudentRisk(actor, { studentPersonId: String(row.person_id), scoringPeriod: input.scoringPeriod }, db);
  }

  // Create cohort snapshot
  const snapshotResult = await db.query(
    `select
       count(*)::integer as total_students,
       sum(case when risk_tier = 'critical' then 1 else 0 end)::integer as critical_count,
       sum(case when risk_tier = 'high' then 1 else 0 end)::integer as high_count,
       sum(case when risk_tier = 'moderate' then 1 else 0 end)::integer as moderate_count,
       sum(case when risk_tier = 'low' then 1 else 0 end)::integer as low_count,
       avg(composite_score) as avg_composite_score
     from academy_retention_risk_scores
     where tenant_id = $1 and scoring_period = $2`,
    [tenantId, input.scoringPeriod],
  );

  const snapshotRow = snapshotResult.rows[0];
  const now = new Date().toISOString();

  const insertResult = await db.query(
    `insert into academy_cohort_risk_snapshots (
       tenant_id, scoring_period, program_id, total_students, critical_count, high_count, moderate_count, low_count,
       avg_composite_score, snapshot_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning id, tenant_id, scoring_period, program_id, total_students, critical_count, high_count, moderate_count,
               low_count, avg_composite_score, snapshot_at, created_at`,
    [
      tenantId,
      input.scoringPeriod,
      input.programId ?? null,
      snapshotRow.total_students,
      snapshotRow.critical_count,
      snapshotRow.high_count,
      snapshotRow.moderate_count,
      snapshotRow.low_count,
      snapshotRow.avg_composite_score,
      now,
    ],
  );

  const result = insertResult.rows[0];
  return {
    id: String(result.id),
    tenantId: String(result.tenant_id),
    scoringPeriod: String(result.scoring_period),
    programId: result.program_id ? String(result.program_id) : null,
    totalStudents: Number(result.total_students),
    criticalCount: Number(result.critical_count),
    highCount: Number(result.high_count),
    moderateCount: Number(result.moderate_count),
    lowCount: Number(result.low_count),
    avgCompositeScore: result.avg_composite_score !== null ? Number(result.avg_composite_score) : null,
    snapshotAt: result.snapshot_at instanceof Date ? result.snapshot_at.toISOString() : String(result.snapshot_at),
    createdAt: result.created_at instanceof Date ? result.created_at.toISOString() : String(result.created_at),
  };
}

export async function getCohortRiskSnapshot(
  actor: AcademyActor,
  scoringPeriod: string,
  db: RetentionRiskDatabase,
): Promise<CohortRiskSnapshot | null> {
  // Enforce tenant isolation
  const tenantId = actor.tenantId;

  // Authorization: institution_admin, academic_admin, advisor can read
  const canRead = actor.roles.some((role) => adminRoles.has(role) || role === advisorRole);
  if (!canRead) {
    throw new AcademyAuthorizationError("Forbidden cohort snapshot access.");
  }

  const result = await db.query(
    `select id, tenant_id, scoring_period, program_id, total_students, critical_count, high_count, moderate_count,
            low_count, avg_composite_score, snapshot_at, created_at
     from academy_cohort_risk_snapshots
     where tenant_id = $1 and scoring_period = $2
     order by snapshot_at desc
     limit 1`,
    [tenantId, scoringPeriod],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    scoringPeriod: String(row.scoring_period),
    programId: row.program_id ? String(row.program_id) : null,
    totalStudents: Number(row.total_students),
    criticalCount: Number(row.critical_count),
    highCount: Number(row.high_count),
    moderateCount: Number(row.moderate_count),
    lowCount: Number(row.low_count),
    avgCompositeScore: row.avg_composite_score !== null ? Number(row.avg_composite_score) : null,
    snapshotAt: row.snapshot_at instanceof Date ? row.snapshot_at.toISOString() : String(row.snapshot_at),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export async function getStudentRiskScore(
  actor: AcademyActor,
  studentPersonId: string,
  scoringPeriod: string,
  db: RetentionRiskDatabase,
): Promise<RetentionRiskScore | null> {
  // Enforce tenant isolation
  const tenantId = actor.tenantId;

  // Authorization: institution_admin, academic_admin, advisor, or student viewing own
  const isAdmin = actor.roles.some((role) => adminRoles.has(role));
  const isAdvisor = actor.roles.includes(advisorRole);
  const isStudentSelf = actor.roles.includes("student") && actor.userId === studentPersonId;

  if (!isAdmin && !isAdvisor && !isStudentSelf) {
    throw new AcademyAuthorizationError("Forbidden risk score access.");
  }

  const result = await db.query(
    `select id, tenant_id, student_person_id, cohort_id, scoring_period, risk_tier, composite_score,
            gpa_signal, attendance_signal, financial_signal, engagement_signal, signal_explanations,
            computed_at, reviewed_by_person_id, reviewed_at, action_taken, created_at, updated_at
     from academy_retention_risk_scores
     where tenant_id = $1 and student_person_id = $2 and scoring_period = $3`,
    [tenantId, studentPersonId, scoringPeriod],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentPersonId: String(row.student_person_id),
    cohortId: row.cohort_id ? String(row.cohort_id) : null,
    scoringPeriod: String(row.scoring_period),
    riskTier: String(row.risk_tier) as RiskTier,
    compositeScore: Number(row.composite_score),
    gpaSignal: Number(row.gpa_signal),
    attendanceSignal: Number(row.attendance_signal),
    financialSignal: Number(row.financial_signal),
    engagementSignal: Number(row.engagement_signal),
    signalExplanations: typeof row.signal_explanations === "string"
      ? JSON.parse(row.signal_explanations)
      : (row.signal_explanations as SignalExplanation[]),
    computedAt: row.computed_at instanceof Date ? row.computed_at.toISOString() : String(row.computed_at),
    reviewedByPersonId: row.reviewed_by_person_id ? String(row.reviewed_by_person_id) : null,
    reviewedAt: row.reviewed_at
      ? (row.reviewed_at instanceof Date ? row.reviewed_at.toISOString() : String(row.reviewed_at))
      : null,
    actionTaken: row.action_taken ? String(row.action_taken) : null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

export async function markRiskReviewed(
  actor: AcademyActor,
  scoreId: string,
  actionTaken: string,
  db: RetentionRiskDatabase,
): Promise<void> {
  // Enforce tenant isolation
  const tenantId = actor.tenantId;

  // Authorization: institution_admin, academic_admin, advisor only
  const canReview = actor.roles.some((role) => adminRoles.has(role) || role === advisorRole);
  if (!canReview) {
    throw new AcademyAuthorizationError("Forbidden risk review access.");
  }

  // Verify the score belongs to this tenant before updating
  const checkResult = await db.query(
    `select id from academy_retention_risk_scores where id = $1 and tenant_id = $2`,
    [scoreId, tenantId],
  );

  if (checkResult.rowCount === 0) {
    throw new Error("Risk score not found or cross-tenant access denied.");
  }

  const now = new Date().toISOString();
  await db.query(
    `update academy_retention_risk_scores
     set reviewed_by_person_id = $3, reviewed_at = $4, action_taken = $5, updated_at = $4
     where id = $1 and tenant_id = $2`,
    [scoreId, tenantId, actor.userId, now, actionTaken],
  );
}

export async function getRiskLeaderboard(
  actor: AcademyActor,
  scoringPeriod: string,
  db: RetentionRiskDatabase,
): Promise<RetentionRiskScore[]> {
  // Enforce tenant isolation
  const tenantId = actor.tenantId;

  // Authorization: institution_admin, academic_admin, advisor can read
  const canRead = actor.roles.some((role) => adminRoles.has(role) || role === advisorRole);
  if (!canRead) {
    throw new AcademyAuthorizationError("Forbidden leaderboard access.");
  }

  const result = await db.query(
    `select id, tenant_id, student_person_id, cohort_id, scoring_period, risk_tier, composite_score,
            gpa_signal, attendance_signal, financial_signal, engagement_signal, signal_explanations,
            computed_at, reviewed_by_person_id, reviewed_at, action_taken, created_at, updated_at
     from academy_retention_risk_scores
     where tenant_id = $1 and scoring_period = $2
     order by composite_score desc, student_person_id asc
     limit 20`,
    [tenantId, scoringPeriod],
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentPersonId: String(row.student_person_id),
    cohortId: row.cohort_id ? String(row.cohort_id) : null,
    scoringPeriod: String(row.scoring_period),
    riskTier: String(row.risk_tier) as RiskTier,
    compositeScore: Number(row.composite_score),
    gpaSignal: Number(row.gpa_signal),
    attendanceSignal: Number(row.attendance_signal),
    financialSignal: Number(row.financial_signal),
    engagementSignal: Number(row.engagement_signal),
    signalExplanations: typeof row.signal_explanations === "string"
      ? JSON.parse(row.signal_explanations)
      : (row.signal_explanations as SignalExplanation[]),
    computedAt: row.computed_at instanceof Date ? row.computed_at.toISOString() : String(row.computed_at),
    reviewedByPersonId: row.reviewed_by_person_id ? String(row.reviewed_by_person_id) : null,
    reviewedAt: row.reviewed_at
      ? (row.reviewed_at instanceof Date ? row.reviewed_at.toISOString() : String(row.reviewed_at))
      : null,
    actionTaken: row.action_taken ? String(row.action_taken) : null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  }));
}
