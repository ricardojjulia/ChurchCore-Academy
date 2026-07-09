/**
 * Assignment Grading Service — ADR-0054
 *
 * Faculty-facing assignment creation and per-assignment grade entry with
 * weighted grade computation advisory model.
 *
 * Design constraints:
 * - Tenant isolation verified before any repository access
 * - Faculty must be section instructor to create/edit assignments
 * - Weight sum validation: all assignment weights in a section ≤ 100
 * - Assignments lock once first grade is entered (max_points/weight immutable)
 * - Computed grades are ADVISORY only - faculty posts through existing postGrade
 */

import type { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AssignmentGradingType = "points" | "pass_fail" | "rubric";

export interface Assignment {
  id: string;
  tenantId: string;
  sectionId: string;
  courseId: string;
  title: string;
  description?: string;
  dueDate?: string;
  maxPoints: number;
  weight: number; // Integer 0-100
  gradingType: AssignmentGradingType;
  createdBy: string;
  createdAt: string;
  locked: boolean;
}

export interface AssignmentSubmission {
  id: string;
  tenantId: string;
  assignmentId: string;
  studentRegistrationId: string;
  learnerPersonId: string;
  gradePoints?: number;
  passFailResult?: "pass" | "fail";
  submittedAt?: string;
  gradedAt?: string;
  gradedBy?: string;
}

export interface CreateAssignmentInput {
  sectionId: string;
  title: string;
  description?: string;
  dueDate?: string;
  maxPoints: number;
  weight: number; // Integer 0-100
  gradingType: AssignmentGradingType;
}

export interface UpdateAssignmentInput {
  title?: string;
  description?: string;
  dueDate?: string;
  maxPoints?: number; // Only if not locked
  weight?: number; // Only if not locked
}

export interface BulkGradeInput {
  studentRegistrationId: string;
  gradePoints?: number;
  passFailResult?: "pass" | "fail";
}

export interface ComputedGrade {
  studentRegistrationId: string;
  learnerPersonId: string;
  weightedPercentage: number;
  totalWeightUsed: number;
}

export class AssignmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssignmentValidationError";
  }
}

export class AssignmentLockedError extends Error {
  constructor() {
    super("Assignment is locked. Cannot change max_points or weight after grading has started.");
    this.name = "AssignmentLockedError";
  }
}

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

export interface AssignmentGradingDatabase {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------

function canManageAssignments(actor: AcademyActor): boolean {
  return actor.roles.some((r) =>
    ["faculty", "teacher", "professor", "institution_admin", "dean", "registrar", "academic_admin"].includes(r)
  );
}

function isAdmin(actor: AcademyActor): boolean {
  return actor.roles.some((r) =>
    ["institution_admin", "dean", "registrar", "academic_admin"].includes(r)
  );
}

// ---------------------------------------------------------------------------
// Section ownership verification
// ---------------------------------------------------------------------------

async function verifySectionInstructor(
  db: AssignmentGradingDatabase,
  tenantId: string,
  sectionId: string,
  actorUserId: string,
): Promise<void> {
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
      "You are not assigned as an instructor for this section."
    );
  }
}

// ---------------------------------------------------------------------------
// createAssignment
// ---------------------------------------------------------------------------

export async function createAssignment(
  db: AssignmentGradingDatabase,
  actor: AcademyActor,
  input: CreateAssignmentInput,
): Promise<Assignment> {
  if (!canManageAssignments(actor)) {
    throw new AcademyAuthorizationError("Only faculty and admins may create assignments.");
  }

  // Tenant isolation: verify section belongs to actor's tenant
  const sectionCheck = await db.query(
    `select course_id
       from public.academy_course_sections
      where tenant_id = $1 and id = $2`,
    [actor.tenantId, input.sectionId],
  );

  if (sectionCheck.rows.length === 0) {
    throw new AcademyAuthorizationError(
      "Section not found or does not belong to your institution."
    );
  }

  const courseId = String(sectionCheck.rows[0].course_id);

  // Non-admins must be section instructor
  if (!isAdmin(actor)) {
    await verifySectionInstructor(db, actor.tenantId, input.sectionId, actor.userId);
  }

  // Validate weight sum for section (must be ≤ 100)
  const weightCheck = await db.query(
    `select coalesce(sum(weight), 0) as total_weight
       from public.academy_gradebook_assignments
      where tenant_id = $1 and section_id = $2`,
    [actor.tenantId, input.sectionId],
  );

  const currentTotal = Number(weightCheck.rows[0]?.total_weight ?? 0);
  if (currentTotal + input.weight > 100) {
    throw new AssignmentValidationError(
      `Weight sum would exceed 100. Current: ${currentTotal}, Requested: ${input.weight}`
    );
  }

  // Create assignment
  const result = await db.query(
    `insert into public.academy_gradebook_assignments
       (tenant_id, course_id, section_id, created_by_person_id,
        title, description, max_points, weight, grading_type, due_date, locked)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)
     returning
       id, tenant_id, course_id, section_id, created_by_person_id,
       title, description, max_points, weight, grading_type, due_date,
       locked, created_at, updated_at`,
    [
      actor.tenantId,
      courseId,
      input.sectionId,
      actor.userId,
      input.title,
      input.description ?? null,
      input.maxPoints,
      input.weight,
      input.gradingType,
      input.dueDate ?? null,
    ],
  );

  return mapAssignmentRow(result.rows[0]);
}

// ---------------------------------------------------------------------------
// updateAssignment
// ---------------------------------------------------------------------------

export async function updateAssignment(
  db: AssignmentGradingDatabase,
  actor: AcademyActor,
  assignmentId: string,
  input: UpdateAssignmentInput,
): Promise<Assignment> {
  if (!canManageAssignments(actor)) {
    throw new AcademyAuthorizationError("Only faculty and admins may update assignments.");
  }

  // Tenant isolation: verify assignment belongs to actor's tenant
  const assignmentCheck = await db.query(
    `select section_id, locked
       from public.academy_gradebook_assignments
      where tenant_id = $1 and id = $2`,
    [actor.tenantId, assignmentId],
  );

  if (assignmentCheck.rows.length === 0) {
    throw new AcademyAuthorizationError(
      "Assignment not found or does not belong to your institution."
    );
  }

  const sectionId = String(assignmentCheck.rows[0].section_id);
  const isLocked = Boolean(assignmentCheck.rows[0].locked);

  // Non-admins must be section instructor
  if (!isAdmin(actor)) {
    await verifySectionInstructor(db, actor.tenantId, sectionId, actor.userId);
  }

  // If assignment is locked, reject changes to max_points or weight
  if (isLocked && (input.maxPoints !== undefined || input.weight !== undefined)) {
    throw new AssignmentLockedError();
  }

  // If weight is being changed, validate total
  if (input.weight !== undefined) {
    const weightCheck = await db.query(
      `select coalesce(sum(weight), 0) as total_weight
         from public.academy_gradebook_assignments
        where tenant_id = $1 and section_id = $2 and id != $3`,
      [actor.tenantId, sectionId, assignmentId],
    );

    const currentTotal = Number(weightCheck.rows[0]?.total_weight ?? 0);
    if (currentTotal + input.weight > 100) {
      throw new AssignmentValidationError(
        `Weight sum would exceed 100. Current (excluding this assignment): ${currentTotal}, Requested: ${input.weight}`
      );
    }
  }

  // Build update query
  const updates: string[] = [];
  const params: unknown[] = [actor.tenantId, assignmentId];
  let paramIndex = 3;

  if (input.title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    params.push(input.title);
  }
  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    params.push(input.description);
  }
  if (input.dueDate !== undefined) {
    updates.push(`due_date = $${paramIndex++}`);
    params.push(input.dueDate);
  }
  if (input.maxPoints !== undefined) {
    updates.push(`max_points = $${paramIndex++}`);
    params.push(input.maxPoints);
  }
  if (input.weight !== undefined) {
    updates.push(`weight = $${paramIndex++}`);
    params.push(input.weight);
  }

  updates.push(`updated_at = now()`);

  const result = await db.query(
    `update public.academy_gradebook_assignments
     set ${updates.join(", ")}
     where tenant_id = $1 and id = $2
     returning
       id, tenant_id, course_id, section_id, created_by_person_id,
       title, description, max_points, weight, grading_type, due_date,
       locked, created_at, updated_at`,
    params,
  );

  return mapAssignmentRow(result.rows[0]);
}

// ---------------------------------------------------------------------------
// bulkGradeAssignment
// ---------------------------------------------------------------------------

export async function bulkGradeAssignment(
  db: AssignmentGradingDatabase,
  actor: AcademyActor,
  assignmentId: string,
  grades: BulkGradeInput[],
): Promise<void> {
  if (!canManageAssignments(actor)) {
    throw new AcademyAuthorizationError("Only faculty and admins may enter grades.");
  }

  // Tenant isolation: verify assignment belongs to actor's tenant
  const assignmentCheck = await db.query(
    `select section_id
       from public.academy_gradebook_assignments
      where tenant_id = $1 and id = $2`,
    [actor.tenantId, assignmentId],
  );

  if (assignmentCheck.rows.length === 0) {
    throw new AcademyAuthorizationError(
      "Assignment not found or does not belong to your institution."
    );
  }

  const sectionId = String(assignmentCheck.rows[0].section_id);

  // Non-admins must be section instructor
  if (!isAdmin(actor)) {
    await verifySectionInstructor(db, actor.tenantId, sectionId, actor.userId);
  }

  // Upsert each grade
  for (const grade of grades) {
    // Find the learner_person_id from the registration
    const registrationCheck = await db.query(
      `select r.student_person_id, r.course_section_id
         from public.academy_course_section_registrations r
        where r.tenant_id = $1 and r.id = $2 and r.course_section_id = $3`,
      [actor.tenantId, grade.studentRegistrationId, sectionId],
    );

    if (registrationCheck.rows.length === 0) {
      throw new AssignmentValidationError(
        `Student registration ${grade.studentRegistrationId} not found in this section.`
      );
    }

    const learnerPersonId = String(registrationCheck.rows[0].student_person_id);

    await db.query(
      `insert into public.academy_gradebook_submissions
         (tenant_id, assignment_id, learner_person_id, status, grade_points, pass_fail_result, graded_at, graded_by)
       values ($1, $2, $3, 'graded', $4, $5, now(), $6)
       on conflict (tenant_id, assignment_id, learner_person_id)
       do update set
         status = 'graded',
         grade_points = excluded.grade_points,
         pass_fail_result = excluded.pass_fail_result,
         graded_at = now(),
         graded_by = excluded.graded_by,
         updated_at = now()`,
      [
        actor.tenantId,
        assignmentId,
        learnerPersonId,
        grade.gradePoints ?? null,
        grade.passFailResult ?? null,
        actor.userId,
      ],
    );
  }

  // Lock assignment (trigger will handle this, but explicit update for safety)
  await db.query(
    `update public.academy_gradebook_assignments
     set locked = true
     where tenant_id = $1 and id = $2`,
    [actor.tenantId, assignmentId],
  );
}

// ---------------------------------------------------------------------------
// computeSectionGrades
// ---------------------------------------------------------------------------

export async function computeSectionGrades(
  db: AssignmentGradingDatabase,
  actor: AcademyActor,
  sectionId: string,
): Promise<ComputedGrade[]> {
  if (!canManageAssignments(actor)) {
    throw new AcademyAuthorizationError("Only faculty and admins may compute grades.");
  }

  // Tenant isolation: verify section belongs to actor's tenant
  const sectionCheck = await db.query(
    `select id
       from public.academy_course_sections
      where tenant_id = $1 and id = $2`,
    [actor.tenantId, sectionId],
  );

  if (sectionCheck.rows.length === 0) {
    throw new AcademyAuthorizationError(
      "Section not found or does not belong to your institution."
    );
  }

  // Non-admins must be section instructor
  if (!isAdmin(actor)) {
    await verifySectionInstructor(db, actor.tenantId, sectionId, actor.userId);
  }

  // Compute weighted grades per ADR-0054:
  // weighted_grade = sum(assignment.grade_points / assignment.max_points * assignment.weight)
  //                / sum(assignment.weight for graded assignments)
  const result = await db.query(
    `select
       r.id as student_registration_id,
       r.student_person_id as learner_person_id,
       sum(
         case
           when s.grade_points is not null and a.max_points > 0
           then (s.grade_points / a.max_points) * a.weight
           else 0
         end
       ) as weighted_sum,
       sum(
         case
           when s.grade_points is not null
           then a.weight
           else 0
         end
       ) as total_weight_graded
     from public.academy_course_section_registrations r
     cross join public.academy_gradebook_assignments a
     left join public.academy_gradebook_submissions s
       on s.tenant_id = r.tenant_id
       and s.assignment_id = a.id
       and s.learner_person_id = r.student_person_id
     where r.tenant_id = $1
       and r.course_section_id = $2
       and r.status in ('registered', 'completed')
       and a.tenant_id = r.tenant_id
       and a.section_id = r.course_section_id
     group by r.id, r.student_person_id`,
    [actor.tenantId, sectionId],
  );

  return result.rows.map((row) => {
    const weightedSum = Number(row.weighted_sum ?? 0);
    const totalWeightGraded = Number(row.total_weight_graded ?? 0);
    const weightedPercentage =
      totalWeightGraded > 0 ? weightedSum / totalWeightGraded : 0;

    return {
      studentRegistrationId: String(row.student_registration_id),
      learnerPersonId: String(row.learner_person_id),
      weightedPercentage,
      totalWeightUsed: totalWeightGraded,
    };
  });
}

// ---------------------------------------------------------------------------
// getAssignments
// ---------------------------------------------------------------------------

export async function getAssignments(
  db: AssignmentGradingDatabase,
  actor: AcademyActor,
  sectionId: string,
): Promise<Assignment[]> {
  if (!canManageAssignments(actor)) {
    throw new AcademyAuthorizationError("Only faculty and admins may view assignments.");
  }

  // Tenant isolation
  const sectionCheck = await db.query(
    `select id
       from public.academy_course_sections
      where tenant_id = $1 and id = $2`,
    [actor.tenantId, sectionId],
  );

  if (sectionCheck.rows.length === 0) {
    throw new AcademyAuthorizationError(
      "Section not found or does not belong to your institution."
    );
  }

  const result = await db.query(
    `select
       id, tenant_id, course_id, section_id, created_by_person_id,
       title, description, max_points, weight, grading_type, due_date,
       locked, created_at, updated_at
     from public.academy_gradebook_assignments
     where tenant_id = $1 and section_id = $2
     order by due_date asc nulls last, created_at asc`,
    [actor.tenantId, sectionId],
  );

  return result.rows.map(mapAssignmentRow);
}

// ---------------------------------------------------------------------------
// getAssignmentGrades
// ---------------------------------------------------------------------------

export async function getAssignmentGrades(
  db: AssignmentGradingDatabase,
  actor: AcademyActor,
  assignmentId: string,
): Promise<AssignmentSubmission[]> {
  if (!canManageAssignments(actor)) {
    throw new AcademyAuthorizationError("Only faculty and admins may view grades.");
  }

  // Tenant isolation
  const assignmentCheck = await db.query(
    `select section_id
       from public.academy_gradebook_assignments
      where tenant_id = $1 and id = $2`,
    [actor.tenantId, assignmentId],
  );

  if (assignmentCheck.rows.length === 0) {
    throw new AcademyAuthorizationError(
      "Assignment not found or does not belong to your institution."
    );
  }

  const sectionId = String(assignmentCheck.rows[0].section_id);

  const result = await db.query(
    `select
       coalesce(s.id::text, r.id::text) as id,
       r.tenant_id,
       $2::uuid as assignment_id,
       r.student_person_id as learner_person_id,
       s.grade_points,
       s.pass_fail_result,
       s.submitted_at,
       s.graded_at,
       s.graded_by,
       r.id as student_registration_id
     from public.academy_course_section_registrations r
     left join public.academy_gradebook_submissions s
       on s.tenant_id = r.tenant_id
       and s.assignment_id = $2
       and s.learner_person_id = r.student_person_id
     where r.tenant_id = $1
       and r.course_section_id = $3
       and r.status in ('registered', 'completed')
     order by r.student_person_id`,
    [actor.tenantId, assignmentId, sectionId],
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    tenantId: String(row.tenant_id),
    assignmentId: String(row.assignment_id),
    studentRegistrationId: row.student_registration_id
      ? String(row.student_registration_id)
      : "",
    learnerPersonId: String(row.learner_person_id),
    gradePoints: row.grade_points != null ? Number(row.grade_points) : undefined,
    passFailResult: row.pass_fail_result
      ? (String(row.pass_fail_result) as "pass" | "fail")
      : undefined,
    submittedAt: row.submitted_at ? String(row.submitted_at) : undefined,
    gradedAt: row.graded_at ? String(row.graded_at) : undefined,
    gradedBy: row.graded_by ? String(row.graded_by) : undefined,
  }));
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function mapAssignmentRow(row: Record<string, unknown>): Assignment {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    sectionId: String(row.section_id),
    courseId: String(row.course_id),
    title: String(row.title),
    description: row.description ? String(row.description) : undefined,
    dueDate: row.due_date ? String(row.due_date) : undefined,
    maxPoints: Number(row.max_points),
    weight: Number(row.weight),
    gradingType: String(row.grading_type) as AssignmentGradingType,
    createdBy: String(row.created_by_person_id),
    createdAt: String(row.created_at),
    locked: Boolean(row.locked),
  };
}
