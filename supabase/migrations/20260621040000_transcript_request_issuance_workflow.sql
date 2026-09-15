alter table public.academy_transcript_issuances
  drop constraint if exists academy_transcript_issuances_status_check;

alter table public.academy_transcript_issuances
  add constraint academy_transcript_issuances_status_check
  check (status in ('requested', 'held', 'issued', 'released', 'revoked'));

alter table public.academy_transcript_issuances
  add column if not exists requested_by_person_id text,
  add column if not exists requested_at timestamptz,
  add column if not exists hold_reason text,
  add column if not exists held_at timestamptz,
  add column if not exists released_at timestamptz,
  add column if not exists released_by_person_id text;

update public.academy_transcript_issuances
   set requested_by_person_id = coalesce(requested_by_person_id, issued_by_person_id),
       requested_at = coalesce(requested_at, issued_at)
 where requested_by_person_id is null
    or requested_at is null;

alter table public.academy_transcript_issuances
  alter column requested_by_person_id set not null,
  alter column requested_at set not null;

alter table public.academy_transcript_issuances
  add constraint academy_transcript_issuances_tenant_id_id_unique unique (tenant_id, id);

create table if not exists public.academy_transcript_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete restrict,
  transcript_id uuid not null,
  actor_person_id text not null,
  event_type text not null check (event_type in ('requested', 'held', 'issued', 'released', 'revoked')),
  previous_status text,
  new_status text not null,
  reason text not null,
  redacted_metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  foreign key (tenant_id, transcript_id)
    references public.academy_transcript_issuances (tenant_id, id) on delete restrict,
  foreign key (tenant_id, actor_person_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

create index if not exists academy_transcript_events_transcript_idx
  on public.academy_transcript_events (tenant_id, transcript_id, occurred_at desc);

create or replace function public.academy_reject_transcript_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Transcript events are immutable.';
end;
$$;

drop trigger if exists academy_transcript_events_immutable
  on public.academy_transcript_events;

create trigger academy_transcript_events_immutable
before update or delete on public.academy_transcript_events
for each row execute function public.academy_reject_transcript_event_mutation();

alter table public.academy_transcript_events enable row level security;
alter table public.academy_transcript_events force row level security;

revoke all on public.academy_transcript_events from anon;
grant select, insert on public.academy_transcript_events to authenticated;
revoke update, delete on public.academy_transcript_events from authenticated;

drop policy if exists academy_transcript_events_read on public.academy_transcript_events;
create policy academy_transcript_events_read
on public.academy_transcript_events
for select
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'dean', 'registrar', 'academic_admin']
  )
);

drop policy if exists academy_transcript_events_insert on public.academy_transcript_events;
create policy academy_transcript_events_insert
on public.academy_transcript_events
for insert
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'dean', 'registrar', 'academic_admin']
  )
);
