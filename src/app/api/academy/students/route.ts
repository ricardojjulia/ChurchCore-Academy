import { AcademyDataRepository } from "@/modules/academy-data/postgres-repository";
import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, async (client) => {
      const dataset = await new AcademyDataRepository(
        asAcademyDatabase(client),
      ).loadDataset(actor.tenantId);
      return {
        students: dataset.students,
        count: dataset.students.length,
      };
    });
  });
}
