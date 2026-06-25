import {
  renderTranscriptPdfBuffer,
  type TranscriptPdfData,
} from "./pdf-generator";

export type TranscriptStorageClient = {
  upload(
    bucket: string,
    path: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void>;
  exists(bucket: string, path: string): Promise<boolean>;
  signedUrl(
    bucket: string,
    path: string,
    expiresInSeconds: number,
  ): Promise<string>;
};

const TRANSCRIPT_BUCKET = "transcripts";
const SIGNED_URL_TTL_SECONDS = 900; // 15 minutes

export function buildTranscriptStoragePath(
  tenantId: string,
  studentPersonId: string,
  issuanceId: string,
): string {
  return `${tenantId}/${studentPersonId}/${issuanceId}.pdf`;
}

export async function generateTranscriptPdf(
  data: TranscriptPdfData,
  issuanceId: string,
  storage: TranscriptStorageClient,
): Promise<{ path: string; signedUrl: string }> {
  const path = buildTranscriptStoragePath(
    data.institution.tenantId ?? "",
    data.studentId,
    issuanceId,
  );

  // Idempotency: if PDF already exists, skip generation
  const fileExists = await storage.exists(TRANSCRIPT_BUCKET, path);

  if (!fileExists) {
    const buffer = await renderTranscriptPdfBuffer(data);
    await storage.upload(TRANSCRIPT_BUCKET, path, buffer, "application/pdf");
  }

  const signedUrl = await storage.signedUrl(
    TRANSCRIPT_BUCKET,
    path,
    SIGNED_URL_TTL_SECONDS,
  );

  return { path, signedUrl };
}

export async function getTranscriptSignedUrl(
  tenantId: string,
  studentPersonId: string,
  issuanceId: string,
  issuanceStatus: string,
  storage: TranscriptStorageClient,
): Promise<string | null> {
  // Only released transcripts are downloadable
  if (issuanceStatus !== "released") {
    return null;
  }

  const path = buildTranscriptStoragePath(tenantId, studentPersonId, issuanceId);

  // Check if file exists
  const fileExists = await storage.exists(TRANSCRIPT_BUCKET, path);
  if (!fileExists) {
    return null;
  }

  return storage.signedUrl(TRANSCRIPT_BUCKET, path, SIGNED_URL_TTL_SECONDS);
}
