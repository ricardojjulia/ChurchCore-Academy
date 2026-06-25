import assert from "node:assert/strict";
import test from "node:test";
import { createStudentBillingCheckoutRequest } from "@/app/api/academy/students/me/billing/pay/route";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { StudentAccountStatement } from "@/modules/billing/types";

const student: AcademyActor = {
  userId: "person-student",
  tenantId: "tenant-1",
  roles: ["student"],
};

function statement(balanceCents: number): StudentAccountStatement {
  return {
    tenantId: "tenant-1",
    studentPersonId: "person-student",
    currency: "USD",
    balanceCents,
    entries: [],
  };
}

test("student self-pay creates Stripe checkout for the authenticated student's current balance", async () => {
  const calls: string[] = [];

  const response = await createStudentBillingCheckoutRequest(
    new Request("http://localhost/api/academy/students/me/billing/pay", {
      method: "POST",
      headers: { origin: "https://academy.example.test" },
    }),
    {
      resolveActor: async () => student,
      readStatement: async (actor, studentPersonId) => {
        calls.push(`statement:${actor.userId}:${studentPersonId}`);
        return statement(37500);
      },
      createPaymentIntent: async (actor, input) => {
        calls.push(`intent:${actor.userId}:${input.studentPersonId}:${input.amountCents}`);
        return {
          id: "intent-student-1",
          tenantId: actor.tenantId,
          studentPersonId: input.studentPersonId,
          amountCents: input.amountCents,
          currency: input.currency,
          provider: "stripe",
          status: "requires_action",
          clientSecretRedacted: true,
          createdByPersonId: actor.userId,
          createdAt: "2026-06-22T00:00:00.000Z",
          idempotencyKey: input.idempotencyKey,
        };
      },
      createCheckoutSession: async (input) => {
        calls.push(`stripe:${input.metadata.tenantId}:${input.metadata.studentPersonId}`);
        assert.equal(input.line_items[0]?.price_data.unit_amount, 37500);
        assert.equal(input.success_url, "https://academy.example.test/student/account?payment=success");
        return {
          id: "cs_student_123",
          url: "https://checkout.stripe.test/session/cs_student_123",
        };
      },
      recordCheckoutSession: async (input) => {
        calls.push(`record:${input.intentId}:${input.stripeCheckoutSessionId}`);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    checkoutUrl: "https://checkout.stripe.test/session/cs_student_123",
  });
  assert.deepEqual(calls, [
    "statement:person-student:person-student",
    "intent:person-student:person-student:37500",
    "stripe:tenant-1:person-student",
    "record:intent-student-1:cs_student_123",
  ]);
});

test("student self-pay rejects accounts with no current balance", async () => {
  const response = await createStudentBillingCheckoutRequest(
    new Request("http://localhost/api/academy/students/me/billing/pay", {
      method: "POST",
    }),
    {
      resolveActor: async () => student,
      readStatement: async () => statement(0),
      createPaymentIntent: async () => {
        throw new Error("intent should not be reached");
      },
      createCheckoutSession: async () => {
        throw new Error("stripe should not be reached");
      },
      recordCheckoutSession: async () => {
        throw new Error("record should not be reached");
      },
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "No payment is currently due.",
  });
});
