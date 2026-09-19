import { handleApi, requireStringField, requireBooleanField } from "@/app/api/academy/api-utils";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AdmissionDocumentService } from "@/modules/admissions/document-service";
import { PostgresAdmissionsRepository } from "@/modules/admissions/postgres-repository";
import { PostgresAcademyAuditRepository } from "@/modules/audit/postgres-repository";
import { createStorageProvider } from "@/lib/supabase/storage";
import { CreateDocumentTypeInput } from "@/modules/admissions/types";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const repository = new PostgresAdmissionsRepository();
    const audit = new PostgresAcademyAuditRepository();
    const storage = createStorageProvider();
    const service = new AdmissionDocumentService(repository, audit, storage);

    const documentTypes = await service.listActiveDocumentTypes(
      actor,
      actor.tenantId,
    );

    return { documentTypes };
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

    const repository = new PostgresAdmissionsRepository();
    const audit = new PostgresAcademyAuditRepository();
    const storage = createStorageProvider();
    const service = new AdmissionDocumentService(repository, audit, storage);

    const documentType = await service.createDocumentType(actor, input);

    return { documentType };
  });
}
