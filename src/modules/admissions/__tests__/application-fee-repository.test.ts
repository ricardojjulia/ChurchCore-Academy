import assert from "node:assert/strict";
import test from "node:test";
import { PostgresApplicationFeeRepository } from "@/modules/admissions/application-fee-repository";

interface MockDatabase {
  query(sql: string, values?: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

function createMockDb(queryResults: { rowCount: number | null; rows: Record<string, unknown>[] }[]): MockDatabase {
  let callIndex = 0;
  return {
    query: async () => {
      if (callIndex >= queryResults.length) {
        throw new Error("Unexpected query call");
      }
      return queryResults[callIndex++];
    },
  };
}

test("PostgresApplicationFeeRepository.create - success", async () => {
  const mockDb = createMockDb([
    {
      rowCount: 1,
      rows: [{
        id: "fee-1",
        tenant_id: "tenant-a",
        application_id: "app-1",
        fee_type: "application_fee",
        amount_cents: 5000,
        currency: "USD",
        status: "pending",
        created_at: new Date("2026-01-01"),
        updated_at: new Date("2026-01-01"),
      }],
    },
  ]);

  const repo = new PostgresApplicationFeeRepository(mockDb);
  const result = await repo.create({
    tenantId: "tenant-a",
    applicationId: "app-1",
    feeType: "application_fee",
    amountCents: 5000,
    currency: "USD",
  });

  assert.equal(result.id, "fee-1");
  assert.equal(result.status, "pending");
  assert.equal(result.amountCents, 5000);
});

test("PostgresApplicationFeeRepository.create - idempotent on conflict", async () => {
  const mockDb = createMockDb([
    { rowCount: 0, rows: [] }, // INSERT conflict
    {
      rowCount: 1,
      rows: [{
        id: "fee-1",
        tenant_id: "tenant-a",
        application_id: "app-1",
        fee_type: "application_fee",
        amount_cents: 5000,
        currency: "USD",
        status: "paid",
        paid_at: new Date("2026-01-01"),
        created_at: new Date("2026-01-01"),
        updated_at: new Date("2026-01-01"),
      }],
    },
  ]);

  const repo = new PostgresApplicationFeeRepository(mockDb);
  const result = await repo.create({
    tenantId: "tenant-a",
    applicationId: "app-1",
    feeType: "application_fee",
    amountCents: 5000,
    currency: "USD",
  });

  assert.equal(result.status, "paid");
});

test("PostgresApplicationFeeRepository.findByApplication - found", async () => {
  const mockDb = createMockDb([
    {
      rowCount: 1,
      rows: [{
        id: "fee-1",
        tenant_id: "tenant-a",
        application_id: "app-1",
        fee_type: "application_fee",
        amount_cents: 5000,
        currency: "USD",
        status: "pending",
        created_at: new Date("2026-01-01"),
        updated_at: new Date("2026-01-01"),
      }],
    },
  ]);

  const repo = new PostgresApplicationFeeRepository(mockDb);
  const result = await repo.findByApplication("tenant-a", "app-1", "application_fee");

  assert.ok(result);
  assert.equal(result.id, "fee-1");
});

test("PostgresApplicationFeeRepository.findByApplication - not found", async () => {
  const mockDb = createMockDb([{ rowCount: 0, rows: [] }]);

  const repo = new PostgresApplicationFeeRepository(mockDb);
  const result = await repo.findByApplication("tenant-a", "app-1", "application_fee");

  assert.equal(result, undefined);
});

test("PostgresApplicationFeeRepository.transitionToPaid - success", async () => {
  const mockDb = createMockDb([
    {
      rowCount: 1,
      rows: [{
        id: "fee-1",
        tenant_id: "tenant-a",
        application_id: "app-1",
        fee_type: "application_fee",
        amount_cents: 5000,
        currency: "USD",
        status: "paid",
        paid_at: new Date("2026-01-01"),
        paid_by_person_id: "staff-1",
        created_at: new Date("2026-01-01"),
        updated_at: new Date("2026-01-01"),
      }],
    },
  ]);

  const repo = new PostgresApplicationFeeRepository(mockDb);
  const result = await repo.transitionToPaid("tenant-a", "app-1", "application_fee", {
    paidByPersonId: "staff-1",
  });

  assert.ok(result);
  assert.equal(result.status, "paid");
  assert.equal(result.paidByPersonId, "staff-1");
});

test("PostgresApplicationFeeRepository.transitionToPaid - no rows updated (not pending)", async () => {
  const mockDb = createMockDb([{ rowCount: 0, rows: [] }]);

  const repo = new PostgresApplicationFeeRepository(mockDb);
  const result = await repo.transitionToPaid("tenant-a", "app-1", "application_fee", {
    paidByPersonId: "staff-1",
  });

  assert.equal(result, undefined);
});

test("PostgresApplicationFeeRepository.transitionToWaived - success", async () => {
  const mockDb = createMockDb([
    {
      rowCount: 1,
      rows: [{
        id: "fee-1",
        tenant_id: "tenant-a",
        application_id: "app-1",
        fee_type: "application_fee",
        amount_cents: 5000,
        currency: "USD",
        status: "waived",
        waived_at: new Date("2026-01-01"),
        waived_by_person_id: "staff-1",
        waived_reason: "Financial hardship",
        created_at: new Date("2026-01-01"),
        updated_at: new Date("2026-01-01"),
      }],
    },
  ]);

  const repo = new PostgresApplicationFeeRepository(mockDb);
  const result = await repo.transitionToWaived("tenant-a", "app-1", "application_fee", {
    waivedByPersonId: "staff-1",
    waivedReason: "Financial hardship",
  });

  assert.ok(result);
  assert.equal(result.status, "waived");
  assert.equal(result.waivedReason, "Financial hardship");
});

test("PostgresApplicationFeeRepository.transitionToWaived - no rows updated (not pending)", async () => {
  const mockDb = createMockDb([{ rowCount: 0, rows: [] }]);

  const repo = new PostgresApplicationFeeRepository(mockDb);
  const result = await repo.transitionToWaived("tenant-a", "app-1", "application_fee", {
    waivedByPersonId: "staff-1",
    waivedReason: "Financial hardship",
  });

  assert.equal(result, undefined);
});
