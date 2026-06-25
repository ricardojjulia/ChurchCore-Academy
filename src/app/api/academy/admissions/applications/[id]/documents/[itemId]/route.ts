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

export async function PATCH(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { itemId } = await context.params;
    const body = await request.json();
    const action = String(body.action ?? "");

    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new PostgresDocumentChecklistRepository(
        asAcademyDatabase<DocumentChecklistDatabase>(client),
      );
      const storageClient = createStorageClient();
      const service = new DocumentChecklistService(repository);

      if (action === "confirm_upload") {
        const { storagePath, storageFilename, contentType, fileSizeBytes } = body;
        const result = await service.confirmDocumentUpload(actor, {
          documentItemId: itemId,
          storagePath: String(storagePath),
          storageFilename: String(storageFilename),
          contentType: String(contentType),
          fileSizeBytes: Number(fileSizeBytes),
        });
        if (result.oldStoragePath) {
          await storageClient.delete(result.oldStoragePath);
        }
        return result.item;
      }

      if (action === "review") {
        const { decision, officerNote } = body;
        return service.reviewDocumentItem(actor, {
          documentItemId: itemId,
          decision: decision as "reviewed" | "resubmission_required",
          officerNote: officerNote ? String(officerNote) : undefined,
        });
      }

      if (action === "download_url") {
        const url = await service.getSignedDownloadUrl(actor, itemId, storageClient);
        return { url };
      }

      throw new Error(`Unknown action: ${action}`);
    });
  });
}
