import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { DocumentChecklistService } from "@/modules/admissions/document-checklist";
import {
  DocumentChecklistDatabase,
  PostgresDocumentChecklistRepository,
} from "@/modules/admissions/document-checklist-repository";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: applicationId } = await context.params;

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");
      const repository = new PostgresDocumentChecklistRepository(
        asAcademyDatabase<DocumentChecklistDatabase>(client),
      );
      const service = new DocumentChecklistService(repository);

      const checklist = await service.getApplicationChecklist(
        actor,
        applicationId,
      );

      return { checklist };
    });
  });
}
