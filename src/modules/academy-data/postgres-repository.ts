import { AcademyDataset, AdminUser, CourseSection, FacultyRecord, Program, StudentRecord } from "@/modules/academy-data/types";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { getDatabasePool } from "@/lib/database";

function parseArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value === "string") {
    return JSON.parse(value) as T[];
  }

  return [];
}

export class AcademyDataRepository {
  async loadDataset(): Promise<AcademyDataset> {
    const pool = getDatabasePool();
    const [admins, programs, students, faculty, sections, thresholds] = await Promise.all([
      pool.query("select * from academy_admin_users order by name asc"),
      pool.query("select * from academy_programs order by name asc"),
      pool.query("select * from academy_students order by full_name asc"),
      pool.query("select * from academy_faculty order by name asc"),
      pool.query("select * from academy_sections order by code asc"),
      pool.query("select * from academy_thresholds limit 1"),
    ]);

    if (thresholds.rowCount === 0) {
      throw new Error("Academy dataset is not seeded.");
    }

    return {
      tenantId: thresholds.rows[0].tenant_id,
      productArea: "academy",
      generatedAt: new Date().toISOString(),
      institutionName: "ChurchCore Academy",
      administrators: admins.rows.map(
        (row): AdminUser => ({
          id: row.id,
          tenantId: row.tenant_id,
          name: row.name,
          title: row.title,
          role: row.role,
        }),
      ),
      programs: programs.rows.map(
        (row): Program => ({
          id: row.id,
          tenantId: row.tenant_id,
          name: row.name,
          credential: row.credential,
          requiredCredits: row.required_credits,
          cohortLabel: row.cohort_label,
        }),
      ),
      students: students.rows.map(
        (row): StudentRecord => ({
          id: row.id,
          tenantId: row.tenant_id,
          fullName: row.full_name,
          email: row.email,
          enrollmentStatus: row.enrollment_status,
          applicationStartedAt: row.application_started_at?.toISOString(),
          admittedAt: row.admitted_at?.toISOString(),
          activeTerm: row.active_term ?? undefined,
          programId: row.program_id ?? undefined,
          advisorUserId: row.advisor_user_id ?? undefined,
          missingEnrollmentSteps: parseArray<string>(row.missing_enrollment_steps),
          missingDocuments: parseArray<StudentRecord["missingDocuments"][number]>(row.missing_documents),
          documentationNotes: parseArray<string>(row.documentation_notes),
          creditsEarned: row.credits_earned,
          expectedCreditsByNow: row.expected_credits_by_now,
          transcriptCredits: row.transcript_credits,
          gpa: row.gpa === null ? undefined : Number(row.gpa),
          statusFlag: row.status_flag,
          allProgramCoursesCompleted: row.all_program_courses_completed,
          graduationAdministrativeHolds: parseArray<string>(row.graduation_administrative_holds),
          expectedNextTermRegistered: row.expected_next_term_registered,
          transcriptAlerts: parseArray<string>(row.transcript_alerts),
          recordAlerts: parseArray<string>(row.record_alerts),
        }),
      ),
      faculty: faculty.rows.map(
        (row): FacultyRecord => ({
          id: row.id,
          tenantId: row.tenant_id,
          name: row.name,
          title: row.title,
          assignedSectionIds: parseArray<string>(row.assigned_section_ids),
          adviseeCount: row.advisee_count,
        }),
      ),
      sections: sections.rows.map(
        (row): CourseSection => ({
          id: row.id,
          tenantId: row.tenant_id,
          code: row.code,
          title: row.title,
          programId: row.program_id,
          instructorFacultyId: row.instructor_faculty_id ?? undefined,
          rosterCount: row.roster_count,
          rosterCapacity: row.roster_capacity,
          setupAlerts: parseArray<string>(row.setup_alerts),
        }),
      ),
      thresholds: {
        incompleteEnrollmentDays: thresholds.rows[0].incomplete_enrollment_days,
        graduationCreditThreshold: Number(thresholds.rows[0].graduation_credit_threshold),
        creditPaceGap: thresholds.rows[0].credit_pace_gap,
        minimumGpa: Number(thresholds.rows[0].minimum_gpa),
        facultyLoadThreshold: thresholds.rows[0].faculty_load_threshold,
        advisorStudentRatioThreshold: thresholds.rows[0].advisor_student_ratio_threshold,
      },
    };
  }

  async seedFromMockData(dataset: AcademyDataset = academyDataset) {
    const pool = getDatabasePool();

    await pool.query("begin");
    try {
      for (const admin of dataset.administrators) {
        await pool.query(
          `insert into academy_admin_users (id, tenant_id, name, title, role)
           values ($1, $2, $3, $4, $5)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id, name = excluded.name, title = excluded.title, role = excluded.role`,
          [admin.id, admin.tenantId, admin.name, admin.title, admin.role],
        );
      }

      for (const program of dataset.programs) {
        await pool.query(
          `insert into academy_programs (id, tenant_id, name, credential, required_credits, cohort_label)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id, name = excluded.name, credential = excluded.credential,
               required_credits = excluded.required_credits, cohort_label = excluded.cohort_label`,
          [program.id, program.tenantId, program.name, program.credential, program.requiredCredits, program.cohortLabel],
        );
      }

      for (const student of dataset.students) {
        await pool.query(
          `insert into academy_students (
             id, tenant_id, full_name, email, enrollment_status, application_started_at, admitted_at, active_term,
             program_id, advisor_user_id, missing_enrollment_steps, missing_documents, documentation_notes,
             credits_earned, expected_credits_by_now, transcript_credits, gpa, status_flag,
             all_program_courses_completed, graduation_administrative_holds, expected_next_term_registered,
             transcript_alerts, record_alerts
           )
           values (
             $1, $2, $3, $4, $5, $6, $7, $8,
             $9, $10, $11::jsonb, $12::jsonb, $13::jsonb,
             $14, $15, $16, $17, $18,
             $19, $20::jsonb, $21,
             $22::jsonb, $23::jsonb
           )
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               full_name = excluded.full_name,
               email = excluded.email,
               enrollment_status = excluded.enrollment_status,
               application_started_at = excluded.application_started_at,
               admitted_at = excluded.admitted_at,
               active_term = excluded.active_term,
               program_id = excluded.program_id,
               advisor_user_id = excluded.advisor_user_id,
               missing_enrollment_steps = excluded.missing_enrollment_steps,
               missing_documents = excluded.missing_documents,
               documentation_notes = excluded.documentation_notes,
               credits_earned = excluded.credits_earned,
               expected_credits_by_now = excluded.expected_credits_by_now,
               transcript_credits = excluded.transcript_credits,
               gpa = excluded.gpa,
               status_flag = excluded.status_flag,
               all_program_courses_completed = excluded.all_program_courses_completed,
               graduation_administrative_holds = excluded.graduation_administrative_holds,
               expected_next_term_registered = excluded.expected_next_term_registered,
               transcript_alerts = excluded.transcript_alerts,
               record_alerts = excluded.record_alerts`,
          [
            student.id,
            student.tenantId,
            student.fullName,
            student.email,
            student.enrollmentStatus,
            student.applicationStartedAt ?? null,
            student.admittedAt ?? null,
            student.activeTerm ?? null,
            student.programId ?? null,
            student.advisorUserId ?? null,
            JSON.stringify(student.missingEnrollmentSteps),
            JSON.stringify(student.missingDocuments),
            JSON.stringify(student.documentationNotes),
            student.creditsEarned,
            student.expectedCreditsByNow,
            student.transcriptCredits,
            student.gpa ?? null,
            student.statusFlag,
            student.allProgramCoursesCompleted,
            JSON.stringify(student.graduationAdministrativeHolds),
            student.expectedNextTermRegistered,
            JSON.stringify(student.transcriptAlerts),
            JSON.stringify(student.recordAlerts),
          ],
        );
      }

      for (const faculty of dataset.faculty) {
        await pool.query(
          `insert into academy_faculty (id, tenant_id, name, title, assigned_section_ids, advisee_count)
           values ($1, $2, $3, $4, $5::jsonb, $6)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               name = excluded.name,
               title = excluded.title,
               assigned_section_ids = excluded.assigned_section_ids,
               advisee_count = excluded.advisee_count`,
          [faculty.id, faculty.tenantId, faculty.name, faculty.title, JSON.stringify(faculty.assignedSectionIds), faculty.adviseeCount],
        );
      }

      for (const section of dataset.sections) {
        await pool.query(
          `insert into academy_sections (id, tenant_id, code, title, program_id, instructor_faculty_id, roster_count, roster_capacity, setup_alerts)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               code = excluded.code,
               title = excluded.title,
               program_id = excluded.program_id,
               instructor_faculty_id = excluded.instructor_faculty_id,
               roster_count = excluded.roster_count,
               roster_capacity = excluded.roster_capacity,
               setup_alerts = excluded.setup_alerts`,
          [
            section.id,
            section.tenantId,
            section.code,
            section.title,
            section.programId,
            section.instructorFacultyId ?? null,
            section.rosterCount,
            section.rosterCapacity,
            JSON.stringify(section.setupAlerts),
          ],
        );
      }

      await pool.query(
        `insert into academy_thresholds (
           tenant_id,
           incomplete_enrollment_days,
           graduation_credit_threshold,
           credit_pace_gap,
           minimum_gpa,
           faculty_load_threshold,
           advisor_student_ratio_threshold
         )
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (tenant_id) do update
         set incomplete_enrollment_days = excluded.incomplete_enrollment_days,
             graduation_credit_threshold = excluded.graduation_credit_threshold,
             credit_pace_gap = excluded.credit_pace_gap,
             minimum_gpa = excluded.minimum_gpa,
             faculty_load_threshold = excluded.faculty_load_threshold,
             advisor_student_ratio_threshold = excluded.advisor_student_ratio_threshold`,
        [
          dataset.tenantId,
          dataset.thresholds.incompleteEnrollmentDays,
          dataset.thresholds.graduationCreditThreshold,
          dataset.thresholds.creditPaceGap,
          dataset.thresholds.minimumGpa,
          dataset.thresholds.facultyLoadThreshold,
          dataset.thresholds.advisorStudentRatioThreshold,
        ],
      );

      await pool.query("commit");
    } catch (error) {
      await pool.query("rollback");
      throw error;
    }
  }
}
