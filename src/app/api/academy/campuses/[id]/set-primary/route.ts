import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { setPrimaryCampus, type CampusDatabase } from "@/modules/academy-config/campuses";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await params;

    return withAcademyDatabaseContext(actor, (client) =>
      setPrimaryCampus(actor, id, asAcademyDatabase<CampusDatabase>(client)),
    );
  });
}
