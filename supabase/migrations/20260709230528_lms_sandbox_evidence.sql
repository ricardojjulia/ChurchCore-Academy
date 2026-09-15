-- LMS sandbox evidence ledger: tenant-scoped operator evidence for provider readiness.

create table if not exists public.academy_lms_sandbox_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete restrict,
  provider_id text not null check (provider_id in ('moodle', 'canvas')),
  evidence_label text not null,
  evidence_status text not null check (evidence_status in ('pending', 'recorded')),
  reference text not null,
  notes text,
  recorded_by_person_id text not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, provider_id, evidence_label),
  foreign key (tenant_id, recorded_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

create index if not exists academy_lms_sandbox_evidence_status_idx
  on public.academy_lms_sandbox_evidence (tenant_id, provider_id, evidence_status);

alter table public.academy_lms_sandbox_evidence enable row level security;
alter table public.academy_lms_sandbox_evidence force row level security;

drop policy if exists academy_lms_sandbox_evidence_tenant_isolation
on public.academy_lms_sandbox_evidence;

create policy academy_lms_sandbox_evidence_tenant_isolation
on public.academy_lms_sandbox_evidence
using (tenant_id = current_setting('app.academy_tenant_id', true))
with check (tenant_id = current_setting('app.academy_tenant_id', true));
