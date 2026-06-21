import assert from "node:assert/strict";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { TranscriptService } from "@/modules/transcripts/service";
import type {
  TranscriptRecord,
  TranscriptRepository,
  TranscriptRequestInput,
} from "@/modules/transcripts/types";

const registrar: AcademyActor = {
  tenantId: "tenant-1",
  userId: "registrar-1",
  roles: ["registrar"],
};

const student: AcademyActor = {
  tenantId: "tenant-1",
  userId: "student-1",
  roles: ["student"],
};

const faculty: AcademyActor = {
  tenantId: "tenant-1",
  userId: "faculty-1",
  roles: ["faculty"],
};

function transcript(
  overrides: Partial<TranscriptRecord> = {},
): TranscriptRecord {
  return {
    id: "transcript-1",
    tenantId: "tenant-1",
    studentPersonId: "student-1",
    status: "requested",
    deliveryMethod: "digital_download",
    issuedAt: "2026-06-21T12:00:00.000Z",
    issuedByPersonId: "registrar-1",
    idempotencyKey: "idem-1",
    ...overrides,
  };
}

function repository(options: {
  hasPostedRecords?: boolean;
  hasActiveHold?: boolean;
} = {}) {
  const calls: string[] = [];
  const repo: TranscriptRepository = {
    async createRequest(input: TranscriptRequestInput) {
      calls.push(`request:${input.studentPersonId}`);
      return transcript({
        studentPersonId: input.studentPersonId,
        status: "requested",
        deliveryMethod: input.deliveryMethod,
        requestedByPersonId: input.requestedByPersonId,
      });
    },
    async issue(input) {
      calls.push(`issue:${input.studentPersonId}`);
      return transcript({
        studentPersonId: input.studentPersonId,
        status: "issued",
        deliveryMethod: input.deliveryMethod,
      });
    },
    async findByStudent() {
      return [];
    },
    async hold(tenantId, transcriptId, actorPersonId, reason) {
      calls.push(`hold:${transcriptId}:${actorPersonId}:${reason}`);
      return transcript({ tenantId, id: transcriptId, status: "held" });
    },
    async release(tenantId, transcriptId, actorPersonId, reason) {
      calls.push(`release:${transcriptId}:${actorPersonId}:${reason}`);
      return transcript({ tenantId, id: transcriptId, status: "released" });
    },
    async revoke(tenantId, transcriptId, actorPersonId, reason) {
      calls.push(`revoke:${transcriptId}:${actorPersonId}:${reason}`);
      return transcript({ tenantId, id: transcriptId, status: "revoked" });
    },
    async hasPostedTranscriptRecords() {
      return options.hasPostedRecords ?? true;
    },
    async hasActiveTranscriptHold() {
      return options.hasActiveHold ?? false;
    },
  };

  return { repo, calls };
}

test("student can request their own transcript without registrar authority", async () => {
  const { repo, calls } = repository();
  const service = new TranscriptService(repo);

  const result = await service.requestTranscript(student, {
    studentPersonId: "student-1",
    deliveryMethod: "digital_download",
    idempotencyKey: "request-1",
  });

  assert.equal(result.status, "requested");
  assert.deepEqual(calls, ["request:student-1"]);
});

test("student cannot request another student's transcript", async () => {
  const { repo, calls } = repository();
  const service = new TranscriptService(repo);

  await assert.rejects(
    () =>
      service.requestTranscript(student, {
        studentPersonId: "student-2",
        deliveryMethod: "digital_download",
        idempotencyKey: "request-1",
      }),
    /Students can request only their own transcripts/i,
  );

  assert.equal(calls.length, 0);
});

test("registrar can issue only when posted transcript records exist and no hold is active", async () => {
  const { repo, calls } = repository();
  const service = new TranscriptService(repo);

  const result = await service.issueTranscript(registrar, {
    studentPersonId: "student-1",
    deliveryMethod: "print",
    idempotencyKey: "issue-1",
  });

  assert.equal(result.status, "issued");
  assert.deepEqual(calls, ["issue:student-1"]);
});

test("registrar issuance rejects students without posted transcript records", async () => {
  const { repo, calls } = repository({ hasPostedRecords: false });
  const service = new TranscriptService(repo);

  await assert.rejects(
    () =>
      service.issueTranscript(registrar, {
        studentPersonId: "student-1",
        deliveryMethod: "print",
        idempotencyKey: "issue-1",
      }),
    /Posted transcript records are required/i,
  );

  assert.equal(calls.length, 0);
});

test("registrar issuance rejects active transcript holds", async () => {
  const { repo, calls } = repository({ hasActiveHold: true });
  const service = new TranscriptService(repo);

  await assert.rejects(
    () =>
      service.issueTranscript(registrar, {
        studentPersonId: "student-1",
        deliveryMethod: "print",
        idempotencyKey: "issue-1",
      }),
    /Transcript hold must be released/i,
  );

  assert.equal(calls.length, 0);
});

test("faculty cannot issue, hold, release, or revoke transcripts", async () => {
  const { repo, calls } = repository();
  const service = new TranscriptService(repo);

  await assert.rejects(
    () =>
      service.issueTranscript(faculty, {
        studentPersonId: "student-1",
        deliveryMethod: "print",
        idempotencyKey: "issue-1",
      }),
    /Forbidden transcript administration access/i,
  );
  await assert.rejects(
    () => service.holdTranscript(faculty, "transcript-1", "Financial hold."),
    /Forbidden transcript administration access/i,
  );
  await assert.rejects(
    () => service.releaseTranscript(faculty, "transcript-1", "Hold cleared."),
    /Forbidden transcript administration access/i,
  );
  await assert.rejects(
    () => service.revokeTranscript(faculty, "transcript-1", "Issued in error."),
    /Forbidden transcript administration access/i,
  );

  assert.equal(calls.length, 0);
});
