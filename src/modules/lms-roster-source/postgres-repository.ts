import { getDatabasePool } from "@/lib/database";
import type {
  LmsRosterEligibleSection,
  LmsRosterSourcePerson,
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
	              profile.institution_name,
	              s.course_id,
	              s.section_code,
	              coalesce(s.title_override, c.title) as section_title,
	              c.code as course_code,
	              c.title as course_title,
	              s.academic_period_id,
	              p.name as academic_period_name,
	              p.period_type as academic_period_type,
	              p.starts_on as academic_period_starts_on,
	              p.ends_on as academic_period_ends_on,
	              y.code as academic_year_code,
	              s.primary_instructor_id
	         from academy_course_sections s
	         join academy_institution_profiles profile
	           on profile.tenant_id = s.tenant_id
	         join academy_courses c
	           on c.tenant_id = s.tenant_id and c.id = s.course_id
	         join academy_academic_periods p
	           on p.tenant_id = s.tenant_id and p.id = s.academic_period_id
	         join academy_academic_years y
	           on y.tenant_id = p.tenant_id and y.id = p.academic_year_id
	        where s.tenant_id = $1 and s.id = $2
	        limit 1`,
      [tenantId, sectionId],
    );
    const sectionRow = section.rows[0];
    if (!sectionRow) {
      throw new Error("Course section was not found.");
    }

    const registrations = await this.database.query(
	      `select student_person_id, status, registered_at
	         from academy_course_section_registrations
	        where tenant_id = $1
	          and course_section_id = $2
          and status in ('pending_confirmation', 'registered', 'waitlisted', 'withdrawn', 'completed')
        order by registered_at asc, id asc`,
	      [tenantId, sectionId],
	    );
	    const personIds = uniqueStrings([
	      stringOrUndefined(sectionRow.primary_instructor_id),
	      ...registrations.rows.map((row) => stringOrUndefined(row.student_person_id)),
	    ]);
	    const people = personIds.length > 0 ? await this.fetchPeople(tenantId, personIds) : [];

	    return {
	      id: String(sectionRow.id),
	      tenantId: String(sectionRow.tenant_id),
	      institutionName: stringOrUndefined(sectionRow.institution_name),
	      courseId: String(sectionRow.course_id),
	      sectionCode: String(sectionRow.section_code),
	      courseCode: String(sectionRow.course_code),
	      courseTitle: String(sectionRow.course_title),
	      sectionTitle: stringOrUndefined(sectionRow.section_title),
	      academicPeriodId: String(sectionRow.academic_period_id),
	      academicPeriodName: stringOrUndefined(sectionRow.academic_period_name),
	      academicPeriodType: stringOrUndefined(sectionRow.academic_period_type),
	      academicPeriodStartsOn: dateStringOrUndefined(sectionRow.academic_period_starts_on),
	      academicPeriodEndsOn: dateStringOrUndefined(sectionRow.academic_period_ends_on),
	      academicYearCode: stringOrUndefined(sectionRow.academic_year_code),
	      primaryInstructorId: stringOrUndefined(sectionRow.primary_instructor_id),
	      registrations: registrations.rows.map(
	        (row): LmsRosterSourceRegistration => ({
	          studentPersonId: String(row.student_person_id),
	          status: String(row.status),
	          registeredOn: dateStringOrUndefined(row.registered_at),
	        }),
	      ),
	      people,
	    };
	  }

	  private async fetchPeople(tenantId: string, personIds: string[]): Promise<LmsRosterSourcePerson[]> {
	    const result = await this.database.query(
	      `select id, display_name, given_name, family_name, email, phone, person_status
	         from academy_people
	        where tenant_id = $1
	          and id = any($2::text[])
	        order by display_name asc, id asc`,
	      [tenantId, personIds],
	    );

	    return result.rows.map((row) => ({
	      id: String(row.id),
	      displayName: String(row.display_name),
	      givenName: stringOrUndefined(row.given_name),
	      familyName: stringOrUndefined(row.family_name),
	      email: stringOrUndefined(row.email),
	      phone: stringOrUndefined(row.phone),
	      status: String(row.person_status),
	    }));
	  }
	}

function dateStringOrUndefined(value: unknown): string | undefined {
  if (value == null) return undefined;
  return String(value).slice(0, 10);
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => !!value))];
}
