alter table public.academy_gradebook_records
  add column if not exists posting_status text not null default 'draft'
    check (posting_status in ('draft', 'posted', 'held', 'revoked')),
  add column if not exists posted_at timestamptz,
  add column if not exists posted_by_person_id text,
  add column if not exists released_to_student_at timestamptz,
  add constraint academy_gradebook_records_posted_by_person_fk
    foreign key (tenant_id, posted_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict;

create table if not exists public.academy_gradebook_posting_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete restrict,
  grade_record_id uuid not null,
  actor_person_id text not null,
  event_type text not null check (event_type in ('posted', 'held', 'released', 'revoked')),
  previous_status text,
  new_status text not null,
  reason text not null,
  redacted_metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  foreign key (tenant_id, grade_record_id)
    references public.academy_gradebook_records (tenant_id, id) on delete restrict,
  foreign key (tenant_id, actor_person_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

create index if not exists academy_gradebook_posting_events_record_idx
  on public.academy_gradebook_posting_events (tenant_id, grade_record_id, occurred_at desc);

create or replace function public.academy_reject_gradebook_posting_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Gradebook posting events are immutable.';
end;
$$;

drop trigger if exists academy_gradebook_posting_events_immutable
  on public.academy_gradebook_posting_events;

create trigger academy_gradebook_posting_events_immutable
before update or delete on public.academy_gradebook_posting_events
for each row execute function public.academy_reject_gradebook_posting_event_mutation();

alter table public.academy_gradebook_posting_events enable row level security;
alter table public.academy_gradebook_posting_events force row level security;

revoke all on public.academy_gradebook_posting_events from anon;
grant select, insert on public.academy_gradebook_posting_events to authenticated;
revoke update, delete on public.academy_gradebook_posting_events from authenticated;

drop policy if exists academy_gradebook_posting_events_read on public.academy_gradebook_posting_events;
create policy academy_gradebook_posting_events_read
on public.academy_gradebook_posting_events
for select
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'dean', 'registrar', 'academic_admin']
  )
);

drop policy if exists academy_gradebook_posting_events_insert on public.academy_gradebook_posting_events;
create policy academy_gradebook_posting_events_insert
on public.academy_gradebook_posting_events
for insert
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'dean', 'registrar', 'academic_admin']
  )
);
