import assert from "node:assert/strict";
import test from "node:test";
import {
  mutateFinancialAid,
  readFinancialAidSummary,
} from "@/app/api/academy/financial-aid/route";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { StudentAidSummary } from "@/modules/financial-aid/types";

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

const summary: StudentAidSummary = {
  tenantId: "tenant-1",
  studentPersonId: "person-student",
  packages: [],
  awards: [],
  disbursements: [],
  activeHolds: [],
  totalAcceptedCents: 0,
  totalPostedCents: 0,
  currency: "USD",
};

test("student aid summary defaults to the authenticated student", async () => {
  const seen: string[] = [];
  const response = await readFinancialAidSummary(
    new Request("http://localhost/api/academy/financial-aid"),
    {
      resolveActor: async () => student,
      serviceForActor: async () => ({
        readStudentAid: async (_actor: AcademyActor, studentPersonId: string) => {
          seen.push(studentPersonId);
          return summary;
        },
      } as never),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(seen, ["person-student"]);
});

test("schedule disbursement requires idempotency key before service dispatch", async () => {
  const response = await mutateFinancialAid(
    new Request("http://localhost/api/academy/financial-aid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "schedule_disbursement",
        awardId: "award-1",
        studentPersonId: "person-student",
        amountCents: 75000,
        scheduledOn: "2026-08-15",
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

test("financial aid route dispatches institutional award creation", async () => {
  const seen: unknown[] = [];
  const response = await mutateFinancialAid(
    new Request("http://localhost/api/academy/financial-aid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_award",
        packageId: "package-1",
        studentPersonId: "person-student",
        awardType: "scholarship",
        sourceType: "institutional",
        amountCents: 150000,
        description: "Institutional scholarship",
      }),
    }),
    {
      resolveActor: async () => admin,
      serviceForActor: async () => ({
        createAward: async (_actor: AcademyActor, input: unknown) => {
          seen.push(input);
          return { id: "award-1" };
        },
      } as never),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(seen, [
    {
      packageId: "package-1",
      studentPersonId: "person-student",
      awardType: "scholarship",
      sourceType: "institutional",
      amountCents: 150000,
      currency: "USD",
      description: "Institutional scholarship",
    },
  ]);
});
