import { handleApi } from "@/app/api/academy/api-utils";
import {
  withAcademyDatabaseContext,
  asAcademyDatabase,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  compileAccreditationPackage,
  type AccreditationDatabaseClient,
} from "@/modules/reporting/accreditation";
import { createAccreditationStorageClient } from "@/modules/reporting/storage-adapter";
import { renderAccreditationPdfBuffer } from "@/modules/reporting/accreditation-package-pdf";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);

    const storage = createAccreditationStorageClient();

    return withAcademyDatabaseContext(actor, async (client) => {
      const db = asAcademyDatabase<AccreditationDatabaseClient>(client);
      return compileAccreditationPackage(
        actor,
        id,
        storage,
        db,
        renderAccreditationPdfBuffer,
      );
    });
  });
}
