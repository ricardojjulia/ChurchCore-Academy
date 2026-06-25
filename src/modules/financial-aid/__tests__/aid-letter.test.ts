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
  const storage: LetterStorageClient & {
    uploaded: boolean;
    bucket?: string;
    uploadedPath?: string;
    signedUrlTtl?: number;
  } = {
    uploaded: false,
    bucket: undefined as string | undefined,
    uploadedPath: undefined as string | undefined,
    signedUrlTtl: undefined as number | undefined,
    async upload(bucket: string, path: string, buffer: Buffer, contentType: string) {
      void buffer;
      void contentType;
      storage.uploaded = true;
      storage.bucket = bucket;
      storage.uploadedPath = path;
    },
    async exists(bucket: string, path: string) {
      void bucket;
      void path;
      return fileExists;
    },
    async signedUrl(bucket: string, path: string, ttl: number) {
      void bucket;
      storage.signedUrlTtl = ttl;
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
  aidLetterId?: string;
  aidLetterStatus?: "draft" | "issued" | "accepted" | "declined" | "expired";
  expiresAt?: string | null;
  hasFederalAward?: boolean;
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
    aidLetterId: "letter-1",
    aidLetterStatus: "issued" as const,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    hasFederalAward: false,
    acceptedAt: null as string | null,
    declinedAt: null as string | null,
    deadline: null as string | null,
    studentPersonId: STUDENT_ID,
    ...overrides,
  };

  return {
    async query(text: string, values?: unknown[]) {
      void values;
      // Aid letter entity idempotency and signed URL lookup.
      if (text.includes("from academy_aid_letters")) {
        return {
          rows: [{
            id: o.aidLetterId,
            student_person_id: o.studentPersonId,
            aid_package_id: PACKAGE_ID,
            status: o.aidLetterStatus,
            storage_path: o.storagePath,
            accepted_at: o.acceptedAt,
            declined_at: o.declinedAt,
            expires_at: o.expiresAt,
          }],
        };
      }
      if (text.includes("insert into academy_aid_letters")) {
        return {
          rows: [{
            id: o.aidLetterId,
            student_person_id: o.studentPersonId,
            aid_package_id: PACKAGE_ID,
            status: "issued",
            storage_path: `${TENANT}/${STUDENT_ID}/${o.aidLetterId}.pdf`,
            expires_at: o.expiresAt,
          }],
        };
      }
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
            award_type: o.hasFederalAward ? "federal_grant" : "scholarship",
            source_type: o.hasFederalAward ? "federal" : "institutional",
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

test("generateAidAwardLetterPdf: stores issued letters in private academy aid bucket by aid letter id", async () => {
  const storage = buildStorage(false);
  const db = buildDb({ packageExists: true, aidLetterId: "letter-123" });
  const result = await generateAidAwardLetterPdf(
    financeActor,
    { packageId: PACKAGE_ID, acceptanceDeadline: "2026-08-01T00:00:00.000Z" },
    storage,
    mockCommunicationsService,
    db,
  );

  assert.equal(storage.bucket, "academy-aid-letters");
  assert.match(
    storage.uploadedPath ?? "",
    new RegExp(`^${TENANT}/${STUDENT_ID}/[0-9a-f-]{36}\\.pdf$`),
  );
  assert.notEqual(storage.uploadedPath, `${TENANT}/${STUDENT_ID}/${PACKAGE_ID}.pdf`);
  assert.equal(result.storagePath, storage.uploadedPath);
  assert.equal(storage.signedUrlTtl, 900);
});

test("generateAidAwardLetterPdf: idempotent — returns existing URL without re-uploading", async () => {
  const existingPath = `${TENANT}/${STUDENT_ID}/letter-1.pdf`;
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

test("generateAidAwardLetterPdf: rejects federal or regulated aid packages", async () => {
  const storage = buildStorage(false);
  const db = buildDb({ packageExists: true, hasFederalAward: true });
  await assert.rejects(
    () => generateAidAwardLetterPdf(
      financeActor,
      { packageId: PACKAGE_ID },
      storage,
      mockCommunicationsService,
      db,
    ),
    AcademyConflictError,
  );
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
    recordStudentAidDecision(studentActor, { packageId: PACKAGE_ID, decision: "accepted", requestIp: "203.0.113.10" }, db),
  );
});

test("recordStudentAidDecision: stores a SHA-256 IP hash and never raw IP", async () => {
  const updates: unknown[][] = [];
  const db = {
    async query(text: string, values: unknown[] = []) {
      if (text.includes("from academy_aid_letters")) {
        return {
          rows: [{
            id: "letter-1",
            student_person_id: STUDENT_ID,
            status: "issued",
            accepted_at: null,
            declined_at: null,
            expires_at: new Date(Date.now() + 86400000).toISOString(),
          }],
        };
      }
      if (text.includes("update academy_aid_letters")) {
        updates.push(values);
      }
      return { rows: [] };
    },
  };

  await recordStudentAidDecision(
    studentActor,
    { packageId: PACKAGE_ID, decision: "accepted", requestIp: "203.0.113.10" },
    db,
  );

  const flatValues = updates.flat().map(String);
  assert.equal(
    flatValues.includes("203.0.113.10"),
    false,
    "raw request IP must not be persisted",
  );
  assert.ok(
    flatValues.some((value) => /^[a-f0-9]{64}$/.test(value)),
    "decision update must include a SHA-256 hash",
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
  const db = buildDb({ studentPersonId: STUDENT_ID, deadline: pastDeadline, expiresAt: pastDeadline });
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
  const path = `${TENANT}/${STUDENT_ID}/letter-1.pdf`;
  const db = buildDb({ letterStatus: "generated", storagePath: path });
  const storage = buildStorage(true);
  const url = await getAidLetterSignedUrl(financeActor, PACKAGE_ID, storage, db);
  assert.ok(url);
  assert.match(url, /storage\.example\.com/);
  assert.equal(storage.signedUrlTtl, 900);
});

test("getAidLetterSignedUrl: rejects expired letters", async () => {
  const path = `${TENANT}/${STUDENT_ID}/letter-1.pdf`;
  const db = buildDb({
    aidLetterStatus: "expired",
    letterStatus: "generated",
    storagePath: path,
    expiresAt: new Date(Date.now() - 86400000).toISOString(),
  });
  const storage = buildStorage(true);
  await assert.rejects(
    () => getAidLetterSignedUrl(studentActor, PACKAGE_ID, storage, db),
    AcademyConflictError,
  );
});
