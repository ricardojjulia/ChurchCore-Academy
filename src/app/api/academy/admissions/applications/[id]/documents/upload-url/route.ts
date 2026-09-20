import { handleApi, requireStringField } from "@/app/api/academy/api-utils";
import {
  fetchCapabilitySet,
} from "@/lib/capability-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { createAdmissionDocumentService } from "@/app/api/academy/admissions/service-factory";
import {
  AdmissionsDatabase,
  PostgresAdmissionsRepository,
} from "@/modules/admissions/postgres-repository";
import {
  AcademyQueryClient,
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import {
  AdmissionApplication,
  UploadUrlRequest,
  UploadUrlResponse,
} from "@/modules/admissions/types";
import { InstitutionCapabilitySet } from "@/modules/academy-config/types";

type RouteContext = { params: Promise<{ id: string }> };

interface UploadUrlRouteDependencies {
  resolveActor(request: Request): Promise<
    Awaited<ReturnType<typeof resolveAcademyActorFromSession>>["actor"]
  >;
  withRequestContext<T>(
    actor: Awaited<
      ReturnType<typeof resolveAcademyActorFromSession>
    >["actor"],
    operation: (client: AcademyQueryClient) => Promise<T>,
  ): Promise<T>;
  findApplication(
    client: AcademyQueryClient,
    tenantId: string,
    applicationId: string,
  ): Promise<AdmissionApplication | undefined>;
  getCapabilities(
    client: AcademyQueryClient,
    tenantId: string,
  ): Promise<InstitutionCapabilitySet>;
  generateUploadUrl(
    client: AcademyQueryClient,
    actor: Awaited<
      ReturnType<typeof resolveAcademyActorFromSession>
    >["actor"],
    tenantId: string,
    applicationId: string,
    applicantPersonId: string,
    documentTypeSlug: string,
    uploadRequest: UploadUrlRequest,
  ): Promise<UploadUrlResponse>;
}

const uploadUrlDependencies: UploadUrlRouteDependencies = {
  resolveActor: async (request) =>
    (await resolveAcademyActorFromSession(request)).actor,
  withRequestContext: async (actor, operation) =>
    withAcademyDatabaseContext(actor, operation),
  findApplication: async (client, tenantId, applicationId) =>
    new PostgresAdmissionsRepository(
      asAcademyDatabase<AdmissionsDatabase>(client),
    ).findById(tenantId, applicationId),
  getCapabilities: async (client, tenantId) =>
    fetchCapabilitySet(client, tenantId),
  generateUploadUrl: async (
    client,
    actor,
    tenantId,
    applicationId,
    applicantPersonId,
    documentTypeSlug,
    uploadRequest,
  ) =>
    createAdmissionDocumentService(client).generateUploadUrl(
      actor,
      tenantId,
      applicationId,
      applicantPersonId,
      documentTypeSlug,
      uploadRequest,
    ),
};

export async function POST(request: Request, context: RouteContext) {
  return issueAdmissionDocumentUploadUrlRequest(request, context);
}

export async function issueAdmissionDocumentUploadUrlRequest(
  request: Request,
  context: RouteContext,
  dependencies: UploadUrlRouteDependencies = uploadUrlDependencies,
) {
  return handleApi(async () => {
    const actor = await dependencies.resolveActor(request);
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

    return dependencies.withRequestContext(actor, async (client) => {
      const application = await dependencies.findApplication(
        client,
        actor.tenantId,
        applicationId,
      );

      if (!application) {
        throw new Error(`Admission application ${applicationId} was not found.`);
      }

      const isApplicantSelfService =
        actor.roles.includes("applicant") &&
        actor.userId === application.applicantPersonId;

      if (!isApplicantSelfService) {
        const capabilities = await dependencies.getCapabilities(
          client,
          actor.tenantId,
        );
        assertCapability(capabilities, "admissionsWorkflows");
      }

      return dependencies.generateUploadUrl(
        client,
        actor,
        actor.tenantId,
        applicationId,
        application.applicantPersonId,
        documentTypeSlug,
        uploadRequest,
      );
    });
  });
}
