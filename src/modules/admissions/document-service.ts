import { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { assertAdmissionsAccess } from "@/modules/admissions/policy";
import {
  ApplicationDocument,
  ChecklistCompletionStatus,
  CreateDocumentTypeInput,
  DocumentChecklistItem,
  DocumentType,
  UploadUrlRequest,
  UploadUrlResponse,
  WaiveDocumentInput,
} from "@/modules/admissions/types";
import { AcademyAuditEventInput } from "@/modules/audit/types";

interface DocumentRepository {
  createDocumentType(input: CreateDocumentTypeInput): Promise<DocumentType>;
  findDocumentTypeById(
    tenantId: string,
    documentTypeId: string,
  ): Promise<DocumentType | undefined>;
  listActiveDocumentTypes(tenantId: string): Promise<DocumentType[]>;
  createApplicationDocument(
    tenantId: string,
    applicationId: string,
    documentTypeId: string,
  ): Promise<ApplicationDocument>;
  findApplicationDocument(
    tenantId: string,
    documentId: string,
  ): Promise<ApplicationDocument | undefined>;
  getDocumentChecklist(
    tenantId: string,
    applicationId: string,
  ): Promise<DocumentChecklistItem[]>;
  confirmDocumentUpload(
    tenantId: string,
    documentId: string,
    storagePath: string,
    uploadedBy: string,
  ): Promise<ApplicationDocument | undefined>;
  markDocumentReceived(
    tenantId: string,
    documentId: string,
    receivedBy: string,
  ): Promise<ApplicationDocument | undefined>;
  waiveDocument(
    tenantId: string,
    documentId: string,
    waivedBy: string,
    waiverNote: string,
  ): Promise<ApplicationDocument | undefined>;
  canAdvanceToDecision(
    tenantId: string,
    applicationId: string,
  ): Promise<boolean>;
  getMissingRequiredDocuments(
    tenantId: string,
    applicationId: string,
  ): Promise<Array<{ documentTypeId: string; name: string }>>;
}

interface AuditRepository {
  append(input: AcademyAuditEventInput): Promise<unknown>;
}

interface StorageProvider {
  generateUploadUrl(
    path: string,
    mimeType: string,
    expiresInSeconds: number,
  ): Promise<string>;
  generateDownloadUrl(path: string, expiresInSeconds: number): Promise<string>;
}

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export class AdmissionDocumentService {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly audit: AuditRepository,
    private readonly storage: StorageProvider,
  ) {}

  async createDocumentType(
    actor: AcademyActor,
    input: CreateDocumentTypeInput,
  ): Promise<DocumentType> {
    // Only institution_admin can create document types
    if (actor.tenantId !== input.tenantId) {
      throw new AcademyAuthorizationError(
        "Cross-tenant document type creation forbidden.",
      );
    }
    if (!actor.roles.includes("institution_admin")) {
      throw new AcademyAuthorizationError(
        "Only institution admins can create document types.",
      );
    }

    const documentType = await this.repository.createDocumentType(input);

    await this.audit.append({
      tenantId: actor.tenantId,
      actorPersonId: actor.userId,
      action: "admission.document_type.created",
      entityType: "document_type",
      entityId: documentType.id,
      resultStatus: "success",
      redactedMetadata: {
        name: documentType.name,
        slug: documentType.slug,
        required: documentType.required,
      },
    });

    return documentType;
  }

  async listActiveDocumentTypes(
    actor: AcademyActor,
    tenantId: string,
  ): Promise<DocumentType[]> {
    if (actor.tenantId !== tenantId) {
      throw new AcademyAuthorizationError(
        "Cross-tenant document type access forbidden.",
      );
    }

    // Require admissions staff roles
    const staffRoles = [
      "institution_admin",
      "dean",
      "registrar",
      "admissions",
    ];
    if (!actor.roles.some((role) => staffRoles.includes(role))) {
      throw new AcademyAuthorizationError(
        "Only admissions staff can list document types.",
      );
    }

    return this.repository.listActiveDocumentTypes(tenantId);
  }

  async getDocumentChecklist(
    actor: AcademyActor,
    tenantId: string,
    applicationId: string,
    applicantPersonId: string,
  ): Promise<DocumentChecklistItem[]> {
    if (actor.tenantId !== tenantId) {
      throw new AcademyAuthorizationError(
        "Cross-tenant document checklist access forbidden.",
      );
    }

    // Allow applicant to view their own checklist or staff to view any
    assertAdmissionsAccess(actor, tenantId, applicantPersonId, "read");

    return this.repository.getDocumentChecklist(tenantId, applicationId);
  }

  async generateUploadUrl(
    actor: AcademyActor,
    tenantId: string,
    applicationId: string,
    applicantPersonId: string,
    documentTypeSlug: string,
    request: UploadUrlRequest,
  ): Promise<UploadUrlResponse> {
    if (actor.tenantId !== tenantId) {
      throw new AcademyAuthorizationError(
        "Cross-tenant document upload forbidden.",
      );
    }

    // Applicant can upload to their own application or staff can upload
    assertAdmissionsAccess(actor, tenantId, applicantPersonId, "submit");

    // Validate file type and size
    if (!ALLOWED_MIME_TYPES.has(request.mimeType)) {
      throw new Error(
        `Unsupported file type. Only PDF, JPEG, and PNG files are allowed.`,
      );
    }

    if (request.sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `File size exceeds maximum limit of ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
      );
    }

    // Generate storage path
    const uuid = crypto.randomUUID();
    const extension = getExtensionFromMimeType(request.mimeType);
    const storagePath = `${tenantId}/${applicationId}/${documentTypeSlug}/${uuid}.${extension}`;

    // Generate presigned upload URL (1 hour expiry)
    const uploadUrl = await this.storage.generateUploadUrl(
      storagePath,
      request.mimeType,
      3600,
    );

    await this.audit.append({
      tenantId,
      actorPersonId: actor.userId,
      action: "admission.document.upload_url_issued",
      entityType: "application_document",
      entityId: applicationId,
      resultStatus: "success",
      redactedMetadata: {
        applicationId,
        documentTypeSlug,
        fileName: request.fileName,
        sizeBytes: request.sizeBytes,
      },
    });

    return {
      uploadUrl,
      storagePath,
    };
  }

  async confirmUpload(
    actor: AcademyActor,
    tenantId: string,
    applicationId: string,
    applicantPersonId: string,
    documentId: string,
    storagePath: string,
  ): Promise<ApplicationDocument> {
    if (actor.tenantId !== tenantId) {
      throw new AcademyAuthorizationError(
        "Cross-tenant document confirmation forbidden.",
      );
    }

    assertAdmissionsAccess(actor, tenantId, applicantPersonId, "submit");

    const updated = await this.repository.confirmDocumentUpload(
      tenantId,
      documentId,
      storagePath,
      actor.userId,
    );

    if (!updated) {
      throw new Error(
        "Document confirmation failed. Document may not be in pending status.",
      );
    }

    await this.audit.append({
      tenantId,
      actorPersonId: actor.userId,
      action: "admission.document.uploaded",
      entityType: "application_document",
      entityId: documentId,
      resultStatus: "uploaded",
      redactedMetadata: {
        applicationId,
      },
    });

    return updated;
  }

  async markReceived(
    actor: AcademyActor,
    tenantId: string,
    applicationId: string,
    applicantPersonId: string,
    documentId: string,
  ): Promise<ApplicationDocument> {
    if (actor.tenantId !== tenantId) {
      throw new AcademyAuthorizationError(
        "Cross-tenant document review forbidden.",
      );
    }

    // Only staff can mark documents as received
    assertAdmissionsAccess(actor, tenantId, applicantPersonId, "review");

    const updated = await this.repository.markDocumentReceived(
      tenantId,
      documentId,
      actor.userId,
    );

    if (!updated) {
      throw new Error("Document not found or invalid status transition.");
    }

    await this.audit.append({
      tenantId,
      actorPersonId: actor.userId,
      action: "admission.document.received",
      entityType: "application_document",
      entityId: documentId,
      resultStatus: "received",
      redactedMetadata: {
        applicationId,
      },
    });

    return updated;
  }

  async waiveDocument(
    actor: AcademyActor,
    input: WaiveDocumentInput,
  ): Promise<ApplicationDocument> {
    if (actor.tenantId !== input.tenantId) {
      throw new AcademyAuthorizationError("Cross-tenant document waiver forbidden.");
    }

    // Waiver note is mandatory
    if (!input.waiverNote || input.waiverNote.trim().length === 0) {
      throw new Error("Waiver note is required when waiving a document.");
    }

    // Only staff can waive documents
    const staffRoles = [
      "institution_admin",
      "dean",
      "registrar",
      "admissions",
    ];
    if (!actor.roles.some((role) => staffRoles.includes(role))) {
      throw new AcademyAuthorizationError(
        "Only admissions staff can waive documents.",
      );
    }

    const updated = await this.repository.waiveDocument(
      input.tenantId,
      input.documentId,
      input.waivedBy,
      input.waiverNote,
    );

    if (!updated) {
      throw new Error("Document not found.");
    }

    await this.audit.append({
      tenantId: input.tenantId,
      actorPersonId: actor.userId,
      action: "admission.document.waived",
      entityType: "application_document",
      entityId: input.documentId,
      resultStatus: "waived",
      redactedMetadata: {
        applicationId: input.applicationId,
        waiverNote: input.waiverNote.substring(0, 100),
      },
    });

    return updated;
  }

  async generateDownloadUrl(
    actor: AcademyActor,
    tenantId: string,
    applicationId: string,
    applicantPersonId: string,
    documentId: string,
  ): Promise<string> {
    if (actor.tenantId !== tenantId) {
      throw new AcademyAuthorizationError(
        "Cross-tenant document download forbidden.",
      );
    }

    // Applicant can download their own documents or staff can download any
    assertAdmissionsAccess(actor, tenantId, applicantPersonId, "read");

    const document = await this.repository.findApplicationDocument(
      tenantId,
      documentId,
    );

    if (!document || !document.storagePath) {
      throw new Error("Document not found or not uploaded.");
    }

    // Generate signed download URL (15 minutes expiry)
    const downloadUrl = await this.storage.generateDownloadUrl(
      document.storagePath,
      900,
    );

    await this.audit.append({
      tenantId,
      actorPersonId: actor.userId,
      action: "admission.document.downloaded",
      entityType: "application_document",
      entityId: documentId,
      resultStatus: "success",
      redactedMetadata: {
        applicationId,
      },
    });

    return downloadUrl;
  }

  async canAdvanceToDecision(
    actor: AcademyActor,
    tenantId: string,
    applicationId: string,
  ): Promise<ChecklistCompletionStatus> {
    if (actor.tenantId !== tenantId) {
      throw new AcademyAuthorizationError(
        "Cross-tenant decision check forbidden.",
      );
    }

    const complete = await this.repository.canAdvanceToDecision(
      tenantId,
      applicationId,
    );

    if (complete) {
      return { complete: true, missingDocuments: [] };
    }

    const missingDocuments =
      await this.repository.getMissingRequiredDocuments(
        tenantId,
        applicationId,
      );

    return {
      complete: false,
      missingDocuments,
    };
  }
}

function getExtensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    default:
      throw new Error(`Unknown MIME type: ${mimeType}`);
  }
}
