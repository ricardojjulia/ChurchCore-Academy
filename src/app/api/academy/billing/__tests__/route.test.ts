import assert from "node:assert/strict";
import test from "node:test";
import {
  mutateBillingAccount,
  readBillingStatement,
} from "@/app/api/academy/billing/route";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { StudentAccountStatement } from "@/modules/billing/types";

const student: AcademyActor = {
  userId: "person-student",
  tenantId: "tenant-1",
  roles: ["student"],
};

const admin: AcademyActor = {
  userId: "person-admin",
  tenantId: "tenant-1",
  roles: ["institution_admin"],
};

const statement: StudentAccountStatement = {
  tenantId: "tenant-1",
  studentPersonId: "person-student",
  currency: "USD",
  balanceCents: 10000,
  entries: [],
};

test("billing mutation requires an idempotency key before service dispatch", async () => {
  const response = await mutateBillingAccount(
    new Request("http://localhost/api/academy/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "charge",
        studentPersonId: "person-student",
        amountCents: 10000,
        description: "Tuition",
      }),
    }),
    {
      resolveActor: async () => admin,
      serviceForActor: async () => {
        throw new Error("service should not be reached");
      },
    },
  );

  assert.equal(response.status, 400);
});

test("student billing read defaults to the authenticated student", async () => {
  const seen: string[] = [];
  const response = await readBillingStatement(
    new Request("http://localhost/api/academy/billing"),
    {
      resolveActor: async () => student,
      serviceForActor: async () => ({
        readStudentStatement: async (_actor: AcademyActor, studentPersonId: string) => {
          seen.push(studentPersonId);
          return statement;
        },
      } as never),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(seen, ["person-student"]);
});

test("billing route dispatches payment intent for the student actor", async () => {
  const seen: unknown[] = [];
  const response = await mutateBillingAccount(
    new Request("http://localhost/api/academy/billing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "intent-1",
      },
      body: JSON.stringify({
        action: "payment_intent",
        amountCents: 10000,
        provider: "manual",
      }),
    }),
    {
      resolveActor: async () => student,
      serviceForActor: async () => ({
        createPaymentIntent: async (_actor: AcademyActor, input: unknown) => {
          seen.push(input);
          return {
            id: "intent-1",
            tenantId: "tenant-1",
            studentPersonId: "person-student",
            amountCents: 10000,
            currency: "USD",
            provider: "manual",
            status: "requires_action",
            clientSecretRedacted: true,
            createdByPersonId: "person-student",
            createdAt: "2026-06-21T05:00:00.000Z",
            idempotencyKey: "intent-1",
          };
        },
      } as never),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(seen, [
    {
      studentPersonId: "person-student",
      amountCents: 10000,
      currency: "USD",
      provider: "manual",
      idempotencyKey: "intent-1",
    },
  ]);
});
