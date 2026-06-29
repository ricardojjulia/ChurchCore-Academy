import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademicPeriodLifecycleService } from "@/modules/academic-calendar/period-lifecycle-service";
import { PostgresAcademicPeriodRepository } from "@/modules/academic-calendar/postgres-period-repository";
import { AuditService } from "@/modules/audit/service";
import { PostgresAuditRepository } from "@/modules/audit/postgres-repository";

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  return handleApi(async () => {
    const { id: periodId } = context.params;
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json();

    const action = body.action;
    if (!action || typeof action !== "string") {
      throw new Error("An 'action' is required to transition period status.");
    }

    return withAcademyDatabaseContext(actor, async (client) => {
      const db = asAcademyDatabase(client);
      const periodRepo = new PostgresAcademicPeriodRepository(db, actor.tenantId);
      const auditRepo = new PostgresAuditRepository(db);
      const auditService = new AuditService(auditRepo);
      const service = new AcademicPeriodLifecycleService(db, periodRepo, auditService);

      switch (action) {
        case "open_enrollment":
          return service.openEnrollment(actor, periodId);
        case "activate":
          return service.activatePeriod(actor, periodId);
        case "complete":
          return service.completePeriod(actor, periodId);
        default:
          throw new Error(`Invalid period status action: ${action}`);
      }
    });
  });
}