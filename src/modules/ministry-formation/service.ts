import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type {
  AcademyQueryClient,
} from "@/lib/academy-database-context";
import type {
  PracticumSession,
  FaithMilestone,
  FormationEvaluation,
  MilestoneType,
  StudentFormationRecord,
  StudentFormationRecordStaffView,
  FormationEvaluationStudentView,
  FormationAdvisorAssignment,
  FormationSummary,
  FormationPageMetadata,
} from "@/modules/ministry-formation/types";
import { PermanentRecordError } from "@/modules/ministry-formation/errors";

const practicumRecorderRoles = new Set<AcademyRole>([
  "faculty",
  "advisor",
  "institution_admin",
  "registrar",
]);

const milestoneRecorderRoles = new Set<AcademyRole>([
  "institution_admin",
  "registrar",
  "academic_admin",
]);

const evaluationRecorderRoles = new Set<AcademyRole>([
  "faculty",
  "advisor",
  "institution_admin",
]);

const endorserRoles = new Set<AcademyRole>(["institution_admin"]);

const formationViewerRoles = new Set<AcademyRole>([
  "faculty",
  "advisor",
  "institution_admin",
  "registrar",
  "academic_admin",
]);

const advisorAssignerRoles = new Set<AcademyRole>([
  "institution_admin",
  "academic_admin",
]);

const advisorEligibleRoles = new Set<AcademyRole>([
  "faculty",
  "advisor",
  "institution_admin",
]);

function requireText(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required.`);
  }
  return trimmed;
}

// Helper: Check if actor has full reviewer access (institution_admin bypass or explicit reviewer role)
function hasReviewerAccess(actor: AcademyActor): boolean {
  return actor.roles.includes("institution_admin") || actor.roles.includes("ministry_formation_reviewer");
}

// Helper: Check if actor can see pastoral notes on a specific evaluation
function canSeePastoralNotes(actor: AcademyActor, evaluatorPersonId: string): boolean {
  // Reviewer access (institution_admin or ministry_formation_reviewer) can see all pastoral notes
  if (hasReviewerAccess(actor)) {
    return true;
  }
  // Evaluator can see their own evaluation's pastoral notes
  if (evaluatorPersonId === actor.userId) {
    return true;
  }
  // Registrar never sees pastoral notes, regardless of other roles
  if (actor.roles.includes("registrar")) {
    return false;
  }
  return false;
}

function assertPracticumRecorder(actor: AcademyActor) {
  if (!actor.roles.some((role) => practicumRecorderRoles.has(role))) {
    throw new AcademyAuthorizationError(
      "Forbidden practicum session recording access.",
    );
  }
}

function assertMilestoneRecorder(actor: AcademyActor) {
  if (!actor.roles.some((role) => milestoneRecorderRoles.has(role))) {
    throw new AcademyAuthorizationError(
      "Forbidden milestone recording access.",
    );
  }
}

function assertEvaluationRecorder(actor: AcademyActor) {
  if (!actor.roles.some((role) => evaluationRecorderRoles.has(role))) {
    throw new AcademyAuthorizationError(
      "Forbidden evaluation recording access.",
    );
  }
}

function assertEndorser(actor: AcademyActor) {
  if (!actor.roles.some((role) => endorserRoles.has(role))) {
    throw new AcademyAuthorizationError("Forbidden endorsement access.");
  }
}

function hasFormationViewerAccess(actor: AcademyActor): boolean {
  return actor.roles.some((role) => formationViewerRoles.has(role));
}

function assertAdvisorAssigner(actor: AcademyActor) {
  if (!actor.roles.some((role) => advisorAssignerRoles.has(role))) {
    throw new AcademyAuthorizationError(
      "Forbidden advisor assignment access.",
    );
  }
}

function validateDate(dateString: string, field: string): string {
  const trimmed = requireText(dateString, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`${field} must be a valid date (YYYY-MM-DD).`);
  }
  return trimmed;
}

export async function logPracticumSession(
  actor: AcademyActor,
  input: {
    studentPersonId: string;
    hours: number;
    siteName: string;
    supervisorName: string;
    sessionDate: string;
    reflectionNote?: string;
    isTransferCredit?: boolean;
    sourceInstitution?: string;
  },
  db: AcademyQueryClient,
): Promise<PracticumSession> {
  assertPracticumRecorder(actor);

  const studentPersonId = requireText(input.studentPersonId, "studentPersonId");
  const siteName = requireText(input.siteName, "siteName");
  const supervisorName = requireText(input.supervisorName, "supervisorName");
  const sessionDate = validateDate(input.sessionDate, "sessionDate");

  if (!Number.isFinite(input.hours) || input.hours <= 0) {
    throw new Error("hours must be greater than 0");
  }

  const isTransferCredit = input.isTransferCredit ?? false;
  const sourceInstitution = input.sourceInstitution?.trim() || null;
  const reflectionNote = input.reflectionNote?.trim() || null;

  const result = await db.query(
    `insert into public.ministry_practicum_sessions
      (tenant_id, student_person_id, recorded_by_person_id, hours, site_name, supervisor_name, session_date, reflection_note, is_transfer_credit, source_institution)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning *`,
    [
      actor.tenantId,
      studentPersonId,
      actor.userId,
      input.hours,
      siteName,
      supervisorName,
      sessionDate,
      reflectionNote,
      isTransferCredit,
      sourceInstitution,
    ],
  ) as { rows: Array<{
    id: string;
    tenant_id: string;
    student_person_id: string;
    recorded_by_person_id: string;
    hours: string;
    site_name: string;
    supervisor_name: string;
    session_date: string;
    reflection_note: string | null;
    status: string;
    endorsed_by_person_id: string | null;
    endorsed_at: string | null;
    is_transfer_credit: boolean;
    source_institution: string | null;
    created_at: string;
  }> };

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to create practicum session.");
  }

  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentPersonId: row.student_person_id,
    recordedByPersonId: row.recorded_by_person_id,
    hours: parseFloat(row.hours),
    siteName: row.site_name,
    supervisorName: row.supervisor_name,
    sessionDate: row.session_date,
    reflectionNote: row.reflection_note ?? undefined,
    status: row.status as "draft" | "endorsed",
    endorsedByPersonId: row.endorsed_by_person_id ?? undefined,
    endorsedAt: row.endorsed_at ?? undefined,
    isTransferCredit: row.is_transfer_credit,
    sourceInstitution: row.source_institution ?? undefined,
    createdAt: row.created_at,
  };
}

export async function recordMilestone(
  actor: AcademyActor,
  input: {
    studentPersonId: string;
    milestoneType: MilestoneType;
    customTypeLabel?: string;
    milestoneDate: string;
    witnessNames?: string[];
    institutionNotes?: string;
    isTransferCredit?: boolean;
    sourceInstitution?: string;
  },
  db: AcademyQueryClient,
): Promise<FaithMilestone> {
  assertMilestoneRecorder(actor);

  const studentPersonId = requireText(input.studentPersonId, "studentPersonId");
  const milestoneDate = validateDate(input.milestoneDate, "milestoneDate");
  const customTypeLabel = input.customTypeLabel?.trim() || null;
  const witnessNames = input.witnessNames ?? null;
  const institutionNotes = input.institutionNotes?.trim() || null;
  const isTransferCredit = input.isTransferCredit ?? false;
  const sourceInstitution = input.sourceInstitution?.trim() || null;

  const result = await db.query(
    `insert into public.ministry_faith_milestones
      (tenant_id, student_person_id, recorded_by_person_id, milestone_type, custom_type_label, milestone_date, witness_names, institution_notes, is_transfer_credit, source_institution)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning *`,
    [
      actor.tenantId,
      studentPersonId,
      actor.userId,
      input.milestoneType,
      customTypeLabel,
      milestoneDate,
      witnessNames,
      institutionNotes,
      isTransferCredit,
      sourceInstitution,
    ],
  ) as { rows: Array<{
    id: string;
    tenant_id: string;
    student_person_id: string;
    recorded_by_person_id: string;
    milestone_type: MilestoneType;
    custom_type_label: string | null;
    milestone_date: string;
    witness_names: string[] | null;
    institution_notes: string | null;
    status: string;
    endorsed_by_person_id: string | null;
    endorsed_at: string | null;
    is_transfer_credit: boolean;
    source_institution: string | null;
    created_at: string;
  }> };

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to create milestone.");
  }

  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentPersonId: row.student_person_id,
    recordedByPersonId: row.recorded_by_person_id,
    milestoneType: row.milestone_type,
    customTypeLabel: row.custom_type_label ?? undefined,
    milestoneDate: row.milestone_date,
    witnessNames: row.witness_names ?? undefined,
    institutionNotes: row.institution_notes ?? undefined,
    status: row.status as "draft" | "endorsed",
    endorsedByPersonId: row.endorsed_by_person_id ?? undefined,
    endorsedAt: row.endorsed_at ?? undefined,
    isTransferCredit: row.is_transfer_credit,
    sourceInstitution: row.source_institution ?? undefined,
    createdAt: row.created_at,
  };
}

export async function recordFormationEvaluation(
  actor: AcademyActor,
  input: {
    studentPersonId: string;
    evaluatorNameSnapshot: string;
    rubricLabel: string;
    scores: Record<string, number>;
    pastoralNotes?: string;
    evaluationDate: string;
  },
  db: AcademyQueryClient,
): Promise<FormationEvaluation> {
  assertEvaluationRecorder(actor);

  const studentPersonId = requireText(input.studentPersonId, "studentPersonId");
  const evaluatorNameSnapshot = requireText(
    input.evaluatorNameSnapshot,
    "evaluatorNameSnapshot",
  );
  const rubricLabel = requireText(input.rubricLabel, "rubricLabel");
  const evaluationDate = validateDate(input.evaluationDate, "evaluationDate");
  const pastoralNotes = input.pastoralNotes?.trim() || null;

  const result = await db.query(
    `insert into public.ministry_formation_evaluations
      (tenant_id, student_person_id, evaluator_person_id, evaluator_name_snapshot, rubric_label, scores, pastoral_notes, evaluation_date)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning *`,
    [
      actor.tenantId,
      studentPersonId,
      actor.userId,
      evaluatorNameSnapshot,
      rubricLabel,
      JSON.stringify(input.scores),
      pastoralNotes,
      evaluationDate,
    ],
  ) as { rows: Array<{
    id: string;
    tenant_id: string;
    student_person_id: string;
    evaluator_person_id: string;
    evaluator_name_snapshot: string;
    rubric_label: string;
    scores: Record<string, number>;
    pastoral_notes: string | null;
    status: string;
    endorsed_by_person_id: string | null;
    endorsed_at: string | null;
    evaluation_date: string;
    created_at: string;
  }> };

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to create evaluation.");
  }

  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentPersonId: row.student_person_id,
    evaluatorPersonId: row.evaluator_person_id,
    evaluatorNameSnapshot: row.evaluator_name_snapshot,
    rubricLabel: row.rubric_label,
    scores: row.scores,
    pastoralNotes: row.pastoral_notes ?? undefined,
    status: row.status as "draft" | "endorsed",
    endorsedByPersonId: row.endorsed_by_person_id ?? undefined,
    endorsedAt: row.endorsed_at ?? undefined,
    evaluationDate: row.evaluation_date,
    createdAt: row.created_at,
  };
}

export async function endorseRecord(
  actor: AcademyActor,
  input: {
    recordType: "practicum" | "milestone" | "evaluation";
    recordId: string;
  },
  db: AcademyQueryClient,
): Promise<PracticumSession | FaithMilestone | FormationEvaluation> {
  assertEndorser(actor);

  const recordId = requireText(input.recordId, "recordId");

  let tableName: string;
  if (input.recordType === "practicum") {
    tableName = "ministry_practicum_sessions";
  } else if (input.recordType === "milestone") {
    tableName = "ministry_faith_milestones";
  } else if (input.recordType === "evaluation") {
    tableName = "ministry_formation_evaluations";
  } else {
    throw new Error("Invalid recordType.");
  }

  // Check if already endorsed
  const checkResult = await db.query(
    `select status from public.${tableName} where id = $1 and tenant_id = $2`,
    [recordId, actor.tenantId],
  ) as { rows: Array<{ status: string }> };

  if (checkResult.rows.length === 0) {
    throw new Error("Record not found.");
  }

  if (checkResult.rows[0].status === "endorsed") {
    throw new PermanentRecordError("Record is endorsed and cannot be modified.");
  }

  const result = await db.query(
    `update public.${tableName}
     set status = 'endorsed', endorsed_by_person_id = $1, endorsed_at = now()
     where id = $2 and tenant_id = $3
     returning *`,
    [actor.userId, recordId, actor.tenantId],
  ) as { rows: unknown[] };

  if (result.rows.length === 0) {
    throw new Error("Failed to endorse record.");
  }

  // Return the appropriate shape based on recordType
  if (input.recordType === "practicum") {
    const row = result.rows[0] as {
      id: string;
      tenant_id: string;
      student_person_id: string;
      recorded_by_person_id: string;
      hours: string;
      site_name: string;
      supervisor_name: string;
      session_date: string;
      reflection_note: string | null;
      status: string;
      endorsed_by_person_id: string | null;
      endorsed_at: string | null;
      is_transfer_credit: boolean;
      source_institution: string | null;
      created_at: string;
    };
    return {
      id: row.id,
      tenantId: row.tenant_id,
      studentPersonId: row.student_person_id,
      recordedByPersonId: row.recorded_by_person_id,
      hours: parseFloat(row.hours),
      siteName: row.site_name,
      supervisorName: row.supervisor_name,
      sessionDate: row.session_date,
      reflectionNote: row.reflection_note ?? undefined,
      status: row.status as "draft" | "endorsed",
      endorsedByPersonId: row.endorsed_by_person_id ?? undefined,
      endorsedAt: row.endorsed_at ?? undefined,
      isTransferCredit: row.is_transfer_credit,
      sourceInstitution: row.source_institution ?? undefined,
      createdAt: row.created_at,
    };
  } else if (input.recordType === "milestone") {
    const row = result.rows[0] as {
      id: string;
      tenant_id: string;
      student_person_id: string;
      recorded_by_person_id: string;
      milestone_type: MilestoneType;
      custom_type_label: string | null;
      milestone_date: string;
      witness_names: string[] | null;
      institution_notes: string | null;
      status: string;
      endorsed_by_person_id: string | null;
      endorsed_at: string | null;
      is_transfer_credit: boolean;
      source_institution: string | null;
      created_at: string;
    };
    return {
      id: row.id,
      tenantId: row.tenant_id,
      studentPersonId: row.student_person_id,
      recordedByPersonId: row.recorded_by_person_id,
      milestoneType: row.milestone_type,
      customTypeLabel: row.custom_type_label ?? undefined,
      milestoneDate: row.milestone_date,
      witnessNames: row.witness_names ?? undefined,
      institutionNotes: row.institution_notes ?? undefined,
      status: row.status as "draft" | "endorsed",
      endorsedByPersonId: row.endorsed_by_person_id ?? undefined,
      endorsedAt: row.endorsed_at ?? undefined,
      isTransferCredit: row.is_transfer_credit,
      sourceInstitution: row.source_institution ?? undefined,
      createdAt: row.created_at,
    };
  } else {
    const row = result.rows[0] as {
      id: string;
      tenant_id: string;
      student_person_id: string;
      evaluator_person_id: string;
      evaluator_name_snapshot: string;
      rubric_label: string;
      scores: Record<string, number>;
      pastoral_notes: string | null;
      status: string;
      endorsed_by_person_id: string | null;
      endorsed_at: string | null;
      evaluation_date: string;
      created_at: string;
    };
    return {
      id: row.id,
      tenantId: row.tenant_id,
      studentPersonId: row.student_person_id,
      evaluatorPersonId: row.evaluator_person_id,
      evaluatorNameSnapshot: row.evaluator_name_snapshot,
      rubricLabel: row.rubric_label,
      scores: row.scores,
      pastoralNotes: row.pastoral_notes ?? undefined,
      status: row.status as "draft" | "endorsed",
      endorsedByPersonId: row.endorsed_by_person_id ?? undefined,
      endorsedAt: row.endorsed_at ?? undefined,
      evaluationDate: row.evaluation_date,
      createdAt: row.created_at,
    };
  }
}

export async function assignFormationAdvisor(
  actor: AcademyActor,
  input: {
    studentPersonId: string;
    advisorPersonId: string;
  },
  db: AcademyQueryClient,
): Promise<FormationAdvisorAssignment> {
  assertAdvisorAssigner(actor);

  const studentPersonId = requireText(input.studentPersonId, "studentPersonId");
  const advisorPersonId = requireText(input.advisorPersonId, "advisorPersonId");

  // Cross-tenant check: confirm both student and advisor exist in actor's tenant
  const studentCheckResult = await db.query(
    `select person_status from public.academy_people where id = $1 and tenant_id = $2`,
    [studentPersonId, actor.tenantId],
  ) as { rows: Array<{ person_status: string }> };

  if (studentCheckResult.rows.length === 0) {
    throw new Error("Student not found.");
  }

  const advisorCheckResult = await db.query(
    `select person_status from public.academy_people where id = $1 and tenant_id = $2`,
    [advisorPersonId, actor.tenantId],
  ) as { rows: Array<{ person_status: string }> };

  if (advisorCheckResult.rows.length === 0) {
    throw new Error("Advisor not found.");
  }

  // Advisor eligibility check: confirm advisor has at least one eligible role
  const advisorRoleResult = await db.query(
    `select role from public.academy_person_role_assignments
     where person_id = $1 and tenant_id = $2 and status = 'active'
       and (starts_on is null or starts_on <= current_date)
       and (ends_on is null or ends_on >= current_date)`,
    [advisorPersonId, actor.tenantId],
  ) as { rows: Array<{ role: string }> };

  const hasEligibleRole = advisorRoleResult.rows.some((row) =>
    advisorEligibleRoles.has(row.role as AcademyRole),
  );

  if (!hasEligibleRole) {
    throw new Error(
      "Advisor must have faculty, advisor, or institution_admin role.",
    );
  }

  // Upsert advisor assignment
  const result = await db.query(
    `insert into public.ministry_formation_advisor_assignments
      (tenant_id, student_person_id, advisor_person_id, assigned_by_person_id)
     values ($1, $2, $3, $4)
     on conflict (tenant_id, student_person_id)
     do update set
       advisor_person_id = excluded.advisor_person_id,
       assigned_at = now(),
       assigned_by_person_id = excluded.assigned_by_person_id
     returning *`,
    [actor.tenantId, studentPersonId, advisorPersonId, actor.userId],
  ) as { rows: Array<{
    id: string;
    tenant_id: string;
    student_person_id: string;
    advisor_person_id: string;
    assigned_at: string;
    assigned_by_person_id: string;
  }> };

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to assign advisor.");
  }

  // Record assignment in append-only history table
  await db.query(
    `insert into public.ministry_formation_advisor_assignment_history
      (tenant_id, student_person_id, advisor_person_id, assigned_at, assigned_by_person_id)
     values ($1, $2, $3, $4, $5)`,
    [
      row.tenant_id,
      row.student_person_id,
      row.advisor_person_id,
      row.assigned_at,
      row.assigned_by_person_id,
    ],
  );

  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentPersonId: row.student_person_id,
    advisorPersonId: row.advisor_person_id,
    assignedAt: row.assigned_at,
    assignedByPersonId: row.assigned_by_person_id,
  };
}

export async function listStudentsWithFormationSummary(
  actor: AcademyActor,
  db: AcademyQueryClient,
): Promise<FormationSummary[]> {
  if (!hasFormationViewerAccess(actor)) {
    throw new AcademyAuthorizationError(
      "Forbidden formation summary access.",
    );
  }

  // Build scoped query based on role
  // ADR-0045 scoping:
  // - institution_admin or ministry_formation_reviewer: full tenant scope
  // - faculty: only students in their own sections (via academy_course_sections.instructor_person_id joined through academy_registrations)
  // - advisor: only students where they are the formation advisor (via ministry_formation_advisor_assignments.advisor_person_id)
  // - registrar: endorsed-only records across full tenant

  const isReviewer = hasReviewerAccess(actor);
  const isFaculty = actor.roles.some(r => r === "faculty" || r === "teacher" || r === "professor");
  const isAdvisor = actor.roles.includes("advisor");
  const isRegistrar = actor.roles.includes("registrar");

  let scopeJoin = "";
  let scopeWhere = "";

  if (isReviewer) {
    // Full tenant scope
    scopeWhere = "p.tenant_id = $1";
  } else if (isFaculty) {
    // Faculty scoping: students in their sections
    // ADR-0026 pattern: academy_course_sections.instructor_person_id = actor.userId
    scopeJoin = `
      inner join public.academy_registrations reg
        on reg.student_person_id = p.id and reg.tenant_id = p.tenant_id
      inner join public.academy_course_sections sec
        on sec.id = reg.section_id and sec.tenant_id = reg.tenant_id
    `;
    scopeWhere = "p.tenant_id = $1 and sec.instructor_person_id = $2";
  } else if (isAdvisor && !isFaculty) {
    // Advisor scoping: students where they are the formation advisor
    // ADR-0045 interpretation: use ministry_formation_advisor_assignments for advisee-scoping
    scopeJoin = `
      inner join public.ministry_formation_advisor_assignments fa
        on fa.student_person_id = p.id and fa.tenant_id = p.tenant_id
    `;
    scopeWhere = "p.tenant_id = $1 and fa.advisor_person_id = $2";
  } else if (isRegistrar) {
    // Registrar scoping: endorsed-only records across full tenant
    scopeWhere = "p.tenant_id = $1";
  } else {
    // Fallback: no scope (should not happen if hasFormationViewerAccess passed)
    throw new AcademyAuthorizationError("Forbidden formation summary access.");
  }

  const query = `
    select
       p.id as student_person_id,
       p.display_name as full_name,
       p.email,
       coalesce(sum(ps.hours), 0) as total_practicum_hours,
       count(distinct fm.id) as milestone_count,
       count(distinct fe.id) as evaluation_count,
       aa.advisor_person_id as formation_advisor_person_id,
       adv.display_name as formation_advisor_name
     from public.academy_people p
     ${scopeJoin}
     left join public.ministry_practicum_sessions ps
       on ps.student_person_id = p.id and ps.tenant_id = p.tenant_id ${isRegistrar ? "and ps.status = 'endorsed'" : ""}
     left join public.ministry_faith_milestones fm
       on fm.student_person_id = p.id and fm.tenant_id = p.tenant_id ${isRegistrar ? "and fm.status = 'endorsed'" : ""}
     left join public.ministry_formation_evaluations fe
       on fe.student_person_id = p.id and fe.tenant_id = p.tenant_id ${isRegistrar ? "and fe.status = 'endorsed'" : ""}
     left join public.ministry_formation_advisor_assignments aa
       on aa.student_person_id = p.id and aa.tenant_id = p.tenant_id
     left join public.academy_people adv
       on adv.id = aa.advisor_person_id and adv.tenant_id = aa.tenant_id
     where ${scopeWhere}
       and (ps.id is not null or fm.id is not null or fe.id is not null or aa.id is not null)
     group by p.id, p.display_name, p.email, aa.advisor_person_id, adv.display_name
     order by p.display_name
  `;

  const params = (isFaculty || (isAdvisor && !isFaculty)) ? [actor.tenantId, actor.userId] : [actor.tenantId];

  const result = await db.query(query, params) as { rows: Array<{
    student_person_id: string;
    full_name: string;
    email: string | null;
    total_practicum_hours: string;
    milestone_count: string;
    evaluation_count: string;
    formation_advisor_person_id: string | null;
    formation_advisor_name: string | null;
  }> };

  return result.rows.map((row) => {
    const totalPracticumHours = parseFloat(row.total_practicum_hours);
    const milestoneCount = parseInt(row.milestone_count, 10);
    const evaluationCount = parseInt(row.evaluation_count, 10);

    // TODO: replace hardcoded formation-completion thresholds (100 hrs / 3 milestones) with per-program requirements once that config exists
    let formationComplete: boolean | null;
    if (totalPracticumHours === 0 && milestoneCount === 0 && evaluationCount === 0) {
      // No formation activity at all — not applicable
      formationComplete = null;
    } else if (totalPracticumHours >= 100 && milestoneCount >= 3) {
      // Meets completion threshold
      formationComplete = true;
    } else {
      // Has formation activity but does not meet threshold
      formationComplete = false;
    }

    return {
      studentPersonId: row.student_person_id,
      fullName: row.full_name,
      email: row.email ?? "",
      totalPracticumHours,
      milestoneCount,
      evaluationCount,
      formationAdvisorPersonId: row.formation_advisor_person_id ?? undefined,
      formationAdvisorName: row.formation_advisor_name ?? undefined,
      formationComplete,
    };
  });
}

export async function getStudentFormationRecord(
  actor: AcademyActor,
  studentPersonId: string,
  db: AcademyQueryClient,
): Promise<StudentFormationRecord | StudentFormationRecordStaffView | null> {
  const subject = requireText(studentPersonId, "studentPersonId");

  const isStudent = actor.roles.includes("student");
  const isStaff = hasFormationViewerAccess(actor);

  // Authorization check
  if (isStudent && subject !== actor.userId) {
    throw new AcademyAuthorizationError(
      "Students can read only their own formation record.",
    );
  }

  if (!isStudent && !isStaff) {
    throw new AcademyAuthorizationError(
      "Forbidden formation record access.",
    );
  }

  // Cross-tenant check — query student profile to ensure same tenant
  const studentProfileResult = await db.query(
    `select enrollment_status from public.academy_student_profiles where person_id = $1 and tenant_id = $2`,
    [subject, actor.tenantId],
  ) as { rows: Array<{ enrollment_status: string }> };

  if (studentProfileResult.rows.length === 0) {
    throw new Error("Student not found.");
  }

  const enrollmentStatus = studentProfileResult.rows[0].enrollment_status;

  // If student is withdrawn and actor is a student, return null
  if (isStudent && enrollmentStatus === "withdrawn") {
    return null;
  }

  // Staff scoping check: verify actor can see this student's formation record
  // ADR-0045 scoping applies
  // Only apply to staff, not to students viewing their own record
  if (!isStudent && isStaff) {
    const isReviewer = hasReviewerAccess(actor);
    const isFaculty = actor.roles.some(r => r === "faculty" || r === "teacher" || r === "professor");
    const isAdvisor = actor.roles.includes("advisor");
    const isRegistrar = actor.roles.includes("registrar");

    if (!isReviewer && !isRegistrar) {
      // Faculty or advisor must have explicit relationship to this student
      if (isFaculty) {
        // Faculty scoping: student must be in one of their sections
        const sectionCheckResult = await db.query(
          `select 1 from public.academy_registrations reg
           join public.academy_course_sections sec
             on sec.id = reg.section_id and sec.tenant_id = reg.tenant_id
           where reg.student_person_id = $1 and reg.tenant_id = $2
             and sec.instructor_person_id = $3
           limit 1`,
          [subject, actor.tenantId, actor.userId],
        ) as { rows: Array<{ "?column?": number }> };

        if (sectionCheckResult.rows.length === 0) {
          throw new AcademyAuthorizationError(
            "Faculty can view only students in their sections.",
          );
        }
      } else if (isAdvisor) {
        // Advisor scoping: actor must be the formation advisor for this student
        const advisorCheckResult = await db.query(
          `select 1 from public.ministry_formation_advisor_assignments
           where student_person_id = $1 and tenant_id = $2 and advisor_person_id = $3
           limit 1`,
          [subject, actor.tenantId, actor.userId],
        ) as { rows: Array<{ "?column?": number }> };

        if (advisorCheckResult.rows.length === 0) {
          throw new AcademyAuthorizationError(
            "Advisor can view only their assigned formation advisees.",
          );
        }
      }
    }
  }

  // Fetch practicum sessions
  const practicumResult = await db.query(
    `select * from public.ministry_practicum_sessions
     where student_person_id = $1 and tenant_id = $2
     order by session_date desc`,
    [subject, actor.tenantId],
  ) as { rows: Array<{
    id: string;
    tenant_id: string;
    student_person_id: string;
    recorded_by_person_id: string;
    hours: string;
    site_name: string;
    supervisor_name: string;
    session_date: string;
    reflection_note: string | null;
    status: string;
    endorsed_by_person_id: string | null;
    endorsed_at: string | null;
    is_transfer_credit: boolean;
    source_institution: string | null;
    created_at: string;
  }> };

  const practicumSessions: PracticumSession[] = practicumResult.rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    studentPersonId: row.student_person_id,
    recordedByPersonId: row.recorded_by_person_id,
    hours: parseFloat(row.hours),
    siteName: row.site_name,
    supervisorName: row.supervisor_name,
    sessionDate: row.session_date,
    reflectionNote: row.reflection_note ?? undefined,
    status: row.status as "draft" | "endorsed",
    endorsedByPersonId: row.endorsed_by_person_id ?? undefined,
    endorsedAt: row.endorsed_at ?? undefined,
    isTransferCredit: row.is_transfer_credit,
    sourceInstitution: row.source_institution ?? undefined,
    createdAt: row.created_at,
  }));

  // Fetch milestones
  const milestoneResult = await db.query(
    `select * from public.ministry_faith_milestones
     where student_person_id = $1 and tenant_id = $2
     order by milestone_date desc`,
    [subject, actor.tenantId],
  ) as { rows: Array<{
    id: string;
    tenant_id: string;
    student_person_id: string;
    recorded_by_person_id: string;
    milestone_type: MilestoneType;
    custom_type_label: string | null;
    milestone_date: string;
    witness_names: string[] | null;
    institution_notes: string | null;
    status: string;
    endorsed_by_person_id: string | null;
    endorsed_at: string | null;
    is_transfer_credit: boolean;
    source_institution: string | null;
    created_at: string;
  }> };

  const milestones: FaithMilestone[] = milestoneResult.rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    studentPersonId: row.student_person_id,
    recordedByPersonId: row.recorded_by_person_id,
    milestoneType: row.milestone_type,
    customTypeLabel: row.custom_type_label ?? undefined,
    milestoneDate: row.milestone_date,
    witnessNames: row.witness_names ?? undefined,
    institutionNotes: row.institution_notes ?? undefined,
    status: row.status as "draft" | "endorsed",
    endorsedByPersonId: row.endorsed_by_person_id ?? undefined,
    endorsedAt: row.endorsed_at ?? undefined,
    isTransferCredit: row.is_transfer_credit,
    sourceInstitution: row.source_institution ?? undefined,
    createdAt: row.created_at,
  }));

  // Fetch evaluations
  const evaluationResult = await db.query(
    `select * from public.ministry_formation_evaluations
     where student_person_id = $1 and tenant_id = $2
     order by evaluation_date desc`,
    [subject, actor.tenantId],
  ) as { rows: Array<{
    id: string;
    tenant_id: string;
    student_person_id: string;
    evaluator_person_id: string;
    evaluator_name_snapshot: string;
    rubric_label: string;
    scores: Record<string, number>;
    pastoral_notes: string | null;
    status: string;
    endorsed_by_person_id: string | null;
    endorsed_at: string | null;
    evaluation_date: string;
    created_at: string;
  }> };

  // Fetch advisor assignment
  const advisorResult = await db.query(
    `select aa.advisor_person_id, p.display_name as advisor_name
     from public.ministry_formation_advisor_assignments aa
     join public.academy_people p
       on p.id = aa.advisor_person_id and p.tenant_id = aa.tenant_id
     where aa.student_person_id = $1 and aa.tenant_id = $2`,
    [subject, actor.tenantId],
  ) as { rows: Array<{
    advisor_person_id: string;
    advisor_name: string;
  }> };

  const advisorInfo = advisorResult.rows[0];

  // Registrar sees only endorsed records (no drafts)
  const isRegistrar = actor.roles.includes("registrar");

  // If student, strip pastoralNotes and filter to endorsed-only records
  if (isStudent) {
    const evaluationsStudentView: FormationEvaluationStudentView[] = evaluationResult.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      studentPersonId: row.student_person_id,
      evaluatorPersonId: row.evaluator_person_id,
      evaluatorNameSnapshot: row.evaluator_name_snapshot,
      rubricLabel: row.rubric_label,
      scores: row.scores,
      status: row.status as "draft" | "endorsed",
      endorsedByPersonId: row.endorsed_by_person_id ?? undefined,
      endorsedAt: row.endorsed_at ?? undefined,
      evaluationDate: row.evaluation_date,
      createdAt: row.created_at,
    }));

    // Students see only endorsed practicum sessions and milestones
    const endorsedPracticumSessions = practicumSessions.filter(s => s.status === "endorsed");
    const endorsedMilestones = milestones.filter(m => m.status === "endorsed");

    return {
      tenantId: actor.tenantId,
      studentPersonId: subject,
      practicumSessions: endorsedPracticumSessions,
      milestones: endorsedMilestones,
      evaluations: evaluationsStudentView,
      formationAdvisorPersonId: advisorInfo?.advisor_person_id,
      formationAdvisorName: advisorInfo?.advisor_name,
    };
  } else {
    // Staff view: filter pastoral notes based on access rules
    // ADR-0045: pastoral notes visible only to:
    // - institution_admin or ministry_formation_reviewer (reviewer access)
    // - the evaluation's own evaluator
    // - NEVER to registrar, regardless of other roles
    const evaluations: FormationEvaluation[] = evaluationResult.rows.map((row) => {
      const showPastoralNotes = canSeePastoralNotes(actor, row.evaluator_person_id);

      return {
        id: row.id,
        tenantId: row.tenant_id,
        studentPersonId: row.student_person_id,
        evaluatorPersonId: row.evaluator_person_id,
        evaluatorNameSnapshot: row.evaluator_name_snapshot,
        rubricLabel: row.rubric_label,
        scores: row.scores,
        pastoralNotes: showPastoralNotes ? (row.pastoral_notes ?? undefined) : undefined,
        status: row.status as "draft" | "endorsed",
        endorsedByPersonId: row.endorsed_by_person_id ?? undefined,
        endorsedAt: row.endorsed_at ?? undefined,
        evaluationDate: row.evaluation_date,
        createdAt: row.created_at,
      };
    });

    // Registrar sees only endorsed records
    const filteredPracticumSessions = isRegistrar ? practicumSessions.filter(s => s.status === "endorsed") : practicumSessions;
    const filteredMilestones = isRegistrar ? milestones.filter(m => m.status === "endorsed") : milestones;
    const filteredEvaluations = isRegistrar ? evaluations.filter(e => e.status === "endorsed") : evaluations;

    return {
      tenantId: actor.tenantId,
      studentPersonId: subject,
      practicumSessions: filteredPracticumSessions,
      milestones: filteredMilestones,
      evaluations: filteredEvaluations,
      formationAdvisorPersonId: advisorInfo?.advisor_person_id,
      formationAdvisorName: advisorInfo?.advisor_name,
    };
  }
}

export async function grantMinistryFormationReviewer(
  actor: AcademyActor,
  targetPersonId: string,
  db: AcademyQueryClient,
): Promise<void> {
  // Only institution_admin can grant this sensitive role
  if (!actor.roles.includes("institution_admin")) {
    throw new AcademyAuthorizationError(
      "Forbidden ministry formation reviewer grant access.",
    );
  }

  const target = requireText(targetPersonId, "targetPersonId");

  // Cross-tenant check: confirm target exists in actor's tenant
  const targetCheckResult = await db.query(
    `select person_status from public.academy_people where id = $1 and tenant_id = $2`,
    [target, actor.tenantId],
  ) as { rows: Array<{ person_status: string }> };

  if (targetCheckResult.rows.length === 0) {
    throw new Error("Target person not found.");
  }

  // Insert role assignment (idempotent via on conflict do nothing)
  await db.query(
    `insert into public.academy_person_role_assignments
      (person_id, tenant_id, role, status)
     values ($1, $2, 'ministry_formation_reviewer', 'active')
     on conflict (person_id, tenant_id, role) do nothing`,
    [target, actor.tenantId],
  );
}

export async function revokeMinistryFormationReviewer(
  actor: AcademyActor,
  targetPersonId: string,
  db: AcademyQueryClient,
): Promise<void> {
  // Only institution_admin can revoke this sensitive role
  if (!actor.roles.includes("institution_admin")) {
    throw new AcademyAuthorizationError(
      "Forbidden ministry formation reviewer revoke access.",
    );
  }

  const target = requireText(targetPersonId, "targetPersonId");

  // Cross-tenant check: confirm target exists in actor's tenant
  const targetCheckResult = await db.query(
    `select person_status from public.academy_people where id = $1 and tenant_id = $2`,
    [target, actor.tenantId],
  ) as { rows: Array<{ person_status: string }> };

  if (targetCheckResult.rows.length === 0) {
    throw new Error("Target person not found.");
  }

  // Delete role assignment
  await db.query(
    `delete from public.academy_person_role_assignments
     where person_id = $1 and tenant_id = $2 and role = 'ministry_formation_reviewer'`,
    [target, actor.tenantId],
  );
}

export async function getFormationPageMetadata(
  actor: AcademyActor,
  studentPersonId: string,
  db: AcademyQueryClient,
): Promise<FormationPageMetadata> {
  if (!hasFormationViewerAccess(actor)) {
    throw new AcademyAuthorizationError(
      "Forbidden formation page metadata access.",
    );
  }

  const subject = requireText(studentPersonId, "studentPersonId");

  // Fetch student display name with tenant isolation
  const studentNameResult = await db.query(
    `select display_name from academy_people where id = $1 and tenant_id = $2`,
    [subject, actor.tenantId],
  ) as { rows: Array<{ display_name: string }> };

  const studentDisplayName = studentNameResult.rows[0]?.display_name || "Student";

  // Fetch eligible advisors for the person picker with tenant isolation
  const eligibleAdvisorsResult = await db.query(
    `select distinct p.id, p.display_name
     from academy_people p
     join academy_person_role_assignments pra
       on pra.person_id = p.id and pra.tenant_id = p.tenant_id
     where p.tenant_id = $1
       and pra.role in ('faculty', 'advisor', 'institution_admin')
       and pra.status = 'active'
       and (pra.starts_on is null or pra.starts_on <= current_date)
       and (pra.ends_on is null or pra.ends_on >= current_date)
     order by p.display_name`,
    [actor.tenantId],
  ) as { rows: Array<{ id: string; display_name: string }> };

  return {
    studentDisplayName,
    eligibleAdvisors: eligibleAdvisorsResult.rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
    })),
  };
}
