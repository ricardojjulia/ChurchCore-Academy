import { randomUUID } from "node:crypto";
import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { CourseRegistrationService } from "@/modules/course-registration/service";
import {
  PostgresCourseRegistrationRepository,
  type CourseRegistrationDatabase,
} from "@/modules/course-registration/postgres-repository";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { canManageCourseRegistration } from "@/modules/course-registration/policy";

// AcademyQueryClient.query returns Promise<unknown>; cast the result to extract rows.
type RawQueryResult = { rows: Record<string, unknown>[] };

interface ListCourseRegistrationsDependencies {
  resolveActor?: (request: Request) => Promise<AcademyActor>;
  query?: (sql: string, values?: unknown[]) => Promise<RawQueryResult>;
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await request.json() as Record<string, unknown>;

    const applicationId = typeof body.applicationId === "string" ? body.applicationId : null;
    const courseSectionId = typeof body.courseSectionId === "string" ? body.courseSectionId : null;
    const idempotencyKey = typeof body.idempotencyKey === "string"
      ? body.idempotencyKey
      : randomUUID();

    if (!applicationId) throw new Error("applicationId is required.");
    if (!courseSectionId) throw new Error("courseSectionId is required.");

    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new PostgresCourseRegistrationRepository(
        asAcademyDatabase<CourseRegistrationDatabase>(client),
      );
      const service = new CourseRegistrationService(repository);

      return service.registerAndConfirm(actor, {
        tenantId: actor.tenantId,
        applicationId,
        courseSectionId,
        idempotencyKey,
        correlationId: randomUUID(),
        confirmationNote: typeof body.confirmationNote === "string"
          ? body.confirmationNote
          : undefined,
      });
    });
  });
}

function mapRegistrationRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => ({
    id: String(row.id),
    courseSectionId: String(row.course_section_id),
    studentPersonId: String(row.student_person_id),
    studentProfileId: String(row.student_profile_id),
    programEnrollmentId: String(row.program_enrollment_id),
    periodRegistrationId: String(row.period_registration_id),
    status: String(row.status),
    registeredAt: row.registered_at instanceof Date
      ? row.registered_at.toISOString()
      : String(row.registered_at),
    confirmedAt: row.confirmed_at instanceof Date
      ? row.confirmed_at.toISOString()
      : String(row.confirmed_at),
    idempotencyKey: String(row.idempotency_key),
    sourceApplicationId: String(row.source_application_id),
  }));
}

export async function listCourseRegistrations(
  request: Request,
  dependencies: ListCourseRegistrationsDependencies = {},
) {
  return handleApi(async () => {
    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get("sectionId");

    const actor = await (
      dependencies.resolveActor ??
      (async (currentRequest) =>
        (await resolveAcademyActorFromSession(currentRequest)).actor)
    )(request);
    const canReadTenantRegistrations = canManageCourseRegistration(actor, actor.tenantId);
    const sql = canReadTenantRegistrations
      ? sectionId
        ? `select r.id,
                  r.course_section_id,
                  r.student_person_id,
                  r.student_profile_id,
                  r.program_enrollment_id,
                  r.period_registration_id,
                  r.status,
                  r.registered_at,
                  r.confirmed_at,
                  r.idempotency_key,
                  r.source_application_id
             from academy_course_section_registrations r
            where r.tenant_id = $1 and r.course_section_id = $2 and r.status = 'registered'
            order by r.registered_at desc`
        : `select r.id,
                  r.course_section_id,
                  r.student_person_id,
                  r.student_profile_id,
                  r.program_enrollment_id,
                  r.period_registration_id,
                  r.status,
                  r.registered_at,
                  r.confirmed_at,
                  r.idempotency_key,
                  r.source_application_id
             from academy_course_section_registrations r
            where r.tenant_id = $1 and r.status = 'registered'
            order by r.registered_at desc
            limit 100`
      : sectionId
        ? `select r.id,
                  r.course_section_id,
                  r.student_person_id,
                  r.student_profile_id,
                  r.program_enrollment_id,
                  r.period_registration_id,
                  r.status,
                  r.registered_at,
                  r.confirmed_at,
                  r.idempotency_key,
                  r.source_application_id
             from academy_course_section_registrations r
            where r.tenant_id = $1
              and r.course_section_id = $2
              and r.student_person_id = $3
              and r.status in ('pending_confirmation', 'registered', 'waitlisted')
            order by r.registered_at desc`
        : `select r.id,
                  r.course_section_id,
                  r.student_person_id,
                  r.student_profile_id,
                  r.program_enrollment_id,
                  r.period_registration_id,
                  r.status,
                  r.registered_at,
                  r.confirmed_at,
                  r.idempotency_key,
                  r.source_application_id
             from academy_course_section_registrations r
            where r.tenant_id = $1
              and r.student_person_id = $2
              and r.status in ('pending_confirmation', 'registered', 'waitlisted')
            order by r.registered_at desc
            limit 100`;
    const values = canReadTenantRegistrations
      ? sectionId ? [actor.tenantId, sectionId] : [actor.tenantId]
      : sectionId ? [actor.tenantId, sectionId, actor.userId] : [actor.tenantId, actor.userId];

    if (dependencies.query) {
      const result = await dependencies.query(sql, values);
      return mapRegistrationRows(result.rows);
    }

    return withAcademyDatabaseContext(actor, async (client) => {
      const result = (await client.query(sql, values)) as RawQueryResult;
      return mapRegistrationRows(result.rows);
    });
  });
}

export async function GET(request: Request) {
  return listCourseRegistrations(request);
}
