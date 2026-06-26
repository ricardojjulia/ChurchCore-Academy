import assert from "node:assert/strict";
import test from "node:test";
import { createBillingCheckoutSessionRequest } from "@/app/api/academy/billing/checkout/route";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { BillingPaymentIntent } from "@/modules/billing/types";

const admin: AcademyActor = {
  userId: "person-admin",
  tenantId: "tenant-1",
  roles: ["institution_admin"],
};

function checkoutRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/academy/billing/payment-link", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://academy.example.test",
    },
    body: JSON.stringify(body),
  });
}

function intent(overrides: Partial<BillingPaymentIntent> = {}): BillingPaymentIntent {
  return {
    id: "intent-1",
    tenantId: "tenant-1",
    studentPersonId: "person-student",
    amountCents: 50000,
    currency: "USD",
    provider: "stripe",
    status: "requires_action",
    providerReference: "safe-reference",
    clientSecretRedacted: true,
    createdByPersonId: "person-admin",
    createdAt: "2026-06-22T00:00:00.000Z",
    idempotencyKey: "checkout-idempotency",
    ...overrides,
  };
}

test("admin payment link creates Stripe-hosted checkout and queues student communication", async () => {
  const calls: string[] = [];

  const response = await createBillingCheckoutSessionRequest(
    checkoutRequest({
      studentPersonId: "person-student",
      amountCents: 50000,
      description: "Fall tuition",
    }),
    {
      resolveActor: async () => admin,
      createPaymentIntent: async (actor, input) => {
        calls.push(`intent:${actor.userId}:${input.studentPersonId}:${input.provider}`);
        return intent({
          studentPersonId: input.studentPersonId,
          amountCents: input.amountCents,
          currency: input.currency,
          idempotencyKey: input.idempotencyKey,
        });
      },
      createCheckoutSession: async (input) => {
        calls.push(`stripe:${input.metadata.tenantId}:${input.metadata.studentPersonId}`);
        assert.equal(input.mode, "payment");
        assert.deepEqual(input.payment_method_types, ["card"]);
        assert.equal(input.line_items[0]?.price_data.unit_amount, 50000);
        assert.equal(input.success_url, "https://academy.example.test/student/account?payment=success");
        return {
          id: "cs_test_123",
          url: "https://checkout.stripe.test/session/cs_test_123",
        };
      },
      recordCheckoutSession: async (input) => {
        calls.push(`record:${input.intentId}:${input.stripeCheckoutSessionId}`);
      },
      enqueuePaymentLink: async (input) => {
        calls.push(`enqueue:${input.studentPersonId}:${input.checkoutUrl}`);
      },
    },
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload, {
    intentId: "intent-1",
    checkoutUrl: "https://checkout.stripe.test/session/cs_test_123",
  });
  assert.doesNotMatch(JSON.stringify(payload), /client_secret|secret_/i);
  assert.deepEqual(calls, [
    "intent:person-admin:person-student:stripe",
    "stripe:tenant-1:person-student",
    "record:intent-1:cs_test_123",
    "enqueue:person-student:https://checkout.stripe.test/session/cs_test_123",
  ]);
});

test("admin payment link maps provider failures to safe errors", async () => {
  const response = await createBillingCheckoutSessionRequest(
    checkoutRequest({
      studentPersonId: "person-student",
      amountCents: 50000,
      description: "Fall tuition",
    }),
    {
      resolveActor: async () => admin,
      createPaymentIntent: async () => intent(),
      createCheckoutSession: async () => {
        throw new Error("Stripe request failed for sk_test_unsafe_secret");
      },
      recordCheckoutSession: async () => {
        throw new Error("record should not be reached");
      },
      enqueuePaymentLink: async () => {
        throw new Error("enqueue should not be reached");
      },
    },
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: "Checkout session creation failed.",
  });
});
