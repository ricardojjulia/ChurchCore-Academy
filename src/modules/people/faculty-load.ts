import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";

const FACULTY_LOAD_ROLES: AcademyRole[] = ["institution_admin", "dean", "academic_admin"];
const facultyRoles = ["faculty", "teacher", "professor"] as const;

export interface FacultyLoadDatabase {
  query(sql: string, values: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export interface FacultySectionLoad {
  sectionId: string;
  sectionCode: string;
  courseTitle: string;
  credits: number | null;
  clockHours: number | null;
  enrolledSeats: number;
  capacity: number | null;
}

export interface FacultyLoadSummary {
  personId: string;
  facultyName: string;
  title: string;
  loadPolicy: string | null;
  sectionCount: number;
  instructionalCredits: number;
  instructionalClockHours: number;
  enrolledSeats: number;
  capacity: number;
  utilizationPercent: number | null;
  adviseeCount: number;
  sections: FacultySectionLoad[];
  reviewFlags: string[];
}

export interface FacultyLoadWorkspace {
  periodId: string | null;
  faculty: FacultyLoadSummary[];
}

export function canReadFacultyLoad(actor: AcademyActor): boolean {
  return actor.roles.some((role) => FACULTY_LOAD_ROLES.includes(role));
}

export async function fetchFacultyLoadWorkspace(
  actor: AcademyActor,
  periodId: string | null,
  database: FacultyLoadDatabase,
): Promise<FacultyLoadWorkspace> {
  if (!canReadFacultyLoad(actor)) {
    throw new AcademyAuthorizationError("Faculty load intelligence requires academic oversight access.");
  }
  if (!periodId) return { periodId: null, faculty: [] };

  const result = await database.query(
    `select staff.person_id,
            person.display_name as faculty_name,
            staff.title,
            staff.load_policy,
            section.id as section_id,
            section.section_code,
            coalesce(section.title_override, course.title) as course_title,
            course.default_credits as credits,
            course.default_clock_hours as clock_hours,
            section.capacity,
            coalesce(registration.enrolled_seats, 0) as enrolled_seats,
            coalesce(advisee.advisee_count, 0) as advisee_count
       from academy_staff_profiles staff
       join academy_people person
         on person.tenant_id = staff.tenant_id and person.id = staff.person_id
       left join academy_course_sections section
         on section.tenant_id = staff.tenant_id
        and section.primary_instructor_id = staff.person_id
        and section.academic_period_id = $2
        and section.status not in ('cancelled', 'archived', 'completed')
       left join academy_courses course
         on course.tenant_id = section.tenant_id and course.id = section.course_id
       left join (
         select tenant_id, course_section_id, count(*)::int as enrolled_seats
           from academy_course_section_registrations
          where tenant_id = $1 and status = 'registered'
          group by tenant_id, course_section_id
       ) registration
         on registration.tenant_id = section.tenant_id
        and registration.course_section_id = section.id
       left join (
         select tenant_id, advisor_person_id, count(*)::int as advisee_count
           from academy_student_profiles
          where tenant_id = $1 and enrollment_status = 'active' and advisor_person_id is not null
          group by tenant_id, advisor_person_id
       ) advisee
         on advisee.tenant_id = staff.tenant_id and advisee.advisor_person_id = staff.person_id
      where staff.tenant_id = $1
        and staff.employment_status = 'active'
        and exists (
          select 1 from academy_person_role_assignments role
           where role.tenant_id = staff.tenant_id and role.person_id = staff.person_id
             and role.status = 'active' and role.role = any($3::text[])
        )
      order by person.display_name, section.section_code`,
    [actor.tenantId, periodId, facultyRoles],
  );

  const byFaculty = new Map<string, FacultyLoadSummary>();
  for (const row of result.rows) {
    const personId = String(row.person_id);
    let summary = byFaculty.get(personId);
    if (!summary) {
      summary = {
        personId,
        facultyName: String(row.faculty_name),
        title: String(row.title),
        loadPolicy: row.load_policy == null ? null : String(row.load_policy),
        sectionCount: 0,
        instructionalCredits: 0,
        instructionalClockHours: 0,
        enrolledSeats: 0,
        capacity: 0,
        utilizationPercent: null,
        adviseeCount: Number(row.advisee_count),
        sections: [],
        reviewFlags: [],
      };
      byFaculty.set(personId, summary);
    }
    if (row.section_id == null) continue;
    const capacity = row.capacity == null ? null : Number(row.capacity);
    const section: FacultySectionLoad = {
      sectionId: String(row.section_id),
      sectionCode: String(row.section_code),
      courseTitle: String(row.course_title),
      credits: row.credits == null ? null : Number(row.credits),
      clockHours: row.clock_hours == null ? null : Number(row.clock_hours),
      enrolledSeats: Number(row.enrolled_seats),
      capacity,
    };
    summary.sections.push(section);
    summary.sectionCount += 1;
    summary.instructionalCredits += section.credits ?? 0;
    summary.instructionalClockHours += section.clockHours ?? 0;
    summary.enrolledSeats += section.enrolledSeats;
    summary.capacity += capacity ?? 0;
  }

  for (const summary of byFaculty.values()) {
    const completeCapacity = summary.sections.length > 0
      && summary.sections.every((section) => section.capacity != null);
    summary.utilizationPercent = completeCapacity && summary.capacity > 0
      ? Math.round((summary.enrolledSeats / summary.capacity) * 100)
      : null;
    if (summary.sectionCount === 0) summary.reviewFlags.push("No sections in selected period");
    if (!summary.loadPolicy) summary.reviewFlags.push("Load policy not configured");
    if (summary.sections.some((section) => section.credits == null)) summary.reviewFlags.push("Credits not configured for every section");
    if (summary.sections.some((section) => section.clockHours == null)) summary.reviewFlags.push("Clock hours not configured for every section");
    if (summary.sections.some((section) => section.capacity == null)) summary.reviewFlags.push("Capacity not configured for every section");
    if (summary.sectionCount >= 10) summary.reviewFlags.push("10 or more active sections");
    if (summary.sections.some((section) => section.capacity != null && section.enrolledSeats > section.capacity)) {
      summary.reviewFlags.push("Section enrollment exceeds capacity");
    }
  }

  return { periodId, faculty: [...byFaculty.values()] };
}
