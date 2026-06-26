create table if not exists public.lms_operation_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  provider_id text not null check (provider_id in ('moodle', 'canvas')),
  operation_family text not null,
  payload jsonb not null,
  idempotency_key text not null,
  requested_by_actor text not null,
  correlation_id text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'retrying', 'succeeded', 'failed', 'blocked_by_circuit')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  last_error text,
  provider_reference text,
  next_run_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider_id, operation_family, idempotency_key)
);

create index if not exists lms_operation_jobs_due_idx
  on public.lms_operation_jobs (status, next_run_at, created_at)
  where status in ('queued', 'retrying');

create index if not exists lms_operation_jobs_tenant_provider_idx
  on public.lms_operation_jobs (tenant_id, provider_id, status, updated_at desc);

comment on table public.lms_operation_jobs is
  'Durable, tenant-scoped LMS provider operation queue with idempotent operation keys and retry state.';

comment on column public.lms_operation_jobs.payload is
  'Provider-neutral operation payload. Secret material is prohibited and must stay in the encrypted provider secret layer.';

alter table public.lms_operation_jobs enable row level security;
alter table public.lms_operation_jobs force row level security;

drop policy if exists lms_operation_jobs_tenant_read on public.lms_operation_jobs;
create policy lms_operation_jobs_tenant_read
on public.lms_operation_jobs
for select
using (tenant_id = current_setting('app.tenant_id', true));

drop policy if exists lms_operation_jobs_tenant_insert on public.lms_operation_jobs;
create policy lms_operation_jobs_tenant_insert
on public.lms_operation_jobs
for insert
with check (tenant_id = current_setting('app.tenant_id', true));

drop policy if exists lms_operation_jobs_tenant_update on public.lms_operation_jobs;
create policy lms_operation_jobs_tenant_update
on public.lms_operation_jobs
for update
using (tenant_id = current_setting('app.tenant_id', true))
with check (tenant_id = current_setting('app.tenant_id', true));
