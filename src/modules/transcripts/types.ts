export type TranscriptStatus = "requested" | "held" | "issued" | "released" | "revoked";
export type TranscriptDeliveryMethod = "digital_download" | "email" | "print";

export interface TranscriptRequestInput {
  tenantId: string;
  studentPersonId: string;
  requestedByPersonId: string;
  deliveryMethod: TranscriptDeliveryMethod;
  recipientName?: string;
  recipientEmail?: string;
  note?: string;
  idempotencyKey: string;
}

export type TranscriptIssuanceRequest = TranscriptRequestInput;

export interface TranscriptRecord {
  id: string;
  tenantId: string;
  studentPersonId: string;
  status: TranscriptStatus;
  deliveryMethod: TranscriptDeliveryMethod;
  recipientName?: string;
  recipientEmail?: string;
  note?: string;
  issuedAt: string;
  issuedByPersonId: string;
  requestedByPersonId?: string;
  requestedAt?: string;
  holdReason?: string;
  heldAt?: string;
  releasedAt?: string;
  releasedByPersonId?: string;
  revokedAt?: string;
  revokedByPersonId?: string;
  idempotencyKey: string;
}

export interface TranscriptRepository {
  createRequest(input: TranscriptRequestInput): Promise<TranscriptRecord>;
  issue(input: TranscriptIssuanceRequest): Promise<TranscriptRecord>;
  findByStudent(tenantId: string, studentPersonId: string): Promise<TranscriptRecord[]>;
  hold(tenantId: string, transcriptId: string, heldByPersonId: string, reason: string): Promise<TranscriptRecord>;
  release(tenantId: string, transcriptId: string, releasedByPersonId: string, reason: string): Promise<TranscriptRecord>;
  revoke(tenantId: string, transcriptId: string, revokedByPersonId: string, reason: string): Promise<TranscriptRecord>;
  hasPostedTranscriptRecords(tenantId: string, studentPersonId: string): Promise<boolean>;
  hasActiveTranscriptHold(tenantId: string, studentPersonId: string): Promise<boolean>;
}

export const DELIVERY_METHODS: TranscriptDeliveryMethod[] = [
  "digital_download",
  "email",
  "print",
];

export function isValidDeliveryMethod(value: string): value is TranscriptDeliveryMethod {
  return (DELIVERY_METHODS as string[]).includes(value);
}

export function validateTranscriptRequest(
  input: Partial<TranscriptIssuanceRequest>,
): TranscriptIssuanceRequest {
  if (!input.tenantId?.trim()) throw new Error("tenantId is required.");
  if (!input.studentPersonId?.trim()) throw new Error("studentPersonId is required.");
  if (!input.requestedByPersonId?.trim()) throw new Error("requestedByPersonId is required.");
  if (!input.idempotencyKey?.trim()) throw new Error("idempotencyKey is required.");
  if (!input.deliveryMethod || !isValidDeliveryMethod(input.deliveryMethod)) {
    throw new Error(`deliveryMethod must be one of: ${DELIVERY_METHODS.join(", ")}.`);
  }
  if (input.deliveryMethod === "email" && !input.recipientEmail?.trim()) {
    throw new Error("recipientEmail is required for email delivery.");
  }

  return input as TranscriptIssuanceRequest;
}
