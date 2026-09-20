import { handleApi, requireStringField } from "@/app/api/academy/api-utils";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { createAdmissionDocumentService } from "@/app/api/academy/admissions/service-factory";
import {
  AdmissionsDatabase,
  PostgresAdmissionsRepository,
} from "@/modules/admissions/postgres-repository";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import { UploadUrlRequest } from "@/modules/admissions/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: applicationId } = await context.params;
    const body = await request.json().catch(() => {
      throw new Error("Malformed JSON body.");
    });

    const documentTypeSlug = requireStringField(body.documentTypeSlug, "documentTypeSlug");
    const uploadRequest: UploadUrlRequest = {
      fileName: requireStringField(body.fileName, "fileName"),
      mimeType: requireStringField(body.mimeType, "mimeType"),
      sizeBytes: (() => {
        if (typeof body.sizeBytes !== "number" || body.sizeBytes <= 0) {
          throw new Error("Invalid sizeBytes: must be a positive number.");
        }
        return body.sizeBytes;
      })(),
    };

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");

      // Fetch application to obtain applicantPersonId and verify tenant ownership
      const application = await new PostgresAdmissionsRepository(
        asAcademyDatabase<AdmissionsDatabase>(client),
      ).findById(actor.tenantId, applicationId);

      if (!application) {
        throw new Error(`Admission application ${applicationId} was not found.`);
      }

      const service = createAdmissionDocumentService(client);

      const result = await service.generateUploadUrl(
        actor,
        actor.tenantId,
        applicationId,
        application.applicantPersonId,
        documentTypeSlug,
        uploadRequest,
      );

      return result;
    });
  });
}
