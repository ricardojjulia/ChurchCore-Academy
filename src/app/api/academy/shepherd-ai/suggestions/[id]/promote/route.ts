import { handleApi, jsonError } from "@/app/api/academy/api-utils";
import { AcademyActor, assertShepherdAiAccess } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademicWorkflowsPostgresService } from "@/modules/academic-workflows/postgres-service";
import { WorkflowRecord } from "@/modules/shepherd-ai/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

interface WorkflowPromotionService {
  promoteSuggestion(
    tenantId: string,
    suggestionId: string,
    ownerUserId: string,
    assignedToUserId?: string,
    dueAt?: string,
  ): Promise<WorkflowRecord>;
}

export async function promoteSuggestionForActor(
  service: WorkflowPromotionService,
  actor: AcademyActor,
  suggestionId: string,
  ownerUserId: string,
  assignedToUserId?: string,
  dueAt?: string,
) {
  assertShepherdAiAccess(actor, actor.tenantId, "write");
  return service.promoteSuggestion(actor.tenantId, suggestionId, ownerUserId, assignedToUserId, dueAt);
}

export async function POST(request: Request, context: RouteContext) {
  const body = await request.json().catch(() => ({}));
  const ownerUserId = typeof body.ownerUserId === "string" ? body.ownerUserId : undefined;
  const assignedToUserId = typeof body.assignedToUserId === "string" ? body.assignedToUserId : undefined;
  const dueAt = typeof body.dueAt === "string" ? body.dueAt : undefined;

  if (!ownerUserId) {
    return jsonError("ownerUserId is required.", 400);
  }

  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await context.params;
    const workflow = await promoteSuggestionForActor(
      new AcademicWorkflowsPostgresService(),
      actor,
      id,
      ownerUserId,
      assignedToUserId,
      dueAt,
    );
    return { workflow };
  });
}
