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

function requireText(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required.`);
  }
  return trimmed;
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

  // If student, strip pastoralNotes
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

    return {
      tenantId: actor.tenantId,
      studentPersonId: subject,
      practicumSessions,
      milestones,
      evaluations: evaluationsStudentView,
    };
  } else {
    const evaluations: FormationEvaluation[] = evaluationResult.rows.map((row) => ({
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
    }));

    return {
      tenantId: actor.tenantId,
      studentPersonId: subject,
      practicumSessions,
      milestones,
      evaluations,
    };
  }
}
