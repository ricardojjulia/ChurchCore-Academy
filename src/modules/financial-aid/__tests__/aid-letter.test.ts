import assert from "node:assert/strict";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError, AcademyConflictError } from "@/modules/academy-auth/errors";
import {
  generateAidAwardLetterPdf,
  recordStudentAidDecision,
  getAidLetterSignedUrl,
  LetterStorageClient,
  LetterDatabaseClient,
} from "@/modules/financial-aid/aid-letter-service";

const TENANT = "tenant-1";
const PACKAGE_ID = "pkg-1";
const STUDENT_ID = "student-person-1";

const financeActor: AcademyActor = { userId: "finance-1", tenantId: TENANT, roles: ["finance"] };
const studentActor: AcademyActor = { userId: STUDENT_ID, tenantId: TENANT, roles: ["student"] };
const otherStudentActor: AcademyActor = { userId: "other-student", tenantId: TENANT, roles: ["student"] };

function buildStorage(fileExists = false) {
  const storage = {
    uploaded: false,
    uploadedPath: undefined as string | undefined,
    async upload(_bucket: string, path: string, _buffer: Buffer, _contentType: string) {
      storage.uploaded = true;
      storage.uploadedPath = path;
    },
    async exists(_bucket: string, _path: string) {
      return fileExists;
    },
    async signedUrl(_bucket: string, path: string, _ttl: number) {
      return `https://storage.example.com/${path}?token=test`;
    },
  };
  return storage;
}

function buildDb(overrides: {
  packageExists?: boolean;
  hasAwards?: boolean;
  letterStatus?: "not_generated" | "generated";
  storagePath?: string | null;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  deadline?: string | null;
  studentPersonId?: string;
} = {}): LetterDatabaseClient {
  const o = {
    packageExists: true,
    hasAwards: true,
    letterStatus: "not_generated" as const,
    storagePath: null as string | null,
    acceptedAt: null as string | null,
    declinedAt: null as string | null,
    deadline: null as string | null,
    studentPersonId: STUDENT_ID,
    ...overrides,
  };

  return {
    async query(text: string, _values?: unknown[]) {
      // Idempotency check
      if (text.includes("award_letter_storage_path") && text.includes("letter_status") && text.includes("tenant_id")) {
        if (!o.packageExists) return { rows: [] };
        return {
          rows: [{
            award_letter_storage_path: o.storagePath,
            letter_status: o.letterStatus,
          }],
        };
      }
      // Package + student data query
      if (text.includes("academy_people") && text.includes("display_name")) {
        if (!o.packageExists) return { rows: [] };
        return {
          rows: [{
            id: PACKAGE_ID,
            student_person_id: o.studentPersonId,
            aid_year: "2026-2027",
            student_name: "Jordan Student",
            student_id: "S-10001",
            program_id: "prog-1",
          }],
        };
      }
      // Awards query
      if (text.includes("academy_aid_awards") && text.includes("package_id")) {
        if (!o.hasAwards) return { rows: [] };
        return {
          rows: [{
            award_type: "scholarship",
            amount_cents: 500000,
            description: "Academic Scholarship",
          }],
        };
      }
      // Institution query
      if (text.includes("institution_name")) {
        return { rows: [{ institution_name: "Faith Seminary" }] };
      }
      // Program name
      if (text.includes("academy_academic_programs")) {
        return { rows: [{ name: "Ministry Leadership" }] };
      }
      // Student decision check
      if (text.includes("student_person_id") && text.includes("accepted_at")) {
        if (!o.packageExists) return { rows: [] };
        return {
          rows: [{
            student_person_id: o.studentPersonId,
            accepted_at: o.acceptedAt,
            declined_at: o.declinedAt,
            acceptance_deadline: o.deadline,
          }],
        };
      }
      // Letter URL check
      if (text.includes("letter_status") && text.includes("award_letter_storage_path")) {
        return {
          rows: [{
            student_person_id: o.studentPersonId,
            letter_status: o.letterStatus,
            award_letter_storage_path: o.storagePath,
          }],
        };
      }
      // Default: insert/update operations
      return { rows: [{ id: "new-id" }] };
    },
  };
}

const mockCommunicationsService = {
  createCommunication: async () => ({ id: "comm-1", tenantId: TENANT }),
} as unknown as import("@/modules/communications/service").CommunicationsService;

test("generateAidAwardLetterPdf: generates and uploads PDF", async () => {
  const storage = buildStorage(false);
  const db = buildDb({ packageExists: true });
  const result = await generateAidAwardLetterPdf(
    financeActor,
    { packageId: PACKAGE_ID },
    storage,
    mockCommunicationsService,
    db,
  );
  assert.ok(result.storagePath);
  assert.ok(result.signedUrl);
  assert.ok(storage.uploaded);
});

test("generateAidAwardLetterPdf: idempotent — returns existing URL without re-uploading", async () => {
  const existingPath = `${TENANT}/${STUDENT_ID}/pkg-1.pdf`;
  const storage = buildStorage(true);
  const db = buildDb({ storagePath: existingPath });
  const result = await generateAidAwardLetterPdf(
    financeActor,
    { packageId: PACKAGE_ID },
    storage,
    mockCommunicationsService,
    db,
  );
  assert.equal(result.storagePath, existingPath);
  assert.equal(storage.uploaded, false);
});

test("generateAidAwardLetterPdf: unauthorized actor throws", async () => {
  const db = buildDb();
  const storage = buildStorage();
  await assert.rejects(
    () => generateAidAwardLetterPdf(
      studentActor,
      { packageId: PACKAGE_ID },
      storage,
      mockCommunicationsService,
      db,
    ),
    AcademyAuthorizationError,
  );
});

test("recordStudentAidDecision: student can accept own package", async () => {
  const db = buildDb({ studentPersonId: STUDENT_ID });
  await assert.doesNotReject(() =>
    recordStudentAidDecision(studentActor, { packageId: PACKAGE_ID, decision: "accepted" }, db),
  );
});

test("recordStudentAidDecision: student cannot accept another student's package", async () => {
  const db = buildDb({ studentPersonId: STUDENT_ID });
  await assert.rejects(
    () => recordStudentAidDecision(otherStudentActor, { packageId: PACKAGE_ID, decision: "accepted" }, db),
    AcademyAuthorizationError,
  );
});

test("recordStudentAidDecision: throws after acceptance deadline", async () => {
  const pastDeadline = new Date(Date.now() - 86400000).toISOString();
  const db = buildDb({ studentPersonId: STUDENT_ID, deadline: pastDeadline });
  await assert.rejects(
    () => recordStudentAidDecision(studentActor, { packageId: PACKAGE_ID, decision: "accepted" }, db),
    AcademyConflictError,
  );
});

test("recordStudentAidDecision: throws when already decided", async () => {
  const db = buildDb({ studentPersonId: STUDENT_ID, acceptedAt: new Date().toISOString() });
  await assert.rejects(
    () => recordStudentAidDecision(studentActor, { packageId: PACKAGE_ID, decision: "accepted" }, db),
    AcademyConflictError,
  );
});

test("getAidLetterSignedUrl: returns null when letter not generated", async () => {
  const db = buildDb({ letterStatus: "not_generated", storagePath: null });
  const storage = buildStorage();
  const url = await getAidLetterSignedUrl(financeActor, PACKAGE_ID, storage, db);
  assert.equal(url, null);
});

test("getAidLetterSignedUrl: returns signed URL when letter is generated", async () => {
  const path = `${TENANT}/${STUDENT_ID}/${PACKAGE_ID}.pdf`;
  const db = buildDb({ letterStatus: "generated", storagePath: path });
  const storage = buildStorage(true);
  const url = await getAidLetterSignedUrl(financeActor, PACKAGE_ID, storage, db);
  assert.ok(url);
  assert.match(url, /storage\.example\.com/);
});
