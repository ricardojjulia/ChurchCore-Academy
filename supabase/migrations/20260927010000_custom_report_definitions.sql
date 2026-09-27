-- Saved custom report definitions for the constrained P1 report builder.
-- Definitions select columns and filters from approved fixed report families;
-- they do not store arbitrary SQL or bypass tenant-scoped report readers.

create table if not exists public.academy_custom_report_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete restrict,
  name text not null check (char_length(trim(name)) between 3 and 80),
  base_report_id text not null check (
    base_report_id in (
      'enrollment',
      'admissions',
      'attendance',
      'grades',
      'transcripts',
      'billing',
      'aid',
      'retention',
      'program_completion'
    )
  ),
  selected_columns text[] not null check (array_length(selected_columns, 1) between 1 and 12),
  filters jsonb not null default '[]'::jsonb check (jsonb_typeof(filters) = 'array'),
  created_by_user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (tenant_id, id)
);

create index if not exists academy_custom_report_definitions_tenant_active_idx
  on public.academy_custom_report_definitions (tenant_id, updated_at desc)
  where archived_at is null;

alter table public.academy_custom_report_definitions enable row level security;
alter table public.academy_custom_report_definitions force row level security;

drop policy if exists academy_custom_report_definitions_tenant_isolation
on public.academy_custom_report_definitions;

create policy academy_custom_report_definitions_tenant_isolation
on public.academy_custom_report_definitions
using (tenant_id = current_setting('app.academy_tenant_id', true))
with check (tenant_id = current_setting('app.academy_tenant_id', true));
