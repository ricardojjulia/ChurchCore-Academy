create unique index if not exists academy_student_profiles_tenant_id_idx
  on public.academy_student_profiles (tenant_id, id);

create unique index if not exists academy_student_profiles_tenant_person_unique_idx
  on public.academy_student_profiles (tenant_id, person_id);

create unique index if not exists academy_person_role_assignments_tenant_id_idx
  on public.academy_person_role_assignments (tenant_id, id);

create unique index if not exists academy_role_assignments_identity_unique_idx
  on public.academy_person_role_assignments (
    tenant_id,
    person_id,
    role,
    scope_type,
    coalesce(scope_id, '')
  );

alter table public.academy_admission_applications
  add column converted_at timestamptz,
  add column converted_by_person_id text,
  add column student_profile_id text,
  add column program_enrollment_id uuid,
  add column period_registration_id uuid;

create table public.academy_program_enrollments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete restrict,
  student_profile_id text not null,
  student_person_id text not null,
  program_id text not null,
  source_application_id uuid not null,
  status text not null default 'active'
    check (status in ('active', 'completed', 'withdrawn', 'cancelled')),
  started_on date not null default current_date,
  ended_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, source_application_id),
  foreign key (tenant_id, student_profile_id)
    references public.academy_student_profiles (tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, program_id)
    references public.academy_programs (tenant_id, id) on delete restrict,
  foreign key (tenant_id, source_application_id)
    references public.academy_admission_applications (tenant_id, id) on delete restrict
);

create index academy_program_enrollments_student_idx
  on public.academy_program_enrollments (tenant_id, student_profile_id, status);

create table public.academy_period_registrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete restrict,
  student_profile_id text not null,
  student_person_id text not null,
  academic_period_id text not null,
  program_enrollment_id uuid not null,
  source_application_id uuid not null,
  status text not null default 'registered'
    check (status in ('registered', 'cancelled', 'completed')),
  registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, source_application_id),
  unique (tenant_id, student_profile_id, academic_period_id),
  foreign key (tenant_id, student_profile_id)
    references public.academy_student_profiles (tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, academic_period_id)
    references public.academy_academic_periods (tenant_id, id) on delete restrict,
  foreign key (tenant_id, program_enrollment_id)
    references public.academy_program_enrollments (tenant_id, id) on delete restrict,
  foreign key (tenant_id, source_application_id)
    references public.academy_admission_applications (tenant_id, id) on delete restrict
);

create index academy_period_registrations_student_idx
  on public.academy_period_registrations (tenant_id, student_profile_id, status);

create table public.academy_enrollment_conversion_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete restrict,
  application_id uuid not null,
  actor_person_id text not null,
  student_profile_id text not null,
  student_number text not null,
  program_enrollment_id uuid not null,
  period_registration_id uuid not null,
  correlation_id text not null,
  idempotency_key text not null,
  occurred_at timestamptz not null default now(),
  unique (tenant_id, application_id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, application_id)
    references public.academy_admission_applications (tenant_id, id) on delete restrict,
  foreign key (tenant_id, actor_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_profile_id)
    references public.academy_student_profiles (tenant_id, id) on delete restrict,
  foreign key (tenant_id, program_enrollment_id)
    references public.academy_program_enrollments (tenant_id, id) on delete restrict,
  foreign key (tenant_id, period_registration_id)
    references public.academy_period_registrations (tenant_id, id) on delete restrict
);

create table public.academy_student_number_sequences (
  tenant_id text primary key references public.academy_institution_profiles(tenant_id) on delete restrict,
  next_value bigint not null default 1 check (next_value > 0),
  updated_at timestamptz not null default now()
);

alter table public.academy_admission_applications
  add constraint academy_admission_converted_by_tenant_fk
    foreign key (tenant_id, converted_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  add constraint academy_admission_student_profile_tenant_fk
    foreign key (tenant_id, student_profile_id)
    references public.academy_student_profiles (tenant_id, id) on delete restrict,
  add constraint academy_admission_program_enrollment_tenant_fk
    foreign key (tenant_id, program_enrollment_id)
    references public.academy_program_enrollments (tenant_id, id) on delete restrict,
  add constraint academy_admission_period_registration_tenant_fk
    foreign key (tenant_id, period_registration_id)
    references public.academy_period_registrations (tenant_id, id) on delete restrict,
  add constraint academy_admission_conversion_metadata_complete
    check (
      (
        converted_at is null
        and converted_by_person_id is null
        and student_profile_id is null
        and program_enrollment_id is null
        and period_registration_id is null
      )
      or (
        converted_at is not null
        and converted_by_person_id is not null
        and student_profile_id is not null
        and program_enrollment_id is not null
        and period_registration_id is not null
        and status = 'accepted'
      )
    );

create or replace function public.academy_enforce_admission_application_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  conversion_was_empty boolean;
  conversion_is_complete boolean;
begin
  if tg_op = 'INSERT' and new.status <> 'draft' then
    raise exception 'New admission applications must be drafts.';
  end if;

  if new.status not in ('accepted', 'declined')
     and (
       new.decided_at is not null
       or new.decided_by_person_id is not null
       or new.decision_reason is not null
     ) then
    raise exception 'Non-terminal applications cannot contain decision metadata.';
  end if;

  if new.status in ('accepted', 'declined')
     and (new.decided_at is null or new.decided_by_person_id is null) then
    raise exception 'Terminal admission decisions require decision metadata.';
  end if;

  if new.status in ('submitted', 'under_review', 'accepted', 'declined')
     and new.submitted_at is null then
    raise exception 'Submitted admission applications require submitted_at.';
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;

  if old.tenant_id <> new.tenant_id or old.id <> new.id then
    raise exception 'Admission application identity is immutable.';
  end if;

  conversion_was_empty :=
    old.converted_at is null
    and old.converted_by_person_id is null
    and old.student_profile_id is null
    and old.program_enrollment_id is null
    and old.period_registration_id is null;

  conversion_is_complete :=
    new.converted_at is not null
    and new.converted_by_person_id is not null
    and new.student_profile_id is not null
    and new.program_enrollment_id is not null
    and new.period_registration_id is not null;

  if old.status = 'accepted'
     and conversion_was_empty
     and conversion_is_complete
     and academy_private.academy_has_active_role(
       new.tenant_id,
       array['institution_admin', 'registrar', 'admissions']
     )
     and new.status = old.status
     and new.applicant_person_id = old.applicant_person_id
     and new.program_id = old.program_id
     and new.application_term_id is not distinct from old.application_term_id
     and new.legal_name = old.legal_name
     and new.preferred_name is not distinct from old.preferred_name
     and new.email = old.email
     and new.phone is not distinct from old.phone
     and new.submitted_at is not distinct from old.submitted_at
     and new.decided_at is not distinct from old.decided_at
     and new.decided_by_person_id is not distinct from old.decided_by_person_id
     and new.decision_reason is not distinct from old.decision_reason
     and new.idempotency_key = old.idempotency_key
     and new.created_at = old.created_at then
    return new;
  end if;

  if old.status in ('accepted', 'declined') then
    raise exception 'Accepted and declined applications are immutable.';
  end if;

  if new.status <> old.status and not (
    (old.status = 'draft' and new.status in ('submitted', 'withdrawn'))
    or (old.status = 'submitted' and new.status in ('under_review', 'accepted', 'declined', 'withdrawn'))
    or (old.status = 'under_review' and new.status in ('accepted', 'declined', 'withdrawn'))
  ) then
    raise exception 'Invalid admission application transition.';
  end if;

  return new;
end;
$$;

create or replace function public.academy_reject_enrollment_conversion_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Enrollment conversion events are immutable.';
end;
$$;

create trigger academy_enrollment_conversion_events_immutable
before update or delete on public.academy_enrollment_conversion_events
for each row execute function public.academy_reject_enrollment_conversion_event_mutation();

create or replace function public.academy_reject_conversion_metadata_rewrite()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.converted_at is not null and (
    new.converted_at is distinct from old.converted_at
    or new.converted_by_person_id is distinct from old.converted_by_person_id
    or new.student_profile_id is distinct from old.student_profile_id
    or new.program_enrollment_id is distinct from old.program_enrollment_id
    or new.period_registration_id is distinct from old.period_registration_id
  ) then
    raise exception 'Admission conversion metadata is immutable.';
  end if;
  return new;
end;
$$;

create trigger academy_admission_conversion_metadata_immutable
before update on public.academy_admission_applications
for each row execute function public.academy_reject_conversion_metadata_rewrite();

alter table public.academy_program_enrollments enable row level security;
alter table public.academy_program_enrollments force row level security;
alter table public.academy_period_registrations enable row level security;
alter table public.academy_period_registrations force row level security;
alter table public.academy_enrollment_conversion_events enable row level security;
alter table public.academy_enrollment_conversion_events force row level security;
alter table public.academy_student_number_sequences enable row level security;
alter table public.academy_student_number_sequences force row level security;

create policy academy_program_enrollments_read
on public.academy_program_enrollments
for select
to authenticated
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'admissions']
  )
  or (
    student_person_id = academy_private.academy_current_person_id()
    and academy_private.academy_has_active_role(tenant_id, array['student'])
  )
);

create policy academy_program_enrollments_write
on public.academy_program_enrollments
for all
to authenticated
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'admissions']
  )
)
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'admissions']
  )
);

create policy academy_period_registrations_read
on public.academy_period_registrations
for select
to authenticated
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'admissions']
  )
  or (
    student_person_id = academy_private.academy_current_person_id()
    and academy_private.academy_has_active_role(tenant_id, array['student'])
  )
);

create policy academy_period_registrations_write
on public.academy_period_registrations
for all
to authenticated
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'admissions']
  )
)
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'admissions']
  )
);

create policy academy_enrollment_conversion_events_read
on public.academy_enrollment_conversion_events
for select
to authenticated
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'admissions']
  )
);

create policy academy_enrollment_conversion_events_insert
on public.academy_enrollment_conversion_events
for insert
to authenticated
with check (
  actor_person_id = academy_private.academy_current_person_id()
  and academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'admissions']
  )
);

create policy academy_student_number_sequences_write
on public.academy_student_number_sequences
for all
to authenticated
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'admissions']
  )
)
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'admissions']
  )
);

drop policy if exists academy_identity_admin
on public.academy_person_role_assignments;

create policy academy_identity_admin
on public.academy_person_role_assignments
for all
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'admissions']
  )
)
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'admissions']
  )
);

revoke all on public.academy_program_enrollments from anon;
revoke all on public.academy_period_registrations from anon;
revoke all on public.academy_enrollment_conversion_events from anon;
revoke all on public.academy_student_number_sequences from anon;

grant select, insert, update on public.academy_program_enrollments to authenticated;
grant select, insert, update on public.academy_period_registrations to authenticated;
grant select, insert on public.academy_enrollment_conversion_events to authenticated;
grant select, insert, update on public.academy_student_number_sequences to authenticated;
