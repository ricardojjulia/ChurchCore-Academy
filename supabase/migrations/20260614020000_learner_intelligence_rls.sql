alter table public.academy_learner_activity_events enable row level security;
alter table public.academy_learner_activity_events force row level security;
alter table public.academy_learner_intelligence_consent enable row level security;
alter table public.academy_learner_intelligence_consent force row level security;
alter table public.academy_learner_memory enable row level security;
alter table public.academy_learner_memory force row level security;
alter table public.academy_learner_identity_snapshots enable row level security;
alter table public.academy_learner_identity_snapshots force row level security;
alter table public.academy_energy_checkins enable row level security;
alter table public.academy_energy_checkins force row level security;
alter table public.academy_intervention_recommendations enable row level security;
alter table public.academy_intervention_recommendations force row level security;

drop policy if exists "academy_learner_activity_events: tenant scoped select"
  on public.academy_learner_activity_events;
create policy "academy_learner_activity_events: tenant scoped select"
  on public.academy_learner_activity_events
  for select to authenticated
  using (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and (
      learner_id = academy_private.academy_current_person_id()
      or academy_private.academy_has_active_role(
        tenant_id,
        array['institution_admin', 'dean', 'registrar', 'academic_admin', 'advisor', 'faculty', 'teacher', 'professor']
      )
    )
  );

drop policy if exists "academy_learner_activity_events: consent-first insert"
  on public.academy_learner_activity_events;
create policy "academy_learner_activity_events: consent-first insert"
  on public.academy_learner_activity_events
  for insert to authenticated
  with check (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and (
      learner_id = academy_private.academy_current_person_id()
      or academy_private.academy_has_active_role(
        tenant_id,
        array['institution_admin', 'dean', 'registrar', 'academic_admin', 'advisor', 'faculty', 'teacher', 'professor']
      )
    )
    and exists (
      select 1
      from public.academy_learner_intelligence_consent consent
      where consent.tenant_id = academy_learner_activity_events.tenant_id
        and consent.learner_id = academy_learner_activity_events.learner_id
        and consent.consent_behavioral_tracking = true
        and consent.revoked_at is null
        and consent.id = (
          select latest.id
          from public.academy_learner_intelligence_consent latest
          where latest.tenant_id = academy_learner_activity_events.tenant_id
            and latest.learner_id = academy_learner_activity_events.learner_id
          order by latest.consented_at desc, latest.created_at desc
          limit 1
        )
    )
  );

drop policy if exists "academy_learner_intelligence_consent: tenant scoped select"
  on public.academy_learner_intelligence_consent;
create policy "academy_learner_intelligence_consent: tenant scoped select"
  on public.academy_learner_intelligence_consent
  for select to authenticated
  using (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and (
      learner_id = academy_private.academy_current_person_id()
      or academy_private.academy_has_active_role(
        tenant_id,
        array['institution_admin', 'dean', 'registrar', 'academic_admin', 'advisor']
      )
    )
  );

drop policy if exists "academy_learner_intelligence_consent: learner insert"
  on public.academy_learner_intelligence_consent;
create policy "academy_learner_intelligence_consent: learner insert"
  on public.academy_learner_intelligence_consent
  for insert to authenticated
  with check (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and learner_id = academy_private.academy_current_person_id()
  );

drop policy if exists "academy_learner_intelligence_consent: learner update"
  on public.academy_learner_intelligence_consent;
create policy "academy_learner_intelligence_consent: learner update"
  on public.academy_learner_intelligence_consent
  for update to authenticated
  using (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and learner_id = academy_private.academy_current_person_id()
  )
  with check (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and learner_id = academy_private.academy_current_person_id()
  );

drop policy if exists "academy_learner_memory: staff read"
  on public.academy_learner_memory;
create policy "academy_learner_memory: staff read"
  on public.academy_learner_memory
  for select to authenticated
  using (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and (
      (
        sensitivity_level = 'standard'
        and academy_private.academy_has_active_role(
          tenant_id,
          array['institution_admin', 'dean', 'registrar', 'academic_admin', 'advisor', 'faculty', 'teacher', 'professor']
        )
      )
      or (
        sensitivity_level in ('pastoral', 'confidential')
        and academy_private.academy_has_active_role(
          tenant_id,
          array['institution_admin', 'dean', 'advisor']
        )
      )
    )
  );

drop policy if exists "academy_learner_memory: consent-first staff write"
  on public.academy_learner_memory;
create policy "academy_learner_memory: consent-first staff write"
  on public.academy_learner_memory
  for insert to authenticated
  with check (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'dean', 'registrar', 'academic_admin']
    )
    and exists (
      select 1
      from public.academy_learner_intelligence_consent consent
      where consent.tenant_id = academy_learner_memory.tenant_id
        and consent.learner_id = academy_learner_memory.learner_id
        and consent.consent_ai_memory = true
        and consent.revoked_at is null
        and consent.id = (
          select latest.id
          from public.academy_learner_intelligence_consent latest
          where latest.tenant_id = academy_learner_memory.tenant_id
            and latest.learner_id = academy_learner_memory.learner_id
          order by latest.consented_at desc, latest.created_at desc
          limit 1
        )
    )
  );

drop policy if exists "academy_learner_identity_snapshots: staff read"
  on public.academy_learner_identity_snapshots;
create policy "academy_learner_identity_snapshots: staff read"
  on public.academy_learner_identity_snapshots
  for select to authenticated
  using (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'dean', 'registrar', 'academic_admin', 'advisor']
    )
  );

drop policy if exists "academy_learner_identity_snapshots: predictive consent insert"
  on public.academy_learner_identity_snapshots;
create policy "academy_learner_identity_snapshots: predictive consent insert"
  on public.academy_learner_identity_snapshots
  for insert to authenticated
  with check (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'dean', 'registrar', 'academic_admin']
    )
    and exists (
      select 1
      from public.academy_learner_intelligence_consent consent
      where consent.tenant_id = academy_learner_identity_snapshots.tenant_id
        and consent.learner_id = academy_learner_identity_snapshots.learner_id
        and consent.consent_predictive_modeling = true
        and consent.revoked_at is null
        and consent.id = (
          select latest.id
          from public.academy_learner_intelligence_consent latest
          where latest.tenant_id = academy_learner_identity_snapshots.tenant_id
            and latest.learner_id = academy_learner_identity_snapshots.learner_id
          order by latest.consented_at desc, latest.created_at desc
          limit 1
        )
    )
  );

drop policy if exists "academy_energy_checkins: learner or staff access"
  on public.academy_energy_checkins;
create policy "academy_energy_checkins: learner or staff access"
  on public.academy_energy_checkins
  for select to authenticated
  using (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and (
      learner_id = academy_private.academy_current_person_id()
      or academy_private.academy_has_active_role(
        tenant_id,
        array['institution_admin', 'dean', 'registrar', 'academic_admin', 'advisor', 'faculty', 'teacher', 'professor']
      )
    )
  );

drop policy if exists "academy_energy_checkins: consent-first write"
  on public.academy_energy_checkins;
create policy "academy_energy_checkins: consent-first write"
  on public.academy_energy_checkins
  for all to authenticated
  using (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and (
      learner_id = academy_private.academy_current_person_id()
      or academy_private.academy_has_active_role(
        tenant_id,
        array['institution_admin', 'dean', 'registrar', 'academic_admin', 'advisor']
      )
    )
  )
  with check (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and (
      learner_id = academy_private.academy_current_person_id()
      or academy_private.academy_has_active_role(
        tenant_id,
        array['institution_admin', 'dean', 'registrar', 'academic_admin', 'advisor']
      )
    )
    and exists (
      select 1
      from public.academy_learner_intelligence_consent consent
      where consent.tenant_id = academy_energy_checkins.tenant_id
        and consent.learner_id = academy_energy_checkins.learner_id
        and consent.consent_behavioral_tracking = true
        and consent.revoked_at is null
    )
  );

drop policy if exists "academy_intervention_recommendations: staff read"
  on public.academy_intervention_recommendations;
create policy "academy_intervention_recommendations: staff read"
  on public.academy_intervention_recommendations
  for select to authenticated
  using (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'dean', 'registrar', 'academic_admin', 'advisor', 'faculty', 'teacher', 'professor']
    )
  );

drop policy if exists "academy_intervention_recommendations: predictive consent insert"
  on public.academy_intervention_recommendations;
create policy "academy_intervention_recommendations: predictive consent insert"
  on public.academy_intervention_recommendations
  for insert to authenticated
  with check (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'dean', 'registrar', 'academic_admin']
    )
    and exists (
      select 1
      from public.academy_learner_intelligence_consent consent
      where consent.tenant_id = academy_intervention_recommendations.tenant_id
        and consent.learner_id = academy_intervention_recommendations.learner_id
        and consent.consent_predictive_modeling = true
        and consent.revoked_at is null
        and consent.id = (
          select latest.id
          from public.academy_learner_intelligence_consent latest
          where latest.tenant_id = academy_intervention_recommendations.tenant_id
            and latest.learner_id = academy_intervention_recommendations.learner_id
          order by latest.consented_at desc, latest.created_at desc
          limit 1
        )
    )
  );

drop policy if exists "academy_intervention_recommendations: staff update"
  on public.academy_intervention_recommendations;
create policy "academy_intervention_recommendations: staff update"
  on public.academy_intervention_recommendations
  for update to authenticated
  using (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'dean', 'registrar', 'academic_admin', 'advisor', 'faculty', 'teacher', 'professor']
    )
  )
  with check (
    tenant_id = any(academy_private.academy_current_tenant_ids())
    and academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'dean', 'registrar', 'academic_admin', 'advisor', 'faculty', 'teacher', 'professor']
    )
  );

grant select, insert on public.academy_learner_activity_events to authenticated;
grant select, insert, update on public.academy_learner_intelligence_consent to authenticated;
grant select, insert on public.academy_learner_memory to authenticated;
grant select on public.academy_learner_memory_with_confidence to authenticated;
grant select, insert on public.academy_learner_identity_snapshots to authenticated;
grant select, insert, update on public.academy_energy_checkins to authenticated;
grant select, insert, update on public.academy_intervention_recommendations to authenticated;
