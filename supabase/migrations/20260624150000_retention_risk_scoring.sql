-- Retention risk scores for individual students
create table if not exists public.academy_retention_risk_scores (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete cascade,
  student_person_id text not null references public.academy_people(id) on delete cascade,
  cohort_id text,
  scoring_period text not null,
  risk_tier text not null check (risk_tier in ('low','moderate','high','critical')),
  composite_score integer not null check (composite_score between 0 and 100),
  gpa_signal integer not null default 0 check (gpa_signal between 0 and 25),
  attendance_signal integer not null default 0 check (attendance_signal between 0 and 25),
  financial_signal integer not null default 0 check (financial_signal between 0 and 25),
  engagement_signal integer not null default 0 check (engagement_signal between 0 and 25),
  signal_explanations jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now(),
  reviewed_by_person_id text,
  reviewed_at timestamptz,
  action_taken text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_retention_risk_unique unique (tenant_id, student_person_id, scoring_period)
);

alter table public.academy_retention_risk_scores enable row level security;
alter table public.academy_retention_risk_scores force row level security;

create policy "Tenant isolation for academy_retention_risk_scores"
  on public.academy_retention_risk_scores
  for all
  using (tenant_id = current_setting('app.academy_tenant_id', true));

-- Cohort-level risk snapshot summary
create table if not exists public.academy_cohort_risk_snapshots (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete cascade,
  scoring_period text not null,
  program_id text,
  total_students integer not null default 0,
  critical_count integer not null default 0,
  high_count integer not null default 0,
  moderate_count integer not null default 0,
  low_count integer not null default 0,
  avg_composite_score numeric(5,2),
  snapshot_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.academy_cohort_risk_snapshots enable row level security;
alter table public.academy_cohort_risk_snapshots force row level security;

create policy "Tenant isolation for academy_cohort_risk_snapshots"
  on public.academy_cohort_risk_snapshots
  for all
  using (tenant_id = current_setting('app.academy_tenant_id', true));
