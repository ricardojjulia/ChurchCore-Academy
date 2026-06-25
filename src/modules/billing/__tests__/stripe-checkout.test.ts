import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { BillingService } from "@/modules/billing/service";
import {
  BillingLedgerEntry,
  BillingRepository,
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

const finance: AcademyActor = {
  userId: "person-finance",
  tenantId: "tenant-1",
  roles: ["finance"],
};

const student: AcademyActor = {
  userId: "person-student",
  tenantId: "tenant-1",
  roles: ["student"],
};

const crossTenantActor: AcademyActor = {
  userId: "person-admin-other",
  tenantId: "tenant-2",
  roles: ["institution_admin"],
};

function mockRepository(): BillingRepository & { calls: string[] } {
  const calls: string[] = [];
  const ledgerEntries = new Map<string, BillingLedgerEntry>();

  return {
    calls,
    async postLedgerEntry(input) {
      const existing = ledgerEntries.get(input.idempotencyKey);
      if (existing) return existing;

      calls.push(`ledger:${input.entryType}:${input.studentPersonId}:${input.amountCents}:${input.idempotencyKey}`);

      const entry: BillingLedgerEntry = {
        id: `entry-${randomUUID()}`,
        tenantId: input.tenantId,
        studentPersonId: input.studentPersonId,
        entryType: input.entryType,
        amountCents: input.amountCents,
        currency: input.currency,
        description: input.description,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        postedByPersonId: input.postedByPersonId,
        postedAt: new Date().toISOString(),
        idempotencyKey: input.idempotencyKey,
      };

      ledgerEntries.set(input.idempotencyKey, entry);
      return entry;
    },

    async createPaymentIntent(input) {
      calls.push(`intent:${input.studentPersonId}:${input.amountCents}:${input.provider}:${input.idempotencyKey}`);
      return {
        id: `intent-${randomUUID()}`,
        tenantId: input.tenantId,
        studentPersonId: input.studentPersonId,
        amountCents: input.amountCents,
        currency: input.currency,
        provider: input.provider,
        status: "requires_action",
        providerReference: input.provider === "stripe" ? "pi_safe_reference" : undefined,
        clientSecretRedacted: true,
        createdByPersonId: input.createdByPersonId,
        createdAt: new Date().toISOString(),
        idempotencyKey: input.idempotencyKey,
      };
    },

    async markPaymentPosted(input) {
      calls.push(`payment:${input.studentPersonId}:${input.amountCents}:${input.providerReference}:${input.idempotencyKey}`);

      return this.postLedgerEntry({
        tenantId: input.tenantId,
        studentPersonId: input.studentPersonId,
        entryType: "payment",
        amountCents: -input.amountCents,
        currency: input.currency,
        description: input.description,
        sourceType: "payment",
        sourceId: input.providerReference,
        postedByPersonId: input.postedByPersonId,
        idempotencyKey: input.idempotencyKey,
      });
    },

    async readStatement() {
      return {
        tenantId: "tenant-1",
        studentPersonId: "person-student",
        currency: "USD",
        balanceCents: 0,
        entries: [],
      };
    },

    async updateCheckoutSession(input) {
      calls.push(`checkout:${input.intentId}:${input.stripeCheckoutSessionId}`);
    },

    async findPaymentIntentByStripeSession(tenantId, sessionId) {
      calls.push(`find-session:${tenantId}:${sessionId}`);
      return {
        id: "intent-123",
        tenantId,
        studentPersonId: "person-student",
        amountCents: 50000,
        currency: "USD",
        provider: "stripe",
        status: "requires_action",
        clientSecretRedacted: true,
        createdByPersonId: "person-admin",
        createdAt: new Date().toISOString(),
        idempotencyKey: "intent-key",
      };
    },

    async studentExistsInTenant(tenantId, studentPersonId) {
      return tenantId === "tenant-1" && studentPersonId === "person-student";
    },
  };
}

test("createPaymentIntent with Stripe returns intent with clientSecretRedacted sentinel", async () => {
  const repository = mockRepository();
  const service = new BillingService(repository);

  const intent = await service.createPaymentIntent(admin, {
    studentPersonId: "person-student",
    amountCents: 50000,
    currency: "USD",
    provider: "stripe",
    idempotencyKey: "stripe-intent-1",
  });

  assert.equal(intent.clientSecretRedacted, true);
  assert.equal("clientSecret" in intent, false);
  assert.doesNotMatch(JSON.stringify(intent), /secret_unsafe/);
  assert.doesNotMatch(JSON.stringify(intent), /pi_.*_secret/);
  assert.deepEqual(repository.calls, [
    "intent:person-student:50000:stripe:stripe-intent-1",
  ]);
});

test("createPaymentIntent rejects amountCents <= 0", async () => {
  const repository = mockRepository();
  const service = new BillingService(repository);

  await assert.rejects(
    () =>
      service.createPaymentIntent(admin, {
        studentPersonId: "person-student",
        amountCents: 0,
        currency: "USD",
        provider: "stripe",
        idempotencyKey: "bad-amount",
      }),
    /amountCents must be a positive integer/,
  );

  await assert.rejects(
    () =>
      service.createPaymentIntent(admin, {
        studentPersonId: "person-student",
        amountCents: -100,
        currency: "USD",
        provider: "stripe",
        idempotencyKey: "negative-amount",
      }),
    /amountCents must be a positive integer/,
  );
});

test("createPaymentIntent rejects cross-tenant access", async () => {
  const repository = mockRepository();
  const service = new BillingService(repository);

  await assert.rejects(
    () =>
      service.createPaymentIntent(crossTenantActor, {
        studentPersonId: "person-student",
        amountCents: 10000,
        currency: "USD",
        provider: "stripe",
        idempotencyKey: "cross-tenant-intent",
      }),
    AcademyAuthorizationError,
  );
});

test("postPayment creates negative ledger entry (credit) for Stripe payment", async () => {
  const repository = mockRepository();
  const service = new BillingService(repository);

  const payment = await service.postPayment(registrar, {
    studentPersonId: "person-student",
    amountCents: 50000,
    currency: "USD",
    provider: "stripe",
    providerReference: "cs_test_stripe_session_123",
    description: "Stripe Checkout payment",
    idempotencyKey: "stripe-session-cs_test_stripe_session_123",
  });

  assert.equal(payment.amountCents, -50000);
  assert.equal(payment.entryType, "payment");
  assert.equal(payment.sourceType, "payment");
  assert.equal(payment.sourceId, "cs_test_stripe_session_123");
  assert.deepEqual(repository.calls, [
    "payment:person-student:50000:cs_test_stripe_session_123:stripe-session-cs_test_stripe_session_123",
    "ledger:payment:person-student:-50000:stripe-session-cs_test_stripe_session_123",
  ]);
});

test("postPayment idempotency prevents duplicate ledger entries", async () => {
  const repository = mockRepository();
  const service = new BillingService(repository);

  const idempotencyKey = "stripe-session-duplicate";

  const payment1 = await service.postPayment(finance, {
    studentPersonId: "person-student",
    amountCents: 30000,
    currency: "USD",
    provider: "stripe",
    providerReference: "cs_duplicate",
    description: "Stripe payment",
    idempotencyKey,
  });

  const payment2 = await service.postPayment(finance, {
    studentPersonId: "person-student",
    amountCents: 30000,
    currency: "USD",
    provider: "stripe",
    providerReference: "cs_duplicate",
    description: "Stripe payment",
    idempotencyKey,
  });

  assert.equal(payment1.id, payment2.id);
  assert.equal(repository.calls.filter((c) => c.startsWith("ledger:")).length, 1);
});

test("postPayment rejects student actor (admin-only)", async () => {
  const repository = mockRepository();
  const service = new BillingService(repository);

  await assert.rejects(
    () =>
      service.postPayment(student, {
        studentPersonId: "person-student",
        amountCents: 10000,
        currency: "USD",
        provider: "stripe",
        providerReference: "cs_unauthorized",
        description: "Unauthorized payment",
        idempotencyKey: "unauthorized-payment",
      }),
    AcademyAuthorizationError,
  );
});

test("finance role can post Stripe payments", async () => {
  const repository = mockRepository();
  const service = new BillingService(repository);

  const payment = await service.postPayment(finance, {
    studentPersonId: "person-student",
    amountCents: 25000,
    currency: "USD",
    provider: "stripe",
    providerReference: "cs_finance_session",
    description: "Stripe payment posted by finance",
    idempotencyKey: "finance-payment-1",
  });

  assert.equal(payment.amountCents, -25000);
  assert.equal(payment.postedByPersonId, "person-finance");
});

test("registrar role can post Stripe payments", async () => {
  const repository = mockRepository();
  const service = new BillingService(repository);

  const payment = await service.postPayment(registrar, {
    studentPersonId: "person-student",
    amountCents: 15000,
    currency: "USD",
    provider: "stripe",
    providerReference: "cs_registrar_session",
    description: "Stripe payment posted by registrar",
    idempotencyKey: "registrar-payment-1",
  });

  assert.equal(payment.amountCents, -15000);
  assert.equal(payment.postedByPersonId, "person-registrar");
});
