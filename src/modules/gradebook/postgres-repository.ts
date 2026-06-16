import { getDatabasePool } from "@/lib/database";
import type {
  GradebookAuditRead,
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
    };
  }

  async fetchLearnerGradebook(
    tenantId: string,
    learnerPersonId: string,
  ): Promise<GradebookReadModel> {
    return {
      records: await this.fetchRecords(
        `where record.tenant_id = $1 and record.learner_person_id = $2`,
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
}
