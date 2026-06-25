import { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { AcademyQueryClient } from "@/lib/academy-database-context";

export interface GuardianStudentAttendanceSummary {
  sectionId: string;
  sectionName: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  recentAbsenceDates: string[];
}

export interface GuardianStudentGradeSummary {
  termName: string;
  cumulativeGpa: number | null;
  postedGrades: { courseCode: string; courseTitle: string; grade: string }[];
}

export interface GuardianStudentView {
  studentPersonId: string;
  studentName: string;
  enrollmentStatus: string;
  balanceCents: number;
  currency: string;
  attendance: GuardianStudentAttendanceSummary[];
  grades: GuardianStudentGradeSummary;
}

export async function fetchGuardianStudentSummary(
  guardianPersonId: string,
  studentPersonId: string,
  tenantId: string,
  db: AcademyQueryClient,
): Promise<GuardianStudentView | null> {
  // Verify guardian-student link
  const relationshipResult = await db.query(
    `select ferpa_restricted
     from academy_student_relationships
     where tenant_id = $1
       and related_person_id = $2
       and student_person_id = $3
       and status = 'active'
     limit 1`,
    [tenantId, guardianPersonId, studentPersonId],
  ) as { rows: { ferpa_restricted: boolean }[] };

  if (relationshipResult.rows.length === 0) {
    throw new AcademyAuthorizationError("Guardian is not linked to this student.");
  }

  // If FERPA restricted, return null to signal access restricted
  if (relationshipResult.rows[0].ferpa_restricted) {
    return null;
  }

  // Fetch student profile and person info
  const studentResult = await db.query(
    `select
       p.id as person_id,
       p.display_name,
       sp.enrollment_status,
       coalesce(sa.currency, 'USD') as currency
     from academy_people p
     join academy_student_profiles sp on sp.person_id = p.id and sp.tenant_id = p.tenant_id
     left join academy_student_accounts sa on sa.student_person_id = p.id and sa.tenant_id = p.tenant_id
     where p.tenant_id = $1
       and p.id = $2`,
    [tenantId, studentPersonId],
  ) as { rows: { person_id: string; display_name: string; enrollment_status: string; currency: string }[] };

  if (studentResult.rows.length === 0) {
    throw new AcademyAuthorizationError("Student not found.");
  }

  const student = studentResult.rows[0];

  // Fetch attendance summaries per section
  const attendanceResult = await db.query(
    `select
       ar.course_section_id::text as section_id,
       cs.course_code || ' ' || cs.section_code as section_name,
       count(*) filter (where ar.status = 'present') as present_count,
       count(*) filter (where ar.status = 'absent') as absent_count,
       count(*) filter (where ar.status = 'late') as late_count,
       array_agg(ar.session_date::text order by ar.session_date desc)
         filter (where ar.status = 'absent') as recent_absence_dates
     from academy_attendance_records ar
     join academy_course_sections cs on cs.id = ar.course_section_id and cs.tenant_id = ar.tenant_id
     where ar.tenant_id = $1
       and ar.student_person_id::text = $2
     group by ar.course_section_id, cs.course_code, cs.section_code`,
    [tenantId, studentPersonId],
  ) as {
    rows: {
      section_id: string;
      section_name: string;
      present_count: string;
      absent_count: string;
      late_count: string;
      recent_absence_dates: string[] | null;
    }[];
  };

  const attendance: GuardianStudentAttendanceSummary[] = attendanceResult.rows.map((row) => ({
    sectionId: row.section_id,
    sectionName: row.section_name,
    presentCount: parseInt(row.present_count, 10),
    absentCount: parseInt(row.absent_count, 10),
    lateCount: parseInt(row.late_count, 10),
    recentAbsenceDates: (row.recent_absence_dates || []).slice(0, 5),
  }));

  // Fetch current term official posted grades
  const gradesResult = await db.query(
    `select
       c.course_code,
       c.title as course_title,
       gr.final_letter_grade as grade
     from academy_gradebook_records gr
     join academy_course_sections cs on cs.id::text = gr.section_id and cs.tenant_id = gr.tenant_id
     join academy_courses c on c.id = cs.course_id and c.tenant_id = cs.tenant_id
     where gr.tenant_id = $1
       and gr.learner_person_id = $2
       and gr.status = 'official'
     order by c.course_code`,
    [tenantId, studentPersonId],
  ) as { rows: { course_code: string; course_title: string; grade: string | null }[] };

  const postedGrades = gradesResult.rows.map((row) => ({
    courseCode: row.course_code,
    courseTitle: row.course_title,
    grade: row.grade || "N/A",
  }));

  // Fetch GPA from student profile
  const gpaResult = await db.query(
    `select gpa
     from academy_student_profiles
     where tenant_id = $1
       and person_id = $2`,
    [tenantId, studentPersonId],
  ) as { rows: { gpa: number | null }[] };

  const cumulativeGpa = gpaResult.rows[0]?.gpa || null;

  // Fetch balance from billing ledger
  const balanceResult = await db.query(
    `select coalesce(sum(
       case
         when entry_type in ('charge') then amount_cents
         when entry_type in ('credit', 'payment', 'refund') then -amount_cents
         else 0
       end
     ), 0) as balance_cents
     from academy_billing_ledger_entries
     where tenant_id = $1
       and student_person_id = $2`,
    [tenantId, studentPersonId],
  ) as { rows: { balance_cents: string }[] };

  const balanceCents = parseInt(balanceResult.rows[0]?.balance_cents || "0", 10);

  return {
    studentPersonId: student.person_id,
    studentName: student.display_name,
    enrollmentStatus: student.enrollment_status,
    balanceCents,
    currency: student.currency,
    attendance,
    grades: {
      termName: "Current Term",
      cumulativeGpa,
      postedGrades,
    },
  };
}

export async function setFerpaRestriction(
  actor: AcademyActor,
  input: { studentPersonId: string; guardianPersonId: string; ferpaRestricted: boolean },
  db: AcademyQueryClient,
): Promise<void> {
  // Enforce role: institution_admin or registrar
  if (!actor.roles.includes("institution_admin") && !actor.roles.includes("registrar")) {
    throw new AcademyAuthorizationError("Only institution_admin or registrar can modify FERPA restrictions.");
  }

  // Enforce tenant isolation
  const result = await db.query(
    `update academy_student_relationships
     set ferpa_restricted = $1
     where tenant_id = $2
       and student_person_id = $3
       and related_person_id = $4
       and status = 'active'`,
    [input.ferpaRestricted, actor.tenantId, input.studentPersonId, input.guardianPersonId],
  ) as { rowCount: number | null };

  if (!result.rowCount || result.rowCount === 0) {
    throw new AcademyAuthorizationError("No active guardian relationship found for the given student and guardian.");
  }
}

export async function getLinkedStudentsForGuardian(
  guardianPersonId: string,
  tenantId: string,
  db: AcademyQueryClient,
): Promise<{ studentPersonId: string; studentName: string; ferpaRestricted: boolean }[]> {
  const result = await db.query(
    `select
       sr.student_person_id,
       p.display_name as student_name,
       sr.ferpa_restricted
     from academy_student_relationships sr
     join academy_people p on p.id = sr.student_person_id and p.tenant_id = sr.tenant_id
     where sr.tenant_id = $1
       and sr.related_person_id = $2
       and sr.status = 'active'
     order by p.display_name`,
    [tenantId, guardianPersonId],
  ) as { rows: { student_person_id: string; student_name: string; ferpa_restricted: boolean }[] };

  return result.rows.map((row) => ({
    studentPersonId: row.student_person_id,
    studentName: row.student_name,
    ferpaRestricted: row.ferpa_restricted,
  }));
}
