import { getDatabasePool } from "@/lib/database";
import type {
  StudentProgramProgressRepository,
  StudentProgramProgressRequirement,
  StudentProgramProgressSummary,
} from "./types";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface StudentProgramProgressDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

function numberValue(value: unknown): number {
  if (value == null) return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function timestampString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapRequirement(row: Record<string, unknown>): StudentProgramProgressRequirement {
  const status = String(row.progress_status) as StudentProgramProgressRequirement["status"];
  return {
    requirementId: String(row.requirement_id),
    courseId: String(row.course_id),
    courseCode: row.course_code != null ? String(row.course_code) : undefined,
    courseTitle: row.course_title != null ? String(row.course_title) : undefined,
    requirementType: String(row.requirement_type),
    requirementGroup: String(row.requirement_group),
    sequence: Number(row.sequence),
    credits: numberValue(row.credits),
    minimumGrade: row.minimum_grade != null ? String(row.minimum_grade) : undefined,
    status,
    completedRegistrationId: row.completed_registration_id != null
      ? String(row.completed_registration_id)
      : undefined,
    activeRegistrationId: row.active_registration_id != null
      ? String(row.active_registration_id)
      : undefined,
    finalLetterGrade: row.final_letter_grade != null ? String(row.final_letter_grade) : undefined,
    completedAt: timestampString(row.completed_at),
  };
}

export class PostgresStudentProgramProgressRepository implements StudentProgramProgressRepository {
  constructor(
    private readonly database: StudentProgramProgressDatabase = getDatabasePool() as StudentProgramProgressDatabase,
  ) {}

  async getProgress(tenantId: string, studentProfileId: string): Promise<StudentProgramProgressSummary | undefined> {
    const result = await this.database.query(
      `with active_membership as (
          select m.id,
                 m.student_profile_id,
                 m.academic_program_id,
                 p.program_code,
                 p.title as program_title,
                 m.catalog_academic_year_id,
                 y.name as catalog_academic_year_name
            from academy_program_enrollments m
            left join academy_academic_programs p
              on p.tenant_id = m.tenant_id and p.id = m.academic_program_id
            left join academy_academic_years y
              on y.tenant_id = m.tenant_id and y.id = m.catalog_academic_year_id
           where m.tenant_id = $1
             and m.student_profile_id = $2
             and m.status = 'active'
             and m.academic_program_id is not null
             and m.catalog_academic_year_id is not null
           order by m.started_on desc, m.created_at desc
           limit 1
        ),
        attempts as (
          select s.course_id,
                 max(r.id::text) filter (where r.status = 'completed') as completed_registration_id,
                 max(r.id::text) filter (where r.status in ('pending_confirmation', 'registered', 'waitlisted')) as active_registration_id,
                 max(r.updated_at) filter (where r.status = 'completed') as completed_at
            from academy_course_section_registrations r
            join academy_course_sections s
              on s.tenant_id = r.tenant_id and s.id = r.course_section_id
           where r.tenant_id = $1
             and r.student_profile_id = $2
             and r.status in ('pending_confirmation', 'registered', 'waitlisted', 'completed')
           group by s.course_id
        ),
        grade_summaries as (
          select summary.course_id,
                 summary.final_letter_grade,
                 summary.is_passing,
                 row_number() over (
                   partition by summary.course_id
                   order by summary.calculated_at desc, summary.id desc
                 ) as summary_rank
            from academy_gradebook_course_summaries summary
            join active_membership membership
              on membership.id = summary.enrollment_id
           where summary.tenant_id = $1
             and summary.learner_person_id = (
               select sp.person_id
                 from academy_student_profiles sp
                where sp.tenant_id = $1 and sp.id = $2
                limit 1
             )
        )
        select membership.id as active_program_membership_id,
               membership.student_profile_id,
               membership.academic_program_id,
               membership.program_code,
               membership.program_title,
               membership.catalog_academic_year_id,
               membership.catalog_academic_year_name,
               requirement.id as requirement_id,
               requirement.course_id,
               course.code as course_code,
               course.title as course_title,
               requirement.requirement_type,
               requirement.requirement_group,
               requirement.sequence,
               requirement.credits,
               requirement.minimum_grade,
               attempts.completed_registration_id,
               attempts.active_registration_id,
               attempts.completed_at,
               grade_summaries.final_letter_grade,
               case
                 when attempts.completed_registration_id is not null
                   and coalesce(grade_summaries.is_passing, true) is true then 'completed'
                 when attempts.active_registration_id is not null then 'in_progress'
                 else 'not_started'
               end as progress_status
          from active_membership membership
          join academy_program_curriculum_requirements requirement
            on requirement.tenant_id = $1
           and requirement.academic_program_id = membership.academic_program_id
           and requirement.academic_year_id = membership.catalog_academic_year_id
           and requirement.status = 'active'
          join academy_courses course
            on course.tenant_id = requirement.tenant_id and course.id = requirement.course_id
          left join attempts
            on attempts.course_id = requirement.course_id
          left join grade_summaries
            on grade_summaries.course_id = requirement.course_id
           and grade_summaries.summary_rank = 1
         order by requirement.sequence asc, course.code asc`,
      [tenantId, studentProfileId],
    );

    const first = result.rows[0];
    if (!first) return undefined;

    const requirements = result.rows.map(mapRequirement);
    const requiredCredits = requirements.reduce((sum, requirement) => sum + requirement.credits, 0);
    const completedCredits = requirements
      .filter((requirement) => requirement.status === "completed")
      .reduce((sum, requirement) => sum + requirement.credits, 0);
    const inProgressCredits = requirements
      .filter((requirement) => requirement.status === "in_progress")
      .reduce((sum, requirement) => sum + requirement.credits, 0);

    return {
      studentProfileId: String(first.student_profile_id),
      activeProgramMembershipId: String(first.active_program_membership_id),
      academicProgramId: String(first.academic_program_id),
      programCode: first.program_code != null ? String(first.program_code) : undefined,
      programTitle: first.program_title != null ? String(first.program_title) : undefined,
      catalogAcademicYearId: String(first.catalog_academic_year_id),
      catalogAcademicYearName: first.catalog_academic_year_name != null
        ? String(first.catalog_academic_year_name)
        : undefined,
      requiredCredits,
      completedCredits,
      inProgressCredits,
      remainingCredits: Math.max(0, requiredCredits - completedCredits),
      percentComplete: requiredCredits > 0 ? Math.round((completedCredits / requiredCredits) * 100) : 0,
      requirements,
    };
  }
}
