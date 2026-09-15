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

function serviceFor(client: AcademyQueryClient) {
  return new StudentGroupService(
    new PostgresStudentGroupRepository(asAcademyDatabase<StudentGroupDatabase>(client)),
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, async (client) => ({
      memberships: await serviceFor(client).listMembers(actor, id),
    }));
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, async (client) => ({
      membership: await serviceFor(client).addMember(actor, id, {
        studentProfileId: typeof body.studentProfileId === "string" ? body.studentProfileId : "",
        startedOn: typeof body.startedOn === "string" ? body.startedOn : undefined,
      }),
    }));
  });
}
