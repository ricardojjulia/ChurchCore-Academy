create table if not exists public.academy_intervention_status_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete cascade,
  intervention_id uuid not null,
  previous_status text not null
    check (previous_status in ('pending', 'reviewed', 'acted_on', 'dismissed', 'expired')),
  next_status text not null
    check (next_status in ('pending', 'reviewed', 'acted_on', 'dismissed', 'expired')),
  changed_by_user_id text,
  note text,
  changed_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, intervention_id)
    references public.academy_intervention_recommendations (tenant_id, id) on delete cascade,
  foreign key (tenant_id, changed_by_user_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

create index if not exists academy_intervention_status_history_tenant_intervention_changed_idx
  on public.academy_intervention_status_history (tenant_id, intervention_id, changed_at desc);

alter table public.academy_intervention_status_history enable row level security;
alter table public.academy_intervention_status_history force row level security;

drop policy if exists "academy_intervention_status_history: staff read"
  on public.academy_intervention_status_history;
create policy "academy_intervention_status_history: staff read"
  on public.academy_intervention_status_history
  for select to authenticated
  using (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'dean', 'registrar', 'academic_admin', 'advisor', 'faculty', 'teacher', 'professor']
    )
  );

drop policy if exists "academy_intervention_status_history: staff write"
  on public.academy_intervention_status_history;
create policy "academy_intervention_status_history: staff write"
  on public.academy_intervention_status_history
  for insert to authenticated
  with check (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and changed_by_user_id = academy_private.academy_current_person_id()
    and academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'dean', 'registrar', 'academic_admin', 'advisor', 'faculty', 'teacher', 'professor']
    )
  );

drop trigger if exists academy_intervention_status_history_immutable
  on public.academy_intervention_status_history;
create trigger academy_intervention_status_history_immutable
before update or delete on public.academy_intervention_status_history
for each row execute function academy_private.academy_reject_immutable_learner_intelligence_change();

grant select, insert on public.academy_intervention_status_history to authenticated;
