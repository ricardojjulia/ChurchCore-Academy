import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import {
  BillingService,
  buildProviderSafePaymentIntent,
} from "@/modules/billing/service";
import {
  BillingLedgerEntry,
  BillingRepository,
  StudentAccountStatement,
} from "@/modules/billing/types";

const admin: AcademyActor = {
  userId: "person-admin",
  tenantId: "tenant-1",
  roles: ["institution_admin"],
};

const registrar: AcademyActor = {
  userId: "person-registrar",
  tenantId: "tenant-1",
  roles: ["registrar"],
};

const student: AcademyActor = {
  userId: "person-student",
  tenantId: "tenant-1",
  roles: ["student"],
};

const faculty: AcademyActor = {
  userId: "person-faculty",
  tenantId: "tenant-1",
  roles: ["faculty"],
};

function entry(overrides: Partial<BillingLedgerEntry> = {}): BillingLedgerEntry {
  return {
    id: "entry-1",
    tenantId: "tenant-1",
    studentPersonId: "person-student",
    entryType: "charge",
    amountCents: 120000,
    currency: "USD",
    description: "Tuition charge",
    sourceType: "manual",
    sourceId: "manual-1",
    postedByPersonId: "person-admin",
    postedAt: "2026-06-21T05:00:00.000Z",
    idempotencyKey: "charge-1",
    ...overrides,
  };
}

function statement(overrides: Partial<StudentAccountStatement> = {}): StudentAccountStatement {
  return {
    tenantId: "tenant-1",
    studentPersonId: "person-student",
    currency: "USD",
    balanceCents: 75000,
    entries: [
      entry({ amountCents: 120000 }),
      entry({
        id: "entry-2",
        entryType: "payment",
        amountCents: -45000,
        description: "Payment",
      }),
    ],
    ...overrides,
  };
}

function mockRepository(): BillingRepository & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async postLedgerEntry(input) {
      calls.push(`${input.entryType}:${input.studentPersonId}:${input.amountCents}:${input.idempotencyKey}`);
      return entry({
        entryType: input.entryType,
        amountCents: input.amountCents,
        description: input.description,
        idempotencyKey: input.idempotencyKey,
        postedByPersonId: input.postedByPersonId,
      });
    },
    async createPaymentIntent(input) {
      calls.push(`intent:${input.studentPersonId}:${input.amountCents}:${input.provider}:${input.idempotencyKey}`);
      return {
        id: "intent-1",
        tenantId: input.tenantId,
        studentPersonId: input.studentPersonId,
        amountCents: input.amountCents,
        currency: input.currency,
        provider: input.provider,
        status: "requires_action",
        providerReference: "pi_safe_reference",
        clientSecretRedacted: true,
        createdByPersonId: input.createdByPersonId,
        createdAt: "2026-06-21T05:00:00.000Z",
        idempotencyKey: input.idempotencyKey,
      };
    },
    async markPaymentPosted(input) {
      calls.push(`payment:${input.studentPersonId}:${input.amountCents}:${input.providerReference}:${input.idempotencyKey}`);
      return entry({
        entryType: "payment",
        amountCents: -input.amountCents,
        sourceType: "payment",
        sourceId: input.providerReference,
        description: input.description,
        idempotencyKey: input.idempotencyKey,
        postedByPersonId: input.postedByPersonId,
      });
    },
    async readStatement(_tenantId, studentPersonId) {
      return statement({ studentPersonId });
    },
  };
}

test("admin can assess charges and credits with signed ledger amounts", async () => {
  const repository = mockRepository();
  const service = new BillingService(repository);

  await service.assessCharge(admin, {
    studentPersonId: "person-student",
    amountCents: 120000,
    currency: "USD",
    description: "Tuition charge",
    idempotencyKey: "charge-1",
  });
  await service.applyCredit(admin, {
    studentPersonId: "person-student",
    amountCents: 25000,
    currency: "USD",
    description: "Scholarship credit",
    idempotencyKey: "credit-1",
  });

  assert.deepEqual(repository.calls, [
    "charge:person-student:120000:charge-1",
    "credit:person-student:-25000:credit-1",
  ]);
});

test("payment posting is provider-safe and records a negative ledger entry", async () => {
  const repository = mockRepository();
  const service = new BillingService(repository);

  const intent = await service.createPaymentIntent(student, {
    studentPersonId: "person-student",
    amountCents: 45000,
    currency: "USD",
    provider: "manual",
    idempotencyKey: "intent-1",
  });
  const payment = await service.postPayment(registrar, {
    studentPersonId: "person-student",
    amountCents: 45000,
    currency: "USD",
    provider: "manual",
    providerReference: "receipt-1",
    description: "Manual payment",
    idempotencyKey: "payment-1",
  });

  assert.equal(intent.clientSecretRedacted, true);
  assert.equal(payment.amountCents, -45000);
  assert.deepEqual(repository.calls, [
    "intent:person-student:45000:manual:intent-1",
    "payment:person-student:45000:receipt-1:payment-1",
  ]);
});

test("payment provider payloads never expose secrets", () => {
  const payload = buildProviderSafePaymentIntent({
    provider: "stripe",
    providerReference: "pi_123",
    clientSecret: "pi_123_secret_unsafe",
    amountCents: 50000,
    currency: "USD",
  });

  assert.equal(payload.providerReference, "pi_123");
  assert.equal(payload.clientSecretRedacted, true);
  assert.equal("clientSecret" in payload, false);
  assert.doesNotMatch(JSON.stringify(payload), /secret_unsafe/);
});

test("student can read and create payment intent only for own account", async () => {
  const repository = mockRepository();
  const service = new BillingService(repository);

  const ownStatement = await service.readStudentStatement(student, "person-student");
  assert.equal(ownStatement.studentPersonId, "person-student");

  await assert.rejects(
    () => service.readStudentStatement(student, "person-other"),
    AcademyAuthorizationError,
  );
  await assert.rejects(
    () =>
      service.createPaymentIntent(student, {
        studentPersonId: "person-other",
        amountCents: 1000,
        currency: "USD",
        provider: "manual",
        idempotencyKey: "intent-other",
      }),
    AcademyAuthorizationError,
  );
});

test("non-finance roles cannot mutate student accounts", async () => {
  const repository = mockRepository();
  const service = new BillingService(repository);

  await assert.rejects(
    () =>
      service.assessCharge(faculty, {
        studentPersonId: "person-student",
        amountCents: 1000,
        currency: "USD",
        description: "Unauthorized charge",
        idempotencyKey: "bad-charge",
      }),
    AcademyAuthorizationError,
  );
});
