import { handleApi } from "@/app/api/academy/api-utils";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AdmissionDocumentService } from "@/modules/admissions/document-service";
import { PostgresAdmissionsRepository } from "@/modules/admissions/postgres-repository";
import { PostgresAcademyAuditRepository } from "@/modules/audit/postgres-repository";
import { createStorageProvider } from "@/lib/supabase/storage";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: applicationId } = await context.params;

    const repository = new PostgresAdmissionsRepository();
    const application = await repository.findById(actor.tenantId, applicationId);

    if (!application) {
      throw new Error("Application not found.");
    }

    const audit = new PostgresAcademyAuditRepository();
    const storage = createStorageProvider();
    const service = new AdmissionDocumentService(repository, audit, storage);

    const checklist = await service.getDocumentChecklist(
      actor,
      actor.tenantId,
      applicationId,
      application.applicantPersonId,
    );

    return { checklist };
  });
}
