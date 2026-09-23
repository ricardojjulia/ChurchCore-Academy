import assert from "node:assert/strict";
import test from "node:test";
import { EnrollmentAgreementService } from "@/modules/admissions/enrollment-agreement-service";
import type {
  EnrollmentAgreementSignature,
  CreateEnrollmentAgreementInput,
  SignEnrollmentAgreementInput,
} from "@/modules/admissions/enrollment-agreement-types";

interface MockEnrollmentAgreementRepository {
  findByApplication(
    tenantId: string,
    applicationId: string,
  ): Promise<EnrollmentAgreementSignature | undefined>;
  create(
    input: CreateEnrollmentAgreementInput,
  ): Promise<EnrollmentAgreementSignature>;
  sign(
    input: SignEnrollmentAgreementInput,
  ): Promise<EnrollmentAgreementSignature | undefined>;
}

interface MockAuditRepository {
  events: Array<{ action: string; entityId: string }>;
  append(input: unknown): Promise<void>;
}

function createMockAuditRepository(): MockAuditRepository {
  return {
    events: [],
    async append(input: unknown) {
      const event = input as { action: string; entityId: string };
      this.events.push(event);
    },
  };
}

function createPendingAgreement(): EnrollmentAgreementSignature {
  return {
    id: "agreement-1",
    tenantId: "tenant-a",
    applicationId: "app-1",
    status: "pending",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

function createSignedAgreement(): EnrollmentAgreementSignature {
  return {
    id: "agreement-1",
    tenantId: "tenant-a",
    applicationId: "app-1",
    status: "signed",
    agreementTextHash: "abc123hash",
    signedByPersonId: "person-1",
    signedAt: "2026-01-02T10:00:00Z",
    redactedIpAddress: "192.168.1.0",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T10:00:00Z",
  };
}

test("EnrollmentAgreementService.createPendingAgreement - success", async () => {
  const mockRepo: MockEnrollmentAgreementRepository = {
    findByApplication: async () => undefined,
    create: async (input) => ({
      ...createPendingAgreement(),
      tenantId: input.tenantId,
      applicationId: input.applicationId,
    }),
    sign: async () => undefined,
  };
  const audit = createMockAuditRepository();

  const service = new EnrollmentAgreementService(mockRepo, audit);
  const result = await service.createPendingAgreement("tenant-a", "app-1");

  assert.ok(result);
  assert.equal(result.status, "pending");
  assert.equal(result.applicationId, "app-1");
});

test("EnrollmentAgreementService.signAgreement - success", async () => {
  const mockRepo: MockEnrollmentAgreementRepository = {
    findByApplication: async () => createPendingAgreement(),
    create: async () => createPendingAgreement(),
    sign: async () => createSignedAgreement(),
  };
  const audit = createMockAuditRepository();

  const service = new EnrollmentAgreementService(mockRepo, audit);
  const result = await service.signAgreement(
    "tenant-a",
    "app-1",
    "person-1",
    "192.168.1.0",
    "correlation-1",
  );

  assert.ok(result);
  assert.equal(result.status, "signed");
  assert.equal(result.signedByPersonId, "person-1");
  assert.equal(result.redactedIpAddress, "192.168.1.0");

  // Verify audit event was written
  assert.equal(audit.events.length, 1);
  assert.equal(audit.events[0].action, "admission.agreement.signed");
});

test("EnrollmentAgreementService.signAgreement - idempotent when already signed", async () => {
  const signed = createSignedAgreement();
  const mockRepo: MockEnrollmentAgreementRepository = {
    findByApplication: async () => signed,
    create: async () => createPendingAgreement(),
    sign: async () => undefined, // Simulates compare-and-set returning no rows
  };
  const audit = createMockAuditRepository();

  const service = new EnrollmentAgreementService(mockRepo, audit);
  const result = await service.signAgreement(
    "tenant-a",
    "app-1",
    "person-1",
    "192.168.1.0",
    "correlation-1",
  );

  assert.ok(result);
  assert.equal(result.status, "signed");
  // No new audit event when idempotent
  assert.equal(audit.events.length, 0);
});

test("EnrollmentAgreementService.signAgreement - rejects when agreement not found", async () => {
  const mockRepo: MockEnrollmentAgreementRepository = {
    findByApplication: async () => undefined,
    create: async () => createPendingAgreement(),
    sign: async () => undefined,
  };
  const audit = createMockAuditRepository();

  const service = new EnrollmentAgreementService(mockRepo, audit);

  await assert.rejects(
    async () => service.signAgreement("tenant-a", "app-1", "person-1", null, "correlation-1"),
    { name: "EnrollmentAgreementNotFoundError" },
  );
});

test("EnrollmentAgreementService.signAgreement - null IP does not block signing", async () => {
  const mockRepo: MockEnrollmentAgreementRepository = {
    findByApplication: async () => createPendingAgreement(),
    create: async () => createPendingAgreement(),
    sign: async () => ({
      ...createSignedAgreement(),
      redactedIpAddress: undefined, // Repository stored null
    }),
  };
  const audit = createMockAuditRepository();

  const service = new EnrollmentAgreementService(mockRepo, audit);
  const result = await service.signAgreement(
    "tenant-a",
    "app-1",
    "person-1",
    null, // No IP available
    "correlation-1",
  );

  assert.ok(result);
  assert.equal(result.status, "signed");
  // Signature succeeded even though IP was null
  assert.equal(result.redactedIpAddress, undefined);
});

test("EnrollmentAgreementService.getAgreementByApplication - cross-tenant returns undefined", async () => {
  // Repository enforces tenant isolation
  const mockRepo: MockEnrollmentAgreementRepository = {
    findByApplication: async (tenantId) => {
      if (tenantId !== "tenant-a") return undefined;
      return createPendingAgreement();
    },
    create: async () => createPendingAgreement(),
    sign: async () => undefined,
  };
  const audit = createMockAuditRepository();

  const service = new EnrollmentAgreementService(mockRepo, audit);
  const result = await service.getAgreementByApplication("tenant-b", "app-1");

  assert.equal(result, undefined, "Cross-tenant query should return no results");
});

test("EnrollmentAgreementService.signAgreement - audit metadata does not include hash or IP", async () => {
  const mockRepo: MockEnrollmentAgreementRepository = {
    findByApplication: async () => createPendingAgreement(),
    create: async () => createPendingAgreement(),
    sign: async () => createSignedAgreement(),
  };
  const audit = createMockAuditRepository();

  const service = new EnrollmentAgreementService(mockRepo, audit);
  await service.signAgreement(
    "tenant-a",
    "app-1",
    "person-1",
    "192.168.1.0",
    "correlation-1",
  );

  assert.equal(audit.events.length, 1);
  const eventData = audit.events[0] as unknown as {
    redactedMetadata?: Record<string, unknown>;
  };

  // Verify hash and IP are NOT in metadata
  const metadata = eventData.redactedMetadata ?? {};
  assert.ok(!("agreementTextHash" in metadata), "Hash must not be in audit metadata");
  assert.ok(!("redactedIpAddress" in metadata), "IP must not be in audit metadata");
  assert.ok(!("hash" in metadata), "Hash field must not be in audit metadata");
  assert.ok(!("ip" in metadata), "IP field must not be in audit metadata");
});
