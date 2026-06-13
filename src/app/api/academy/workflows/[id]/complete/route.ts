import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { AcademyActor, assertShepherdAiAccess } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademicWorkflowsPostgresService } from "@/modules/academic-workflows/postgres-service";
import { WorkflowRecord } from "@/modules/shepherd-ai/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

interface WorkflowCompletionService {
  completeWorkflow(tenantId: string, workflowId: string): Promise<WorkflowRecord>;
}

export async function completeWorkflowForActor(service: WorkflowCompletionService, actor: AcademyActor, workflowId: string) {
  assertShepherdAiAccess(actor, actor.tenantId, "write");
  return service.completeWorkflow(actor.tenantId, workflowId);
}

export async function POST(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await context.params;
    return withAcademyDatabaseContext(actor, async (client) => {
      const workflow = await completeWorkflowForActor(
        new AcademicWorkflowsPostgresService(
          asAcademyDatabase(client),
          false,
        ),
        actor,
        id,
      );
      return { workflow };
    });
  });
}
