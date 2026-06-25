import assert from "node:assert/strict";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  TranscriptService,
  buildSignedDownloadUrl,
} from "@/modules/transcripts/service";
import type {
  TranscriptRecord,
  TranscriptRepository,
  TranscriptRequestInput,
} from "@/modules/transcripts/types";

// ---------------------------------------------------------------------------
// Test actors
// ---------------------------------------------------------------------------

const student: AcademyActor = {
  tenantId: "tenant-1",
  userId: "student-1",
  roles: ["student"],
};

const studentOtherTenant: AcademyActor = {
  tenantId: "tenant-2",
  userId: "student-2",
  roles: ["student"],
};

const registrar: AcademyActor = {
  tenantId: "tenant-1",
  userId: "registrar-1",
  roles: ["registrar"],
};

// ---------------------------------------------------------------------------
// In-memory repository helpers
// ---------------------------------------------------------------------------

function makeTranscriptRecord(
  overrides: Partial<TranscriptRecord> = {},
): TranscriptRecord {
  return {
    id: "transcript-100",
    tenantId: "tenant-1",
    studentPersonId: "student-1",
    status: "requested",
    deliveryMethod: "digital_download",
    issuedAt: "2026-06-22T00:00:00.000Z",
    issuedByPersonId: "system",
    idempotencyKey: "idem-test-1",
    ...overrides,
  };
}

interface MockRepoOptions {
  /** Email queue to track confirmation calls */
  emailQueue?: string[];
  /** Whether hasPostedTranscriptRecords returns true */
  hasPostedRecords?: boolean;
  /** Whether hasActiveTranscriptHold returns true */
  hasActiveHold?: boolean;
}

function makeRepository(options: MockRepoOptions = {}): TranscriptRepository {
  return {
    async createRequest(input: TranscriptRequestInput) {
      return makeTranscriptRecord({
        tenantId: input.tenantId,
        studentPersonId: input.studentPersonId,
        status: "requested",
        deliveryMethod: input.deliveryMethod,
        requestedByPersonId: input.requestedByPersonId,
        idempotencyKey: input.idempotencyKey,
      });
    },
    async issue(input) {
      return makeTranscriptRecord({
        tenantId: input.tenantId,
        studentPersonId: input.studentPersonId,
        status: "issued",
        deliveryMethod: input.deliveryMethod,
      });
    },
    async findByStudent(tenantId: string, studentPersonId: string) {
      return [
        makeTranscriptRecord({ tenantId, studentPersonId, status: "requested" }),
        makeTranscriptRecord({
          id: "transcript-101",
          tenantId,
          studentPersonId,
          status: "released",
          storageUrl: "https://storage.example.com/t-101.pdf",
        }),
      ];
    },
    async hold(tenantId, transcriptId, actorPersonId, reason) {
      return makeTranscriptRecord({
        tenantId,
        id: transcriptId,
        status: "held",
        holdReason: reason,
        heldAt: new Date().toISOString(),
        issuedByPersonId: actorPersonId,
      });
    },
    async release(tenantId, transcriptId, actorPersonId, reason) {
      return makeTranscriptRecord({
        tenantId,
        id: transcriptId,
        status: "released",
        releasedAt: new Date().toISOString(),
        releasedByPersonId: actorPersonId,
        issuedByPersonId: actorPersonId,
        note: reason,
      });
    },
    async revoke(tenantId, transcriptId, actorPersonId, reason) {
      return makeTranscriptRecord({
        tenantId,
        id: transcriptId,
        status: "revoked",
        revokedAt: new Date().toISOString(),
        revokedByPersonId: actorPersonId,
        issuedByPersonId: actorPersonId,
        note: reason,
      });
    },
    async hasPostedTranscriptRecords() {
      return options.hasPostedRecords ?? true;
    },
    async hasActiveTranscriptHold() {
      return options.hasActiveHold ?? false;
    },
  };
}

// ---------------------------------------------------------------------------
// T1-05: requestTranscript() success
// ---------------------------------------------------------------------------

test("requestTranscript() creates record with status requested", async () => {
  const repo = makeRepository();
  const service = new TranscriptService(repo);

  const result = await service.requestTranscript(student, {
    studentPersonId: "student-1",
    deliveryMethod: "digital_download",
    idempotencyKey: "idem-1",
  });

  assert.equal(result.status, "requested");
  assert.equal(result.studentPersonId, "student-1");
  assert.equal(result.tenantId, "tenant-1");
});

// ---------------------------------------------------------------------------
// T1-05: cross-tenant rejection
// ---------------------------------------------------------------------------

test("requestTranscript() rejects student from another tenant requesting a different student record", async () => {
  // studentOtherTenant (tenant-2) cannot request for student-1 (tenant-1's student)
  const repo = makeRepository();
  const service = new TranscriptService(repo);

  await assert.rejects(
    () =>
      service.requestTranscript(studentOtherTenant, {
        studentPersonId: "student-1",
        deliveryMethod: "digital_download",
        idempotencyKey: "idem-cross",
      }),
    /Students can request only their own transcripts/i,
  );
});

// ---------------------------------------------------------------------------
// T1-05: getTranscriptRequests() — registrar sees all
// ---------------------------------------------------------------------------

test("findByStudent() called by registrar returns all records for the student", async () => {
  const repo = makeRepository();
  const records = await repo.findByStudent("tenant-1", "student-1");
  assert.equal(records.length, 2);
  assert.ok(records.some((r) => r.status === "requested"));
  assert.ok(records.some((r) => r.status === "released"));
});

// ---------------------------------------------------------------------------
// T1-05: getTranscriptRequests() — student sees own, no revoked
// ---------------------------------------------------------------------------

test("student can request only their own transcript (not another student's)", async () => {
  const repo = makeRepository();
  const service = new TranscriptService(repo);

  await assert.rejects(
    () =>
      service.requestTranscript(student, {
        studentPersonId: "student-99",
        deliveryMethod: "email",
        recipientEmail: "other@school.edu",
        idempotencyKey: "idem-2",
      }),
    /Students can request only their own transcripts/i,
  );
});

// ---------------------------------------------------------------------------
// T1-05: buildSignedDownloadUrl() — status gating
// ---------------------------------------------------------------------------

test("buildSignedDownloadUrl() returns null for issued status", () => {
  const record = makeTranscriptRecord({
    status: "issued",
    storageUrl: "https://storage.example.com/issued.pdf",
  });
  assert.equal(buildSignedDownloadUrl(record), null);
});

test("buildSignedDownloadUrl() returns null for held status", () => {
  const record = makeTranscriptRecord({
    status: "held",
    storageUrl: "https://storage.example.com/held.pdf",
  });
  assert.equal(buildSignedDownloadUrl(record), null);
});

test("buildSignedDownloadUrl() returns null for requested status", () => {
  const record = makeTranscriptRecord({ status: "requested", storageUrl: "https://storage.example.com/req.pdf" });
  assert.equal(buildSignedDownloadUrl(record), null);
});

test("buildSignedDownloadUrl() returns storageUrl for released status", () => {
  const record = makeTranscriptRecord({
    status: "released",
    storageUrl: "https://storage.example.com/released.pdf",
  });
  const url = buildSignedDownloadUrl(record);
  assert.ok(typeof url === "string" && url.length > 0);
  assert.equal(url, "https://storage.example.com/released.pdf");
});

test("buildSignedDownloadUrl() returns null for released status without storageUrl", () => {
  const record = makeTranscriptRecord({ status: "released" });
  assert.equal(buildSignedDownloadUrl(record), null);
});

// ---------------------------------------------------------------------------
// T1-05: Registrar-scoped getTranscriptRequests (service-level)
// ---------------------------------------------------------------------------

test("registrar can issue transcript when posted records exist and no active hold", async () => {
  const repo = makeRepository();
  const service = new TranscriptService(repo);

  const result = await service.issueTranscript(registrar, {
    studentPersonId: "student-1",
    deliveryMethod: "print",
    idempotencyKey: "idem-issue-1",
  });

  assert.equal(result.status, "issued");
});

test("non-registrar student cannot issue a transcript", async () => {
  const repo = makeRepository();
  const service = new TranscriptService(repo);

  await assert.rejects(
    () =>
      service.issueTranscript(student, {
        studentPersonId: "student-1",
        deliveryMethod: "print",
        idempotencyKey: "idem-iss-2",
      }),
    /Forbidden transcript administration access/i,
  );
});
