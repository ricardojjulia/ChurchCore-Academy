import assert from "node:assert/strict";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import {
  createTuitionSchedule,
  listTuitionSchedules,
  generatePaymentPlan,
  markOverdueInstallments,
  applyLateFee,
  getStudentPaymentPlan,
  type TuitionScheduleRepository,
} from "@/modules/billing/tuition-schedule";

const finance: AcademyActor = {
  userId: "person-finance",
  tenantId: "tenant-1",
  roles: ["finance"],
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

const otherTenantStudent: AcademyActor = {
  userId: "person-student-2",
  tenantId: "tenant-2",
  roles: ["student"],
};

const faculty: AcademyActor = {
  userId: "person-faculty",
  tenantId: "tenant-1",
  roles: ["faculty"],
};

function mockRepository(): TuitionScheduleRepository & {
  schedules: Record<string, unknown>[];
  plans: Record<string, unknown>[];
  installments: Record<string, unknown>[];
} {
  const schedules: Record<string, unknown>[] = [];
  const plans: Record<string, unknown>[] = [];
  const installments: Record<string, unknown>[] = [];

  return {
    schedules,
    plans,
    installments,
    async query(text: string, values?: unknown[]) {
      const sql = text.toLowerCase();

      // Create schedule
      if (sql.includes("insert into academy_tuition_schedules")) {
        const row = {
          id: `schedule-${schedules.length + 1}`,
          tenant_id: values?.[0],
          program_id: values?.[1],
          term_id: values?.[2],
          base_amount_cents: values?.[3],
          currency: values?.[4],
          active: true,
          created_by_person_id: values?.[5],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        schedules.push(row);
        return { rows: [row] };
      }

      // List schedules
      if (sql.includes("select * from academy_tuition_schedules") && sql.includes("active = true")) {
        const tenantId = values?.[0];
        return {
          rows: schedules.filter(
            (s) => s.tenant_id === tenantId && s.active === true,
          ),
        };
      }

      // Archive schedule
      if (sql.includes("update academy_tuition_schedules") && sql.includes("active = false")) {
        const tenantId = values?.[0];
        const id = values?.[1];
        const schedule = schedules.find(
          (s) => s.tenant_id === tenantId && s.id === id,
        );
        if (schedule) {
          schedule.active = false;
          schedule.updated_at = new Date().toISOString();
          return { rows: [{ id }] };
        }
        return { rows: [] };
      }

      // Check existing plan (idempotency)
      if (sql.includes("select * from academy_payment_plans") && sql.includes("registration_id")) {
        const tenantId = values?.[0];
        const registrationId = values?.[1];
        return {
          rows: plans.filter(
            (p) => p.tenant_id === tenantId && p.registration_id === registrationId,
          ),
        };
      }

      // Load schedule for plan generation
      if (sql.includes("select * from academy_tuition_schedules") && sql.includes("id = $2")) {
        const tenantId = values?.[0];
        const id = values?.[1];
        return {
          rows: schedules.filter(
            (s) => s.tenant_id === tenantId && s.id === id && s.active === true,
          ),
        };
      }

      // Create payment plan
      if (sql.includes("insert into academy_payment_plans")) {
        const row = {
          id: `plan-${plans.length + 1}`,
          tenant_id: values?.[0],
          student_person_id: values?.[1],
          schedule_id: values?.[2],
          registration_id: values?.[3],
          plan_type: values?.[4],
          total_amount_cents: values?.[5],
          currency: values?.[6],
          status: "active",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        plans.push(row);
        return { rows: [row] };
      }

      // Create installment
      if (sql.includes("insert into academy_payment_plan_installments")) {
        const row = {
          id: `installment-${installments.length + 1}`,
          tenant_id: values?.[0],
          plan_id: values?.[1],
          installment_number: values?.[2],
          due_date: values?.[3],
          amount_cents: values?.[4],
          currency: values?.[5],
          status: "pending",
          late_fee_cents: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        installments.push(row);
        return { rows: [row] };
      }

      // Mark overdue installments
      if (sql.includes("update academy_payment_plan_installments") && sql.includes("overdue")) {
        const tenantId = values?.[0];
        const asOfString = values?.[1];
        const marked = installments.filter(
          (i) =>
            i.tenant_id === tenantId &&
            i.status === "pending" &&
            String(i.due_date) < asOfString,
        );
        marked.forEach((i) => {
          i.status = "overdue";
          i.updated_at = new Date().toISOString();
        });
        return { rows: marked };
      }

      // Apply late fee
      if (sql.includes("update academy_payment_plan_installments") && sql.includes("late_fee_cents")) {
        const tenantId = values?.[0];
        const id = values?.[1];
        const lateFee = values?.[2];
        const installment = installments.find(
          (i) => i.tenant_id === tenantId && i.id === id,
        );
        if (installment) {
          installment.late_fee_cents = Number(installment.late_fee_cents) + Number(lateFee);
          installment.updated_at = new Date().toISOString();
          return { rows: [{ id }] };
        }
        return { rows: [] };
      }

      // Get student payment plan
      if (sql.includes("select * from academy_payment_plans") && sql.includes("student_person_id")) {
        const tenantId = values?.[0];
        const studentPersonId = values?.[1];
        return {
          rows: plans.filter(
            (p) =>
              p.tenant_id === tenantId &&
              p.student_person_id === studentPersonId &&
              p.status === "active",
          ),
        };
      }

      // Get installments for plan
      if (sql.includes("select * from academy_payment_plan_installments") && sql.includes("plan_id")) {
        const tenantId = values?.[0];
        const planId = values?.[1];
        return {
          rows: installments.filter(
            (i) => i.tenant_id === tenantId && i.plan_id === planId,
          ),
        };
      }

      return { rows: [] };
    },
  };
}

test("finance admin can create tuition schedule", async () => {
  const repository = mockRepository();

  const schedule = await createTuitionSchedule(
    finance,
    {
      programId: "program-1",
      termId: "term-1",
      baseAmountCents: 120000,
      currency: "USD",
      planType: "installment",
      installmentCount: 4,
    },
    repository,
  );

  assert.equal(schedule.programId, "program-1");
  assert.equal(schedule.termId, "term-1");
  assert.equal(schedule.baseAmountCents, 120000);
  assert.equal(schedule.currency, "USD");
  assert.equal(schedule.active, true);
  assert.equal(repository.schedules.length, 1);
});

test("non-finance role cannot create tuition schedule", async () => {
  const repository = mockRepository();

  await assert.rejects(
    () =>
      createTuitionSchedule(
        faculty,
        {
          programId: "program-1",
          termId: "term-1",
          baseAmountCents: 120000,
          planType: "installment",
        },
        repository,
      ),
    AcademyAuthorizationError,
  );
});

test("registrar can list tuition schedules", async () => {
  const repository = mockRepository();

  await createTuitionSchedule(
    finance,
    {
      programId: "program-1",
      termId: "term-1",
      baseAmountCents: 120000,
      planType: "installment",
    },
    repository,
  );

  const schedules = await listTuitionSchedules(registrar, repository);

  assert.equal(schedules.length, 1);
  assert.equal(schedules[0].programId, "program-1");
});

test("generatePaymentPlan creates correct number of installments", async () => {
  const repository = mockRepository();

  const schedule = await createTuitionSchedule(
    finance,
    {
      programId: "program-1",
      termId: "term-1",
      baseAmountCents: 120000,
      planType: "installment",
      installmentCount: 4,
    },
    repository,
  );

  const plan = await generatePaymentPlan(
    registrar,
    {
      studentPersonId: "person-student",
      registrationId: "reg-1",
      scheduleId: schedule.id,
    },
    repository,
  );

  assert.equal(plan.totalAmountCents, 120000);
  assert.equal(plan.registrationId, "reg-1");
  assert.equal(repository.installments.length, 4);

  // Check installment amounts sum to total
  const totalInstallmentAmount = repository.installments.reduce(
    (sum, i) => sum + Number(i.amount_cents),
    0,
  );
  assert.equal(totalInstallmentAmount, 120000);
});

test("generatePaymentPlan is idempotent on duplicate registrationId", async () => {
  const repository = mockRepository();

  const schedule = await createTuitionSchedule(
    finance,
    {
      programId: "program-1",
      termId: "term-1",
      baseAmountCents: 120000,
      planType: "installment",
    },
    repository,
  );

  const plan1 = await generatePaymentPlan(
    registrar,
    {
      studentPersonId: "person-student",
      registrationId: "reg-1",
      scheduleId: schedule.id,
    },
    repository,
  );

  const plan2 = await generatePaymentPlan(
    registrar,
    {
      studentPersonId: "person-student",
      registrationId: "reg-1",
      scheduleId: schedule.id,
    },
    repository,
  );

  assert.equal(plan1.id, plan2.id);
  assert.equal(repository.plans.length, 1);
});

test("markOverdueInstallments marks only past-due pending installments", async () => {
  const repository = mockRepository();

  const schedule = await createTuitionSchedule(
    finance,
    {
      programId: "program-1",
      termId: "term-1",
      baseAmountCents: 120000,
      planType: "installment",
    },
    repository,
  );

  await generatePaymentPlan(
    registrar,
    {
      studentPersonId: "person-student",
      registrationId: "reg-1",
      scheduleId: schedule.id,
    },
    repository,
  );

  // Set first installment to past due
  repository.installments[0].due_date = "2025-01-01";

  const asOf = new Date("2025-06-01");
  const markedCount = await markOverdueInstallments("tenant-1", asOf, repository);

  assert.equal(markedCount, 1);
  assert.equal(repository.installments[0].status, "overdue");
  assert.equal(repository.installments[1].status, "pending");
});

test("applyLateFee adds late fee to installment", async () => {
  const repository = mockRepository();

  const schedule = await createTuitionSchedule(
    finance,
    {
      programId: "program-1",
      termId: "term-1",
      baseAmountCents: 120000,
      planType: "installment",
    },
    repository,
  );

  await generatePaymentPlan(
    registrar,
    {
      studentPersonId: "person-student",
      registrationId: "reg-1",
      scheduleId: schedule.id,
    },
    repository,
  );

  const installmentId = String(repository.installments[0].id);

  await applyLateFee("tenant-1", installmentId, 5000, repository);

  assert.equal(repository.installments[0].late_fee_cents, 5000);
});

test("student can see own payment plan", async () => {
  const repository = mockRepository();

  const schedule = await createTuitionSchedule(
    finance,
    {
      programId: "program-1",
      termId: "term-1",
      baseAmountCents: 120000,
      planType: "installment",
    },
    repository,
  );

  await generatePaymentPlan(
    registrar,
    {
      studentPersonId: "person-student",
      registrationId: "reg-1",
      scheduleId: schedule.id,
    },
    repository,
  );

  const view = await getStudentPaymentPlan(student, repository);

  assert.ok(view);
  assert.equal(view.plan.studentPersonId, "person-student");
  assert.equal(view.installments.length, 4);
});

test("student cannot see another student plan (cross-tenant)", async () => {
  const repository = mockRepository();

  const schedule = await createTuitionSchedule(
    finance,
    {
      programId: "program-1",
      termId: "term-1",
      baseAmountCents: 120000,
      planType: "installment",
    },
    repository,
  );

  await generatePaymentPlan(
    registrar,
    {
      studentPersonId: "person-student",
      registrationId: "reg-1",
      scheduleId: schedule.id,
    },
    repository,
  );

  // Different tenant student should not see plan
  const view = await getStudentPaymentPlan(otherTenantStudent, repository);

  assert.equal(view, null);
});
