import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import {
  AcademyAuthorizationError,
  AcademyConflictError,
} from "@/modules/academy-auth/errors";
import { FinancialAidService } from "@/modules/financial-aid/service";
import {
  AidAward,
  AidDisbursement,
  AidPackage,
  FinancialAidRepository,
} from "@/modules/financial-aid/types";

const aidAdmin: AcademyActor = {
  userId: "person-admin",
  tenantId: "tenant-1",
  roles: ["institution_admin"],
};

const registrar: AcademyActor = {
  userId: "person-registrar",
  tenantId: "tenant-1",
  roles: ["registrar"],
};

const student: AcademyActor = {
  userId: "person-student",
  tenantId: "tenant-1",
  roles: ["student"],
};

const faculty: AcademyActor = {
  userId: "person-faculty",
  tenantId: "tenant-1",
  roles: ["faculty"],
};

function aidPackage(overrides: Partial<AidPackage> = {}): AidPackage {
  return {
    id: "package-1",
    tenantId: "tenant-1",
    studentPersonId: "person-student",
    aidYear: "2026-2027",
    status: "draft",
    createdByPersonId: "person-admin",
    createdAt: "2026-06-21T06:00:00.000Z",
    updatedAt: "2026-06-21T06:00:00.000Z",
    ...overrides,
  };
}

function award(overrides: Partial<AidAward> = {}): AidAward {
  return {
    id: "award-1",
    tenantId: "tenant-1",
    packageId: "package-1",
    studentPersonId: "person-student",
    awardType: "scholarship",
    sourceType: "institutional",
    status: "offered",
    amountCents: 150000,
    currency: "USD",
    description: "Institutional scholarship",
    createdByPersonId: "person-admin",
    createdAt: "2026-06-21T06:00:00.000Z",
    updatedAt: "2026-06-21T06:00:00.000Z",
    ...overrides,
  };
}

function disbursement(overrides: Partial<AidDisbursement> = {}): AidDisbursement {
  return {
    id: "disbursement-1",
    tenantId: "tenant-1",
    awardId: "award-1",
    studentPersonId: "person-student",
    status: "scheduled",
    scheduledOn: "2026-08-15",
    amountCents: 75000,
    currency: "USD",
    ledgerEntryId: undefined,
    postedByPersonId: undefined,
    postedAt: undefined,
    idempotencyKey: "disbursement-1",
    ...overrides,
  };
}

function mockRepository(): FinancialAidRepository & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async createPackage(input) {
      calls.push(`package:${input.studentPersonId}:${input.aidYear}`);
      return aidPackage(input);
    },
    async createAward(input) {
      calls.push(`award:${input.packageId}:${input.amountCents}:${input.sourceType}`);
      return award(input);
    },
    async updateAwardStatus(input) {
      calls.push(`award-status:${input.awardId}:${input.status}`);
      return award({ id: input.awardId, status: input.status });
    },
    async scheduleDisbursement(input) {
      calls.push(`schedule:${input.awardId}:${input.amountCents}:${input.scheduledOn}`);
      return disbursement(input);
    },
    async postDisbursement(input) {
      calls.push(`post:${input.disbursementId}:${input.postedByPersonId}:${input.idempotencyKey}`);
      return disbursement({
        id: input.disbursementId,
        status: "posted",
        postedByPersonId: input.postedByPersonId,
        postedAt: "2026-06-21T06:30:00.000Z",
        ledgerEntryId: "ledger-1",
        idempotencyKey: input.idempotencyKey,
      });
    },
    async createHold(input) {
      calls.push(`hold:${input.studentPersonId}:${input.holdType}`);
      return {
        id: "hold-1",
        tenantId: input.tenantId,
        studentPersonId: input.studentPersonId,
        holdType: input.holdType,
        status: "active",
        reason: input.reason,
        createdByPersonId: input.createdByPersonId,
        createdAt: "2026-06-21T06:00:00.000Z",
      };
    },
    async readStudentAid(_tenantId, studentPersonId) {
      return {
        tenantId: "tenant-1",
        studentPersonId,
        packages: [aidPackage({ studentPersonId })],
        awards: [award({ studentPersonId, status: "accepted" })],
        disbursements: [disbursement({ studentPersonId, status: "posted", ledgerEntryId: "ledger-1" })],
        activeHolds: [],
        totalAcceptedCents: 150000,
        totalPostedCents: 75000,
        currency: "USD",
      };
    },
  };
}

test("aid admin can create package, award, and schedule disbursement", async () => {
  const repository = mockRepository();
  const service = new FinancialAidService(repository);

  await service.createPackage(aidAdmin, {
    studentPersonId: "person-student",
    aidYear: "2026-2027",
  });
  await service.createAward(aidAdmin, {
    packageId: "package-1",
    studentPersonId: "person-student",
    awardType: "scholarship",
    sourceType: "institutional",
    amountCents: 150000,
    currency: "USD",
    description: "Institutional scholarship",
  });
  await service.scheduleDisbursement(aidAdmin, {
    awardId: "award-1",
    studentPersonId: "person-student",
    amountCents: 75000,
    currency: "USD",
    scheduledOn: "2026-08-15",
    idempotencyKey: "schedule-1",
  });

  assert.deepEqual(repository.calls, [
    "package:person-student:2026-2027",
    "award:package-1:150000:institutional",
    "schedule:award-1:75000:2026-08-15",
  ]);
});

test("accepted institutional aid disbursement posts through ledger integration", async () => {
  const repository = mockRepository();
  const service = new FinancialAidService(repository);

  await service.updateAwardStatus(registrar, {
    awardId: "award-1",
    status: "accepted",
  });
  const posted = await service.postDisbursement(registrar, {
    disbursementId: "disbursement-1",
    idempotencyKey: "post-1",
  });

  assert.equal(posted.status, "posted");
  assert.equal(posted.ledgerEntryId, "ledger-1");
  assert.deepEqual(repository.calls, [
    "award-status:award-1:accepted",
    "post:disbursement-1:person-registrar:post-1",
  ]);
});

test("students can read only their own aid summary", async () => {
  const repository = mockRepository();
  const service = new FinancialAidService(repository);

  const own = await service.readStudentAid(student, "person-student");
  assert.equal(own.totalAcceptedCents, 150000);

  await assert.rejects(
    () => service.readStudentAid(student, "person-other"),
    AcademyAuthorizationError,
  );
});

test("non-aid roles cannot mutate aid records", async () => {
  const service = new FinancialAidService(mockRepository());

  await assert.rejects(
    () =>
      service.createPackage(faculty, {
        studentPersonId: "person-student",
        aidYear: "2026-2027",
      }),
    AcademyAuthorizationError,
  );
});

test("regulated federal aid remains disabled behind compliance gate", async () => {
  const service = new FinancialAidService(mockRepository());

  await assert.rejects(
    () =>
      service.createAward(aidAdmin, {
        packageId: "package-1",
        studentPersonId: "person-student",
        awardType: "federal_grant",
        sourceType: "federal",
        amountCents: 150000,
        currency: "USD",
        description: "Pell Grant",
      }),
    AcademyConflictError,
  );
});
