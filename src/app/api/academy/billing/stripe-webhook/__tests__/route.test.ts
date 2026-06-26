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
              entryType: "payment",
              amountCents: -Number(input.amountCents),
              currency: String(input.currency),
              description: String(input.description),
              sourceType: "payment",
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
          entryType: "payment",
          amountCents: -25000,
          currency: "USD",
          description: "Stripe Checkout payment",
          sourceType: "payment",
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
