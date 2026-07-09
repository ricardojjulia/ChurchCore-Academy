import { getDatabasePool } from "@/lib/database";
import type {
  AvailableStudentSection,
  AssignStudentSectionInput,
  StudentSectionEnrollment,
  StudentSectionEnrollmentRepository,
} from "./types";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface StudentSectionEnrollmentDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

function timestampString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapEnrollment(row: Record<string, unknown>): StudentSectionEnrollment {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentProfileId: String(row.student_profile_id),
    studentPersonId: String(row.student_person_id),
    courseSectionId: String(row.course_section_id),
    programEnrollmentId: String(row.program_enrollment_id),
    periodRegistrationId: String(row.period_registration_id),
    status: String(row.status),
    registeredAt: timestampString(row.registered_at),
  };
}

function mapAvailableSection(row: Record<string, unknown>): AvailableStudentSection {
  return {
    id: String(row.id),
    sectionCode: String(row.section_code),
    courseCode: String(row.course_code),
    courseTitle: String(row.course_title),
    academicPeriodId: String(row.academic_period_id),
    academicPeriodName: String(row.academic_period_name),
    schedulePattern: row.schedule_pattern != null ? String(row.schedule_pattern) : undefined,
    deliveryMode: String(row.delivery_mode),
    capacity: row.capacity != null ? Number(row.capacity) : undefined,
    enrolledCount: Number(row.enrolled_count ?? 0),
  };
}

export class PostgresStudentSectionEnrollmentRepository implements StudentSectionEnrollmentRepository {
  constructor(
    private readonly database: StudentSectionEnrollmentDatabase = getDatabasePool() as StudentSectionEnrollmentDatabase,
  ) {}

  async listAvailableSections(tenantId: string, studentProfileId: string): Promise<AvailableStudentSection[]> {
    const result = await this.database.query(
      `select s.id,
              s.section_code,
              c.code as course_code,
              c.title as course_title,
              s.academic_period_id,
              p.name as academic_period_name,
              s.schedule_pattern,
              s.delivery_mode,
              s.capacity,
              (select count(*)::int
                 from academy_course_section_registrations r
                where r.tenant_id = s.tenant_id
                  and r.course_section_id = s.id
                  and r.status in ('pending_confirmation', 'registered')) as enrolled_count
         from academy_course_sections s
         join academy_courses c
           on c.tenant_id = s.tenant_id and c.id = s.course_id
         join academy_academic_periods p
           on p.tenant_id = s.tenant_id and p.id = s.academic_period_id
        where s.tenant_id = $1
          and s.status in ('open', 'in_progress')
          and exists (
            select 1
              from academy_program_enrollments membership
             where membership.tenant_id = $1
               and membership.student_profile_id = $2
               and membership.status = 'active'
          )
          and not exists (
            select 1
              from academy_course_section_registrations existing
             where existing.tenant_id = s.tenant_id
               and existing.student_profile_id = $2
               and existing.course_section_id = s.id
               and existing.status in ('pending_confirmation', 'registered', 'waitlisted')
          )
          and (
            s.capacity is null
            or (select count(*)::int
                  from academy_course_section_registrations r2
                 where r2.tenant_id = s.tenant_id
                   and r2.course_section_id = s.id
                   and r2.status in ('pending_confirmation', 'registered')) < s.capacity
          )
        order by p.starts_on desc, c.code asc, s.section_code asc`,
      [tenantId, studentProfileId],
    );
    return result.rows.map(mapAvailableSection);
  }

  async assignSection(
    tenantId: string,
    input: Required<AssignStudentSectionInput>,
  ): Promise<StudentSectionEnrollment> {
    const student = await this.database.query(
      `select id, person_id from academy_student_profiles
        where tenant_id = $1 and id = $2
        limit 1`,
      [tenantId, input.studentProfileId],
    );
    const studentRow = student.rows[0];
    if (!studentRow) throw new Error("Student profile was not found.");
    const studentPersonId = String(studentRow.person_id);

    const membership = await this.database.query(
      `select id, student_person_id
         from academy_program_enrollments
        where tenant_id = $1
          and student_profile_id = $2
          and status = 'active'
        order by started_on desc, created_at desc
        limit 1`,
      [tenantId, input.studentProfileId],
    );
    const membershipRow = membership.rows[0];
    if (!membershipRow) throw new Error("Active program membership was not found.");

    const section = await this.database.query(
      `select s.id,
              s.academic_period_id,
              s.status,
              s.capacity,
              (select count(*)::int
                 from academy_course_section_registrations r
                where r.tenant_id = $1
                  and r.course_section_id = $2
                  and r.status in ('pending_confirmation', 'registered')) as current_enrollment
         from academy_course_sections s
        where s.tenant_id = $1 and s.id = $2
        for update of s`,
      [tenantId, input.courseSectionId],
    );
    const sectionRow = section.rows[0];
    if (!sectionRow) throw new Error("Course section was not found.");

    const sectionStatus = String(sectionRow.status);
    if (sectionStatus !== "open" && sectionStatus !== "in_progress") {
      throw new Error(`Course section is ${sectionStatus}.`);
    }

    const existing = await this.database.query(
      `select id, tenant_id, student_profile_id, student_person_id,
              course_section_id, program_enrollment_id, period_registration_id,
              status, registered_at
         from academy_course_section_registrations
        where tenant_id = $1
          and student_profile_id = $2
          and course_section_id = $3
          and status in ('pending_confirmation', 'registered', 'waitlisted')
        limit 1`,
      [tenantId, input.studentProfileId, input.courseSectionId],
    );
    if (existing.rows[0]) return mapEnrollment(existing.rows[0]);

    if (sectionRow.capacity != null && Number(sectionRow.current_enrollment ?? 0) >= Number(sectionRow.capacity)) {
      throw new Error("Course section capacity is full.");
    }

    const periodRegistration = await this.database.query(
      `select id
         from academy_period_registrations
        where tenant_id = $1
          and student_profile_id = $2
          and academic_period_id = $3
          and status = 'registered'
        limit 1`,
      [tenantId, input.studentProfileId, String(sectionRow.academic_period_id)],
    );

    let periodRegistrationId = periodRegistration.rows[0]?.id != null
      ? String(periodRegistration.rows[0].id)
      : "";

    if (!periodRegistrationId) {
      const insertedPeriod = await this.database.query(
        `insert into academy_period_registrations (
           tenant_id, student_profile_id, student_person_id,
           academic_period_id, program_enrollment_id,
           source_application_id, status
         ) values ($1,$2,$3,$4,$5,null,'registered')
         returning id`,
        [
          tenantId,
          input.studentProfileId,
          studentPersonId,
          String(sectionRow.academic_period_id),
          String(membershipRow.id),
        ],
      );
      const insertedRow = insertedPeriod.rows[0];
      if (!insertedRow) throw new Error("Period registration was not created.");
      periodRegistrationId = String(insertedRow.id);
    }

    const registration = await this.database.query(
      `insert into academy_course_section_registrations (
         tenant_id, student_profile_id, student_person_id,
         program_enrollment_id, period_registration_id, course_section_id,
         source_application_id, status, registered_at, confirmed_at,
         confirmation_note, idempotency_key
       ) values ($1,$2,$3,$4,$5,$6,null,'registered',now(),now(),$7,gen_random_uuid()::text)
       returning id, tenant_id, student_profile_id, student_person_id,
                 course_section_id, program_enrollment_id, period_registration_id,
                 status, registered_at`,
      [
        tenantId,
        input.studentProfileId,
        studentPersonId,
        String(membershipRow.id),
        periodRegistrationId,
        input.courseSectionId,
        "Staff section enrollment",
      ],
    );

    await this.database.query(
      `update academy_student_profiles
          set active_period_id = $3,
              updated_at = now()
        where tenant_id = $1 and id = $2`,
      [tenantId, input.studentProfileId, String(sectionRow.academic_period_id)],
    );

    const row = registration.rows[0];
    if (!row) throw new Error("Section registration was not created.");
    return mapEnrollment(row);
  }
}
