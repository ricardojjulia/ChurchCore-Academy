import { getDatabasePool } from "@/lib/database";
import { AcademyConflictError } from "@/modules/academy-auth/errors";
import type {
  GradebookAuditRead,
  GradebookGradingTarget,
  GradebookReadModel,
  GradebookRecordRead,
} from "@/modules/gradebook/types";
import type { SensitivityTier, SubmissionStatus } from "@/types/gradebook";

export interface GradebookQueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface GradebookDatabase {
  query(sql: string, values?: unknown[]): Promise<GradebookQueryResult>;
}

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function optionalIso(value: unknown) {
  return value === null || value === undefined ? null : iso(value);
}

function optionalString(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function optionalNumber(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

function mapRecordRow(row: Record<string, unknown>): GradebookRecordRead {
  return {
    id: String(row.id),
    submissionId: String(row.submission_id),
    assignmentId: String(row.assignment_id),
    assignmentTitle: String(row.assignment_title),
    courseId: String(row.course_id),
    courseTitle: String(row.course_title),
    sectionId: optionalString(row.section_id),
    sectionCode: optionalString(row.section_code),
    learnerPersonId: String(row.learner_person_id),
    learnerDisplayName: String(row.learner_display_name),
    pointsEarned: optionalNumber(row.points_earned),
    maxPoints: Number(row.max_points),
    percentage: optionalNumber(row.percentage),
    letterGrade: optionalString(row.letter_grade),
    isPassing:
      row.is_passing === null || row.is_passing === undefined
        ? null
        : Boolean(row.is_passing),
    instructorFeedback: optionalString(row.instructor_feedback),
    sensitivityTier: row.sensitivity_tier as SensitivityTier,
    gradedAt: iso(row.graded_at),
    isOverridden: Boolean(row.is_overridden),
    postingStatus:
      row.posting_status === undefined
        ? undefined
        : row.posting_status as GradebookRecordRead["postingStatus"],
    postedAt:
      row.posted_at === undefined ? undefined : optionalIso(row.posted_at),
    releasedToStudentAt:
      row.released_to_student_at === undefined
        ? undefined
        : optionalIso(row.released_to_student_at),
    status: row.status as SubmissionStatus,
    submittedAt: optionalIso(row.submitted_at),
    ...(row.behavioral_signal === undefined
      ? {}
      : { behavioralSignal: optionalString(row.behavioral_signal) }),
  };
}

function mapAuditRow(row: Record<string, unknown>): GradebookAuditRead {
  return {
    id: String(row.id),
    gradeRecordId: optionalString(row.grade_record_id),
    summaryId: optionalString(row.summary_id),
    overriddenByPersonId: String(row.overridden_by_person_id),
    overriddenBy: String(row.overridden_by_display_name ?? row.overridden_by_person_id),
    overrideType: row.override_type as GradebookAuditRead["overrideType"],
    reason: String(row.reason),
    overrideAt: iso(row.override_at),
  };
}

function mapGradingTargetRow(row: Record<string, unknown>): GradebookGradingTarget {
  return {
    submissionId: String(row.submission_id),
    assignmentId: String(row.assignment_id),
    assignmentTitle: String(row.assignment_title),
    courseTitle: String(row.course_title),
    sectionCode: String(row.section_code),
    learnerPersonId: String(row.learner_person_id),
    learnerDisplayName: String(row.learner_display_name),
    maxPoints: Number(row.max_points),
    status: String(row.status),
    submittedAt: optionalIso(row.submitted_at),
    sensitivityTier: row.sensitivity_tier as GradebookGradingTarget["sensitivityTier"],
  };
}

export class GradebookPostgresRepository {
  constructor(private readonly database: GradebookDatabase = getDatabasePool()) {}

  async fetchAdminGradebook(tenantId: string): Promise<GradebookReadModel> {
    return {
      records: await this.fetchRecords(
        `where record.tenant_id = $1`,
        [tenantId],
        true,
      ),
      overrideAudit: await this.fetchOverrideAudit(tenantId),
    };
  }

  async fetchInstructorGradebook(
    tenantId: string,
    instructorPersonId: string,
    filters: { learnerPersonId?: string } = {},
  ): Promise<GradebookReadModel> {
    const conditions = [
      `record.tenant_id = $1`,
      `(section.primary_instructor_id = $2 or section.assistant_instructor_ids ? $2)`,
    ];
    const values: unknown[] = [tenantId, instructorPersonId];

    if (filters.learnerPersonId) {
      values.push(filters.learnerPersonId);
      conditions.push(`record.learner_person_id = $${values.length}`);
    }

    return {
      records: await this.fetchRecords(
        `where ${conditions.join(" and ")}`,
        values,
        true,
      ),
      overrideAudit: await this.fetchOverrideAudit(tenantId, instructorPersonId),
      gradingTargets: await this.fetchInstructorGradingTargets(
        tenantId,
        instructorPersonId,
        filters,
      ),
    };
  }

  async fetchLearnerGradebook(
    tenantId: string,
    learnerPersonId: string,
  ): Promise<GradebookReadModel> {
    return {
      records: await this.fetchRecords(
        `where record.tenant_id = $1
           and record.learner_person_id = $2
           and record.posting_status = 'posted'
           and record.released_to_student_at is not null`,
        [tenantId, learnerPersonId],
        false,
      ),
      overrideAudit: [],
    };
  }

  private async fetchRecords(
    whereClause: string,
    values: unknown[],
    includeBehavioralSignal: boolean,
  ) {
    const behavioralSignalSelect = includeBehavioralSignal
      ? `, case
            when record.is_passing = false then 'Needs support'
            when record.is_overridden then 'Override applied'
            else 'On pace'
         end as behavioral_signal`
      : "";

    const result = await this.database.query(
      `
        select
          record.id,
          record.submission_id,
          record.assignment_id,
          assignment.title as assignment_title,
          assignment.course_id,
          course.title as course_title,
          assignment.section_id,
          section.section_code,
          record.learner_person_id,
          learner.display_name as learner_display_name,
          record.points_earned,
          record.max_points,
          record.percentage,
          record.letter_grade,
          record.is_passing,
          record.instructor_feedback,
          record.sensitivity_tier,
          record.graded_at,
          record.is_overridden,
          record.posting_status,
          record.posted_at,
          record.released_to_student_at,
          submission.status,
          submission.submitted_at
          ${behavioralSignalSelect}
        from public.academy_gradebook_records record
        join public.academy_gradebook_assignments assignment
          on assignment.tenant_id = record.tenant_id
         and assignment.id = record.assignment_id
        join public.academy_courses course
          on course.tenant_id = assignment.tenant_id
         and course.id = assignment.course_id
        left join public.academy_course_sections section
          on section.tenant_id = assignment.tenant_id
         and section.id = assignment.section_id
        join public.academy_gradebook_submissions submission
          on submission.tenant_id = record.tenant_id
         and submission.id = record.submission_id
        join public.academy_people learner
          on learner.tenant_id = record.tenant_id
         and learner.id = record.learner_person_id
        ${whereClause}
        order by course.title asc, assignment.title asc, learner.display_name asc
      `,
      values,
    );

    return result.rows.map(mapRecordRow);
  }

  private async fetchOverrideAudit(tenantId: string, instructorPersonId?: string) {
    const values: unknown[] = [tenantId];
    const instructorFilter = instructorPersonId
      ? `and exists (
           select 1
           from public.academy_gradebook_records record
           join public.academy_gradebook_assignments assignment
             on assignment.tenant_id = record.tenant_id
            and assignment.id = record.assignment_id
           join public.academy_course_sections section
             on section.tenant_id = assignment.tenant_id
            and section.id = assignment.section_id
           where record.tenant_id = audit.tenant_id
             and record.id = audit.grade_record_id
             and (section.primary_instructor_id = $2 or section.assistant_instructor_ids ? $2)
         )`
      : "";

    if (instructorPersonId) {
      values.push(instructorPersonId);
    }

    const result = await this.database.query(
      `
        select
          audit.id,
          audit.grade_record_id,
          audit.summary_id,
          audit.overridden_by_person_id,
          person.display_name as overridden_by_display_name,
          audit.override_type,
          audit.reason,
          audit.override_at
        from public.academy_gradebook_override_audit audit
        left join public.academy_people person
          on person.tenant_id = audit.tenant_id
         and person.id = audit.overridden_by_person_id
        where audit.tenant_id = $1
        ${instructorFilter}
        order by audit.override_at desc
        limit 100
      `,
      values,
    );

    return result.rows.map(mapAuditRow);
  }

  async gradeSubmission(input: {
    tenantId: string;
    submissionId: string;
    assignmentId: string;
    learnerPersonId: string;
    gradedByPersonId: string;
    pointsEarned: number | null;
    letterGrade?: string | null;
    isPassing?: boolean | null;
    instructorFeedback?: string | null;
  }): Promise<GradebookRecordRead> {
    // Resolve the submission/assignment/learner target and its grading fields (max_points,
    // sensitivity_tier) from the assignment itself, not from caller input — max_points and
    // sensitivity_tier belong to the assignment's own defined scale, not something a caller
    // should be able to override per-request. Mirrors the equivalent fix in submitGradeAction
    // (src/lib/actions/gradebook/submitGradeAction.ts). Found via PR #126 review, applied here
    // as a follow-up since this is a second, older writer of the same table.
    const target = await this.database.query(
      `select
         submission.tenant_id,
         submission.learner_person_id,
         assignment.max_points,
         assignment.sensitivity_tier
       from public.academy_gradebook_submissions submission
       join public.academy_gradebook_assignments assignment
         on assignment.tenant_id = submission.tenant_id
        and assignment.id = submission.assignment_id
       where submission.tenant_id = $1
         and submission.id = $2
         and assignment.id = $3
         and submission.learner_person_id = $4`,
      [input.tenantId, input.submissionId, input.assignmentId, input.learnerPersonId],
    );

    const targetRow = target.rows[0];
    if (!targetRow) {
      throw new Error("Gradebook record target not found.");
    }
    const maxPoints = Number(targetRow.max_points);
    const sensitivityTier = String(targetRow.sensitivity_tier);

    // Attempt the first-ever insert atomically via ON CONFLICT DO NOTHING; if a record already
    // exists, fall through to a locked check-then-update instead of trusting a value read
    // before the conflict.
    const inserted = await this.database.query(
      `insert into public.academy_gradebook_records (
         tenant_id, submission_id, assignment_id, learner_person_id,
         graded_by_person_id, points_earned, max_points, letter_grade,
         is_passing, instructor_feedback, sensitivity_tier, graded_at, updated_at
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
       on conflict (tenant_id, submission_id) do nothing
       returning
         id, submission_id, assignment_id, learner_person_id,
         points_earned, max_points, percentage, letter_grade,
         is_passing, instructor_feedback, sensitivity_tier,
         graded_at, is_overridden`,
      [
        input.tenantId,
        input.submissionId,
        input.assignmentId,
        targetRow.learner_person_id,
        input.gradedByPersonId,
        input.pointsEarned ?? null,
        maxPoints,
        input.letterGrade ?? null,
        input.isPassing ?? null,
        input.instructorFeedback ?? null,
        sensitivityTier,
      ],
    );

    let row = inserted.rows[0];
    if (!row) {
      // A record already exists — lock it before deciding what to do with it. This serializes
      // against postGradeAction's/overrideGradeAction's own `for update` locks on the same row,
      // closing a race where a stale resubmission could otherwise land between a registrar's
      // concurrent post and its own read of the "old" posting_status, silently reverting work
      // the registrar just completed.
      //
      // The lookup filters on assignment_id and learner_person_id too, not just submission_id —
      // academy_gradebook_records carries its own assignment_id/learner_person_id columns with
      // nothing in the schema enforcing they match the submission's real ones (this table's other
      // writer, this same method before today's fix, used to trust caller-supplied values
      // directly). Without this filter, a pre-existing row with a stale/wrong association would
      // still match on submission_id alone and get updated by id, preserving the wrong
      // assignment/learner association and silently corrupting downstream GPA/reporting that
      // reads those columns off the record. Found via PR #131 review.
      const existing = await this.database.query(
        `select id, posting_status
         from public.academy_gradebook_records
         where tenant_id = $1
           and submission_id = $2
           and assignment_id = $3
           and learner_person_id = $4
         for update`,
        [input.tenantId, input.submissionId, input.assignmentId, targetRow.learner_person_id],
      );

      const existingRow = existing.rows[0];
      if (!existingRow) {
        throw new AcademyConflictError(
          "A gradebook record already exists for this submission, but its assignment/learner association does not match — this indicates a data-integrity issue, not a normal resubmission. Contact an administrator rather than retrying.",
        );
      }

      // Once a record has left "draft" — posted, held, or revoked — this write path is no
      // longer the right tool to change it. Silently overwriting it let a stale/direct
      // resubmission clear a registrar-held or -revoked record, or undo a post that had just
      // landed concurrently. Corrections to a non-draft record belong in the registrar override
      // flow (overrideGradeAction), which carries a required reason and an audit trail.
      //
      // AcademyConflictError (not a plain Error) so handleApi maps this to HTTP 409, letting
      // callers distinguish an expected state conflict from a real server failure — a plain
      // Error here was mapped to a generic 500 "Unexpected API error." Found via PR #131 review.
      if (existingRow.posting_status !== "draft") {
        throw new AcademyConflictError(
          `Cannot resubmit: this grade is already ${String(existingRow.posting_status)}. Use the grade override workflow to make corrections.`,
        );
      }

      const updated = await this.database.query(
        `update public.academy_gradebook_records
         set
           points_earned        = $3,
           max_points            = $4,
           letter_grade          = $5,
           is_passing             = $6,
           instructor_feedback   = $7,
           sensitivity_tier      = $8,
           graded_by_person_id   = $9,
           graded_at             = now(),
           updated_at            = now()
         where tenant_id = $1 and id = $2
         returning
           id, submission_id, assignment_id, learner_person_id,
           points_earned, max_points, percentage, letter_grade,
           is_passing, instructor_feedback, sensitivity_tier,
           graded_at, is_overridden`,
        [
          input.tenantId,
          existingRow.id,
          input.pointsEarned ?? null,
          maxPoints,
          input.letterGrade ?? null,
          input.isPassing ?? null,
          input.instructorFeedback ?? null,
          sensitivityTier,
          input.gradedByPersonId,
        ],
      );
      row = updated.rows[0];
    }

    return {
      id: String(row.id),
      submissionId: String(row.submission_id),
      assignmentId: String(row.assignment_id),
      assignmentTitle: "",
      courseId: "",
      courseTitle: "",
      sectionId: null,
      sectionCode: null,
      learnerPersonId: String(row.learner_person_id),
      learnerDisplayName: "",
      pointsEarned: row.points_earned === null ? null : Number(row.points_earned),
      maxPoints: Number(row.max_points),
      percentage: row.percentage === null ? null : Number(row.percentage),
      letterGrade: row.letter_grade === null ? null : String(row.letter_grade),
      isPassing: row.is_passing === null ? null : Boolean(row.is_passing),
      instructorFeedback: row.instructor_feedback === null ? null : String(row.instructor_feedback),
      sensitivityTier: row.sensitivity_tier as GradebookRecordRead["sensitivityTier"],
      gradedAt: iso(row.graded_at),
      isOverridden: Boolean(row.is_overridden),
      status: "graded",
      submittedAt: null,
    };
  }

  private async fetchInstructorGradingTargets(
    tenantId: string,
    instructorPersonId: string,
    filters: { learnerPersonId?: string } = {},
  ) {
    const conditions = [
      `submission.tenant_id = $1`,
      `(section.primary_instructor_id = $2 or section.assistant_instructor_ids ? $2)`,
      `record.id is null`,
      `submission.status in ('submitted', 'resubmitted', 'returned')`,
    ];
    const values: unknown[] = [tenantId, instructorPersonId];

    if (filters.learnerPersonId) {
      values.push(filters.learnerPersonId);
      conditions.push(`submission.learner_person_id = $${values.length}`);
    }

    const result = await this.database.query(
      `
        select
          submission.id as submission_id,
          assignment.id as assignment_id,
          assignment.title as assignment_title,
          course.title as course_title,
          section.section_code,
          submission.learner_person_id,
          learner.display_name as learner_display_name,
          assignment.max_points,
          submission.status,
          submission.submitted_at,
          assignment.sensitivity_tier
        from public.academy_gradebook_submissions submission
        join public.academy_gradebook_assignments assignment
          on assignment.tenant_id = submission.tenant_id
         and assignment.id = submission.assignment_id
        join public.academy_courses course
          on course.tenant_id = assignment.tenant_id
         and course.id = assignment.course_id
        join public.academy_course_sections section
          on section.tenant_id = assignment.tenant_id
         and section.id = assignment.section_id
        join public.academy_people learner
          on learner.tenant_id = submission.tenant_id
         and learner.id = submission.learner_person_id
        left join public.academy_gradebook_records record
          on record.tenant_id = submission.tenant_id
         and record.submission_id = submission.id
        where ${conditions.join(" and ")}
        order by submission.submitted_at asc, learner.display_name asc
        limit 25
      `,
      values,
    );

    return result.rows.map(mapGradingTargetRow);
  }
}
