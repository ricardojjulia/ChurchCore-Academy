import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { createStorageClient } from "@/lib/supabase/storage-client";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { DocumentChecklistService } from "@/modules/admissions/document-checklist";
import {
  DocumentChecklistDatabase,
  PostgresDocumentChecklistRepository,
} from "@/modules/admissions/document-checklist-repository";

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

export async function POST(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: applicationId, itemId } = await context.params;
    const body = await request.json();
    const filename = String(body.filename ?? "document.pdf");

    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new PostgresDocumentChecklistRepository(
        asAcademyDatabase<DocumentChecklistDatabase>(client),
      );
      const service = new DocumentChecklistService(repository);
      const checklist = await service.getApplicationChecklist(actor, applicationId);
      const item = checklist.items.find((i) => i.id === itemId);
      if (!item) {
        throw new Error("Document item not found.");
      }

      const storagePath = `${actor.tenantId}/applications/${applicationId}/${itemId}/${filename}`;
      const storageClient = createStorageClient();
      const signedUploadUrl = await storageClient.generateSignedUploadUrl(storagePath, 180);
      return { signedUploadUrl, storagePath, documentItemId: itemId };
    });
  });
}
