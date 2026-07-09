import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  PostgresStudentGroupRepository,
  type StudentGroupDatabase,
} from "@/modules/student-groups/postgres-repository";
import { StudentGroupService } from "@/modules/student-groups/service";
import type { StudentGroupStatus, StudentGroupType } from "@/modules/student-groups/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, async (client) => {
      const service = new StudentGroupService(
        new PostgresStudentGroupRepository(asAcademyDatabase<StudentGroupDatabase>(client)),
      );
      const group = await service.updateGroup(actor, id, {
        academicYearId: typeof body.academicYearId === "string" ? body.academicYearId : "",
        academicProgramId: typeof body.academicProgramId === "string" ? body.academicProgramId : undefined,
        name: typeof body.name === "string" ? body.name : "",
        code: typeof body.code === "string" ? body.code : "",
        groupType: body.groupType as StudentGroupType,
        status: body.status as StudentGroupStatus,
        description: typeof body.description === "string" ? body.description : undefined,
      });
      return { group };
    });
  });
}
