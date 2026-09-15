-- Federal aid program tracking
create table if not exists public.academy_federal_aid_programs (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete cascade,
  program_code text not null,
  program_name text not null,
  opeid text,
  active boolean not null default true,
  max_annual_award_cents integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_federal_aid_programs_unique unique (tenant_id, program_code)
);

alter table public.academy_federal_aid_programs enable row level security;
alter table public.academy_federal_aid_programs force row level security;

create policy academy_federal_aid_programs_tenant_isolation
  on public.academy_federal_aid_programs
  using (tenant_id = current_setting('app.academy_tenant_id', true));

-- SAP (Satisfactory Academic Progress) evaluations
create table if not exists public.academy_sap_evaluations (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete cascade,
  student_person_id text not null references public.academy_people(id) on delete cascade,
  evaluation_period text not null,
  evaluation_date date not null,
  qualitative_standard text not null check (qualitative_standard in ('meets','warning','probation','suspended')),
  quantitative_standard text not null check (quantitative_standard in ('meets','warning','probation','suspended')),
  cumulative_gpa numeric(4,3),
  completion_rate numeric(5,2),
  max_timeframe_compliant boolean not null default true,
  evaluated_by_person_id text not null,
  appeal_filed boolean not null default false,
  appeal_outcome text check (appeal_outcome in ('approved','denied')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_sap_evaluations_unique unique (tenant_id, student_person_id, evaluation_period)
);

alter table public.academy_sap_evaluations enable row level security;
alter table public.academy_sap_evaluations force row level security;

create policy academy_sap_evaluations_tenant_isolation
  on public.academy_sap_evaluations
  using (tenant_id = current_setting('app.academy_tenant_id', true));

-- Federal disbursement reporting
create table if not exists public.academy_federal_disbursement_reports (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete cascade,
  reporting_period text not null,
  program_code text not null,
  student_person_id text not null,
  disbursement_amount_cents integer not null,
  disbursement_date date not null,
  cod_reference text,
  status text not null default 'pending' check (status in ('pending','reported','accepted','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.academy_federal_disbursement_reports enable row level security;
alter table public.academy_federal_disbursement_reports force row level security;

create policy academy_federal_disbursement_reports_tenant_isolation
  on public.academy_federal_disbursement_reports
  using (tenant_id = current_setting('app.academy_tenant_id', true));
