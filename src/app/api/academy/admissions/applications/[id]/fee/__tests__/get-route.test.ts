import assert from "node:assert/strict";
import test from "node:test";
import { getFeeChargeRequest } from "@/app/api/academy/admissions/applications/[id]/fee/route";
import { AcademyAuthenticationError, AcademyAuthorizationError } from "@/modules/academy-auth/errors";
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
    status: "pending",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

test("fee GET route - returns the fee charge when one exists", async () => {
  const response = await getFeeChargeRequest(
    new Request("http://localhost"),
    context,
    {
      resolveActor: async () => staffActor,
      findFeeCharge: async () => feeCharge(),
    },
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as { feeCharge: ApplicationFeeCharge };
  assert.equal(body.feeCharge.status, "pending");
});

test("fee GET route - 404 when no fee charge exists (the common case — most applications have no program fee configured)", async () => {
  const response = await getFeeChargeRequest(
    new Request("http://localhost"),
    context,
    {
      resolveActor: async () => staffActor,
      findFeeCharge: async () => undefined,
    },
  );
  assert.equal(response.status, 404);
});

test("fee GET route - 401 when no verified actor is available", async () => {
  const response = await getFeeChargeRequest(
    new Request("http://localhost"),
    context,
    {
      resolveActor: async () => {
        throw new AcademyAuthenticationError();
      },
      findFeeCharge: async () => feeCharge(),
    },
  );
  assert.equal(response.status, 401);
});

test("fee GET route - 403 when the actor lacks a staff role", async () => {
  const response = await getFeeChargeRequest(
    new Request("http://localhost"),
    context,
    {
      resolveActor: async () => ({
        userId: "student-1",
        tenantId: "tenant-a",
        roles: ["student"],
      }),
      findFeeCharge: async () => {
        throw new AcademyAuthorizationError("Forbidden application fee access.");
      },
    },
  );
  assert.equal(response.status, 403);
});
