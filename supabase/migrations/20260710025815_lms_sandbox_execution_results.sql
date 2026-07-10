-- LMS sandbox check results: deterministic readiness run output for provider activation evidence.

create table if not exists public.academy_lms_sandbox_check_results (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete restrict,
  provider_id text not null check (provider_id in ('moodle', 'canvas')),
  check_key text not null,
  check_label text not null,
  check_status text not null check (check_status in ('passed', 'failed', 'skipped')),
  safe_summary text not null,
  reference text not null,
  duration_ms integer not null default 0 check (duration_ms >= 0),
  run_by_person_id text not null,
  run_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, provider_id, check_key),
  foreign key (tenant_id, run_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

create index if not exists academy_lms_sandbox_check_results_status_idx
  on public.academy_lms_sandbox_check_results (tenant_id, provider_id, check_status, run_at desc);

alter table public.academy_lms_sandbox_check_results enable row level security;
alter table public.academy_lms_sandbox_check_results force row level security;

drop policy if exists academy_lms_sandbox_check_results_tenant_isolation
on public.academy_lms_sandbox_check_results;

create policy academy_lms_sandbox_check_results_tenant_isolation
on public.academy_lms_sandbox_check_results
using (tenant_id = current_setting('app.academy_tenant_id', true))
with check (tenant_id = current_setting('app.academy_tenant_id', true));
