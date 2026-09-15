import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { CourseCatalogService } from "@/modules/course-catalog/service";
import {
  AcademyCourseCatalogRepository,
  type CourseCatalogRepository,
} from "@/modules/course-catalog/postgres-repository";

type Queryable = {
  query(sql: string, params: unknown[]): Promise<{
    rowCount: number | null;
    rows: Record<string, unknown>[];
  }>;
};

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new AcademyCourseCatalogRepository(asAcademyDatabase<Queryable>(client));
      const service = new CourseCatalogService(repository as CourseCatalogRepository);

      const course = await service.archiveCourse(actor, id);

      return { course };
    });
  }, { operation: "course.archive" });
}
