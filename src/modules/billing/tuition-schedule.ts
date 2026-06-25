import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type {
  TuitionSchedule,
  PaymentPlan,
  PaymentPlanInstallment,
  CreateTuitionScheduleInput,
  GeneratePaymentPlanInput,
  StudentPaymentPlanView,
} from "@/modules/billing/tuition-schedule-types";

export interface TuitionScheduleRepository {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const tuitionAdminRoles = new Set<AcademyRole>([
  "institution_admin",
  "finance",
]);

const tuitionReadRoles = new Set<AcademyRole>([
  "institution_admin",
  "finance",
  "registrar",
]);

const registrationRoles = new Set<AcademyRole>([
  "institution_admin",
  "registrar",
]);

function assertTuitionAdmin(actor: AcademyActor) {
  if (!actor.roles.some((role) => tuitionAdminRoles.has(role))) {
    throw new AcademyAuthorizationError(
      "Forbidden tuition schedule administration access.",
    );
  }
}

function assertTuitionRead(actor: AcademyActor) {
  if (!actor.roles.some((role) => tuitionReadRoles.has(role))) {
    throw new AcademyAuthorizationError(
      "Forbidden tuition schedule read access.",
    );
  }
}

function assertRegistrationRole(actor: AcademyActor) {
  if (!actor.roles.some((role) => registrationRoles.has(role))) {
    throw new AcademyAuthorizationError(
      "Forbidden registration access.",
    );
  }
}

function requireText(value: string, field: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required.`);
  }
  return trimmed;
}

function assertPositiveAmount(amountCents: number) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("amountCents must be a positive integer.");
  }
}

function normalizeCurrency(currency: string) {
  const normalized = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error("currency must be a three-letter ISO currency code.");
  }
  return normalized;
}

function rowToSchedule(row: Record<string, unknown>): TuitionSchedule {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    programId: String(row.program_id),
    termId: String(row.term_id),
    baseAmountCents: Number(row.base_amount_cents),
    currency: String(row.currency),
    active: Boolean(row.active),
    createdByPersonId: String(row.created_by_person_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToPaymentPlan(row: Record<string, unknown>): PaymentPlan {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentPersonId: String(row.student_person_id),
    scheduleId: String(row.schedule_id),
    registrationId: String(row.registration_id),
    planType: String(row.plan_type) as "full" | "installment",
    totalAmountCents: Number(row.total_amount_cents),
    currency: String(row.currency),
    status: String(row.status) as "active" | "paid" | "cancelled",
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToInstallment(row: Record<string, unknown>): PaymentPlanInstallment {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    planId: String(row.plan_id),
    installmentNumber: Number(row.installment_number),
    dueDate: String(row.due_date),
    amountCents: Number(row.amount_cents),
    currency: String(row.currency),
    status: String(row.status) as "pending" | "paid" | "overdue" | "waived",
    paidAt: row.paid_at != null ? String(row.paid_at) : undefined,
    ledgerEntryId: row.ledger_entry_id != null ? String(row.ledger_entry_id) : undefined,
    lateFeeAmountCents: Number(row.late_fee_cents),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function createTuitionSchedule(
  actor: AcademyActor,
  input: CreateTuitionScheduleInput,
  db: TuitionScheduleRepository,
): Promise<TuitionSchedule> {
  assertTuitionAdmin(actor);
  assertPositiveAmount(input.baseAmountCents);

  const programId = requireText(input.programId, "programId");
  const termId = requireText(input.termId, "termId");
  const currency = normalizeCurrency(input.currency ?? "USD");

  const result = await db.query(
    `insert into academy_tuition_schedules (
       tenant_id,
       program_id,
       term_id,
       base_amount_cents,
       currency,
       created_by_person_id
     ) values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [actor.tenantId, programId, termId, input.baseAmountCents, currency, actor.userId],
  );

  return rowToSchedule(result.rows[0]);
}

export async function listTuitionSchedules(
  actor: AcademyActor,
  db: TuitionScheduleRepository,
): Promise<TuitionSchedule[]> {
  assertTuitionRead(actor);

  const result = await db.query(
    `select * from academy_tuition_schedules
      where tenant_id = $1 and active = true
      order by created_at desc`,
    [actor.tenantId],
  );

  return result.rows.map(rowToSchedule);
}

export async function archiveTuitionSchedule(
  actor: AcademyActor,
  scheduleId: string,
  db: TuitionScheduleRepository,
): Promise<void> {
  assertTuitionAdmin(actor);
  const id = requireText(scheduleId, "scheduleId");

  const result = await db.query(
    `update academy_tuition_schedules
        set active = false,
            updated_at = now()
      where tenant_id = $1 and id = $2
      returning id`,
    [actor.tenantId, id],
  );

  if (result.rows.length === 0) {
    throw new Error(`Tuition schedule ${id} was not found.`);
  }
}

export async function generatePaymentPlan(
  actor: AcademyActor,
  input: GeneratePaymentPlanInput,
  db: TuitionScheduleRepository,
): Promise<PaymentPlan> {
  assertRegistrationRole(actor);

  const studentPersonId = requireText(input.studentPersonId, "studentPersonId");
  const registrationId = requireText(input.registrationId, "registrationId");
  const scheduleId = requireText(input.scheduleId, "scheduleId");

  // Check for existing plan (idempotency)
  const existing = await db.query(
    `select * from academy_payment_plans
      where tenant_id = $1 and registration_id = $2`,
    [actor.tenantId, registrationId],
  );

  if (existing.rows.length > 0) {
    return rowToPaymentPlan(existing.rows[0]);
  }

  // Load schedule
  const scheduleResult = await db.query(
    `select * from academy_tuition_schedules
      where tenant_id = $1 and id = $2 and active = true`,
    [actor.tenantId, scheduleId],
  );

  if (scheduleResult.rows.length === 0) {
    throw new Error(`Tuition schedule ${scheduleId} was not found or is not active.`);
  }

  const schedule = rowToSchedule(scheduleResult.rows[0]);

  // Create payment plan
  const planResult = await db.query(
    `insert into academy_payment_plans (
       tenant_id,
       student_person_id,
       schedule_id,
       registration_id,
       plan_type,
       total_amount_cents,
       currency
     ) values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [
      actor.tenantId,
      studentPersonId,
      scheduleId,
      registrationId,
      "installment",
      schedule.baseAmountCents,
      schedule.currency,
    ],
  );

  const plan = rowToPaymentPlan(planResult.rows[0]);

  // Generate installments (default: 4 installments for demonstration)
  const installmentCount = 4;
  const baseInstallmentAmount = Math.floor(schedule.baseAmountCents / installmentCount);
  const remainder = schedule.baseAmountCents % installmentCount;

  for (let i = 0; i < installmentCount; i++) {
    const installmentAmount = i === 0 ? baseInstallmentAmount + remainder : baseInstallmentAmount;
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + i);
    const dueDateString = dueDate.toISOString().slice(0, 10);

    await db.query(
      `insert into academy_payment_plan_installments (
         tenant_id,
         plan_id,
         installment_number,
         due_date,
         amount_cents,
         currency
       ) values ($1, $2, $3, $4, $5, $6)`,
      [actor.tenantId, plan.id, i + 1, dueDateString, installmentAmount, schedule.currency],
    );
  }

  return plan;
}

export async function markOverdueInstallments(
  tenantId: string,
  asOf: Date,
  db: TuitionScheduleRepository,
): Promise<number> {
  const asOfString = asOf.toISOString().slice(0, 10);

  const result = await db.query(
    `update academy_payment_plan_installments
        set status = 'overdue',
            updated_at = now()
      where tenant_id = $1
        and status = 'pending'
        and due_date < $2
      returning id`,
    [tenantId, asOfString],
  );

  return result.rows.length;
}

export async function applyLateFee(
  tenantId: string,
  installmentId: string,
  lateFeeAmountCents: number,
  db: TuitionScheduleRepository,
): Promise<void> {
  assertPositiveAmount(lateFeeAmountCents);

  const result = await db.query(
    `update academy_payment_plan_installments
        set late_fee_cents = late_fee_cents + $3,
            updated_at = now()
      where tenant_id = $1 and id = $2
      returning id`,
    [tenantId, installmentId, lateFeeAmountCents],
  );

  if (result.rows.length === 0) {
    throw new Error(`Installment ${installmentId} was not found.`);
  }
}

export async function getStudentPaymentPlan(
  actor: AcademyActor,
  db: TuitionScheduleRepository,
): Promise<StudentPaymentPlanView | null> {
  const hasAdminAccess = actor.roles.some((role) => tuitionReadRoles.has(role));

  // Students can only see their own plan
  if (!hasAdminAccess && !actor.roles.includes("student")) {
    throw new AcademyAuthorizationError(
      "Forbidden payment plan access.",
    );
  }

  const studentPersonId = hasAdminAccess ? actor.userId : actor.userId;

  const planResult = await db.query(
    `select * from academy_payment_plans
      where tenant_id = $1 and student_person_id = $2 and status = 'active'
      order by created_at desc
      limit 1`,
    [actor.tenantId, studentPersonId],
  );

  if (planResult.rows.length === 0) {
    return null;
  }

  const plan = rowToPaymentPlan(planResult.rows[0]);

  const installmentsResult = await db.query(
    `select * from academy_payment_plan_installments
      where tenant_id = $1 and plan_id = $2
      order by installment_number asc`,
    [actor.tenantId, plan.id],
  );

  const installments = installmentsResult.rows.map(rowToInstallment);

  return { plan, installments };
}
