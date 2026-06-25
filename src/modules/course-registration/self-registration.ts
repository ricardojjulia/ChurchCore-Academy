import { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyConflictError } from "@/modules/academy-auth/errors";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export interface SectionRegistration {
  id: string;
  tenantId: string;
  courseSectionId: string;
  studentPersonId: string;
  studentProfileId: string;
  programEnrollmentId: string;
  periodRegistrationId: string;
  status: string;
  registeredAt: string;
}

const registrarRoles = new Set(["institution_admin", "registrar", "academic_admin"]);

function assertTenantIsolation(actor: AcademyActor, tenantId: string) {
  if (actor.tenantId !== tenantId) {
    throw new Error("Cross-tenant access is forbidden.");
  }
}

function canBypassEnrollmentWindow(actor: AcademyActor): boolean {
  return actor.roles.some((role) => registrarRoles.has(role));
}

function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function mapRegistration(row: Record<string, unknown>): SectionRegistration {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    courseSectionId: String(row.course_section_id),
    studentPersonId: String(row.student_person_id),
    studentProfileId: String(row.student_profile_id),
    programEnrollmentId: String(row.program_enrollment_id),
    periodRegistrationId: String(row.period_registration_id),
    status: String(row.status),
    registeredAt: toIsoString(row.registered_at),
  };
}

export async function registerStudentForSection(
  actor: AcademyActor,
  input: { sectionId: string; studentPersonId: string },
  db: Queryable,
): Promise<SectionRegistration> {
  assertTenantIsolation(actor, actor.tenantId);

  // Check if student already has an active registration (idempotent)
  const existing = await db.query(
    `select r.id, r.tenant_id, r.course_section_id, r.student_person_id,
            r.student_profile_id, r.program_enrollment_id, r.period_registration_id,
            r.status, r.registered_at
       from academy_course_section_registrations r
      where r.tenant_id = $1
        and r.course_section_id = $2
        and r.student_person_id = $3
        and r.status in ('pending_confirmation', 'registered', 'waitlisted')`,
    [actor.tenantId, input.sectionId, input.studentPersonId],
  );

  if (existing.rowCount && existing.rowCount > 0) {
    // Idempotent: return existing registration
    return mapRegistration(existing.rows[0]);
  }

  // Get section and enrollment window information
  const sectionData = await db.query(
    `select s.id, s.academic_period_id, s.course_id, s.capacity, s.status,
            (select count(*)::int from academy_course_section_registrations r2
             where r2.tenant_id = $1 and r2.course_section_id = $2
               and r2.status in ('pending_confirmation', 'registered')) as current_enrollment,
            ew.id as enrollment_window_id,
            ew.opens_at,
            ew.closes_at
       from academy_course_sections s
       left join academy_enrollment_windows ew
         on ew.tenant_id = $1
        and ew.academic_period_id = s.academic_period_id
        and ew.window_type in ('registration', 'add_drop')
        and ew.opens_at <= now()
        and (ew.closes_at is null or ew.closes_at >= now())
      where s.tenant_id = $1 and s.id = $2`,
    [actor.tenantId, input.sectionId],
  );

  if (!sectionData.rowCount || sectionData.rowCount === 0) {
    throw new Error("Cross-tenant access is forbidden.");
  }

  const section = sectionData.rows[0];

  // Check enrollment window (bypass for registrar/admin)
  if (!canBypassEnrollmentWindow(actor)) {
    if (!section.enrollment_window_id) {
      throw new AcademyConflictError("Registration window is not open.");
    }
  }

  // Check capacity atomically
  if (section.capacity !== null && section.capacity !== undefined) {
    const currentEnrollment = Number(section.current_enrollment ?? 0);
    if (currentEnrollment >= Number(section.capacity)) {
      throw new AcademyConflictError("Section is at capacity.");
    }
  }

  // Check prerequisites
  const prerequisites = await db.query(
    `select cp.required_course_id,
            (select c.code from academy_courses c where c.id = cp.required_course_id) as required_course_code
       from academy_course_prerequisites cp
      where cp.tenant_id = $1 and cp.course_id = $2
        and cp.requirement_type = 'required_before_registration'`,
    [actor.tenantId, section.course_id],
  );

  if (prerequisites.rowCount && prerequisites.rowCount > 0) {
    for (const prereq of prerequisites.rows) {
      const completed = await db.query(
        `select 1
           from academy_course_section_registrations r
           join academy_course_sections s2
             on s2.tenant_id = r.tenant_id and s2.id = r.course_section_id
          where r.tenant_id = $1
            and r.student_person_id = $2
            and s2.course_id = $3
            and r.status = 'completed'
          limit 1`,
        [actor.tenantId, input.studentPersonId, prereq.required_course_id],
      );

      if (!completed.rowCount || completed.rowCount === 0) {
        throw new AcademyConflictError(
          `Prerequisite not met: ${prereq.required_course_code} must be completed before registration.`,
        );
      }
    }
  }

  // Get student profile and active period registration
  const studentData = await db.query(
    `select sp.id as student_profile_id,
            pr.id as period_registration_id,
            pr.program_enrollment_id
       from academy_student_profiles sp
       join academy_period_registrations pr
         on pr.tenant_id = sp.tenant_id
        and pr.student_profile_id = sp.id
        and pr.academic_period_id = $3
      where sp.tenant_id = $1
        and sp.person_id = $2
      limit 1`,
    [actor.tenantId, input.studentPersonId, section.academic_period_id],
  );

  if (!studentData.rowCount || studentData.rowCount === 0) {
    throw new Error(
      `No active period registration found for student ${input.studentPersonId} in this academic period.`,
    );
  }

  const student = studentData.rows[0];

  // Insert registration
  const registration = await db.query(
    `insert into academy_course_section_registrations (
       tenant_id, student_profile_id, student_person_id, program_enrollment_id,
       period_registration_id, course_section_id, source_application_id,
       status, registered_at, confirmed_at, idempotency_key
     ) values (
       $1, $2, $3, $4, $5, $6, null, 'registered', now(), now(), gen_random_uuid()::text
     ) returning id, tenant_id, course_section_id, student_person_id,
                 student_profile_id, program_enrollment_id, period_registration_id,
                 status, registered_at`,
    [
      actor.tenantId,
      student.student_profile_id,
      input.studentPersonId,
      student.program_enrollment_id,
      student.period_registration_id,
      input.sectionId,
    ],
  );

  if (!registration.rows[0]) {
    throw new Error("Registration creation failed.");
  }

  return mapRegistration(registration.rows[0]);
}

export async function dropStudentFromSection(
  actor: AcademyActor,
  input: { registrationId: string },
  db: Queryable,
): Promise<void> {
  assertTenantIsolation(actor, actor.tenantId);

  // Get registration with enrollment window info
  const registrationData = await db.query(
    `select r.id, r.course_section_id, r.student_person_id, r.status,
            s.academic_period_id,
            ew.id as enrollment_window_id
       from academy_course_section_registrations r
       join academy_course_sections s
         on s.tenant_id = r.tenant_id and s.id = r.course_section_id
       left join academy_enrollment_windows ew
         on ew.tenant_id = r.tenant_id
        and ew.academic_period_id = s.academic_period_id
        and ew.window_type in ('add_drop', 'withdrawal')
        and ew.opens_at <= now()
        and (ew.closes_at is null or ew.closes_at >= now())
      where r.tenant_id = $1 and r.id = $2`,
    [actor.tenantId, input.registrationId],
  );

  if (!registrationData.rowCount || registrationData.rowCount === 0) {
    throw new Error(`Registration ${input.registrationId} not found.`);
  }

  const registration = registrationData.rows[0];

  // Check enrollment window (bypass for registrar/admin)
  if (!canBypassEnrollmentWindow(actor)) {
    // Students can only drop their own registrations
    if (registration.student_person_id !== actor.userId) {
      throw new Error("Forbidden: cannot drop another student's registration.");
    }

    if (!registration.enrollment_window_id) {
      throw new AcademyConflictError("Add/drop window is not open.");
    }
  }

  // Update status to withdrawn
  await db.query(
    `update academy_course_section_registrations
       set status = 'withdrawn', updated_at = now()
     where tenant_id = $1 and id = $2`,
    [actor.tenantId, input.registrationId],
  );
}
