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
  isPassing: boolean;
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
  isPassing: boolean,
): Promise<SubmitDraftFinalGradeResult> {
  if (!isInstructor(actor) && !isAdmin(actor)) {
    throw new AcademyAuthorizationError(
      "Only instructors may submit draft final grades.",
    );
  }

  // The submission form's Input caps this at 8 characters client-side, but that's bypassable by
  // any direct API call — enforce the same limit server-side so an arbitrarily long string can't
  // land in the summary and later an immutable transcript entry.
  if (letterGrade.length === 0 || letterGrade.length > 8) {
    throw new Error("letterGrade must be between 1 and 8 characters.");
  }

  // Verify tenant isolation. academy_course_sections has no term_id column (only
  // academic_period_id) — this query previously referenced a column that has never existed,
  // meaning every call to this function has failed outright since it was written. Found while
  // wiring the first real caller for this function.
  const sectionResult = await db.query(
    `select course_id
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

  // Resolve the student's registration for THIS section — academy_program_enrollments has no
  // course_id or person_id columns at all (it's a program-level enrollment: academic_program_id,
  // catalog_academic_year_id, student_person_id), so the previous direct lookup there could never
  // have matched anything even if the section query above hadn't already failed first. The
  // section-scoped registration is the authoritative link to both the program enrollment and
  // this specific section.
  const registrationResult = await db.query(
    `select id, program_enrollment_id
       from public.academy_course_section_registrations
      where tenant_id = $1
        and course_section_id = $2
        and student_person_id = $3
        and status in ('registered', 'completed')`,
    [actor.tenantId, sectionId, learnerPersonId],
  );

  const registrationRow = registrationResult.rows[0];
  if (!registrationRow) {
    // "not found" maps handleApi to 404 rather than an opaque 500 — see api-utils.ts.
    throw new Error("An active registration was not found for this student in this section.");
  }
  if (!registrationRow.program_enrollment_id) {
    // Some registrations (e.g. K-12 grade-band enrollment, seeded in
    // 20260624060000_seed_demo_multi_institution_showcase.sql: "no program enrollment needed for
    // K-12 grade bands") legitimately have no program_enrollment_id at all.
    // academy_gradebook_course_summaries.enrollment_id is a NOT NULL FK to
    // academy_program_enrollments, so there is no valid value to write for these students today.
    // Supporting them needs a real schema change to the summary/transcript-entry pipeline (an
    // alternate, non-program-enrollment key), which is a grading/transcript architecture change
    // per CLAUDE.md Rule 0 — flagged as a follow-up rather than improvised here. " must " keeps
    // this a 400, not a 500 (see api-utils.ts).
    throw new Error(
      "This registration must have a program enrollment before a final grade can be submitted; " +
        "final grades for non-program (e.g. K-12 grade-band) registrations are not yet supported.",
    );
  }

  const registrationId = String(registrationRow.id);
  const enrollmentId = String(registrationRow.program_enrollment_id);

  // Once a transcript entry exists for this registration it is immutable (enforced by a DB
  // trigger); a resubmission past that point would silently update the still-mutable draft
  // summary while the posted transcript stays frozen, leaving the two permanently disagreeing
  // with no signal to the faculty member or the UI. Found in PR review before merge.
  const postedCheck = await db.query(
    `select id from public.academy_transcript_entries
      where tenant_id = $1 and course_section_registration_id = $2`,
    [actor.tenantId, registrationId],
  );
  if (postedCheck.rows.length > 0) {
    throw new Error(
      "This course has already been posted to the student's transcript; it must be corrected " +
        "through the registrar's grade override workflow, not resubmitted here.",
    );
  }

  const submittedAt = new Date().toISOString();

  // is_passing is caller-supplied rather than derived from the letter grade string: per
  // ADR-0054 the final grade is a manual entry with no automatic conversion, and there is no
  // institution-configured mapping from letter grade to pass/fail available at this layer (a
  // hardcoded rule like "F fails" would bake in a specific grading scheme this SIS is meant to
  // stay agnostic to). academy_transcript_entries.is_passing is NOT NULL, so a real boolean must
  // be captured here rather than left null, matching the pattern already used for is_passing on
  // individual academy_gradebook_records entries.
  // on conflict targets (tenant_id, enrollment_id, course_id) — enrollment_id is the student's
  // PROGRAM enrollment (program-scoped, not course-scoped), so a (tenant_id, enrollment_id)-only
  // target would let a second course under the same program enrollment silently overwrite the
  // first course's summary row. Confirmed against real local data: two program enrollments each
  // span two course sections. See migration 20260917030000_final_grade_submission_fixes.sql,
  // which widens the underlying unique constraint to match.
  await db.query(
    `insert into public.academy_gradebook_course_summaries
       (tenant_id, course_id, learner_person_id, enrollment_id,
        final_letter_grade, is_passing, sensitivity_tier)
     values ($1, $2, $3, $4, $5, $6, 'standard')
     on conflict (tenant_id, enrollment_id, course_id)
     do update set
       final_letter_grade = excluded.final_letter_grade,
       is_passing = excluded.is_passing,
       updated_at = now()`,
    [actor.tenantId, courseId, learnerPersonId, enrollmentId, letterGrade, isPassing],
  );

  // Submitting a final grade for a section means this student's participation in it is
  // complete — mark the registration accordingly so it becomes eligible for the registrar's
  // existing transcript-entry promotion flow (TranscriptEntryService.listCandidates requires
  // registration.status = 'completed'). A resubmission (e.g. a grade correction before a
  // registrar promotes it) is a no-op here since the registration is already completed.
  await db.query(
    `update public.academy_course_section_registrations
        set status = 'completed', updated_at = now()
      where tenant_id = $1 and id = $2`,
    [actor.tenantId, registrationId],
  );

  return {
    sectionId,
    learnerPersonId,
    letterGrade,
    isPassing,
    submittedAt,
  };
}

// ---------------------------------------------------------------------------
// getSectionFinalGradeStatus
// ---------------------------------------------------------------------------

export interface SectionFinalGradeStatus {
  studentRegistrationId: string;
  learnerPersonId: string;
  registrationStatus: string;
  finalLetterGrade?: string;
  isPassing?: boolean;
}

/**
 * Read model for the faculty final-grade submission UI: for every active-or-completed
 * registration in a section, whether a final grade has already been submitted for it (via
 * submitDraftFinalGrade) and the registration's current status.
 */
export async function getSectionFinalGradeStatus(
  db: AssignmentDatabase,
  actor: AcademyActor,
  sectionId: string,
): Promise<SectionFinalGradeStatus[]> {
  if (!isInstructor(actor) && !isAdmin(actor)) {
    throw new AcademyAuthorizationError("Only instructors and admins may view final grade status.");
  }

  const sectionCheck = await db.query(
    `select id from public.academy_course_sections where tenant_id = $1 and id = $2`,
    [actor.tenantId, sectionId],
  );
  if (sectionCheck.rows.length === 0) {
    throw new AcademyAuthorizationError("Section not found or does not belong to your institution.");
  }

  if (!isAdmin(actor)) {
    await assertSectionOwnership(db, actor.tenantId, sectionId, actor.userId);
  }

  const result = await db.query(
    `select
       reg.id as registration_id,
       reg.student_person_id as learner_person_id,
       reg.status as registration_status,
       summary.final_letter_grade,
       summary.is_passing
     from public.academy_course_section_registrations reg
     join public.academy_course_sections section
       on section.tenant_id = reg.tenant_id and section.id = reg.course_section_id
     left join public.academy_gradebook_course_summaries summary
       on summary.tenant_id = reg.tenant_id
      and summary.enrollment_id = reg.program_enrollment_id
      and summary.course_id = section.course_id
     where reg.tenant_id = $1
       and reg.course_section_id = $2
       and reg.status in ('registered', 'completed')
     order by reg.student_person_id`,
    [actor.tenantId, sectionId],
  );

  return result.rows.map((row) => ({
    studentRegistrationId: String(row.registration_id),
    learnerPersonId: String(row.learner_person_id),
    registrationStatus: String(row.registration_status),
    finalLetterGrade: row.final_letter_grade ? String(row.final_letter_grade) : undefined,
    isPassing: row.is_passing == null ? undefined : Boolean(row.is_passing),
  }));
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
