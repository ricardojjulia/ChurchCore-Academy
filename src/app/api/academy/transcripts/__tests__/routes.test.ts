import assert from "node:assert/strict";
import test from "node:test";
import {
  createTranscriptRequest,
  listTranscriptRequests,
} from "@/app/api/academy/transcripts/route";
import {
  GET as downloadTranscriptRequest,
} from "@/app/api/academy/transcripts/[id]/download/route";
import {
  transitionTranscriptRequest,
} from "@/app/api/academy/transcripts/[id]/revoke/route";
import { AcademyActor } from "@/modules/academy-auth/policy";
import {
  TranscriptDeliveryMethod,
  TranscriptRecord,
} from "@/modules/transcripts/types";
import type { TranscriptStorageClient } from "@/modules/transcripts/storage";

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

function downloadParams(id = "transcript-1") {
  return { params: Promise.resolve({ id }) };
}

function storageClient(options: {
  exists?: boolean;
  signedUrl?: string;
  calls?: string[];
} = {}): TranscriptStorageClient {
  const calls = options.calls ?? [];
  return {
    async upload(bucket, path, _buffer, contentType) {
      calls.push(`upload:${bucket}:${path}:${contentType}`);
    },
    async exists(bucket, path) {
      calls.push(`exists:${bucket}:${path}`);
      return options.exists ?? true;
    },
    async signedUrl(bucket, path, expiresInSeconds) {
      calls.push(`signedUrl:${bucket}:${path}:${expiresInSeconds}`);
      return options.signedUrl ?? `https://storage.example.com/${bucket}/${path}?ttl=${expiresInSeconds}`;
    },
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

test("student transcript download redirects to a fresh signed URL for own released transcript", async () => {
  const response = await downloadTranscriptRequest(
    new Request("http://localhost/api/academy/transcripts/transcript-1/download"),
    downloadParams(),
    {
      resolveActor: async () => student,
      findById: async () => transcript({ status: "released" }),
      storageClient: storageClient({
        signedUrl: "https://storage.example.com/signed-transcript.pdf",
      }),
    },
  );

  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get("location"),
    "https://storage.example.com/signed-transcript.pdf",
  );
});

test("student transcript download rejects another student's transcript", async () => {
  const response = await downloadTranscriptRequest(
    new Request("http://localhost/api/academy/transcripts/transcript-1/download"),
    downloadParams(),
    {
      resolveActor: async () => student,
      findById: async () =>
        transcript({ status: "released", studentPersonId: "person-other" }),
      storageClient: storageClient(),
    },
  );

  assert.equal(response.status, 403);
});

test("transcript download rejects held or issued transcript PDFs before storage access", async () => {
  for (const status of ["held", "issued"] as const) {
    const calls: string[] = [];
    const response = await downloadTranscriptRequest(
      new Request("http://localhost/api/academy/transcripts/transcript-1/download"),
      downloadParams(),
      {
        resolveActor: async () => registrar,
        findById: async () => transcript({ status }),
        storageClient: storageClient({ calls }),
      },
    );

    assert.equal(response.status, 403);
    assert.deepEqual(calls, []);
  }
});

test("released transcript download generates and stores a missing PDF on demand", async () => {
  const calls: string[] = [];
  const updates: string[] = [];
  const response = await downloadTranscriptRequest(
    new Request("http://localhost/api/academy/transcripts/transcript-1/download"),
    downloadParams(),
    {
      resolveActor: async () => registrar,
      findById: async () => transcript({ status: "released" }),
      storageClient: storageClient({ exists: false, calls }),
      buildPdfData: async () => ({
        institution: {
          tenantId: "tenant-1",
          institutionName: "Faith Academy",
        },
        studentName: "Person Student",
        studentId: "person-student",
        programName: "Bible Studies",
        cumulativeGpa: null,
        creditsEarned: 0,
        issuanceId: "transcript-1",
        issuanceDate: "2026-06-21",
        gradeRows: [],
      }),
      generatePdf: async () => ({
        path: "tenant-1/person-student/transcript-1.pdf",
        signedUrl: "https://storage.example.com/generated-transcript.pdf",
      }),
      updateStorageUrl: async (
        _actor: AcademyActor,
        transcriptId: string,
        path: string,
      ) => {
        updates.push(`${transcriptId}:${path}`);
      },
    },
  );

  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get("location"),
    "https://storage.example.com/generated-transcript.pdf",
  );
  assert.deepEqual(calls, [
    "exists:transcripts:tenant-1/person-student/transcript-1.pdf",
  ]);
  assert.deepEqual(updates, [
    "transcript-1:tenant-1/person-student/transcript-1.pdf",
  ]);
});
