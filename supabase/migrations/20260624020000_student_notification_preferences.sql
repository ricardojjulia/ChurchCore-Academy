-- T3-07: Student notification preference toggles
-- Stores per-student opt-in for communication categories

create table if not exists public.academy_student_notification_preferences (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete cascade,
  person_id text not null references public.academy_people(id) on delete cascade,
  billing_notices boolean not null default true,
  advising_notices boolean not null default true,
  academic_announcements boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_student_notification_prefs_unique unique (tenant_id, person_id)
);

create index if not exists academy_student_notification_prefs_tenant_person_idx
  on public.academy_student_notification_preferences (tenant_id, person_id);

alter table public.academy_student_notification_preferences enable row level security;
alter table public.academy_student_notification_preferences force row level security;

create policy "tenant_isolation_student_notification_preferences"
  on public.academy_student_notification_preferences
  using (tenant_id = current_setting('app.tenant_id', true));
