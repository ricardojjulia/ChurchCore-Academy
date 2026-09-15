import { handleApi } from "@/app/api/academy/api-utils";
import {
  withAcademyDatabaseContext,
  asAcademyDatabase,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  getAccreditationPackageUrl,
  type AccreditationDatabaseClient,
} from "@/modules/reporting/accreditation";
import { createAccreditationStorageClient } from "@/modules/reporting/storage-adapter";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);

    const storage = createAccreditationStorageClient();

    return withAcademyDatabaseContext(actor, async (client) => {
      const db = asAcademyDatabase<AccreditationDatabaseClient>(client);
      const url = await getAccreditationPackageUrl(actor, id, storage, db);

      if (!url) {
        return { url: null, message: "Package not yet compiled or not found." };
      }

      return { url };
    });
  });
}
