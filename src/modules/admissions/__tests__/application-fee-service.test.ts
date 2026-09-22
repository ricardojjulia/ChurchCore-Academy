import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationFeeService } from "@/modules/admissions/application-fee-service";
import type {
  ApplicationFeeCharge,
  ApplicationFeeType,
  TransitionToPaidInput,
  TransitionToWaivedInput,
} from "@/modules/admissions/application-fee-types";
import type { AcademyActor } from "@/modules/academy-auth/policy";

interface MockFeeRepository {
  findByApplication(
    tenantId: string,
    applicationId: string,
    feeType: ApplicationFeeType,
  ): Promise<ApplicationFeeCharge | undefined>;
  transitionToPaid(
    tenantId: string,
    applicationId: string,
    feeType: ApplicationFeeType,
    input: TransitionToPaidInput,
  ): Promise<ApplicationFeeCharge | undefined>;
  transitionToWaived(
    tenantId: string,
    applicationId: string,
    feeType: ApplicationFeeType,
    input: TransitionToWaivedInput,
  ): Promise<ApplicationFeeCharge | undefined>;
}

const staffActor: AcademyActor = {
  userId: "staff-1",
  tenantId: "tenant-a",
  roles: ["registrar"],
};

const crossTenantActor: AcademyActor = {
  userId: "staff-2",
  tenantId: "tenant-b",
  roles: ["registrar"],
};

const studentActor: AcademyActor = {
  userId: "student-1",
  tenantId: "tenant-a",
  roles: ["student"],
};

function createPendingFeeCharge(): ApplicationFeeCharge {
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
  };
}

test("ApplicationFeeService.findFeeCharge - staff success", async () => {
  const mockRepo: MockFeeRepository = {
    findByApplication: async () => createPendingFeeCharge(),
    transitionToPaid: async () => undefined,
    transitionToWaived: async () => undefined,
  };

  const service = new ApplicationFeeService(mockRepo);
  const result = await service.findFeeCharge(staffActor, "app-1");

  assert.ok(result);
  assert.equal(result.status, "pending");
});

test("ApplicationFeeService.findFeeCharge - cross-tenant isolation (returns undefined)", async () => {
  // Cross-tenant isolation happens at repository level: query with wrong tenantId returns no rows
  const mockRepo: MockFeeRepository = {
    findByApplication: async (tenantId) => {
      // Repository enforces tenant isolation via query
      if (tenantId !== "tenant-a") return undefined;
      return createPendingFeeCharge();
    },
    transitionToPaid: async () => undefined,
    transitionToWaived: async () => undefined,
  };

  const service = new ApplicationFeeService(mockRepo);
  const result = await service.findFeeCharge(crossTenantActor, "app-1");

  assert.equal(result, undefined, "Cross-tenant query should return no results");
});

test("ApplicationFeeService.findFeeCharge - student rejection", async () => {
  const mockRepo: MockFeeRepository = {
    findByApplication: async () => createPendingFeeCharge(),
    transitionToPaid: async () => undefined,
    transitionToWaived: async () => undefined,
  };

  const service = new ApplicationFeeService(mockRepo);

  await assert.rejects(
    async () => service.findFeeCharge(studentActor, "app-1"),
    /Forbidden/i,
  );
});

test("ApplicationFeeService.recordManualPayment - success", async () => {
  const paid: ApplicationFeeCharge = {
    ...createPendingFeeCharge(),
    status: "paid",
    paidByPersonId: "staff-1",
    paidAt: "2026-01-02T00:00:00Z",
  };

  const mockRepo: MockFeeRepository = {
    findByApplication: async () => createPendingFeeCharge(),
    transitionToPaid: async () => paid,
    transitionToWaived: async () => undefined,
  };

  const service = new ApplicationFeeService(mockRepo);
  const result = await service.recordManualPayment(staffActor, "app-1");

  assert.equal(result.status, "paid");
  assert.equal(result.paidByPersonId, "staff-1");
});

test("ApplicationFeeService.recordManualPayment - idempotent already paid", async () => {
  const alreadyPaid: ApplicationFeeCharge = {
    ...createPendingFeeCharge(),
    status: "paid",
    paidByPersonId: "staff-1",
    paidAt: "2026-01-01T00:00:00Z",
  };

  const mockRepo: MockFeeRepository = {
    findByApplication: async () => alreadyPaid,
    transitionToPaid: async () => undefined, // No rows updated
    transitionToWaived: async () => undefined,
  };

  const service = new ApplicationFeeService(mockRepo);
  const result = await service.recordManualPayment(staffActor, "app-1");

  assert.equal(result.status, "paid");
});

test("ApplicationFeeService.recordManualPayment - reject already waived", async () => {
  const waived: ApplicationFeeCharge = {
    ...createPendingFeeCharge(),
    status: "waived",
    waivedByPersonId: "staff-2",
    waivedReason: "Hardship",
    waivedAt: "2026-01-01T00:00:00Z",
  };

  const mockRepo: MockFeeRepository = {
    findByApplication: async () => waived,
    transitionToPaid: async () => undefined, // No rows updated
    transitionToWaived: async () => undefined,
  };

  const service = new ApplicationFeeService(mockRepo);

  await assert.rejects(
    async () => service.recordManualPayment(staffActor, "app-1"),
    /waived/i,
  );
});

test("ApplicationFeeService.waiveFee - success", async () => {
  const waived: ApplicationFeeCharge = {
    ...createPendingFeeCharge(),
    status: "waived",
    waivedByPersonId: "staff-1",
    waivedReason: "Financial hardship",
    waivedAt: "2026-01-02T00:00:00Z",
  };

  const mockRepo: MockFeeRepository = {
    findByApplication: async () => createPendingFeeCharge(),
    transitionToPaid: async () => undefined,
    transitionToWaived: async () => waived,
  };

  const service = new ApplicationFeeService(mockRepo);
  const result = await service.waiveFee(staffActor, "app-1", "Financial hardship");

  assert.equal(result.status, "waived");
  assert.equal(result.waivedReason, "Financial hardship");
});

test("ApplicationFeeService.waiveFee - reject empty reason", async () => {
  const mockRepo: MockFeeRepository = {
    findByApplication: async () => createPendingFeeCharge(),
    transitionToPaid: async () => undefined,
    transitionToWaived: async () => undefined,
  };

  const service = new ApplicationFeeService(mockRepo);

  await assert.rejects(
    async () => service.waiveFee(staffActor, "app-1", "   "),
    /required/i,
  );
});

test("ApplicationFeeService.waiveFee - idempotent already waived", async () => {
  const alreadyWaived: ApplicationFeeCharge = {
    ...createPendingFeeCharge(),
    status: "waived",
    waivedByPersonId: "staff-1",
    waivedReason: "Hardship",
    waivedAt: "2026-01-01T00:00:00Z",
  };

  const mockRepo: MockFeeRepository = {
    findByApplication: async () => alreadyWaived,
    transitionToPaid: async () => undefined,
    transitionToWaived: async () => undefined, // No rows updated
  };

  const service = new ApplicationFeeService(mockRepo);
  const result = await service.waiveFee(staffActor, "app-1", "Another reason");

  assert.equal(result.status, "waived");
});

test("ApplicationFeeService.waiveFee - reject already paid", async () => {
  const paid: ApplicationFeeCharge = {
    ...createPendingFeeCharge(),
    status: "paid",
    paidByPersonId: "staff-1",
    paidAt: "2026-01-01T00:00:00Z",
  };

  const mockRepo: MockFeeRepository = {
    findByApplication: async () => paid,
    transitionToPaid: async () => undefined,
    transitionToWaived: async () => undefined, // No rows updated
  };

  const service = new ApplicationFeeService(mockRepo);

  await assert.rejects(
    async () => service.waiveFee(staffActor, "app-1", "Some reason"),
    /paid/i,
  );
});
