/**
 * Assignment service — faculty-facing CRUD for gradebook assignments and
 * submission scores, plus draft final-grade submission.
 *
 * Design constraints:
 * - Business logic only: no direct DB imports. DB is injected via AssignmentDatabase.
 * - Tenant isolation verified before any write.
 * - Faculty must own the section (primary or assistant) to create/delete assignments.
 * - Score may exceed max_points (extra credit) — allowed with a warning in the return value.
 * - Grade submission deadline: if the term's grade_submission_deadline has passed, throw GradeDeadlineError.
 */

import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AssignmentType =
  | "essay"
  | "quiz"
  | "project"
  | "participation"
  | "attendance"
  | "practical"
  | "reflection";

export const ASSIGNMENT_TYPES: AssignmentType[] = [
  "essay",
  "quiz",
  "project",
  "participation",
  "attendance",
  "practical",
  "reflection",
];

export interface AssignmentRecord {
  id: string;
  tenantId: string;
  courseId: string;
  sectionId: string;
  createdByPersonId: string;
  title: string;
  description?: string;
  assignmentType: AssignmentType;
  maxPoints: number;
  weight: number;
  dueDate?: string;
  isPublished: boolean;
  sensitivityTier: "standard" | "elevated" | "pastoral";
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionScoreRecord {
  id: string;
  tenantId: string;
  assignmentId: string;
  learnerPersonId: string;
  status: string;
  submittedAt: string;
  updatedAt: string;
}

export interface CreateAssignmentInput {
  sectionId: string;
  title: string;
  assignmentType: AssignmentType;
  maxPoints: number;
  weight?: number;
  dueDate?: string;
  description?: string;
}

export interface UpsertScoreInput {
  assignmentId: string;
  learnerPersonId: string;
  score: number | null;
}

export interface UpsertScoreResult {
  submission: SubmissionScoreRecord;
  /** True when score exceeds maxPoints (extra credit). */
  warning?: boolean;
  warningMessage?: string;
}

export interface SubmitDraftFinalGradeResult {
  sectionId: string;
  learnerPersonId: string;
  letterGrade: string;
  submittedAt: string;
}

/** Thrown when trying to score a submission after the grade submission deadline. */
export class GradeDeadlineError extends Error {
  constructor(deadline: string) {
    super(`Grade submission deadline has passed (${deadline}). Contact the registrar.`);
    this.name = "GradeDeadlineError";
  }
}

// ---------------------------------------------------------------------------
// Repository interface (injected — never import a DB driver here)
// ---------------------------------------------------------------------------

export interface AssignmentDatabase {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------

const INSTRUCTOR_ROLES = new Set<AcademyRole>(["faculty", "teacher", "professor"]);
const ADMIN_ROLES = new Set<AcademyRole>([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
]);

function isInstructor(actor: AcademyActor) {
  return actor.roles.some((r) => INSTRUCTOR_ROLES.has(r));
}

function isAdmin(actor: AcademyActor) {
  return actor.roles.some((r) => ADMIN_ROLES.has(r));
}

// ---------------------------------------------------------------------------
// Section ownership check
// ---------------------------------------------------------------------------

async function assertSectionOwnership(
  db: AssignmentDatabase,
  tenantId: string,
  sectionId: string,
  actorUserId: string,
) {
  const result = await db.query(
    `select 1
       from public.academy_course_sections
      where tenant_id = $1
        and id = $2
        and (primary_instructor_id = $3 or assistant_instructor_ids ? $3)
      limit 1`,
    [tenantId, sectionId, actorUserId],
  );
  if (result.rows.length === 0) {
    throw new AcademyAuthorizationError(
      "You are not assigned as an instructor for this section.",
    );
  }
}

// ---------------------------------------------------------------------------
// createAssignment
// ---------------------------------------------------------------------------

export async function createAssignment(
  db: AssignmentDatabase,
  actor: AcademyActor,
  input: CreateAssignmentInput,
): Promise<AssignmentRecord> {
  if (!isInstructor(actor) && !isAdmin(actor)) {
    throw new AcademyAuthorizationError(
      "Only instructors may create assignments.",
    );
  }

  // Tenant isolation: section must belong to actor's tenant
  const sectionCheck = await db.query(
    `select course_id
       from public.academy_course_sections
      where tenant_id = $1 and id = $2`,
    [actor.tenantId, input.sectionId],
  );

  if (sectionCheck.rows.length === 0) {
    throw new AcademyAuthorizationError(
      "Section not found or does not belong to your institution.",
    );
  }

  // Instructors (non-admins) must own the section
  if (!isAdmin(actor)) {
    await assertSectionOwnership(db, actor.tenantId, input.sectionId, actor.userId);
  }

  const courseId = String(sectionCheck.rows[0].course_id);
  const weight = input.weight ?? 1.0;

  const result = await db.query(
    `insert into public.academy_gradebook_assignments
       (tenant_id, course_id, section_id, created_by_person_id,
        title, description, assignment_type, max_points, weight, due_date)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning
       id, tenant_id, course_id, section_id, created_by_person_id,
       title, description, assignment_type, max_points, weight,
       due_date, is_published, sensitivity_tier, created_at, updated_at`,
    [
      actor.tenantId,
      courseId,
      input.sectionId,
      actor.userId,
      input.title,
      input.description ?? null,
      input.assignmentType,
      input.maxPoints,
      weight,
      input.dueDate ?? null,
    ],
  );

  return mapAssignmentRow(result.rows[0]);
}

// ---------------------------------------------------------------------------
// deleteAssignment
// ---------------------------------------------------------------------------

export async function deleteAssignment(
  db: AssignmentDatabase,
  actor: AcademyActor,
  assignmentId: string,
): Promise<void> {
  if (!isInstructor(actor) && !isAdmin(actor)) {
    throw new AcademyAuthorizationError("Only instructors may delete assignments.");
  }

  // Look up assignment to get sectionId and verify tenant
  const assignmentResult = await db.query(
    `select section_id, created_by_person_id
       from public.academy_gradebook_assignments
      where tenant_id = $1 and id = $2`,
    [actor.tenantId, assignmentId],
  );

  if (assignmentResult.rows.length === 0) {
    throw new Error("Assignment not found.");
  }

  const sectionId = String(assignmentResult.rows[0].section_id);

  if (!isAdmin(actor)) {
    await assertSectionOwnership(db, actor.tenantId, sectionId, actor.userId);
  }

  // Delete submissions first (FK constraint), then the assignment
  await db.query(
    `delete from public.academy_gradebook_submissions
      where tenant_id = $1 and assignment_id = $2`,
    [actor.tenantId, assignmentId],
  );

  await db.query(
    `delete from public.academy_gradebook_assignments
      where tenant_id = $1 and id = $2`,
    [actor.tenantId, assignmentId],
  );
}

// ---------------------------------------------------------------------------
// upsertSubmissionScore
// ---------------------------------------------------------------------------

export async function upsertSubmissionScore(
  db: AssignmentDatabase,
  actor: AcademyActor,
  input: UpsertScoreInput,
): Promise<UpsertScoreResult> {
  if (!isInstructor(actor) && !isAdmin(actor)) {
    throw new AcademyAuthorizationError("Only instructors may record scores.");
  }

  // Load assignment (verify tenant + get section and deadline info)
  const assignmentResult = await db.query(
    `select a.id, a.section_id, a.max_points,
            t.grade_submission_deadline
       from public.academy_gradebook_assignments a
       join public.academy_course_sections s
         on s.tenant_id = a.tenant_id and s.id = a.section_id
       left join public.academy_academic_terms t
         on t.tenant_id = a.tenant_id and t.id = s.term_id
      where a.tenant_id = $1 and a.id = $2`,
    [actor.tenantId, input.assignmentId],
  );

  if (assignmentResult.rows.length === 0) {
    throw new Error("Assignment not found.");
  }

  const assignmentRow = assignmentResult.rows[0];
  const sectionId = String(assignmentRow.section_id);
  const maxPoints = Number(assignmentRow.max_points);
  const deadline = assignmentRow.grade_submission_deadline
    ? String(assignmentRow.grade_submission_deadline)
    : null;

  // Check deadline
  if (deadline && new Date(deadline) < new Date()) {
    throw new GradeDeadlineError(deadline);
  }

  if (!isAdmin(actor)) {
    await assertSectionOwnership(db, actor.tenantId, sectionId, actor.userId);
  }

  // Upsert the submission row (learner_person_id + assignment_id = unique)
  const upsertResult = await db.query(
    `insert into public.academy_gradebook_submissions
       (tenant_id, assignment_id, learner_person_id, status, content)
     values ($1, $2, $3, 'graded', null)
     on conflict (tenant_id, assignment_id, learner_person_id)
     do update set
       status = 'graded',
       updated_at = now()
     returning id, tenant_id, assignment_id, learner_person_id, status, submitted_at, updated_at`,
    [actor.tenantId, input.assignmentId, input.learnerPersonId],
  );

  const row = upsertResult.rows[0];
  const submission: SubmissionScoreRecord = {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    assignmentId: String(row.assignment_id),
    learnerPersonId: String(row.learner_person_id),
    status: String(row.status),
    submittedAt: String(row.submitted_at),
    updatedAt: String(row.updated_at),
  };

  const score = input.score;
  const isExtraCredit = score !== null && score > maxPoints;

  return {
    submission,
    ...(isExtraCredit
      ? {
          warning: true,
          warningMessage: `Score ${score} exceeds max points ${maxPoints}. This will be recorded as extra credit.`,
        }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// submitDraftFinalGrade
// ---------------------------------------------------------------------------

export async function submitDraftFinalGrade(
  db: AssignmentDatabase,
  actor: AcademyActor,
  sectionId: string,
  learnerPersonId: string,
  letterGrade: string,
): Promise<SubmitDraftFinalGradeResult> {
  if (!isInstructor(actor) && !isAdmin(actor)) {
    throw new AcademyAuthorizationError(
      "Only instructors may submit draft final grades.",
    );
  }

  // Verify tenant isolation
  const sectionResult = await db.query(
    `select course_id, term_id
       from public.academy_course_sections
      where tenant_id = $1 and id = $2`,
    [actor.tenantId, sectionId],
  );

  if (sectionResult.rows.length === 0) {
    throw new AcademyAuthorizationError(
      "Section not found or does not belong to your institution.",
    );
  }

  if (!isAdmin(actor)) {
    await assertSectionOwnership(db, actor.tenantId, sectionId, actor.userId);
  }

  const courseId = String(sectionResult.rows[0].course_id);

  // Find the enrollment for the student in this course
  const enrollmentResult = await db.query(
    `select id
       from public.academy_program_enrollments
      where tenant_id = $1
        and person_id = $2
        and course_id = $3
      limit 1`,
    [actor.tenantId, learnerPersonId, courseId],
  );

  const enrollmentId = enrollmentResult.rows[0]
    ? String(enrollmentResult.rows[0].id)
    : null;

  const submittedAt = new Date().toISOString();

  // Write draft to gradebook course summaries (posting_status = draft)
  await db.query(
    `insert into public.academy_gradebook_course_summaries
       (tenant_id, course_id, learner_person_id, enrollment_id,
        final_letter_grade, is_passing, sensitivity_tier)
     values ($1, $2, $3, $4, $5, null, 'standard')
     on conflict (tenant_id, enrollment_id)
     do update set
       final_letter_grade = excluded.final_letter_grade,
       updated_at = now()`,
    [actor.tenantId, courseId, learnerPersonId, enrollmentId, letterGrade],
  );

  return {
    sectionId,
    learnerPersonId,
    letterGrade,
    submittedAt,
  };
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function mapAssignmentRow(row: Record<string, unknown>): AssignmentRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    courseId: String(row.course_id),
    sectionId: String(row.section_id),
    createdByPersonId: String(row.created_by_person_id),
    title: String(row.title),
    description: row.description != null ? String(row.description) : undefined,
    assignmentType: String(row.assignment_type) as AssignmentType,
    maxPoints: Number(row.max_points),
    weight: Number(row.weight),
    dueDate: row.due_date != null ? String(row.due_date) : undefined,
    isPublished: Boolean(row.is_published),
    sensitivityTier: (String(row.sensitivity_tier) || "standard") as AssignmentRecord["sensitivityTier"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
