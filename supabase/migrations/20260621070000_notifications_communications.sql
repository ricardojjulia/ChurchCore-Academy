create table if not exists public.academy_communication_preferences (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete cascade,
  person_id text not null,
  channel text not null check (channel in ('email')),
  opted_out boolean not null default false,
  updated_by_person_id text,
  updated_at timestamptz not null default now(),
  unique (tenant_id, person_id, channel),
  foreign key (tenant_id, person_id)
    references public.academy_people (tenant_id, id) on delete cascade,
  foreign key (tenant_id, updated_by_person_id)
    references public.academy_people (tenant_id, id) on delete set null
);

create table if not exists public.academy_communication_messages (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete cascade,
  recipient_person_id text not null,
  related_student_person_id text,
  channel text not null check (channel in ('in_app', 'email')),
  template_key text not null check (
    template_key in (
      'admissions_decision',
      'registration_confirmation',
      'transcript_update',
      'billing_account_update',
      'grade_release',
      'attendance_concern',
      'workflow_assignment'
    )
  ),
  subject text not null,
  body text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'read', 'cancelled')),
  source_type text not null check (
    source_type in (
      'admissions',
      'registration',
      'transcript',
      'billing',
      'gradebook',
      'attendance',
      'workflow',
      'manual'
    )
  ),
  source_id text not null,
  idempotency_key text not null,
  retry_count integer not null default 0 check (retry_count >= 0),
  provider_reference text,
  failure_reason text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  read_at timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, recipient_person_id, channel, idempotency_key),
  foreign key (tenant_id, recipient_person_id)
    references public.academy_people (tenant_id, id) on delete cascade,
  foreign key (tenant_id, related_student_person_id)
    references public.academy_people (tenant_id, id) on delete set null
);

create table if not exists public.academy_communication_audit_events (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete cascade,
  message_id text not null,
  event_type text not null check (event_type in ('queued', 'provider_handoff', 'sent', 'failed', 'read', 'cancelled')),
  actor_person_id text,
  occurred_at timestamptz not null default now(),
  note text,
  foreign key (tenant_id, message_id)
    references public.academy_communication_messages (tenant_id, id) on delete restrict,
  foreign key (tenant_id, actor_person_id)
    references public.academy_people (tenant_id, id) on delete set null
);

create index if not exists academy_communication_messages_recipient_idx
  on public.academy_communication_messages (tenant_id, recipient_person_id, created_at desc);

create index if not exists academy_communication_messages_source_idx
  on public.academy_communication_messages (tenant_id, source_type, source_id);

create index if not exists academy_communication_audit_events_message_idx
  on public.academy_communication_audit_events (tenant_id, message_id, occurred_at desc);

create or replace function public.academy_prevent_communication_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'academy_communication_audit_events is append-only.';
end;
$$;

drop trigger if exists academy_communication_audit_events_immutable
  on public.academy_communication_audit_events;

create trigger academy_communication_audit_events_immutable
before update or delete on public.academy_communication_audit_events
for each row execute function public.academy_prevent_communication_audit_mutation();

alter table public.academy_communication_messages enable row level security;
alter table public.academy_communication_messages force row level security;
alter table public.academy_communication_preferences enable row level security;
alter table public.academy_communication_preferences force row level security;
alter table public.academy_communication_audit_events enable row level security;
alter table public.academy_communication_audit_events force row level security;

revoke all on public.academy_communication_messages from anon;
revoke all on public.academy_communication_preferences from anon;
revoke all on public.academy_communication_audit_events from anon;

grant select, insert, update on public.academy_communication_messages to authenticated;
grant select, insert, update on public.academy_communication_preferences to authenticated;
grant select, insert on public.academy_communication_audit_events to authenticated;
revoke update, delete on public.academy_communication_audit_events from authenticated;

drop policy if exists academy_communication_messages_read on public.academy_communication_messages;
create policy academy_communication_messages_read
on public.academy_communication_messages
for select
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and (
    recipient_person_id = academy_private.academy_current_person_id()
    or academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'registrar', 'academic_admin', 'dean', 'admissions']
    )
  )
);

drop policy if exists academy_communication_messages_staff_write on public.academy_communication_messages;
create policy academy_communication_messages_staff_write
on public.academy_communication_messages
for insert
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'admissions']
  )
);

drop policy if exists academy_communication_messages_recipient_update on public.academy_communication_messages;
create policy academy_communication_messages_recipient_update
on public.academy_communication_messages
for update
using (
  recipient_person_id = academy_private.academy_current_person_id()
  or academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'admissions']
  )
)
with check (
  recipient_person_id = academy_private.academy_current_person_id()
  or academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'admissions']
  )
);

drop policy if exists academy_communication_preferences_read on public.academy_communication_preferences;
create policy academy_communication_preferences_read
on public.academy_communication_preferences
for select
using (
  person_id = academy_private.academy_current_person_id()
  or academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'admissions']
  )
);

drop policy if exists academy_communication_preferences_write on public.academy_communication_preferences;
create policy academy_communication_preferences_write
on public.academy_communication_preferences
for all
using (
  person_id = academy_private.academy_current_person_id()
  or academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'admissions']
  )
)
with check (
  person_id = academy_private.academy_current_person_id()
  or academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'admissions']
  )
);

drop policy if exists academy_communication_audit_events_read on public.academy_communication_audit_events;
create policy academy_communication_audit_events_read
on public.academy_communication_audit_events
for select
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'admissions']
  )
  or exists (
    select 1
    from public.academy_communication_messages message
    where message.tenant_id = academy_communication_audit_events.tenant_id
      and message.id = academy_communication_audit_events.message_id
      and message.recipient_person_id = academy_private.academy_current_person_id()
  )
);

drop policy if exists academy_communication_audit_events_insert on public.academy_communication_audit_events;
create policy academy_communication_audit_events_insert
on public.academy_communication_audit_events
for insert
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean', 'admissions']
  )
  or actor_person_id = academy_private.academy_current_person_id()
);
