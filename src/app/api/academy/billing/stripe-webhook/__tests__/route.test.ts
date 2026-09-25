import assert from "node:assert/strict";
import test from "node:test";
import { handleStripeWebhookRequest } from "@/app/api/academy/billing/stripe-webhook/route";
import type { AcademyActor } from "@/modules/academy-auth/policy";

const webhookSecret = "whsec_test";

function webhookRequest(body: string, signature = "valid-signature") {
  return new Request("http://localhost/api/academy/billing/stripe-webhook", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body,
  });
}

test("stripe webhook rejects invalid signatures before posting payment", async () => {
  const postCalls: unknown[] = [];

  const response = await handleStripeWebhookRequest(
    webhookRequest("{}", "bad-signature"),
    {
      webhookSecret,
      constructEvent: () => {
        throw new Error("Stripe raw signature failure with secret details");
      },
      serviceForTenant: async () => ({
        postPayment: async (...args: unknown[]) => {
          postCalls.push(args);
          throw new Error("service should not be reached");
        },
      }),
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid webhook signature." });
  assert.deepEqual(postCalls, []);
});

test("checkout.session.completed posts payment through BillingService with session idempotency key", async () => {
  const postCalls: Array<{
    actor: AcademyActor;
    input: Record<string, unknown>;
  }> = [];

  const response = await handleStripeWebhookRequest(
    webhookRequest("signed-body"),
    {
      webhookSecret,
      constructEvent: (body, signature, secret) => {
        assert.equal(body, "signed-body");
        assert.equal(signature, "valid-signature");
        assert.equal(secret, webhookSecret);
        return {
          type: "checkout.session.completed",
          data: {
            object: {
              id: "cs_test_123",
              amount_total: 50000,
              currency: "usd",
              metadata: {
                tenantId: "tenant-1",
                studentPersonId: "person-student",
              },
            },
          },
        };
      },
      serviceForTenant: async (tenantId) => {
        assert.equal(tenantId, "tenant-1");
        return {
          postPayment: async (actor: AcademyActor, input: Record<string, unknown>) => {
            postCalls.push({ actor, input });
            return {
              id: "entry-1",
              tenantId: actor.tenantId,
              studentPersonId: String(input.studentPersonId),
              academicPeriodId: "period-1",
              entryType: "payment" as const,
              amountCents: -Number(input.amountCents),
              currency: String(input.currency),
              description: String(input.description),
              sourceType: "payment" as const,
              sourceId: String(input.providerReference),
              postedByPersonId: actor.userId,
              postedAt: "2026-06-22T00:00:00.000Z",
              idempotencyKey: String(input.idempotencyKey),
            };
          },
        };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true });
  assert.equal(postCalls.length, 1);
  assert.equal(postCalls[0]?.actor.tenantId, "tenant-1");
  assert.equal(postCalls[0]?.actor.userId, "system");
  assert.deepEqual(postCalls[0]?.input, {
    studentPersonId: "person-student",
    amountCents: 50000,
    currency: "USD",
    provider: "stripe",
    providerReference: "cs_test_123",
    description: "Stripe Checkout payment",
    idempotencyKey: "stripe-session-cs_test_123",
  });
});

test("duplicate checkout.session.completed webhook returns ok without duplicate ledger insert", async () => {
  const postCalls: string[] = [];
  const seenKeys = new Set<string>();

  const dependencies = {
    webhookSecret,
    constructEvent: () => ({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_duplicate",
          amount_total: 25000,
          currency: "usd",
          metadata: {
            tenantId: "tenant-1",
            studentPersonId: "person-student",
          },
        },
      },
    }),
    serviceForTenant: async () => ({
      postPayment: async (_actor: AcademyActor, input: Record<string, unknown>) => {
        const key = String(input.idempotencyKey);
        if (!seenKeys.has(key)) {
          postCalls.push(key);
          seenKeys.add(key);
        }
        return {
          id: "entry-duplicate",
          tenantId: "tenant-1",
          studentPersonId: "person-student",
          academicPeriodId: "period-1",
          entryType: "payment" as const,
          amountCents: -25000,
          currency: "USD",
          description: "Stripe Checkout payment",
          sourceType: "payment" as const,
          sourceId: "cs_duplicate",
          postedByPersonId: "system",
          postedAt: "2026-06-22T00:00:00.000Z",
          idempotencyKey: key,
        };
      },
    }),
  };

  const first = await handleStripeWebhookRequest(webhookRequest("first"), dependencies);
  const second = await handleStripeWebhookRequest(webhookRequest("second"), dependencies);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.deepEqual(postCalls, ["stripe-session-cs_duplicate"]);
});

// This branch is the primary path for Stripe checkout payments to resolve application
// fees and unblock a draft application's submission. It was rewritten earlier in this
// feature's development after a version that bypassed finalizeSubmission (audit event +
// document-checklist snapshot + confirmation email) via a raw status UPDATE silently
// broke the admissions document-checklist gate. These tests exist to catch a regression
// back to that — a mocked db lets them assert on the exact queries run, the same way
// application-fee-integration.test.ts does at the module level.
function applicationFeeWebhookRequest() {
  return webhookRequest("signed-body");
}

function mockApplicationFeeDb(overrides: {
  transitionRowCount?: number;
  applicationRow?: Record<string, unknown>;
} = {}) {
  const calls: { sql: string; values?: unknown[] }[] = [];
  const db = {
    calls,
    async query(sql: string, values?: unknown[]) {
      calls.push({ sql, values });
      const normalized = sql.trim().toLowerCase();

      if (normalized.includes("update academy_application_fee_charges")) {
        const rowCount = overrides.transitionRowCount ?? 1;
        return { rowCount, rows: rowCount ? [{ id: "fee-1" }] : [] };
      }
      if (normalized.includes("applicant_person_id") && normalized.includes("academy_admission_applications")) {
        return {
          rowCount: 1,
          rows: [
            overrides.applicationRow ?? {
              applicant_person_id: "person-applicant",
              program_id: "program-1",
              legal_name: "Jordan Rivera",
              email: "jordan@example.com",
              idempotency_key: "public-apply-person-applicant",
            },
          ],
        };
      }
      if (normalized.includes("update academy_admission_applications") && normalized.includes("submitted")) {
        return { rowCount: 1, rows: [] };
      }
      if (normalized.includes("insert into academy_admission_application_events")) {
        return { rowCount: 1, rows: [] };
      }
      if (normalized.includes("select academic_program_id from academy_programs")) {
        return { rowCount: 1, rows: [{ academic_program_id: "11111111-1111-4111-8111-111111111111" }] };
      }
      if (normalized.includes("academy_program_document_requirements")) {
        return { rowCount: 0, rows: [] };
      }
      if (normalized.includes("academy_communication_messages")) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    },
  };
  return db;
}

test("checkout.session.completed with applicationId metadata transitions the fee to paid and finalizes submission", async () => {
  const db = mockApplicationFeeDb();

  const response = await handleStripeWebhookRequest(applicationFeeWebhookRequest(), {
    webhookSecret,
    constructEvent: () => ({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_app_fee_1",
          payment_intent: "pi_123",
          metadata: {
            tenantId: "tenant-1",
            applicationId: "app-1",
            feeChargeId: "fee-1",
          },
        },
      },
    }),
    applicationFeeDb: db,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true });

  const transitionCall = db.calls.find((c) =>
    c.sql.toLowerCase().includes("update academy_application_fee_charges"),
  );
  assert.ok(transitionCall, "must transition the fee charge to paid");
  assert.deepEqual(transitionCall?.values, ["tenant-1", "app-1", "cs_app_fee_1", "pi_123"]);

  const auditEventCall = db.calls.find((c) =>
    c.sql.includes("insert into academy_admission_application_events"),
  );
  assert.ok(
    auditEventCall,
    "must call finalizeSubmission (not just flip status) — this is what the earlier raw-SQL bug skipped",
  );

  const checklistCall = db.calls.find((c) => c.sql.includes("academy_program_document_requirements"));
  assert.ok(checklistCall, "must snapshot the document checklist via finalizeSubmission");
});

test("checkout.session.completed application fee branch is idempotent when the fee was already paid", async () => {
  const db = mockApplicationFeeDb({ transitionRowCount: 0 });

  const response = await handleStripeWebhookRequest(applicationFeeWebhookRequest(), {
    webhookSecret,
    constructEvent: () => ({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_app_fee_2",
          metadata: { tenantId: "tenant-1", applicationId: "app-1" },
        },
      },
    }),
    applicationFeeDb: db,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true });
  // finalizeSubmission is still called even when the fee transition affected zero rows
  // (already paid) — it has its own idempotency guard, so a duplicate webhook delivery
  // must not error and must not duplicate the audit event or checklist snapshot.
  const auditEventCall = db.calls.find((c) =>
    c.sql.includes("insert into academy_admission_application_events"),
  );
  assert.ok(auditEventCall, "finalizeSubmission must still run to reach its own idempotency guard");
});

test("checkout.session.completed with applicationId but missing tenantId returns 400 before touching the database", async () => {
  const db = mockApplicationFeeDb();

  const response = await handleStripeWebhookRequest(applicationFeeWebhookRequest(), {
    webhookSecret,
    constructEvent: () => ({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_app_fee_3",
          metadata: { applicationId: "app-1" },
        },
      },
    }),
    applicationFeeDb: db,
  });

  assert.equal(response.status, 400);
  assert.deepEqual(db.calls, []);
});
