create unique index if not exists academy_people_tenant_id_idx
  on public.academy_people (tenant_id, id);

create unique index if not exists academy_programs_tenant_id_idx
  on public.academy_programs (tenant_id, id);

create unique index if not exists academy_academic_periods_tenant_id_idx
  on public.academy_academic_periods (tenant_id, id);

create table if not exists public.academy_admission_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete restrict,
  applicant_person_id text not null,
  program_id text not null,
  application_term_id text,
  legal_name text not null,
  preferred_name text,
  email text not null,
  phone text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'under_review', 'accepted', 'declined', 'withdrawn')),
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by_person_id text,
  decision_reason text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, applicant_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, program_id)
    references public.academy_programs (tenant_id, id) on delete restrict,
  foreign key (tenant_id, application_term_id)
    references public.academy_academic_periods (tenant_id, id) on delete restrict,
  foreign key (tenant_id, decided_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

create index if not exists academy_admission_applications_tenant_status_idx
  on public.academy_admission_applications (tenant_id, status, updated_at desc);

create index if not exists academy_admission_applications_applicant_idx
  on public.academy_admission_applications (tenant_id, applicant_person_id, created_at desc);

create or replace function public.academy_enforce_admission_application_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
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

drop trigger if exists academy_admission_application_transition
on public.academy_admission_applications;

create trigger academy_admission_application_transition
before insert or update on public.academy_admission_applications
for each row execute function public.academy_enforce_admission_application_transition();

create table if not exists public.academy_admission_application_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete restrict,
  application_id uuid not null,
  actor_person_id text not null,
  event_type text not null
    check (event_type in ('created', 'submitted', 'review_started', 'accepted', 'declined', 'withdrawn')),
  previous_status text,
  next_status text not null,
  redacted_notes text,
  correlation_id text,
  idempotency_key text not null,
  occurred_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, application_id)
    references public.academy_admission_applications (tenant_id, id) on delete restrict,
  foreign key (tenant_id, actor_person_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

create index if not exists academy_admission_events_application_time_idx
  on public.academy_admission_application_events (tenant_id, application_id, occurred_at);

create or replace function public.academy_reject_admission_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Admission application events are immutable.';
end;
$$;

drop trigger if exists academy_admission_events_immutable
on public.academy_admission_application_events;

create trigger academy_admission_events_immutable
before update or delete on public.academy_admission_application_events
for each row execute function public.academy_reject_admission_event_mutation();

alter table public.academy_admission_applications enable row level security;
alter table public.academy_admission_applications force row level security;
alter table public.academy_admission_application_events enable row level security;
alter table public.academy_admission_application_events force row level security;

drop policy if exists academy_admission_applicant_read
on public.academy_admission_applications;

create policy academy_admission_applicant_read
on public.academy_admission_applications
for select
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and applicant_person_id = academy_private.academy_current_person_id()
  and academy_private.academy_has_active_role(
    tenant_id,
    array['applicant']
  )
);

drop policy if exists academy_admission_staff_read
on public.academy_admission_applications;

create policy academy_admission_staff_read
on public.academy_admission_applications
for select
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'dean', 'registrar', 'admissions']
  )
);

drop policy if exists academy_admission_applicant_create
on public.academy_admission_applications;

create policy academy_admission_applicant_create
on public.academy_admission_applications
for insert
with check (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and applicant_person_id = academy_private.academy_current_person_id()
  and academy_private.academy_has_active_role(
    tenant_id,
    array['applicant']
  )
  and status = 'draft'
);

drop policy if exists academy_admission_staff_write
on public.academy_admission_applications;

create policy academy_admission_staff_write
on public.academy_admission_applications
for all
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'dean', 'registrar', 'admissions']
  )
)
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'dean', 'registrar', 'admissions']
  )
);

drop policy if exists academy_admission_applicant_update
on public.academy_admission_applications;

create policy academy_admission_applicant_update
on public.academy_admission_applications
for update
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and applicant_person_id = academy_private.academy_current_person_id()
  and academy_private.academy_has_active_role(
    tenant_id,
    array['applicant']
  )
  and status = 'draft'
)
with check (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and applicant_person_id = academy_private.academy_current_person_id()
  and academy_private.academy_has_active_role(
    tenant_id,
    array['applicant']
  )
  and status in ('draft', 'submitted', 'withdrawn')
);

drop policy if exists academy_admission_event_read
on public.academy_admission_application_events;

create policy academy_admission_event_read
on public.academy_admission_application_events
for select
using (
  exists (
    select 1
    from public.academy_admission_applications application
    where application.id = academy_admission_application_events.application_id
      and application.tenant_id = academy_admission_application_events.tenant_id
      and (
        (
          application.applicant_person_id = academy_private.academy_current_person_id()
          and academy_private.academy_has_active_role(
            application.tenant_id,
            array['applicant']
          )
        )
        or academy_private.academy_has_active_role(
          application.tenant_id,
          array['institution_admin', 'dean', 'registrar', 'admissions']
        )
      )
  )
);

drop policy if exists academy_admission_event_insert
on public.academy_admission_application_events;

create policy academy_admission_event_insert
on public.academy_admission_application_events
for insert
with check (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and actor_person_id = academy_private.academy_current_person_id()
  and exists (
    select 1
    from public.academy_admission_applications application
    where application.id = academy_admission_application_events.application_id
      and application.tenant_id = academy_admission_application_events.tenant_id
      and (
        (
          application.applicant_person_id = academy_admission_application_events.actor_person_id
          and academy_private.academy_has_active_role(
            application.tenant_id,
            array['applicant']
          )
        )
        or academy_private.academy_has_active_role(
          application.tenant_id,
          array['institution_admin', 'dean', 'registrar', 'admissions']
        )
      )
  )
);

revoke update, delete on public.academy_admission_application_events from anon, authenticated;
