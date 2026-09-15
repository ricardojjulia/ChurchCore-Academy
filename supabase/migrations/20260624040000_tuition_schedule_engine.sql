-- T3-09: Tuition Schedule and Payment Plan Engine
-- Per-program, per-term tuition rates, payment plans, and installment tracking

-- 1. Tuition Schedules — admin-managed tuition rates by program and term
create table if not exists public.academy_tuition_schedules (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete cascade,
  program_id text not null,
  term_id text not null,
  base_amount_cents integer not null,
  currency text not null default 'USD',
  active boolean not null default true,
  created_by_person_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_tuition_schedules_tenant_program_term_idx
  on public.academy_tuition_schedules (tenant_id, program_id, term_id, active);

alter table public.academy_tuition_schedules enable row level security;
alter table public.academy_tuition_schedules force row level security;

create policy "tenant_isolation_tuition_schedules"
  on public.academy_tuition_schedules
  using (tenant_id = current_setting('app.academy_tenant_id', true));

-- 2. Payment Plans — student's selected payment arrangement for a registration
create table if not exists public.academy_payment_plans (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete cascade,
  student_person_id text not null,
  schedule_id text not null references public.academy_tuition_schedules(id) on delete restrict,
  registration_id text not null,
  plan_type text not null check (plan_type in ('full', 'installment')),
  total_amount_cents integer not null,
  currency text not null,
  status text not null default 'active' check (status in ('active', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_payment_plans_unique_registration unique (tenant_id, registration_id)
);

create index if not exists academy_payment_plans_tenant_student_idx
  on public.academy_payment_plans (tenant_id, student_person_id);

create index if not exists academy_payment_plans_tenant_schedule_idx
  on public.academy_payment_plans (tenant_id, schedule_id);

alter table public.academy_payment_plans enable row level security;
alter table public.academy_payment_plans force row level security;

create policy "tenant_isolation_payment_plans"
  on public.academy_payment_plans
  using (tenant_id = current_setting('app.academy_tenant_id', true));

-- 3. Payment Plan Installments — individual due dates within a payment plan
create table if not exists public.academy_payment_plan_installments (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete cascade,
  plan_id text not null references public.academy_payment_plans(id) on delete cascade,
  installment_number integer not null,
  due_date date not null,
  amount_cents integer not null,
  currency text not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'waived')),
  paid_at timestamptz,
  ledger_entry_id text,
  late_fee_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_payment_plan_installments_unique_number unique (tenant_id, plan_id, installment_number)
);

create index if not exists academy_payment_plan_installments_tenant_plan_idx
  on public.academy_payment_plan_installments (tenant_id, plan_id);

create index if not exists academy_payment_plan_installments_status_due_idx
  on public.academy_payment_plan_installments (tenant_id, status, due_date);

alter table public.academy_payment_plan_installments enable row level security;
alter table public.academy_payment_plan_installments force row level security;

create policy "tenant_isolation_payment_plan_installments"
  on public.academy_payment_plan_installments
  using (tenant_id = current_setting('app.academy_tenant_id', true));
