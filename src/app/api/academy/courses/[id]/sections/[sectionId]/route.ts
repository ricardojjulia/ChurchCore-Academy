import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { CourseCatalogService } from "@/modules/course-catalog/service";
import {
  AcademyCourseCatalogRepository,
  type CourseCatalogRepository,
} from "@/modules/course-catalog/postgres-repository";
import type { CourseSectionStatus } from "@/modules/course-catalog/types";

type Queryable = {
  query(sql: string, params: unknown[]): Promise<{
    rowCount: number | null;
    rows: Record<string, unknown>[];
  }>;
};

interface Params {
  params: Promise<{ id: string; sectionId: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { sectionId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new AcademyCourseCatalogRepository(asAcademyDatabase<Queryable>(client));
      const service = new CourseCatalogService(repository as CourseCatalogRepository);

      const section = await service.updateSection(actor, sectionId, {
        capacity: typeof body.capacity === "number" ? body.capacity : undefined,
        primaryInstructorId: typeof body.primaryInstructorId === "string" ? body.primaryInstructorId : undefined,
        schedulePattern: typeof body.schedulePattern === "string" ? body.schedulePattern : undefined,
        status: typeof body.status === "string" ? body.status as CourseSectionStatus : undefined,
      });

      return { section };
    });
  }, { operation: "section.update" });
}
