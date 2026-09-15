import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
  type AcademyQueryClient,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  PostgresStudentGroupRepository,
  type StudentGroupDatabase,
} from "@/modules/student-groups/postgres-repository";
import { StudentGroupService } from "@/modules/student-groups/service";
import type { StudentGroupType } from "@/modules/student-groups/types";

function serviceFor(client: AcademyQueryClient) {
  return new StudentGroupService(
    new PostgresStudentGroupRepository(asAcademyDatabase<StudentGroupDatabase>(client)),
  );
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, async (client) => ({
      groups: await serviceFor(client).listGroups(actor),
    }));
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, async (client) => ({
      group: await serviceFor(client).createGroup(actor, {
        academicYearId: typeof body.academicYearId === "string" ? body.academicYearId : "",
        academicProgramId: typeof body.academicProgramId === "string" ? body.academicProgramId : undefined,
        name: typeof body.name === "string" ? body.name : "",
        code: typeof body.code === "string" ? body.code : "",
        groupType: body.groupType as StudentGroupType,
        description: typeof body.description === "string" ? body.description : undefined,
      }),
    }));
  });
}
