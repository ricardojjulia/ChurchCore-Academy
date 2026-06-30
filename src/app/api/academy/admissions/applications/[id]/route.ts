import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
} from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  AdmissionsDatabase,
  PostgresAdmissionsRepository,
} from "@/modules/admissions/postgres-repository";
import { assertAdmissionsAccess } from "@/modules/admissions/policy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await context.params;
    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");
      const application = await new PostgresAdmissionsRepository(
        asAcademyDatabase<AdmissionsDatabase>(client),
      ).findById(actor.tenantId, id);
      if (!application) {
        throw new Error(`Admission application ${id} was not found.`);
      }
      assertAdmissionsAccess(
        actor,
        application.tenantId,
        application.applicantPersonId,
        "read",
      );
      return { application };
    });
  });
}
