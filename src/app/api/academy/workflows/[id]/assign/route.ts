import { handleApi, jsonError } from "@/app/api/academy/api-utils";
import { AcademyActor, assertShepherdAiAccess } from "@/modules/academy-auth/policy";
import { resolveBootstrapAcademyActor } from "@/modules/academy-auth/request-context";
import { AcademicWorkflowsPostgresService } from "@/modules/academic-workflows/postgres-service";
import { WorkflowRecord } from "@/modules/shepherd-ai/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

interface WorkflowAssignmentService {
  assignWorkflow(tenantId: string, workflowId: string, assignedToUserId: string): Promise<WorkflowRecord>;
}

export async function assignWorkflowForActor(
  service: WorkflowAssignmentService,
  actor: AcademyActor,
  workflowId: string,
  assignedToUserId: string,
) {
  assertShepherdAiAccess(actor, actor.tenantId, "write");
  return service.assignWorkflow(actor.tenantId, workflowId, assignedToUserId);
}

export async function POST(request: Request, context: RouteContext) {
  const body = await request.json().catch(() => ({}));
  const assignedToUserId = typeof body.assignedToUserId === "string" ? body.assignedToUserId : undefined;

  if (!assignedToUserId) {
    return jsonError("assignedToUserId is required.", 400);
  }

  return handleApi(async () => {
    const actor = resolveBootstrapAcademyActor(request.headers);
    const { id } = await context.params;
    const workflow = await assignWorkflowForActor(new AcademicWorkflowsPostgresService(), actor, id, assignedToUserId);
    return { workflow };
  });
}

