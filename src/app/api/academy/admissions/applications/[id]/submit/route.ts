import { randomUUID } from "node:crypto";
import { handleApi } from "@/app/api/academy/api-utils";
import { requireIdempotencyKey } from "@/app/api/academy/admissions/request-utils";
import {
  createAdmissionsService,
  createDocumentChecklistService,
} from "@/app/api/academy/admissions/service-factory";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await context.params;
    const idempotencyKey = requireIdempotencyKey(request.headers);
    const correlationId =
      request.headers.get("x-correlation-id")?.trim() ||
      `corr-admission-${randomUUID()}`;

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");
      const application = await createAdmissionsService(client).submit(
        actor,
        id,
        correlationId,
        idempotencyKey,
      );
      // Snapshot the document checklist from the program's requirements — without this,
      // the application would carry zero checklist items forever, and the admissions
      // decision gate would trivially treat it as complete regardless of the program's
      // actual requirements. Mirrors the same step in the public self-service flow
      // (PublicApplicationService.submitPublicApplication).
      await createDocumentChecklistService(client).snapshotChecklistForApplication(
        actor.tenantId,
        application.id,
        application.programId,
      );
      return { application };
    });
  });
}
