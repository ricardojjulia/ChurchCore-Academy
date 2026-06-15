create unique index if not exists academy_course_sections_tenant_id_idx
  on public.academy_course_sections (tenant_id, id);

create table if not exists public.academy_course_section_registrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete restrict,
  student_profile_id text not null,
  student_person_id text not null,
  program_enrollment_id uuid not null,
  period_registration_id uuid not null,
  course_section_id text not null,
  source_application_id uuid not null,
  status text not null default 'registered'
    check (status in ('registered', 'waitlisted', 'withdrawn', 'completed')),
  registered_at timestamptz not null default now(),
  confirmed_at timestamptz not null,
  confirmation_note text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, idempotency_key),
  unique (tenant_id, source_application_id, course_section_id),
  foreign key (tenant_id, student_profile_id)
    references public.academy_student_profiles (tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, program_enrollment_id)
    references public.academy_program_enrollments (tenant_id, id) on delete restrict,
  foreign key (tenant_id, period_registration_id)
    references public.academy_period_registrations (tenant_id, id) on delete restrict,
  foreign key (tenant_id, source_application_id)
    references public.academy_admission_applications (tenant_id, id) on delete restrict,
  foreign key (tenant_id, course_section_id)
    references public.academy_course_sections (tenant_id, id) on delete restrict
);

create index if not exists academy_course_section_registrations_student_idx
  on public.academy_course_section_registrations (tenant_id, student_profile_id, status);

create index if not exists academy_course_section_registrations_section_idx
  on public.academy_course_section_registrations (tenant_id, course_section_id, status);

create table if not exists public.academy_enrollment_confirmation_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete restrict,
  course_section_registration_id uuid not null,
  application_id uuid not null,
  actor_person_id text not null,
  event_type text not null check (event_type in ('confirmed')),
  correlation_id text not null,
  idempotency_key text not null,
  redacted_metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, course_section_registration_id)
    references public.academy_course_section_registrations (tenant_id, id) on delete restrict,
  foreign key (tenant_id, application_id)
    references public.academy_admission_applications (tenant_id, id) on delete restrict,
  foreign key (tenant_id, actor_person_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

create index if not exists academy_enrollment_confirmation_events_application_idx
  on public.academy_enrollment_confirmation_events (tenant_id, application_id, occurred_at desc);

create or replace function public.academy_reject_enrollment_confirmation_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Enrollment confirmation events are immutable.';
end;
$$;

drop trigger if exists academy_enrollment_confirmation_events_immutable
  on public.academy_enrollment_confirmation_events;

create trigger academy_enrollment_confirmation_events_immutable
before update or delete on public.academy_enrollment_confirmation_events
for each row execute function public.academy_reject_enrollment_confirmation_event_mutation();

alter table public.academy_course_section_registrations enable row level security;
alter table public.academy_course_section_registrations force row level security;

alter table public.academy_enrollment_confirmation_events enable row level security;
alter table public.academy_enrollment_confirmation_events force row level security;

drop policy if exists academy_section_registration_read on public.academy_course_section_registrations;
create policy academy_section_registration_read
  on public.academy_course_section_registrations
  for select
  using (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and (
      academy_private.academy_can_read_student(tenant_id, student_person_id)
      or academy_private.academy_has_active_role(
        tenant_id,
        array['institution_admin', 'dean', 'registrar', 'academic_admin', 'admissions']
      )
    )
  );

drop policy if exists academy_section_registration_write on public.academy_course_section_registrations;
create policy academy_section_registration_write
  on public.academy_course_section_registrations
  for insert
  with check (
    academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'dean', 'registrar', 'academic_admin', 'admissions']
    )
  );

drop policy if exists academy_enrollment_confirmation_read on public.academy_enrollment_confirmation_events;
create policy academy_enrollment_confirmation_read
  on public.academy_enrollment_confirmation_events
  for select
  using (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'dean', 'registrar', 'academic_admin', 'admissions']
    )
  );

drop policy if exists academy_enrollment_confirmation_write on public.academy_enrollment_confirmation_events;
create policy academy_enrollment_confirmation_write
  on public.academy_enrollment_confirmation_events
  for insert
  with check (
    academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'dean', 'registrar', 'academic_admin', 'admissions']
    )
  );
