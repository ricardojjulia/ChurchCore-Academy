import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { AcademyActor, assertShepherdAiAccess } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademicWorkflowsPostgresService } from "@/modules/academic-workflows/postgres-service";
import { WorkflowRecord } from "@/modules/shepherd-ai/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

interface WorkflowDeferralService {
  deferWorkflow(tenantId: string, workflowId: string, reason?: string): Promise<WorkflowRecord>;
}

export async function deferWorkflowForActor(
  service: WorkflowDeferralService,
  actor: AcademyActor,
  workflowId: string,
  reason?: string,
) {
  assertShepherdAiAccess(actor, actor.tenantId, "write");
  return service.deferWorkflow(actor.tenantId, workflowId, reason);
}

export async function POST(request: Request, context: RouteContext) {
  const body = await request.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason : undefined;

  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await context.params;
    return withAcademyDatabaseContext(actor, async (client) => {
      const workflow = await deferWorkflowForActor(
        new AcademicWorkflowsPostgresService(
          asAcademyDatabase(client),
          false,
        ),
        actor,
        id,
        reason,
      );
      return { workflow };
    });
  });
}
