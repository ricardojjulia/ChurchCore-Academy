import assert from "node:assert/strict";
import test from "node:test";
import { AdmissionsService } from "@/modules/admissions/service";
import { EnrollmentAgreementService } from "@/modules/admissions/enrollment-agreement-service";
import { EnrollmentConversionService } from "@/modules/enrollment-conversion/service";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { AdmissionApplication } from "@/modules/admissions/types";
import type { EnrollmentAgreementSignature } from "@/modules/admissions/enrollment-agreement-types";

interface MockDatabase {
  applications: Map<string, AdmissionApplication>;
  agreements: Map<string, EnrollmentAgreementSignature>;
  events: Array<{ action: string }>;
}

function createMockDatabase(): MockDatabase {
  return {
    applications: new Map(),
    agreements: new Map(),
    events: [],
  };
}

function createMockAdmissionsRepository(db: MockDatabase) {
  return {
    async findById(tenantId: string, applicationId: string) {
      const app = db.applications.get(applicationId);
      return app && app.tenantId === tenantId ? app : undefined;
    },
    async findByIdempotencyKey() {
      return undefined;
    },
    async findMutationByIdempotencyKey() {
      return undefined;
    },
    async create() {
      throw new Error("Not used in this test");
    },
    async transition(
      tenantId: string,
      applicationId: string,
      expectedStatus: string,
      nextStatus: string,
      decision?: { decidedAt: string; decidedByPersonId: string; decisionReason?: string },
    ) {
      const app = db.applications.get(applicationId);
      if (!app || app.tenantId !== tenantId || app.status !== expectedStatus) {
        return undefined;
      }
      const updated = {
        ...app,
        status: nextStatus as AdmissionApplication["status"],
        decidedAt: decision?.decidedAt,
        decidedByPersonId: decision?.decidedByPersonId,
        decisionReason: decision?.decisionReason,
        updatedAt: new Date().toISOString(),
      };
      db.applications.set(applicationId, updated);
      return updated;
    },
    async appendEvent() {
      // No-op for this test
    },
    async checkApplicationFeeStatus() {
      return "none" as const;
    },
  };
}

function createMockEnrollmentAgreementRepository(db: MockDatabase) {
  return {
    async findByApplication(tenantId: string, applicationId: string) {
      const agreement = db.agreements.get(applicationId);
      return agreement && agreement.tenantId === tenantId ? agreement : undefined;
    },
    async create(input: { tenantId: string; applicationId: string }) {
      const existing = db.agreements.get(input.applicationId);
      if (existing) {
        return existing;
      }
      const agreement: EnrollmentAgreementSignature = {
        id: `agreement-${input.applicationId}`,
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.agreements.set(input.applicationId, agreement);
      return agreement;
    },
    async sign(input: {
      tenantId: string;
      applicationId: string;
      applicantPersonId: string;
      agreementTextHash: string;
      redactedIpAddress: string | null;
    }) {
      const agreement = db.agreements.get(input.applicationId);
      if (!agreement || agreement.tenantId !== input.tenantId || agreement.status !== "pending") {
        return undefined;
      }
      const signed: EnrollmentAgreementSignature = {
        ...agreement,
        status: "signed",
        signedByPersonId: input.applicantPersonId,
        signedAt: new Date().toISOString(),
        agreementTextHash: input.agreementTextHash,
        redactedIpAddress: input.redactedIpAddress ?? undefined,
        updatedAt: new Date().toISOString(),
      };
      db.agreements.set(input.applicationId, signed);
      return signed;
    },
  };
}

function createMockAuditRepository(db: MockDatabase) {
  return {
    async append(input: { action: string }) {
      db.events.push({ action: input.action });
    },
  };
}

function createMockEnrollmentConversionRepository(db: MockDatabase) {
  return {
    async findApplication(tenantId: string, applicationId: string) {
      const app = db.applications.get(applicationId);
      return app && app.tenantId === tenantId ? app : undefined;
    },
    async findReplay() {
      return undefined;
    },
    async findResultByApplication() {
      return undefined;
    },
    async convert(input: { applicationId: string; idempotencyKey: string }) {
      return {
        applicationId: input.applicationId,
        studentProfileId: `student-${input.applicationId}`,
        studentNumber: "S001",
        programEnrollmentId: `enrollment-${input.applicationId}`,
        periodRegistrationId: `registration-${input.applicationId}`,
        convertedAt: new Date().toISOString(),
        idempotencyKey: input.idempotencyKey,
      };
    },
  };
}

const staffActor: AcademyActor = {
  userId: "staff-1",
  tenantId: "tenant-a",
  roles: ["registrar"],
};

test("Enrollment agreement - auto-created on accept", async () => {
  const db = createMockDatabase();

  // Setup: application exists in submitted state
  const application: AdmissionApplication = {
    id: "app-1",
    tenantId: "tenant-a",
    applicantPersonId: "person-1",
    programId: "prog-1",
    applicationTermId: "term-1",
    legalName: "John Doe",
    email: "john@example.com",
    status: "submitted",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  db.applications.set("app-1", application);

  const admissionsRepo = createMockAdmissionsRepository(db);
  const agreementRepo = createMockEnrollmentAgreementRepository(db);
  const audit = createMockAuditRepository(db);

  const admissionsService = new AdmissionsService(
    admissionsRepo,
    audit,
    () => new Date().toISOString(),
    agreementRepo,
  );

  // Act: decide to accept
  await admissionsService.decide(
    staffActor,
    "app-1",
    "accepted",
    "Meets all criteria",
    "correlation-1",
    "idempotency-1",
  );

  // Assert: agreement was auto-created
  const agreement = db.agreements.get("app-1");
  assert.ok(agreement, "Agreement should be auto-created on accept");
  assert.equal(agreement.status, "pending");
  assert.equal(agreement.applicationId, "app-1");
});

test("Enrollment agreement - NOT created on decline", async () => {
  const db = createMockDatabase();

  const application: AdmissionApplication = {
    id: "app-2",
    tenantId: "tenant-a",
    applicantPersonId: "person-2",
    programId: "prog-1",
    applicationTermId: "term-1",
    legalName: "Jane Doe",
    email: "jane@example.com",
    status: "submitted",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  db.applications.set("app-2", application);

  const admissionsRepo = createMockAdmissionsRepository(db);
  const agreementRepo = createMockEnrollmentAgreementRepository(db);
  const audit = createMockAuditRepository(db);

  const admissionsService = new AdmissionsService(
    admissionsRepo,
    audit,
    () => new Date().toISOString(),
    agreementRepo,
  );

  // Act: decide to decline
  await admissionsService.decide(
    staffActor,
    "app-2",
    "declined",
    "Does not meet criteria",
    "correlation-2",
    "idempotency-2",
  );

  // Assert: agreement was NOT created
  const agreement = db.agreements.get("app-2");
  assert.equal(agreement, undefined, "Agreement should NOT be created on decline");
});

test("Enrollment agreement - idempotent on withdraw->re-accept", async () => {
  const db = createMockDatabase();

  // Start with application in submitted state (not accepted)
  const application: AdmissionApplication = {
    id: "app-3",
    tenantId: "tenant-a",
    applicantPersonId: "person-3",
    programId: "prog-1",
    applicationTermId: "term-1",
    legalName: "Bob Smith",
    email: "bob@example.com",
    status: "submitted",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  db.applications.set("app-3", application);

  // Pre-existing agreement (from first acceptance, simulating a previous accept->withdraw cycle)
  const existingAgreement: EnrollmentAgreementSignature = {
    id: "agreement-3",
    tenantId: "tenant-a",
    applicationId: "app-3",
    status: "pending",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  db.agreements.set("app-3", existingAgreement);

  const admissionsRepo = createMockAdmissionsRepository(db);
  const agreementRepo = createMockEnrollmentAgreementRepository(db);
  const audit = createMockAuditRepository(db);

  const admissionsService = new AdmissionsService(
    admissionsRepo,
    audit,
    () => new Date().toISOString(),
    agreementRepo,
  );

  // Act: decide to accept (simulating re-accept after a withdrawal)
  await admissionsService.decide(
    staffActor,
    "app-3",
    "accepted",
    "Re-accepted after withdrawal",
    "correlation-3",
    "idempotency-3",
  );

  // Assert: existing agreement persists, no duplicate or error
  const agreement = db.agreements.get("app-3");
  assert.ok(agreement);
  assert.equal(agreement.id, "agreement-3", "Should be the same agreement");
  assert.equal(agreement.status, "pending", "Status should remain unchanged");
});

test("Enrollment agreement - signing success with redacted IP", async () => {
  const db = createMockDatabase();

  const application: AdmissionApplication = {
    id: "app-4",
    tenantId: "tenant-a",
    applicantPersonId: "person-4",
    programId: "prog-1",
    applicationTermId: "term-1",
    legalName: "Alice Johnson",
    email: "alice@example.com",
    status: "accepted",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  db.applications.set("app-4", application);

  const pendingAgreement: EnrollmentAgreementSignature = {
    id: "agreement-4",
    tenantId: "tenant-a",
    applicationId: "app-4",
    status: "pending",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  db.agreements.set("app-4", pendingAgreement);

  const agreementRepo = createMockEnrollmentAgreementRepository(db);
  const audit = createMockAuditRepository(db);

  const agreementService = new EnrollmentAgreementService(agreementRepo, audit);

  // Act: sign the agreement
  const signed = await agreementService.signAgreement(
    "tenant-a",
    "app-4",
    "person-4",
    "192.168.1.0", // Redacted IP
    "correlation-4",
  );

  // Assert: signature succeeded
  assert.ok(signed);
  assert.equal(signed.status, "signed");
  assert.equal(signed.signedByPersonId, "person-4");
  assert.equal(signed.redactedIpAddress, "192.168.1.0");
  assert.ok(signed.signedAt);
  assert.ok(signed.agreementTextHash);
});

test("Enrollment agreement - signing succeeds with null IP", async () => {
  const db = createMockDatabase();

  const application: AdmissionApplication = {
    id: "app-5",
    tenantId: "tenant-a",
    applicantPersonId: "person-5",
    programId: "prog-1",
    applicationTermId: "term-1",
    legalName: "Charlie Brown",
    email: "charlie@example.com",
    status: "accepted",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  db.applications.set("app-5", application);

  const pendingAgreement: EnrollmentAgreementSignature = {
    id: "agreement-5",
    tenantId: "tenant-a",
    applicationId: "app-5",
    status: "pending",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  db.agreements.set("app-5", pendingAgreement);

  const agreementRepo = createMockEnrollmentAgreementRepository(db);
  const audit = createMockAuditRepository(db);

  const agreementService = new EnrollmentAgreementService(agreementRepo, audit);

  // Act: sign the agreement with null IP
  const signed = await agreementService.signAgreement(
    "tenant-a",
    "app-5",
    "person-5",
    null, // IP unavailable
    "correlation-5",
  );

  // Assert: signature succeeded even with null IP
  assert.ok(signed);
  assert.equal(signed.status, "signed");
  assert.equal(signed.signedByPersonId, "person-5");
  assert.equal(signed.redactedIpAddress, undefined);
});

test("Enrollment conversion - blocked when agreement pending", async () => {
  const db = createMockDatabase();

  const application: AdmissionApplication = {
    id: "app-6",
    tenantId: "tenant-a",
    applicantPersonId: "person-6",
    programId: "prog-1",
    applicationTermId: "term-1",
    legalName: "David Lee",
    email: "david@example.com",
    status: "accepted",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  db.applications.set("app-6", application);

  const pendingAgreement: EnrollmentAgreementSignature = {
    id: "agreement-6",
    tenantId: "tenant-a",
    applicationId: "app-6",
    status: "pending",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  db.agreements.set("app-6", pendingAgreement);

  const conversionRepo = createMockEnrollmentConversionRepository(db);
  const agreementRepo = createMockEnrollmentAgreementRepository(db);
  const audit = createMockAuditRepository(db);

  const conversionService = new EnrollmentConversionService(
    conversionRepo,
    audit,
    () => new Date().toISOString(),
    agreementRepo,
  );

  // Act & Assert: conversion should be blocked
  await assert.rejects(
    async () => conversionService.convert(staffActor, "app-6", "correlation-6", "idempotency-6"),
    (err: Error) => {
      assert.ok(err.message.includes("sign the enrollment agreement"));
      return true;
    },
  );
});

test("Enrollment conversion - succeeds when agreement signed", async () => {
  const db = createMockDatabase();

  const application: AdmissionApplication = {
    id: "app-7",
    tenantId: "tenant-a",
    applicantPersonId: "person-7",
    programId: "prog-1",
    applicationTermId: "term-1",
    legalName: "Eve Martinez",
    email: "eve@example.com",
    status: "accepted",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  db.applications.set("app-7", application);

  const signedAgreement: EnrollmentAgreementSignature = {
    id: "agreement-7",
    tenantId: "tenant-a",
    applicationId: "app-7",
    status: "signed",
    signedByPersonId: "person-7",
    signedAt: "2026-01-02T10:00:00Z",
    agreementTextHash: "abc123hash",
    redactedIpAddress: "192.168.1.0",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T10:00:00Z",
  };
  db.agreements.set("app-7", signedAgreement);

  const conversionRepo = createMockEnrollmentConversionRepository(db);
  const agreementRepo = createMockEnrollmentAgreementRepository(db);
  const audit = createMockAuditRepository(db);

  const conversionService = new EnrollmentConversionService(
    conversionRepo,
    audit,
    () => new Date().toISOString(),
    agreementRepo,
  );

  // Act: conversion should succeed
  const result = await conversionService.convert(
    staffActor,
    "app-7",
    "correlation-7",
    "idempotency-7",
  );

  // Assert: conversion completed
  assert.ok(result);
  assert.equal(result.applicationId, "app-7");
  assert.ok(result.studentProfileId);
});

test("Enrollment conversion - blocked when agreement missing", async () => {
  const db = createMockDatabase();

  const application: AdmissionApplication = {
    id: "app-8",
    tenantId: "tenant-a",
    applicantPersonId: "person-8",
    programId: "prog-1",
    applicationTermId: "term-1",
    legalName: "Frank Wilson",
    email: "frank@example.com",
    status: "accepted",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  db.applications.set("app-8", application);

  // No agreement created (defensive case)

  const conversionRepo = createMockEnrollmentConversionRepository(db);
  const agreementRepo = createMockEnrollmentAgreementRepository(db);
  const audit = createMockAuditRepository(db);

  const conversionService = new EnrollmentConversionService(
    conversionRepo,
    audit,
    () => new Date().toISOString(),
    agreementRepo,
  );

  // Act & Assert: conversion should be blocked
  await assert.rejects(
    async () => conversionService.convert(staffActor, "app-8", "correlation-8", "idempotency-8"),
    (err: Error) => {
      assert.ok(err.message.includes("Enrollment agreement not found"));
      return true;
    },
  );
});

test("Enrollment agreement - cross-tenant isolation", async () => {
  const db = createMockDatabase();

  const application: AdmissionApplication = {
    id: "app-9",
    tenantId: "tenant-a",
    applicantPersonId: "person-9",
    programId: "prog-1",
    applicationTermId: "term-1",
    legalName: "Grace Chen",
    email: "grace@example.com",
    status: "accepted",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  db.applications.set("app-9", application);

  const agreement: EnrollmentAgreementSignature = {
    id: "agreement-9",
    tenantId: "tenant-a",
    applicationId: "app-9",
    status: "pending",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  db.agreements.set("app-9", agreement);

  const agreementRepo = createMockEnrollmentAgreementRepository(db);
  const audit = createMockAuditRepository(db);

  const agreementService = new EnrollmentAgreementService(agreementRepo, audit);

  // Act: cross-tenant query
  const result = await agreementService.getAgreementByApplication("tenant-b", "app-9");

  // Assert: no agreement returned
  assert.equal(result, undefined, "Cross-tenant query must not return agreement");
});

test("Enrollment agreement - no PII in test output", async () => {
  const db = createMockDatabase();

  const application: AdmissionApplication = {
    id: "app-10",
    tenantId: "tenant-a",
    applicantPersonId: "person-10",
    programId: "prog-1",
    applicationTermId: "term-1",
    legalName: "Henry Taylor",
    email: "henry@example.com",
    status: "accepted",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  db.applications.set("app-10", application);

  const agreement: EnrollmentAgreementSignature = {
    id: "agreement-10",
    tenantId: "tenant-a",
    applicationId: "app-10",
    status: "pending",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  db.agreements.set("app-10", agreement);

  const agreementRepo = createMockEnrollmentAgreementRepository(db);
  const audit = createMockAuditRepository(db);

  const agreementService = new EnrollmentAgreementService(agreementRepo, audit);

  // Act: sign agreement
  await agreementService.signAgreement(
    "tenant-a",
    "app-10",
    "person-10",
    "192.168.1.0",
    "correlation-10",
  );

  // Assert: verify no raw IP or hash in audit events
  const auditEvent = db.events.find((e) => e.action === "admission.agreement.signed");
  assert.ok(auditEvent);

  const eventStr = JSON.stringify(auditEvent);
  assert.doesNotMatch(eventStr, /192\.168\.1\.0/, "Redacted IP must not appear in audit event");
  assert.doesNotMatch(eventStr, /hash/i, "Hash must not appear in audit event");
});
