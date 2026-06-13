import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { AcademyActor, assertInstitutionConfigAccess } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyCalendarRepository } from "@/modules/academic-calendar/postgres-repository";
import { AcademicCalendarConfiguration } from "@/modules/academic-calendar/types";
import { validateAcademicCalendarConfiguration } from "@/modules/academic-calendar/validation";

interface AcademicCalendarConfigReader {
  fetchAcademicCalendarConfiguration(tenantId: string): Promise<AcademicCalendarConfiguration>;
}

export async function buildAcademicCalendarConfigPayload(
  repository: AcademicCalendarConfigReader,
  actor: AcademyActor,
  tenantId: string,
) {
  assertInstitutionConfigAccess(actor, tenantId, "read");

  const academicCalendar = await repository.fetchAcademicCalendarConfiguration(tenantId);

  return {
    academicCalendar,
    validation: validateAcademicCalendarConfiguration(academicCalendar),
  };
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, (client) =>
      buildAcademicCalendarConfigPayload(
        new AcademyCalendarRepository(asAcademyDatabase(client)),
        actor,
        actor.tenantId,
      ),
    );
  });
}
