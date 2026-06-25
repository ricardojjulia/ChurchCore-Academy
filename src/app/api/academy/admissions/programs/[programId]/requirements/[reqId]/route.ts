import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { DocumentChecklistService } from "@/modules/admissions/document-checklist";
import {
  DocumentChecklistDatabase,
  PostgresDocumentChecklistRepository,
} from "@/modules/admissions/document-checklist-repository";

type RouteContext = { params: Promise<{ programId: string; reqId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(_request);
    const { reqId } = await context.params;

    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new PostgresDocumentChecklistRepository(
        asAcademyDatabase<DocumentChecklistDatabase>(client),
      );
      const service = new DocumentChecklistService(repository);
      await service.deleteProgramRequirement(actor, reqId);
      return { deleted: true };
    });
  });
}
