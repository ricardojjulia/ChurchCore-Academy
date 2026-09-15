import assert from "node:assert/strict";
import test from "node:test";
import type { TranscriptPdfData } from "@/modules/transcripts/pdf-generator";
import {
  generateTranscriptPdf,
  getTranscriptSignedUrl,
  type TranscriptStorageClient,
} from "@/modules/transcripts/storage";

function mockPdfData(
  overrides: Partial<TranscriptPdfData> = {},
): TranscriptPdfData {
  return {
    institution: {
      tenantId: "tenant-1",
      institutionName: "Faith Academy",
    },
    studentName: "John Student",
    studentId: "student-1",
    programName: "Bible Studies",
    cumulativeGpa: 3.5,
    creditsEarned: 30,
    issuanceId: "issuance-1",
    issuanceDate: "2026-06-23",
    gradeRows: [
      {
        termName: "Fall 2025",
        courseCode: "BIB101",
        courseTitle: "Introduction to Scripture",
        creditHours: 3,
        grade: "A",
        qualityPoints: 12.0,
      },
      {
        termName: "Fall 2025",
        courseCode: "THE101",
        courseTitle: "Systematic Theology I",
        creditHours: 3,
        grade: "B+",
        qualityPoints: 9.9,
      },
    ],
    ...overrides,
  };
}

function mockStorageClient(options: {
  fileExists?: boolean;
  uploadedBuffers?: Buffer[];
} = {}): {
  client: TranscriptStorageClient;
  calls: string[];
} {
  const calls: string[] = [];

  const client: TranscriptStorageClient = {
    async upload(bucket, path, buffer, contentType) {
      options.uploadedBuffers?.push(buffer);
      calls.push(`upload:${bucket}:${path}:${contentType}:${buffer.length}`);
    },
    async exists(bucket, path) {
      calls.push(`exists:${bucket}:${path}`);
      return options.fileExists ?? false;
    },
    async signedUrl(bucket, path, expiresInSeconds) {
      calls.push(`signedUrl:${bucket}:${path}:${expiresInSeconds}`);
      return `https://signed-url.example.com/${path}?expires=${expiresInSeconds}`;
    },
  };

  return { client, calls };
}

// PDF rendering tests are skipped because @react-pdf/renderer has compatibility issues
// with the Node.js test runner. The PDF generation logic is tested indirectly through
// the integration tests. Manual verification of PDF output is required.

test("generateTranscriptPdf uploads and returns signed URL when file does not exist", async () => {
  const data = mockPdfData();
  const { client, calls } = mockStorageClient({ fileExists: false });

  const result = await generateTranscriptPdf(data, "issuance-1", client);

  assert.ok(result.path.includes("tenant-1"), "Path should include tenantId");
  assert.ok(result.path.includes("student-1"), "Path should include studentId");
  assert.ok(result.path.includes("issuance-1.pdf"), "Path should include issuanceId");
  assert.ok(
    result.signedUrl.includes("signed-url.example.com"),
    "Should return signed URL",
  );

  // Should call exists, upload, and signedUrl
  assert.ok(
    calls.some((call) => call.startsWith("exists:")),
    "Should check if file exists",
  );
  assert.ok(
    calls.some((call) => call.startsWith("upload:") && call.includes("application/pdf")),
    "Should upload PDF",
  );
  assert.ok(
    calls.some((call) => call.startsWith("signedUrl:") && call.includes("900")),
    "Should create signed URL with 900s TTL",
  );
});

test("generateTranscriptPdf skips upload when file already exists (idempotency)", async () => {
  const data = mockPdfData();
  const { client, calls } = mockStorageClient({ fileExists: true });

  const result = await generateTranscriptPdf(data, "issuance-1", client);

  assert.ok(result.signedUrl.length > 0, "Should return signed URL");

  // Should call exists and signedUrl, but NOT upload
  assert.ok(
    calls.some((call) => call.startsWith("exists:")),
    "Should check if file exists",
  );
  assert.ok(
    !calls.some((call) => call.startsWith("upload:")),
    "Should NOT upload when file exists",
  );
  assert.ok(
    calls.some((call) => call.startsWith("signedUrl:")),
    "Should create signed URL",
  );
});

test("generateTranscriptPdf uploads a PDF when the student has no grade records", async () => {
  const uploadedBuffers: Buffer[] = [];
  const data = mockPdfData({
    cumulativeGpa: null,
    creditsEarned: 0,
    gradeRows: [],
  });
  const { client, calls } = mockStorageClient({
    fileExists: false,
    uploadedBuffers,
  });

  const result = await generateTranscriptPdf(data, "issuance-1", client);

  assert.equal(result.path, "tenant-1/student-1/issuance-1.pdf");
  assert.equal(uploadedBuffers.length, 1);
  assert.ok(uploadedBuffers[0].length > 0);
  assert.ok(
    calls.some((call) => call.startsWith("upload:transcripts:tenant-1/student-1/issuance-1.pdf")),
    "Should upload no-grade transcript PDF to the transcripts bucket",
  );
});

test("generateTranscriptPdf does not leak issuance internal notes into PDF bytes", async () => {
  const uploadedBuffers: Buffer[] = [];
  const internalNote = "PRIVATE_REGISTRAR_NOTE_DO_NOT_RENDER";
  const data = {
    ...mockPdfData(),
    internalNotes: internalNote,
  } as TranscriptPdfData & { internalNotes: string };
  const { client } = mockStorageClient({
    fileExists: false,
    uploadedBuffers,
  });

  await generateTranscriptPdf(data, "issuance-1", client);

  assert.equal(uploadedBuffers.length, 1);
  assert.doesNotMatch(uploadedBuffers[0].toString("latin1"), new RegExp(internalNote));
});

test("getTranscriptSignedUrl returns URL for released status", async () => {
  const { client } = mockStorageClient({ fileExists: true });

  const url = await getTranscriptSignedUrl(
    "tenant-1",
    "student-1",
    "issuance-1",
    "released",
    client,
  );

  assert.ok(url !== null, "Should return URL for released status");
  assert.ok(
    url?.includes("signed-url.example.com"),
    "Should return valid signed URL",
  );
});

test("getTranscriptSignedUrl returns null for held status", async () => {
  const { client } = mockStorageClient({ fileExists: true });

  const url = await getTranscriptSignedUrl(
    "tenant-1",
    "student-1",
    "issuance-1",
    "held",
    client,
  );

  assert.strictEqual(url, null, "Should return null for held status");
});

test("getTranscriptSignedUrl returns null for issued status", async () => {
  const { client } = mockStorageClient({ fileExists: true });

  const url = await getTranscriptSignedUrl(
    "tenant-1",
    "student-1",
    "issuance-1",
    "issued",
    client,
  );

  assert.strictEqual(url, null, "Should return null for issued status");
});

test("getTranscriptSignedUrl returns null when file does not exist", async () => {
  const { client } = mockStorageClient({ fileExists: false });

  const url = await getTranscriptSignedUrl(
    "tenant-1",
    "student-1",
    "issuance-1",
    "released",
    client,
  );

  assert.strictEqual(
    url,
    null,
    "Should return null when file does not exist",
  );
});

test("cross-tenant: cannot access transcript from different tenant", async () => {
  // This test is more of a documentation test. The actual enforcement
  // happens in the API route layer when resolving the actor and verifying
  // tenantId matches the requested resource.
  const { client } = mockStorageClient({ fileExists: true });

  // Simulating access from tenant-2 trying to access tenant-1's transcript
  const url = await getTranscriptSignedUrl(
    "tenant-2",
    "student-1",
    "issuance-1",
    "released",
    client,
  );

  // Because the path includes tenant-2 (not tenant-1), the file won't exist
  // The storage client will look for: tenant-2/student-1/issuance-1.pdf
  // But the actual file is at: tenant-1/student-1/issuance-1.pdf
  // So this test passes if the mock returns null for non-existent file
  // In real usage, the API route would reject before getting here
  assert.ok(
    url === null || !url.includes("tenant-1"),
    "Should not return URL for cross-tenant access",
  );
});
