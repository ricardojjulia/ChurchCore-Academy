# ADR-0047 — Tuition Schedule and Payment Plan Engine

**Date:** 2026-06-22
**Status:** Accepted
**Deciders:** Ricardo Julia (sole approver)

---

## Context

The billing module contains a ledger model that supports manual charge and credit posting (`src/modules/billing/`). Manual posting works for one-off adjustments but cannot serve as the primary tuition collection mechanism for a running institution. No engine exists that:

- Defines tuition rates per program and per term
- Generates tuition charges automatically when a student's registration is confirmed
- Structures charges into installments based on a payment plan the student selects
- Tracks due dates and posts late fees when installments are overdue

The consequence is that billing is entirely manual today. Every charge must be entered by hand by an admin. There is no way to enforce consistent tuition rates across students in the same program, no payment plan differentiation, and no automated late-fee enforcement.

ADR-0042 records the Stripe integration and PCI boundary. That ADR establishes that Stripe handles payment processing and Academy handles the ledger. This ADR records the tuition scheduling layer that sits between registration confirmation and the Stripe payment link — the engine that decides what is owed, when it is owed, and in how many installments.

The competitive roadmap (docs/competitive-roadmap.md, T3-09) identifies the tuition schedule engine as a Tier 3 feature with ADR-0047 required before implementation begins.

---

## Decision

### 1. TuitionScheduleService

Add `src/modules/billing/tuition-schedule.ts` exporting `TuitionScheduleService`. This service is the only entry point for generating payment plan records from a confirmed registration. No other module or API route may directly insert rows into `academy_payment_plans` or `academy_payment_plan_installments`.

### 2. New entities

**`TuitionSchedule`** — the per-program, per-term tuition rate defined by institution admins:

- `id`, `tenant_id`
- `program_id` — references `academy_programs`
- `term_id` — references `academy_terms`
- `base_amount` — total tuition amount in cents (integer, avoids floating-point rounding)
- `currency` — ISO 4217, default `USD`
- `allowed_plan_types` — array of `PaymentPlanType` values the institution permits for this schedule
- `late_fee_amount` — flat fee in cents posted per overdue installment cycle
- `late_fee_grace_period_days` — days after due date before the late fee is posted
- `active` — boolean; only active schedules are matched to new registrations

**`PaymentPlan`** — a student's selected payment arrangement for a specific registration:

- `id`, `tenant_id`, `student_id`, `registration_id`
- `tuition_schedule_id`
- `plan_type`: enum — `full`, `biannual`, `monthly`
- `total_amount` — copied from the schedule at plan creation time (immutable after creation)
- `created_at`, `status`: `active`, `completed`, `cancelled`

**`PaymentPlanInstallment`** — a single charge within a payment plan:

- `id`, `tenant_id`, `payment_plan_id`
- `installment_number` — 1-indexed position within the plan
- `amount` — in cents
- `due_date`
- `status`: `pending`, `paid`, `overdue`, `waived`
- `ledger_entry_id` — reference to the billing ledger charge entry posted when this installment was created
- `stripe_payment_link_id` — set when a Stripe Payment Link is generated
- `paid_at` — set when the Stripe webhook confirms payment

### 3. Database tables

Three new tenant-scoped tables:

- `academy_tuition_schedules`
- `academy_payment_plans`
- `academy_payment_plan_installments`

All carry `tenant_id` as the first column with RLS enforcement. `academy_tuition_schedules` is editable by institution admins. `academy_payment_plans` and `academy_payment_plan_installments` are append-only in content once created; status transitions use explicit UPDATE on `status` and `paid_at` columns only.

### 4. Engine behavior on registration confirmation

When a student's registration transitions to `confirmed`, the enrollment workflow calls `TuitionScheduleService.applyTuitionForRegistration(registrationId, planType)`:

1. Look up the active `TuitionSchedule` for the registration's program and term. If no schedule exists, return without posting charges (charge posting is optional; not all programs have tuition).
2. Validate that `planType` is in the schedule's `allowed_plan_types`.
3. Create a `PaymentPlan` record linked to the registration.
4. Generate installment records based on `planType` (see §5 below).
5. Post a billing ledger charge entry for each installment (`billing.postCharge`).
6. Enqueue a Stripe Payment Link generation job for each installment (executed by the outbox worker per ADR-0019).

The entire operation runs inside a single database transaction. If any step fails, no plan, installment, or ledger entry is committed.

### 5. Payment plan types and installment generation

**`full`** — one installment for the full `base_amount`, due on the term's first payment due date.

**`biannual`** — two installments of equal amounts. First installment due on the term's first payment due date. Second installment due at the midpoint of the term. If `base_amount` is odd in cents, the first installment carries the extra cent.

**`monthly`** — one installment per calendar month between the term start date and term end date. Amount is `base_amount` divided by month count; remainder is added to the first installment. Minimum month count is 2; if a term spans fewer than 2 months, `monthly` falls back to `biannual`.

### 6. Late fee enforcement

A Vercel Cron job (`/api/academy/billing/late-fees`, scheduled daily at 02:00 UTC) runs `TuitionScheduleService.applyLateFees()`:

1. Query all `pending` installments where `due_date` + `late_fee_grace_period_days` < today.
2. For each, post a late fee ledger entry using the schedule's `late_fee_amount`.
3. Update the installment `status` to `overdue`.
4. Each late fee posting produces an audit event per ADR-0019.

Late fees are posted at most once per installment per overdue cycle (the status transition to `overdue` prevents duplicate posting).

### 7. Stripe integration

Each installment record generates a Stripe Payment Link via the outbox worker established in ADR-0042. The Payment Link is for the installment's `amount` and includes the `installment_id` as the metadata key so the Stripe webhook can identify which installment is being paid.

On receipt of a `checkout.session.completed` or `payment_intent.succeeded` Stripe webhook:

- Confirm `installment_id` metadata is present; reject events without it.
- Set `installment.status = paid` and `installment.paid_at`.
- Post a credit ledger entry via `billing.postCredit` that references the Stripe charge ID.
- If all installments in the payment plan are `paid`, set `payment_plan.status = completed`.

Stripe secret keys and payment intent IDs are never stored in Academy billing ledger entries or audit metadata.

### 8. Admin UI

Institution admins manage tuition schedules at `/admin/billing/tuition-schedules`:

- Create a schedule: select program, select term, enter base amount, choose allowed plan types, configure late fee settings.
- Edit a schedule: only active schedules with no existing payment plans may be edited. Schedules with active plans are archived (`active = false`) and a new schedule is created.
- View: list all schedules with program, term, amount, and plan type columns.

Students see their payment plan and installment due dates at `/account/billing` in the Student PWA:

- Current plan type and total amount.
- Per-installment status, amount, due date, and a Pay Now button that opens the Stripe Payment Link.
- Past-paid installments with `paid_at` confirmation.

---

## Consequences

- Tuition charges are generated consistently and automatically at registration confirmation, eliminating manual per-student charge entry.
- Payment plan flexibility (full, biannual, monthly) is supported at the schedule level, giving institutions control over what plans they offer per program.
- The daily cron late fee job requires a reliable Vercel Cron configuration and monitoring; a missed cron run delays late fee posting by one day.
- The `applyTuitionForRegistration` transaction must be idempotent — registration confirmation events may be retried. Idempotency is enforced by checking for an existing `PaymentPlan` linked to the `registration_id` before creating a new one.
- If no tuition schedule exists for a program/term, no charges are posted and no error is raised. This supports scholarship-only students and programs that do not charge tuition.
- Installment amounts are stored in integer cents. All amount arithmetic in the service layer must use integer operations; no floating-point division.

---

## Alternatives Considered

**Manual ledger posting only (current state):**

- Rejected. Does not scale to an institution with more than a handful of students. Each registration would require a separate admin action to post charges.

**Single-charge billing (no installments):**

- Rejected. Faith-based schools frequently serve students with limited means. Monthly payment plans are a pastoral accommodation and a competitive expectation; Populi offers them.

**Store tuition rates in the course catalog:**

- Rejected. Tuition is a billing concern, not a course delivery concern. Rates vary by program and term, not by individual course. Mixing billing configuration into the course catalog violates the domain boundary and complicates course management.

**Client-side installment math (computed on read, not stored):**

- Rejected. Installment amounts and due dates must be fixed at plan creation time. Recomputing them dynamically would cause amounts to drift if a term's date or the schedule's base amount changes after enrollment.

**TuitionScheduleService with stored plans, integer cents, idempotent application:**

- Accepted. Clear domain ownership, explicit installment records, safe Stripe integration boundary, and late-fee automation.

---

## Review Notes

- Product boundary: `TuitionScheduleService` owns plan generation and late-fee logic. Stripe communication is delegated to the outbox worker. The billing ledger module owns the charge/credit posting API.
- Security/privacy: Stripe secret keys, payment intent IDs, and customer IDs must never appear in Academy billing ledger entries, installment records, or audit metadata.
- Testing: required cases include successful plan generation (all three plan types), cross-tenant rejection, duplicate registration idempotency, missing schedule (no-op), biannual cent-rounding, monthly fallback for short terms, late fee posting for overdue installments, late fee non-duplication after status transition, and Stripe webhook credit posting.
- Rollback: the three new tables are additive. The cron job can be disabled independently. Removing the tables requires archiving or migrating any existing payment plan records.

---

## Related

- ADR-0019 — Immutable audit events and outbox boundary (outbox pattern for Stripe Payment Link generation and late fee audit events)
- ADR-0042 — Stripe payment integration and PCI boundary (Stripe secret handling, webhook verification, ledger credit posting)
- ADR-0011 — Official record transcript and audit model (registration confirmation is the trigger event)
- ADR-0029 — Official records print and export strategy (billing statements as a future print surface)
