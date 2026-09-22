import assert from "node:assert/strict";
import test from "node:test";
import { waiveFeeRequest } from "@/app/api/academy/admissions/applications/[id]/fee/waive/route";
import { AcademyAuthorizationError, AcademyConflictError } from "@/modules/academy-auth/errors";
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
    status: "waived",
    waivedReason: "Financial hardship",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function request(body: unknown) {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("fee/waive route - success passes actor, applicationId, and trimmed reason to the dependency", async () => {
  let calledWith: { actor: AcademyActor; applicationId: string; reason: string } | undefined;

  const response = await waiveFeeRequest(
    request({ reason: "  Financial hardship  " }),
    context,
    {
      resolveActor: async () => staffActor,
      waive: async (actor, applicationId, reason) => {
        calledWith = { actor, applicationId, reason };
        return feeCharge();
      },
    },
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as { feeCharge: ApplicationFeeCharge };
  assert.equal(body.feeCharge.status, "waived");
  assert.equal(calledWith?.applicationId, "app-1");
  assert.equal(calledWith?.actor, staffActor);
});

test("fee/waive route - 400 when reason is missing", async () => {
  const response = await waiveFeeRequest(request({}), context, {
    resolveActor: async () => staffActor,
    waive: async () => feeCharge(),
  });
  assert.equal(response.status, 400);
});

test("fee/waive route - 400 when reason is empty/whitespace-only", async () => {
  const response = await waiveFeeRequest(request({ reason: "   " }), context, {
    resolveActor: async () => staffActor,
    waive: async () => feeCharge(),
  });
  assert.equal(response.status, 400);
});

test("fee/waive route - 400 on malformed JSON body", async () => {
  const response = await waiveFeeRequest(
    new Request("http://localhost", { method: "POST", body: "{not json" }),
    context,
    {
      resolveActor: async () => staffActor,
      waive: async () => feeCharge(),
    },
  );
  assert.equal(response.status, 400);
});

test("fee/waive route - 403 when the actor lacks a staff role", async () => {
  const response = await waiveFeeRequest(request({ reason: "Hardship" }), context, {
    resolveActor: async () => ({
      userId: "student-1",
      tenantId: "tenant-a",
      roles: ["student"],
    }),
    waive: async () => {
      throw new AcademyAuthorizationError("Forbidden application fee access.");
    },
  });
  assert.equal(response.status, 403);
});

test("fee/waive route - 409 when the fee was already paid (cannot waive a paid fee)", async () => {
  const response = await waiveFeeRequest(request({ reason: "Hardship" }), context, {
    resolveActor: async () => staffActor,
    waive: async () => {
      throw new AcademyConflictError("Cannot waive a paid fee.");
    },
  });
  assert.equal(response.status, 409);
});

test("fee/waive route - 404 when the application/fee does not resolve (covers cross-tenant)", async () => {
  const response = await waiveFeeRequest(request({ reason: "Hardship" }), context, {
    resolveActor: async () => staffActor,
    waive: async () => {
      throw new Error("Fee charge not found.");
    },
  });
  assert.equal(response.status, 404);
});
