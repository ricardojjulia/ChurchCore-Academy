import type { AcademyQueryClient } from "@/lib/academy-database-context";
import type { AdminUser, CourseSection, FacultyRecord, Program, StudentRecord } from "@/modules/academy-data/types";

export interface SectionRegistrationReviewRow {
  id: string;
  sectionId: string;
  studentProfileId: string;
  studentPersonId: string;
  studentName: string;
  studentEmail: string;
  studentNumber: string;
  status: string;
  registeredAt: string;
  confirmedAt?: string;
  sourceApplicationId: string;
}

function rows<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

export async function fetchStudentRecords(tenantId: string, client: AcademyQueryClient): Promise<StudentRecord[]> {
  const result = await client.query(
    `select
       sp.id, sp.tenant_id, sp.enrollment_status,
       sp.program_id, sp.advisor_person_id,
       p.display_name as full_name, p.email,
       (select max(aa.submitted_at)
          from academy_admission_applications aa
          where aa.tenant_id = sp.tenant_id
            and aa.applicant_person_id = sp.person_id
            and aa.status <> 'draft') as application_started_at,
       (select max(aa.decided_at)
          from academy_admission_applications aa
          where aa.tenant_id = sp.tenant_id
            and aa.applicant_person_id = sp.person_id
            and aa.status = 'accepted') as admitted_at,
       (select ap.name
          from academy_period_registrations pr
          join academy_academic_periods ap on ap.tenant_id = pr.tenant_id and ap.id = pr.academic_period_id
          where pr.tenant_id = sp.tenant_id
            and pr.student_profile_id = sp.id
            and pr.status = 'registered'
          order by pr.registered_at desc
          limit 1) as active_term
     from academy_student_profiles sp
     join academy_people p on p.tenant_id = sp.tenant_id and p.id = sp.person_id
     where sp.tenant_id = $1
     order by sp.student_number asc`,
    [tenantId],
  );
  return rows<Record<string, unknown>>(result).map((row): StudentRecord => ({
    id: String(row.id),
    tenantId: String(row.tenant_id),
    fullName: String(row.full_name),
    email: String(row.email ?? ""),
    enrollmentStatus: row.enrollment_status as StudentRecord["enrollmentStatus"],
    applicationStartedAt: row.application_started_at != null ? String(row.application_started_at) : undefined,
    admittedAt: row.admitted_at != null ? String(row.admitted_at) : undefined,
    activeTerm: row.active_term != null ? String(row.active_term) : undefined,
    programId: row.program_id != null ? String(row.program_id) : undefined,
    advisorUserId: row.advisor_person_id != null ? String(row.advisor_person_id) : undefined,
    missingEnrollmentSteps: [],
    missingDocuments: [],
    documentationNotes: [],
    creditsEarned: 0,
    expectedCreditsByNow: 0,
    transcriptCredits: 0,
    gpa: undefined,
    statusFlag: "good_standing",
    allProgramCoursesCompleted: false,
    graduationAdministrativeHolds: [],
    expectedNextTermRegistered: false,
    transcriptAlerts: [],
    recordAlerts: [],
  }));
}

export async function fetchProgramList(tenantId: string, client: AcademyQueryClient): Promise<Program[]> {
  const result = await client.query(
    "select * from academy_programs where tenant_id = $1 order by name asc",
    [tenantId],
  );
  return rows<Record<string, unknown>>(result).map((row): Program => ({
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    credential: row.credential as Program["credential"],
    requiredCredits: Number(row.required_credits),
    cohortLabel: String(row.cohort_label),
  }));
}

export async function fetchSectionList(tenantId: string, client: AcademyQueryClient): Promise<CourseSection[]> {
  const result = await client.query(
    `select
       cs.id, cs.tenant_id, cs.section_code, cs.primary_instructor_id,
       cs.capacity,
       coalesce(cs.title_override, c.title) as title,
       coalesce(
         (select count(*)::int
            from academy_course_section_registrations csr
            where csr.tenant_id = cs.tenant_id
              and csr.course_section_id = cs.id
              and csr.status = 'registered'),
         0
       ) as roster_count
     from academy_course_sections cs
     join academy_courses c on c.tenant_id = cs.tenant_id and c.id = cs.course_id
     where cs.tenant_id = $1
     order by cs.section_code asc`,
    [tenantId],
  );
  return rows<Record<string, unknown>>(result).map((row): CourseSection => ({
    id: String(row.id),
    tenantId: String(row.tenant_id),
    code: String(row.section_code),
    title: String(row.title),
    programId: "",
    instructorFacultyId: row.primary_instructor_id != null ? String(row.primary_instructor_id) : undefined,
    rosterCount: Number(row.roster_count),
    rosterCapacity: Number(row.capacity ?? 0),
    setupAlerts: [],
  }));
}

export async function fetchSectionRegistrationReview(
  tenantId: string,
  client: AcademyQueryClient,
): Promise<SectionRegistrationReviewRow[]> {
  const result = await client.query(
    `select
       csr.id,
       csr.course_section_id,
       csr.student_profile_id,
       csr.student_person_id,
       person.display_name as student_name,
       person.email as student_email,
       profile.student_number,
       csr.status,
       csr.registered_at,
       csr.confirmed_at,
       csr.source_application_id
     from academy_course_section_registrations csr
     join academy_people person
       on person.tenant_id = csr.tenant_id
      and person.id = csr.student_person_id
     join academy_student_profiles profile
       on profile.tenant_id = csr.tenant_id
      and profile.id = csr.student_profile_id
     where csr.tenant_id = $1
     order by csr.registered_at desc, person.display_name asc`,
    [tenantId],
  );

  return rows<Record<string, unknown>>(result).map((row) => ({
    id: String(row.id),
    sectionId: String(row.course_section_id),
    studentProfileId: String(row.student_profile_id),
    studentPersonId: String(row.student_person_id),
    studentName: String(row.student_name),
    studentEmail: row.student_email != null ? String(row.student_email) : "",
    studentNumber: String(row.student_number),
    status: String(row.status),
    registeredAt: String(row.registered_at),
    confirmedAt: row.confirmed_at != null ? String(row.confirmed_at) : undefined,
    sourceApplicationId: String(row.source_application_id),
  }));
}

export async function fetchFacultyList(tenantId: string, client: AcademyQueryClient): Promise<FacultyRecord[]> {
  const result = await client.query(
    `select
       stf.id, stf.tenant_id, stf.title, stf.person_id,
       p.display_name as name,
       coalesce(
         (select array_agg(cs.id order by cs.section_code)
            from academy_course_sections cs
            where cs.tenant_id = stf.tenant_id
              and cs.primary_instructor_id = stf.person_id),
         '{}'::text[]
       ) as assigned_section_ids,
       (select count(*)::int
          from academy_student_profiles spp
          where spp.tenant_id = stf.tenant_id
            and spp.advisor_person_id = stf.person_id) as advisee_count
     from academy_staff_profiles stf
     join academy_people p on p.tenant_id = stf.tenant_id and p.id = stf.person_id
     where stf.tenant_id = $1
       and stf.employment_status = 'active'
     order by stf.staff_number asc`,
    [tenantId],
  );
  return rows<Record<string, unknown>>(result).map((row): FacultyRecord => ({
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    title: String(row.title),
    assignedSectionIds: Array.isArray(row.assigned_section_ids)
      ? (row.assigned_section_ids as string[])
      : typeof row.assigned_section_ids === "string"
        ? (JSON.parse(row.assigned_section_ids) as string[])
        : [],
    adviseeCount: Number(row.advisee_count),
  }));
}

export async function fetchAdministrators(tenantId: string, client: AcademyQueryClient): Promise<AdminUser[]> {
  const result = await client.query(
    `select distinct on (p.id)
       p.id,
       ra.tenant_id,
       p.display_name as name,
       coalesce(stf.title, ra.role) as title,
       ra.role
     from academy_person_role_assignments ra
     join academy_people p on p.tenant_id = ra.tenant_id and p.id = ra.person_id
     left join academy_staff_profiles stf
       on stf.tenant_id = ra.tenant_id and stf.person_id = ra.person_id
     where ra.tenant_id = $1
       and ra.status = 'active'
       and ra.role in ('dean', 'registrar', 'academic_admin', 'admissions', 'advisor')
     order by p.id, ra.role asc`,
    [tenantId],
  );
  return rows<Record<string, unknown>>(result).map((row): AdminUser => ({
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    title: String(row.title),
    role: row.role as AdminUser["role"],
  }));
}
