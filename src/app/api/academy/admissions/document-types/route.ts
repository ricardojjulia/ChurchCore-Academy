import { handleApi, requireStringField, requireBooleanField } from "@/app/api/academy/api-utils";
import { createAdmissionDocumentService } from "@/app/api/academy/admissions/service-factory";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { CreateDocumentTypeInput } from "@/modules/admissions/types";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");
      const service = createAdmissionDocumentService(client);

      const documentTypes = await service.listActiveDocumentTypes(
        actor,
        actor.tenantId,
      );

      return { documentTypes };
    });
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json().catch(() => {
      throw new Error("Malformed JSON body.");
    });

    const input: CreateDocumentTypeInput = {
      tenantId: actor.tenantId,
      name: requireStringField(body.name, "name"),
      slug: requireStringField(body.slug, "slug"),
      required: body.required !== undefined ? requireBooleanField(body.required, "required") : false,
      description: typeof body.description === "string" && body.description.trim().length > 0
        ? body.description.trim()
        : undefined,
    };

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");
      const service = createAdmissionDocumentService(client);

      const documentType = await service.createDocumentType(actor, input);

      return { documentType };
    });
  });
}
