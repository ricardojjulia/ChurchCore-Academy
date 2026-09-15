import { handleApi } from "@/app/api/academy/api-utils";
import {
  withAcademyDatabaseContext,
  asAcademyDatabase,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  createAccreditationPackage,
  listAccreditationPackages,
  type AccreditationDatabaseClient,
} from "@/modules/reporting/accreditation";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, async (client) => {
      const db = asAcademyDatabase<AccreditationDatabaseClient>(client);
      return listAccreditationPackages(actor, db);
    });
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = (await request.json()) as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    const input = {
      accreditorName:
        typeof body.accreditorName === "string" ? body.accreditorName : "",
      reportCycle: typeof body.reportCycle === "string" ? body.reportCycle : "",
      packageType:
        typeof body.packageType === "string"
          ? (body.packageType as never)
          : ("annual_report" as never),
    };

    return withAcademyDatabaseContext(actor, async (client) => {
      const db = asAcademyDatabase<AccreditationDatabaseClient>(client);
      return createAccreditationPackage(actor, input, db);
    });
  });
}
