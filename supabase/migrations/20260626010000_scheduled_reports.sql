-- Scheduled institutional reports for ADR-0058.
create table if not exists public.academy_scheduled_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_tenants(id) on delete cascade,
  report_type text not null check (
    report_type in (
      'enrollment_summary',
      'attendance_summary',
      'grade_summary',
      'financial_summary',
      'ipeds_export'
    )
  ),
  frequency text not null check (frequency in ('weekly', 'monthly', 'term_end')),
  delivery_method text not null check (delivery_method in ('email', 'download_link')),
  recipients jsonb not null default '[]'::jsonb,
  format text not null check (format in ('csv', 'json')),
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_scheduled_reports_due_idx
  on public.academy_scheduled_reports (tenant_id, active, next_run_at);

alter table public.academy_scheduled_reports enable row level security;
alter table public.academy_scheduled_reports force row level security;

create policy academy_scheduled_reports_tenant_read
  on public.academy_scheduled_reports
  for select
  using (tenant_id = any(academy_private.academy_current_tenant_ids()));

create policy academy_scheduled_reports_staff_write
  on public.academy_scheduled_reports
  for all
  using (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and academy_private.academy_current_role() in ('institution_admin', 'registrar', 'academic_admin')
  )
  with check (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and academy_private.academy_current_role() in ('institution_admin', 'registrar', 'academic_admin')
  );

insert into storage.buckets (id, name, public)
values ('academy-reports', 'academy-reports', false)
on conflict (id) do nothing;
