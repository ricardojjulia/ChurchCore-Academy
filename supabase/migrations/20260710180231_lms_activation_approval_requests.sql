-- LMS activation approval requests: evidence-gated governance before production provider activation.

create table if not exists public.academy_lms_activation_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete restrict,
  provider_id text not null check (provider_id in ('moodle', 'canvas')),
  request_status text not null check (request_status in ('requested', 'approved', 'rejected')),
  safe_summary text not null,
  evidence_snapshot jsonb not null default '[]'::jsonb,
  requested_by_person_id text not null,
  requested_at timestamptz not null default now(),
  decided_by_person_id text,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, requested_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, decided_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

create unique index if not exists academy_lms_activation_requests_open_idx
  on public.academy_lms_activation_requests (tenant_id, provider_id)
  where request_status = 'requested';

create index if not exists academy_lms_activation_requests_status_idx
  on public.academy_lms_activation_requests (tenant_id, provider_id, request_status, updated_at desc);

alter table public.academy_lms_activation_requests enable row level security;
alter table public.academy_lms_activation_requests force row level security;

drop policy if exists academy_lms_activation_requests_tenant_isolation
on public.academy_lms_activation_requests;

create policy academy_lms_activation_requests_tenant_isolation
on public.academy_lms_activation_requests
using (tenant_id = current_setting('app.academy_tenant_id', true))
with check (tenant_id = current_setting('app.academy_tenant_id', true));
