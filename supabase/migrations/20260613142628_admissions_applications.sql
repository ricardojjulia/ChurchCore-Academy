create table public.academy_admission_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete restrict,
  applicant_person_id text not null references public.academy_people(id) on delete restrict,
  program_id text not null references public.academy_programs(id) on delete restrict,
  application_term_id text references public.academy_academic_periods(id) on delete restrict,
  legal_name text not null,
  preferred_name text,
  email text not null,
  phone text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'under_review', 'accepted', 'declined', 'withdrawn')),
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by_person_id text references public.academy_people(id) on delete restrict,
  decision_reason text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create index academy_admission_applications_tenant_status_idx
  on public.academy_admission_applications (tenant_id, status, updated_at desc);

create index academy_admission_applications_applicant_idx
  on public.academy_admission_applications (tenant_id, applicant_person_id, created_at desc);

create table public.academy_admission_application_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete restrict,
  application_id uuid not null references public.academy_admission_applications(id) on delete restrict,
  actor_person_id text not null references public.academy_people(id) on delete restrict,
  event_type text not null
    check (event_type in ('created', 'submitted', 'review_started', 'accepted', 'declined', 'withdrawn')),
  previous_status text,
  next_status text not null,
  redacted_notes text,
  correlation_id text,
  idempotency_key text not null,
  occurred_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create index academy_admission_events_application_time_idx
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

create trigger academy_admission_events_immutable
before update or delete on public.academy_admission_application_events
for each row execute function public.academy_reject_admission_event_mutation();

alter table public.academy_admission_applications enable row level security;
alter table public.academy_admission_applications force row level security;
alter table public.academy_admission_application_events enable row level security;
alter table public.academy_admission_application_events force row level security;

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

create policy academy_admission_staff_read
on public.academy_admission_applications
for select
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'dean', 'registrar', 'admissions']
  )
);

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
