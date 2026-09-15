-- Add status_token to admission applications for public status lookups
alter table public.academy_admission_applications
  add column if not exists status_token uuid not null default gen_random_uuid();

create unique index if not exists idx_admission_apps_status_token
  on public.academy_admission_applications (status_token);

-- Rate limiting table for public form submissions
create table if not exists public.academy_rate_limits (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  key text not null,
  window_start timestamptz not null default now(),
  attempt_count int not null default 1,
  constraint academy_rate_limits_tenant_key_window unique (tenant_id, key, window_start)
);

alter table public.academy_rate_limits enable row level security;
alter table public.academy_rate_limits force row level security;

-- Expand template_key check constraint to include application_received
alter table public.academy_communication_messages
  drop constraint if exists academy_communication_messages_template_key_check;

alter table public.academy_communication_messages
  add constraint academy_communication_messages_template_key_check
  check (template_key in (
    'admissions_decision',
    'registration_confirmation',
    'transcript_update',
    'billing_account_update',
    'grade_release',
    'attendance_concern',
    'workflow_assignment',
    'application_received'
  ));
