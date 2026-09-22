import assert from "node:assert/strict";
import test from "node:test";
import { recordManualPaymentRequest } from "@/app/api/academy/admissions/applications/[id]/fee/pay/route";
import {
  AcademyAuthenticationError,
  AcademyAuthorizationError,
  AcademyConflictError,
} from "@/modules/academy-auth/errors";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { ApplicationFeeCharge } from "@/modules/admissions/application-fee-types";

const staffActor: AcademyActor = {
  userId: "staff-1",
  tenantId: "tenant-a",
  roles: ["registrar"],
};

const context = { params: Promise.resolve({ id: "app-1" }) };

function feeCharge(overrides: Partial<ApplicationFeeCharge> = {}): ApplicationFeeCharge {
  return {
    id: "fee-1",
    tenantId: "tenant-a",
    applicationId: "app-1",
    feeType: "application_fee",
    amountCents: 5000,
    currency: "USD",
    status: "paid",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

test("fee/pay route - success returns the updated fee charge, dependency receives actor and applicationId", async () => {
  let calledWith: { actor: AcademyActor; applicationId: string } | undefined;

  const response = await recordManualPaymentRequest(
    new Request("http://localhost", { method: "POST" }),
    context,
    {
      resolveActor: async () => staffActor,
      recordPayment: async (actor, applicationId) => {
        calledWith = { actor, applicationId };
        return feeCharge();
      },
    },
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as { feeCharge: ApplicationFeeCharge };
  assert.equal(body.feeCharge.status, "paid");
  assert.deepEqual(calledWith, { actor: staffActor, applicationId: "app-1" });
});

test("fee/pay route - 401 when no verified actor is available", async () => {
  const response = await recordManualPaymentRequest(
    new Request("http://localhost", { method: "POST" }),
    context,
    {
      resolveActor: async () => {
        throw new AcademyAuthenticationError();
      },
      recordPayment: async () => feeCharge(),
    },
  );
  assert.equal(response.status, 401);
});

test("fee/pay route - 403 when the actor lacks a staff role", async () => {
  const response = await recordManualPaymentRequest(
    new Request("http://localhost", { method: "POST" }),
    context,
    {
      resolveActor: async () => ({
        userId: "student-1",
        tenantId: "tenant-a",
        roles: ["student"],
      }),
      recordPayment: async () => {
        throw new AcademyAuthorizationError("Forbidden application fee access.");
      },
    },
  );
  assert.equal(response.status, 403);
});

test("fee/pay route - 409 when the fee was already waived (cannot pay a waived fee)", async () => {
  const response = await recordManualPaymentRequest(
    new Request("http://localhost", { method: "POST" }),
    context,
    {
      resolveActor: async () => staffActor,
      recordPayment: async () => {
        throw new AcademyConflictError("Cannot record payment for a waived fee.");
      },
    },
  );
  assert.equal(response.status, 409);
});

test("fee/pay route - 404 when the application/fee does not resolve (covers cross-tenant: the repository scopes by actor.tenantId, so a cross-tenant applicationId simply matches no rows)", async () => {
  const response = await recordManualPaymentRequest(
    new Request("http://localhost", { method: "POST" }),
    context,
    {
      resolveActor: async () => staffActor,
      recordPayment: async () => {
        throw new Error("Fee charge not found.");
      },
    },
  );
  assert.equal(response.status, 404);
});

test("fee/pay route - response body never leaks a raw persistence error message", async () => {
  const response = await recordManualPaymentRequest(
    new Request("http://localhost", { method: "POST" }),
    context,
    {
      resolveActor: async () => staffActor,
      recordPayment: async () => {
        throw new Error("relation \"academy_application_fee_charges\" does not exist");
      },
    },
  );
  const body = (await response.json()) as { error: string };
  assert.equal(response.status, 500);
  assert.doesNotMatch(body.error, /relation|academy_application_fee_charges/);
});
