import { AcademyDataRepository } from "@/modules/academy-data/postgres-repository";
import { handleApi } from "@/app/api/academy/api-utils";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const dataset = await new AcademyDataRepository().loadDataset(actor.tenantId);
    return {
      students: dataset.students,
      count: dataset.students.length,
    };
  });
}
