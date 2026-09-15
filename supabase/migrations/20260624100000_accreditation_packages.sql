-- Create accreditation packages table
create table if not exists public.academy_accreditation_packages (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete cascade,
  accreditor_name text not null,
  report_cycle text not null,
  package_type text not null check (package_type in ('self_study','annual_report','site_visit_prep','focused_evaluation')),
  status text not null default 'draft' check (status in ('draft','compiled','submitted')),
  generated_by_person_id text not null,
  storage_path text,
  compiled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.academy_accreditation_packages enable row level security;
alter table public.academy_accreditation_packages force row level security;

-- RLS policy for tenant isolation
create policy "Tenant isolation for accreditation packages"
  on public.academy_accreditation_packages
  for all
  using (tenant_id = current_setting('app.academy_tenant_id', true));

-- Index for performance
create index if not exists idx_accreditation_packages_tenant_id
  on public.academy_accreditation_packages(tenant_id);
