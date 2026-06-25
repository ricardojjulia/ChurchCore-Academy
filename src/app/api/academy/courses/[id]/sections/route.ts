import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { CourseCatalogService } from "@/modules/course-catalog/service";
import {
  AcademyCourseCatalogRepository,
  type CourseCatalogRepository,
} from "@/modules/course-catalog/postgres-repository";
import type { DeliveryMode } from "@/modules/course-catalog/types";

type Queryable = {
  query(sql: string, params: unknown[]): Promise<{
    rowCount: number | null;
    rows: Record<string, unknown>[];
  }>;
};

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new AcademyCourseCatalogRepository(asAcademyDatabase<Queryable>(client));
      const service = new CourseCatalogService(repository as CourseCatalogRepository);

      const sections = await service.listSectionsByCourse(actor, id);

      return { sections };
    });
  });
}

export async function POST(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { id: courseId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new AcademyCourseCatalogRepository(asAcademyDatabase<Queryable>(client));
      const service = new CourseCatalogService(repository as CourseCatalogRepository);

      const section = await service.createSection(actor, {
        courseId,
        academicYearId: typeof body.academicYearId === "string" ? body.academicYearId : "",
        academicPeriodId: typeof body.academicPeriodId === "string" ? body.academicPeriodId : "",
        sectionCode: typeof body.sectionCode === "string" ? body.sectionCode : "",
        deliveryMode: typeof body.deliveryMode === "string" ? body.deliveryMode as DeliveryMode : "in_person",
        capacity: typeof body.capacity === "number" ? body.capacity : undefined,
        primaryInstructorId: typeof body.primaryInstructorId === "string" ? body.primaryInstructorId : undefined,
        schedulePattern: typeof body.schedulePattern === "string" ? body.schedulePattern : undefined,
        subdivisionId: typeof body.subdivisionId === "string" ? body.subdivisionId : undefined,
      });

      return { section };
    });
  }, { operation: "section.create" });
}
