import { getDatabasePool } from "@/lib/database";
import type {
  LmsRosterEligibleSection,
  LmsRosterSourceRegistration,
  LmsRosterSourceRepository,
  LmsRosterSourceSection,
} from "./types";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface LmsRosterSourceDatabase {
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
}

function stringOrUndefined(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

function mapEligibleSection(row: Record<string, unknown>): LmsRosterEligibleSection {
  return {
    id: String(row.id),
    sectionCode: String(row.section_code),
    courseCode: String(row.course_code),
    courseTitle: String(row.course_title),
    academicPeriodName: String(row.academic_period_name),
    enrolledCount: Number(row.enrolled_count ?? 0),
  };
}

export class PostgresLmsRosterSourceRepository implements LmsRosterSourceRepository {
  constructor(private readonly database: LmsRosterSourceDatabase = getDatabasePool() as LmsRosterSourceDatabase) {}

  async listRosterEligibleSections(tenantId: string): Promise<LmsRosterEligibleSection[]> {
    const result = await this.database.query(
      `select s.id,
              s.section_code,
              c.code as course_code,
              c.title as course_title,
              p.name as academic_period_name,
              (select count(*)::int
                 from academy_course_section_registrations r
                where r.tenant_id = s.tenant_id
                  and r.course_section_id = s.id
                  and r.status in ('registered', 'pending_confirmation', 'completed')) as enrolled_count
         from academy_course_sections s
         join academy_courses c
           on c.tenant_id = s.tenant_id and c.id = s.course_id
         join academy_academic_periods p
           on p.tenant_id = s.tenant_id and p.id = s.academic_period_id
        where s.tenant_id = $1
          and s.status in ('open', 'in_progress', 'completed')
        order by p.starts_on desc, c.code asc, s.section_code asc`,
      [tenantId],
    );
    return result.rows.map(mapEligibleSection);
  }

  async fetchSectionRosterSource(tenantId: string, sectionId: string): Promise<LmsRosterSourceSection> {
    const section = await this.database.query(
      `select s.id,
              s.tenant_id,
              s.course_id,
              s.section_code,
              c.code as course_code,
              c.title as course_title,
              s.academic_period_id,
              p.name as academic_period_name,
              s.primary_instructor_id
         from academy_course_sections s
         join academy_courses c
           on c.tenant_id = s.tenant_id and c.id = s.course_id
         join academy_academic_periods p
           on p.tenant_id = s.tenant_id and p.id = s.academic_period_id
        where s.tenant_id = $1 and s.id = $2
        limit 1`,
      [tenantId, sectionId],
    );
    const sectionRow = section.rows[0];
    if (!sectionRow) {
      throw new Error("Course section was not found.");
    }

    const registrations = await this.database.query(
      `select student_person_id, status
         from academy_course_section_registrations
        where tenant_id = $1
          and course_section_id = $2
          and status in ('pending_confirmation', 'registered', 'waitlisted', 'withdrawn', 'completed')
        order by registered_at asc, id asc`,
      [tenantId, sectionId],
    );

    return {
      id: String(sectionRow.id),
      tenantId: String(sectionRow.tenant_id),
      courseId: String(sectionRow.course_id),
      sectionCode: String(sectionRow.section_code),
      courseCode: String(sectionRow.course_code),
      courseTitle: String(sectionRow.course_title),
      academicPeriodId: String(sectionRow.academic_period_id),
      academicPeriodName: stringOrUndefined(sectionRow.academic_period_name),
      primaryInstructorId: stringOrUndefined(sectionRow.primary_instructor_id),
      registrations: registrations.rows.map(
        (row): LmsRosterSourceRegistration => ({
          studentPersonId: String(row.student_person_id),
          status: String(row.status),
        }),
      ),
    };
  }
}
