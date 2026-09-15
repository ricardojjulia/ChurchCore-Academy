import { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { AdmissionApplication } from "@/modules/admissions/types";

export type DocumentItemStatus =
  | "pending"
  | "uploaded"
  | "reviewed"
  | "resubmission_required";

export interface ProgramDocumentRequirement {
  id: string;
  tenantId: string;
  programId: string;
  label: string;
  description?: string;
  isRequired: boolean;
  displayOrder: number;
}

export interface ApplicationDocumentItem {
  id: string;
  tenantId: string;
  applicationId: string;
  requirementId: string;
  label: string;
  isRequired: boolean;
  status: DocumentItemStatus;
  storagePath?: string;
  storageFilename?: string;
  officerNote?: string;
  reviewedByPersonId?: string;
  reviewedAt?: string;
  uploadedAt?: string;
}

export interface ApplicationChecklistView {
  items: ApplicationDocumentItem[];
  completionPct: number;
}

export interface CreateProgramRequirementInput {
  programId: string;
  label: string;
  description?: string;
  isRequired: boolean;
  displayOrder?: number;
}

export interface ConfirmDocumentUploadInput {
  documentItemId: string;
  storagePath: string;
  storageFilename: string;
  contentType: string;
  fileSizeBytes: number;
}

export interface ConfirmDocumentUploadResult {
  item: ApplicationDocumentItem;
  oldStoragePath?: string;
}

export interface ReviewDocumentItemInput {
  documentItemId: string;
  decision: "reviewed" | "resubmission_required";
  officerNote?: string;
}

export interface DocumentStorageClient {
  generateSignedUploadUrl(
    path: string,
    expiresInSeconds: number,
  ): Promise<string>;
  delete(path: string): Promise<void>;
  generateSignedDownloadUrl(
    path: string,
    expiresInSeconds: number,
  ): Promise<string>;
}

interface DocumentChecklistRepository {
  programBelongsToTenant(tenantId: string, programId: string): Promise<boolean>;
  findProgramRequirementById(
    tenantId: string,
    requirementId: string,
  ): Promise<ProgramDocumentRequirement | undefined>;
  listProgramRequirements(
    tenantId: string,
    programId: string,
  ): Promise<ProgramDocumentRequirement[]>;
  createProgramRequirement(
    tenantId: string,
    input: CreateProgramRequirementInput,
  ): Promise<ProgramDocumentRequirement>;
  deleteProgramRequirement(
    tenantId: string,
    requirementId: string,
  ): Promise<void>;
  countApplicationsUsingRequirement(
    tenantId: string,
    requirementId: string,
  ): Promise<number>;
  findApplicationDocumentItemById(
    tenantId: string,
    documentItemId: string,
  ): Promise<ApplicationDocumentItem | undefined>;
  listApplicationDocumentItems(
    tenantId: string,
    applicationId: string,
  ): Promise<ApplicationDocumentItem[]>;
  createApplicationDocumentItems(
    tenantId: string,
    applicationId: string,
    requirements: ProgramDocumentRequirement[],
  ): Promise<ApplicationDocumentItem[]>;
  updateDocumentItemUpload(
    tenantId: string,
    documentItemId: string,
    storagePath: string,
    storageFilename: string,
    uploadedAt: string,
  ): Promise<ApplicationDocumentItem>;
  updateDocumentItemReview(
    tenantId: string,
    documentItemId: string,
    status: DocumentItemStatus,
    reviewedByPersonId: string,
    reviewedAt: string,
    officerNote?: string,
  ): Promise<ApplicationDocumentItem>;
  findApplicationByDocumentItemId(
    tenantId: string,
    documentItemId: string,
  ): Promise<AdmissionApplication | undefined>;
}

const staffRoles = new Set([
  "admissions",
  "registrar",
  "academic_admin",
  "institution_admin",
]);

function assertProgramRequirementAccess(actor: AcademyActor, tenantId: string) {
  if (actor.tenantId !== tenantId) {
    throw new AcademyAuthorizationError(
      "Forbidden cross-tenant program requirement access.",
    );
  }
  if (!actor.roles.some((role) => staffRoles.has(role))) {
    throw new AcademyAuthorizationError(
      "Forbidden program requirement access.",
    );
  }
}

function assertDocumentReviewAccess(actor: AcademyActor, tenantId: string) {
  if (actor.tenantId !== tenantId) {
    throw new AcademyAuthorizationError(
      "Forbidden cross-tenant document review access.",
    );
  }
  if (!actor.roles.some((role) => staffRoles.has(role))) {
    throw new AcademyAuthorizationError("Forbidden document review access.");
  }
}

function assertDocumentReadAccess(
  actor: AcademyActor,
  application: AdmissionApplication,
) {
  if (actor.tenantId !== application.tenantId) {
    throw new AcademyAuthorizationError(
      "Forbidden cross-tenant document access.",
    );
  }
  const isStaff = actor.roles.some((role) => staffRoles.has(role));
  const isApplicant =
    actor.roles.includes("applicant") &&
    actor.userId === application.applicantPersonId;
  if (!isStaff && !isApplicant) {
    throw new AcademyAuthorizationError("Forbidden document access.");
  }
}

function assertApplicantDocumentUpload(
  actor: AcademyActor,
  application: AdmissionApplication,
) {
  if (actor.tenantId !== application.tenantId) {
    throw new AcademyAuthorizationError(
      "Forbidden cross-tenant document upload.",
    );
  }
  if (
    !actor.roles.includes("applicant") ||
    actor.userId !== application.applicantPersonId
  ) {
    throw new AcademyAuthorizationError("Forbidden document upload.");
  }
}

export class DocumentChecklistService {
  constructor(
    private readonly repository: DocumentChecklistRepository,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async createProgramRequirement(
    actor: AcademyActor,
    input: CreateProgramRequirementInput,
  ) {
    assertProgramRequirementAccess(actor, actor.tenantId);
    const belongs = await this.repository.programBelongsToTenant(
      actor.tenantId,
      input.programId,
    );
    if (!belongs) {
      throw new AcademyAuthorizationError(
        "Forbidden cross-tenant program requirement access.",
      );
    }
    return this.repository.createProgramRequirement(actor.tenantId, input);
  }

  async listProgramRequirements(actor: AcademyActor, programId: string) {
    if (actor.tenantId !== actor.tenantId) {
      throw new AcademyAuthorizationError(
        "Forbidden cross-tenant program requirements access.",
      );
    }
    return this.repository.listProgramRequirements(actor.tenantId, programId);
  }

  async deleteProgramRequirement(actor: AcademyActor, requirementId: string) {
    assertProgramRequirementAccess(actor, actor.tenantId);
    const count = await this.repository.countApplicationsUsingRequirement(
      actor.tenantId,
      requirementId,
    );
    if (count > 0) {
      throw new Error(
        "Cannot delete program requirement: it is used by existing applications.",
      );
    }
    await this.repository.deleteProgramRequirement(
      actor.tenantId,
      requirementId,
    );
  }

  async snapshotChecklistForApplication(
    actor: AcademyActor,
    applicationId: string,
    programId: string,
  ) {
    if (actor.tenantId !== actor.tenantId) {
      throw new AcademyAuthorizationError(
        "Forbidden cross-tenant checklist snapshot.",
      );
    }
    const existingItems = await this.repository.listApplicationDocumentItems(
      actor.tenantId,
      applicationId,
    );
    if (existingItems.length > 0) {
      return existingItems;
    }
    const requirements = await this.repository.listProgramRequirements(
      actor.tenantId,
      programId,
    );
    if (requirements.length === 0) {
      return [];
    }
    return this.repository.createApplicationDocumentItems(
      actor.tenantId,
      applicationId,
      requirements,
    );
  }

  async getApplicationChecklist(
    actor: AcademyActor,
    applicationId: string,
  ): Promise<ApplicationChecklistView> {
    const items = await this.repository.listApplicationDocumentItems(
      actor.tenantId,
      applicationId,
    );
    if (items.length === 0) {
      return { items: [], completionPct: 100 };
    }
    if (items.length > 0 && items[0].tenantId !== actor.tenantId) {
      throw new AcademyAuthorizationError(
        "Forbidden cross-tenant checklist access.",
      );
    }
    const application =
      await this.repository.findApplicationByDocumentItemId(
        actor.tenantId,
        items[0].id,
      );
    if (!application) {
      throw new Error("Application not found for checklist items.");
    }
    assertDocumentReadAccess(actor, application);

    const requiredItems = items.filter((item) => item.isRequired);
    const reviewedRequiredItems = requiredItems.filter(
      (item) => item.status === "reviewed",
    );
    const completionPct =
      requiredItems.length === 0
        ? 100
        : Math.round(
            (reviewedRequiredItems.length / requiredItems.length) * 100,
          );
    return { items, completionPct };
  }

  async confirmDocumentUpload(
    actor: AcademyActor,
    input: ConfirmDocumentUploadInput,
  ): Promise<ConfirmDocumentUploadResult> {
    if (input.contentType !== "application/pdf") {
      throw new Error("Only PDF documents are accepted.");
    }
    const maxSizeBytes = 10 * 1024 * 1024;
    if (input.fileSizeBytes > maxSizeBytes) {
      throw new Error("Document file size exceeds the 10MB limit.");
    }
    const item = await this.repository.findApplicationDocumentItemById(
      actor.tenantId,
      input.documentItemId,
    );
    if (!item) {
      throw new Error("Document item not found.");
    }
    const application =
      await this.repository.findApplicationByDocumentItemId(
        actor.tenantId,
        input.documentItemId,
      );
    if (!application) {
      throw new Error("Application not found for document item.");
    }
    assertApplicantDocumentUpload(actor, application);

    const oldStoragePath = item.storagePath;
    const updatedItem = await this.repository.updateDocumentItemUpload(
      actor.tenantId,
      input.documentItemId,
      input.storagePath,
      input.storageFilename,
      this.now(),
    );
    return { item: updatedItem, oldStoragePath };
  }

  async reviewDocumentItem(
    actor: AcademyActor,
    input: ReviewDocumentItemInput,
  ): Promise<ApplicationDocumentItem> {
    const item = await this.repository.findApplicationDocumentItemById(
      actor.tenantId,
      input.documentItemId,
    );
    if (!item) {
      throw new Error("Document item not found.");
    }
    assertDocumentReviewAccess(actor, item.tenantId);

    return this.repository.updateDocumentItemReview(
      actor.tenantId,
      input.documentItemId,
      input.decision,
      actor.userId,
      this.now(),
      input.officerNote,
    );
  }

  async getSignedDownloadUrl(
    actor: AcademyActor,
    documentItemId: string,
    storageClient: DocumentStorageClient,
  ): Promise<string> {
    const item = await this.repository.findApplicationDocumentItemById(
      actor.tenantId,
      documentItemId,
    );
    if (!item) {
      throw new Error("Document item not found.");
    }
    if (!item.storagePath) {
      throw new Error("Document has not been uploaded yet.");
    }
    const application =
      await this.repository.findApplicationByDocumentItemId(
        actor.tenantId,
        documentItemId,
      );
    if (!application) {
      throw new Error("Application not found for document item.");
    }
    assertDocumentReadAccess(actor, application);

    return storageClient.generateSignedDownloadUrl(item.storagePath, 900);
  }
}
