-- Application Fee Collection
-- Standalone fee charge tracking for admission applications, intentionally isolated
-- from the billing ledger (no FK to academy_payment_intents or academy_billing_ledger_entries).
-- Applicants are not yet students/persons-with-account in the billing sense.

-- Add application fee configuration to programs. Two program tables carry this data:
-- academy_academic_programs is canonical (admin CRUD reads/writes it via
-- PostgresAcademicProgramRepository), and academy_programs is a legacy table kept in
-- sync via syncLegacyProgram() for older admissions code that queries it directly
-- (see PublicApplicationService.submitPublicApplication). Both need the columns, or
-- the admin UI can save a fee value it can never read back.
alter table public.academy_programs
  add column if not exists application_fee_cents integer
    check (application_fee_cents is null or application_fee_cents > 0),
  add column if not exists application_fee_currency text default 'USD';

alter table public.academy_academic_programs
  add column if not exists application_fee_cents integer
    check (application_fee_cents is null or application_fee_cents > 0),
  add column if not exists application_fee_currency text default 'USD';

-- Application fee charge tracking
create table if not exists public.academy_application_fee_charges (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete restrict,
  application_id uuid not null,
  fee_type text not null default 'application_fee',
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD',
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'waived')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  paid_by_person_id uuid,
  waived_by_person_id uuid,
  waived_reason text,
  waived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fk_application
    foreign key (tenant_id, application_id)
    references public.academy_admission_applications (tenant_id, id)
    on delete cascade,

  constraint waived_reason_required
    check (status != 'waived' or waived_reason is not null),

  unique (application_id, fee_type)
);

-- Tenant isolation via RLS
alter table public.academy_application_fee_charges enable row level security;
alter table public.academy_application_fee_charges force row level security;

create policy academy_application_fee_charges_tenant_isolation
  on public.academy_application_fee_charges
  using (tenant_id = current_setting('app.academy_tenant_id', true));

-- Indexes for lookups
create index if not exists academy_application_fee_charges_application_idx
  on public.academy_application_fee_charges (tenant_id, application_id);

create index if not exists academy_application_fee_charges_status_idx
  on public.academy_application_fee_charges (tenant_id, status);

create index if not exists academy_application_fee_charges_stripe_session_idx
  on public.academy_application_fee_charges (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
