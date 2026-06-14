create table if not exists public.academy_learner_consent_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete cascade,
  learner_id text not null,
  consent_id uuid not null,
  consent_version text not null,
  action text not null check (action in ('granted', 'updated', 'revoked')),
  actor_person_id text not null,
  consent_snapshot jsonb not null,
  reason text,
  occurred_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, learner_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, actor_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, consent_id)
    references public.academy_learner_intelligence_consent (tenant_id, id) on delete restrict
);

create index if not exists academy_learner_consent_events_tenant_learner_time_idx
  on public.academy_learner_consent_events (tenant_id, learner_id, occurred_at desc);

alter table public.academy_learner_consent_events enable row level security;
alter table public.academy_learner_consent_events force row level security;

drop policy if exists "academy_learner_consent_events: learner read"
  on public.academy_learner_consent_events;
create policy "academy_learner_consent_events: learner read"
  on public.academy_learner_consent_events
  for select to authenticated
  using (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and learner_id = academy_private.academy_current_person_id()
  );

drop policy if exists "academy_learner_consent_events: staff read"
  on public.academy_learner_consent_events;
create policy "academy_learner_consent_events: staff read"
  on public.academy_learner_consent_events
  for select to authenticated
  using (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'dean', 'registrar', 'academic_admin', 'advisor']
    )
  );

drop policy if exists "academy_learner_consent_events: learner insert"
  on public.academy_learner_consent_events;

drop trigger if exists academy_learner_consent_events_immutable
  on public.academy_learner_consent_events;
create trigger academy_learner_consent_events_immutable
before update or delete on public.academy_learner_consent_events
for each row execute function academy_private.academy_reject_immutable_learner_intelligence_change();

revoke insert on public.academy_learner_consent_events from authenticated;
grant select on public.academy_learner_consent_events to authenticated;

create or replace function academy_private.academy_record_learner_consent_event()
returns trigger
language plpgsql
security definer
set search_path = public, academy_private
as $$
declare
  event_action text;
begin
  if tg_op = 'INSERT' then
    event_action := 'granted';
  elsif old.revoked_at is null and new.revoked_at is not null then
    event_action := 'revoked';
  else
    event_action := 'updated';
  end if;

  insert into public.academy_learner_consent_events (
    tenant_id,
    learner_id,
    consent_id,
    consent_version,
    action,
    actor_person_id,
    consent_snapshot,
    reason
  ) values (
    new.tenant_id,
    new.learner_id,
    new.id,
    new.consent_version,
    event_action,
    academy_private.academy_current_person_id(),
    jsonb_build_object(
      'consentBehavioralTracking', new.consent_behavioral_tracking,
      'consentAiMemory', new.consent_ai_memory,
      'consentSocialGraph', new.consent_social_graph,
      'consentPredictiveModeling', new.consent_predictive_modeling,
      'consentLearnerMirror', new.consent_learner_mirror
    ),
    case when event_action = 'revoked' then new.revocation_reason else null end
  );

  return new;
end;
$$;

revoke all on function academy_private.academy_record_learner_consent_event() from public;

drop trigger if exists academy_learner_intelligence_consent_record_event
  on public.academy_learner_intelligence_consent;
create trigger academy_learner_intelligence_consent_record_event
after insert or update on public.academy_learner_intelligence_consent
for each row execute function academy_private.academy_record_learner_consent_event();
