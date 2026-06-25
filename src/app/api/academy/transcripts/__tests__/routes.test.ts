import assert from "node:assert/strict";
import test from "node:test";
import {
  createTranscriptRequest,
  listTranscriptRequests,
} from "@/app/api/academy/transcripts/route";
import {
  transitionTranscriptRequest,
} from "@/app/api/academy/transcripts/[id]/revoke/route";
import { AcademyActor } from "@/modules/academy-auth/policy";
import {
  TranscriptDeliveryMethod,
  TranscriptRecord,
} from "@/modules/transcripts/types";

const student: AcademyActor = {
  userId: "person-student",
  tenantId: "tenant-1",
  roles: ["student"],
};

const registrar: AcademyActor = {
  userId: "person-registrar",
  tenantId: "tenant-1",
  roles: ["registrar"],
};

function transcript(overrides: Partial<TranscriptRecord> = {}): TranscriptRecord {
  return {
    id: "transcript-1",
    tenantId: "tenant-1",
    studentPersonId: "person-student",
    status: "requested",
    deliveryMethod: "digital_download",
    issuedAt: "2026-06-21T04:00:00.000Z",
    issuedByPersonId: "person-student",
    requestedByPersonId: "person-student",
    requestedAt: "2026-06-21T04:00:00.000Z",
    idempotencyKey: "idem-1",
    ...overrides,
  };
}

test("student transcript request infers the subject from the verified actor", async () => {
  const calls: unknown[] = [];
  const response = await createTranscriptRequest(
    new Request("http://localhost/api/academy/transcripts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "idem-request",
      },
      body: JSON.stringify({
        action: "request",
        deliveryMethod: "digital_download",
      }),
    }),
    {
      resolveActor: async () => student,
      serviceForActor: async () => ({
        requestTranscript: async (
          actor: AcademyActor,
          input: {
            studentPersonId: string;
            deliveryMethod: TranscriptDeliveryMethod;
            recipientName?: string;
            recipientEmail?: string;
            note?: string;
            idempotencyKey: string;
          },
        ) => {
          calls.push({ actor, input });
          return transcript({
            studentPersonId: input.studentPersonId,
            idempotencyKey: input.idempotencyKey,
          });
        },
      } as never),
      generatePdf: async () => null, // Mock PDF generation
    },
  );
  const body = await response.json() as TranscriptRecord;

  assert.equal(response.status, 200);
  assert.equal(body.studentPersonId, "person-student");
  assert.deepEqual(calls, [
    {
      actor: student,
      input: {
        studentPersonId: "person-student",
        deliveryMethod: "digital_download",
        recipientName: undefined,
        recipientEmail: undefined,
        note: undefined,
        idempotencyKey: "idem-request",
      },
    },
  ]);
});

test("transcript mutations require an idempotency key", async () => {
  const response = await createTranscriptRequest(
    new Request("http://localhost/api/academy/transcripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "request",
        deliveryMethod: "digital_download",
      }),
    }),
    {
      resolveActor: async () => student,
      serviceForActor: async () => {
        throw new Error("service should not be reached");
      },
      generatePdf: async () => null,
    },
  );

  assert.equal(response.status, 400);
});

test("student transcript list rejects another student's records", async () => {
  const response = await listTranscriptRequests(
    new Request("http://localhost/api/academy/transcripts?studentId=person-other"),
    {
      resolveActor: async () => student,
      findByStudent: async () => [transcript()],
      generatePdf: async () => null,
    },
  );

  assert.equal(response.status, 403);
});

test("registrar transcript list may read a student record set", async () => {
  const response = await listTranscriptRequests(
    new Request("http://localhost/api/academy/transcripts?studentId=person-student"),
    {
      resolveActor: async () => registrar,
      findByStudent: async (_actor, studentPersonId) => [
        transcript({ studentPersonId }),
      ],
      generatePdf: async () => null,
    },
  );
  const body = await response.json() as TranscriptRecord[];

  assert.equal(response.status, 200);
  assert.equal(body[0]?.studentPersonId, "person-student");
});

test("transition route dispatches hold, release, and revoke through the service", async () => {
  const actions: string[] = [];
  const params = { params: Promise.resolve({ id: "transcript-1" }) };
  const dependencies = {
    resolveActor: async () => registrar,
    serviceForActor: async () => ({
      holdTranscript: async (_actor: AcademyActor, id: string, reason: string) => {
        actions.push(`hold:${id}:${reason}`);
        return transcript({ id, status: "held" });
      },
      releaseTranscript: async (_actor: AcademyActor, id: string, reason: string) => {
        actions.push(`release:${id}:${reason}`);
        return transcript({ id, status: "released" });
      },
      revokeTranscript: async (_actor: AcademyActor, id: string, reason: string) => {
        actions.push(`revoke:${id}:${reason}`);
        return transcript({ id, status: "revoked" });
      },
    } as never),
  };

  await transitionTranscriptRequest(
    new Request("http://localhost/api/academy/transcripts/transcript-1/hold", {
      method: "POST",
      body: JSON.stringify({ reason: "Balance due." }),
    }),
    params,
    "hold",
    dependencies,
  );
  await transitionTranscriptRequest(
    new Request("http://localhost/api/academy/transcripts/transcript-1/release", {
      method: "POST",
      body: JSON.stringify({ reason: "Balance cleared." }),
    }),
    params,
    "release",
    dependencies,
  );
  await transitionTranscriptRequest(
    new Request("http://localhost/api/academy/transcripts/transcript-1/revoke", {
      method: "POST",
      body: JSON.stringify({ reason: "Issued in error." }),
    }),
    params,
    "revoke",
    dependencies,
  );

  assert.deepEqual(actions, [
    "hold:transcript-1:Balance due.",
    "release:transcript-1:Balance cleared.",
    "revoke:transcript-1:Issued in error.",
  ]);
});
