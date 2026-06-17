export type TranscriptStatus = "draft" | "issued" | "revoked";
export type TranscriptDeliveryMethod = "digital_download" | "email" | "print";

export interface TranscriptIssuanceRequest {
  tenantId: string;
  studentPersonId: string;
  requestedByPersonId: string;
  deliveryMethod: TranscriptDeliveryMethod;
  recipientName?: string;
  recipientEmail?: string;
  note?: string;
  idempotencyKey: string;
}

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
  revokedAt?: string;
  idempotencyKey: string;
}

export interface TranscriptRepository {
  issue(input: TranscriptIssuanceRequest): Promise<TranscriptRecord>;
  findByStudent(tenantId: string, studentPersonId: string): Promise<TranscriptRecord[]>;
  revoke(tenantId: string, transcriptId: string, revokedByPersonId: string): Promise<TranscriptRecord>;
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
