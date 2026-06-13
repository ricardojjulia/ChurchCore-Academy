create or replace function public.academy_current_external_subject()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    auth.uid()::text
  );
$$;

create or replace function public.academy_current_person_id()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    nullif(current_setting('app.academy_person_id', true), ''),
    (
      select account.person_id
      from public.academy_account_links account
      where account.provider = 'supabase'
        and account.external_subject = public.academy_current_external_subject()
        and account.status = 'active'
      order by account.created_at
      limit 1
    )
  );
$$;

create or replace function public.academy_current_tenant_ids()
returns text[]
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when nullif(current_setting('app.academy_tenant_id', true), '') is not null
      then array[current_setting('app.academy_tenant_id', true)]
    else (
      select coalesce(array_agg(distinct account.tenant_id), array[]::text[])
      from public.academy_account_links account
      where account.provider = 'supabase'
        and account.external_subject = public.academy_current_external_subject()
        and account.status = 'active'
    )
  end;
$$;

create or replace function public.academy_has_active_role(
  p_tenant_id text,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.academy_account_links account
    join public.academy_person_role_assignments assignment
      on assignment.tenant_id = account.tenant_id
     and assignment.person_id = account.person_id
    where account.provider = 'supabase'
      and (
        account.external_subject = public.academy_current_external_subject()
        or account.person_id = public.academy_current_person_id()
      )
      and account.status = 'active'
      and account.tenant_id = p_tenant_id
      and assignment.status = 'active'
      and assignment.role = any(p_roles)
      and (assignment.starts_on is null or assignment.starts_on <= current_date)
      and (assignment.ends_on is null or assignment.ends_on >= current_date)
  );
$$;

create or replace function public.academy_can_read_student(
  p_tenant_id text,
  p_student_person_id text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    p_tenant_id = any(public.academy_current_tenant_ids())
    and (
      p_student_person_id = public.academy_current_person_id()
      or public.academy_has_active_role(
        p_tenant_id,
        array['institution_admin', 'dean', 'registrar', 'academic_admin', 'admissions', 'advisor']
      )
      or exists (
        select 1
        from public.academy_student_relationships relationship
        where relationship.tenant_id = p_tenant_id
          and relationship.student_person_id = p_student_person_id
          and relationship.related_person_id = public.academy_current_person_id()
          and relationship.status = 'active'
          and relationship.visibility <> 'none'
          and (relationship.starts_on is null or relationship.starts_on <= current_date)
          and (relationship.ends_on is null or relationship.ends_on >= current_date)
      )
    );
$$;

create table if not exists public.academy_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete restrict,
  actor_person_id text,
  actor_external_subject text,
  action text not null,
  entity_type text not null,
  entity_id text,
  result_status text not null,
  correlation_id text,
  idempotency_key text,
  redacted_metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists academy_audit_events_tenant_time_idx
  on public.academy_audit_events (tenant_id, occurred_at desc);

create unique index if not exists academy_audit_events_tenant_idempotency_idx
  on public.academy_audit_events (tenant_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.academy_reject_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Academy audit events are immutable.';
end;
$$;

drop trigger if exists academy_audit_events_immutable
  on public.academy_audit_events;

create trigger academy_audit_events_immutable
before update or delete on public.academy_audit_events
for each row execute function public.academy_reject_audit_mutation();

do $$
declare
  table_name text;
  protected_tables text[] := array[
    'academy_academic_periods',
    'academy_academic_standing_rules',
    'academy_academic_years',
    'academy_account_links',
    'academy_admin_users',
    'academy_calendar_profiles',
    'academy_course_catalog_profiles',
    'academy_course_lms_mappings',
    'academy_course_prerequisites',
    'academy_course_sections',
    'academy_courses',
    'academy_demo_feedback',
    'academy_demo_feedback_rate_limits',
    'academy_enrollment_windows',
    'academy_evaluation_rule_sets',
    'academy_evaluation_scale_bands',
    'academy_evaluation_scales',
    'academy_faculty',
    'academy_grading_profiles',
    'academy_grading_windows',
    'academy_institution_profiles',
    'academy_institution_subdivisions',
    'academy_official_record_rules',
    'academy_people',
    'academy_person_role_assignments',
    'academy_programs',
    'academy_sections',
    'academy_staff_profiles',
    'academy_student_profiles',
    'academy_student_relationships',
    'academy_students',
    'academy_thresholds',
    'academy_transcript_periods',
    'ai_signals',
    'ai_suggestions',
    'workflow_actions',
    'workflow_feedback',
    'workflows'
  ];
begin
  foreach table_name in array protected_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'alter table public.%I enable row level security',
        table_name
      );
      execute format(
        'alter table public.%I force row level security',
        table_name
      );
    end if;
  end loop;
end;
$$;

alter table public.academy_audit_events enable row level security;
alter table public.academy_audit_events force row level security;

do $$
declare
  table_name text;
  configuration_tables text[] := array[
    'academy_institution_profiles',
    'academy_calendar_profiles',
    'academy_institution_subdivisions',
    'academy_academic_years',
    'academy_academic_periods',
    'academy_enrollment_windows',
    'academy_grading_windows',
    'academy_transcript_periods',
    'academy_course_catalog_profiles',
    'academy_courses',
    'academy_course_sections',
    'academy_course_prerequisites',
    'academy_course_lms_mappings',
    'academy_grading_profiles',
    'academy_evaluation_scales',
    'academy_evaluation_scale_bands',
    'academy_evaluation_rule_sets',
    'academy_official_record_rules',
    'academy_academic_standing_rules'
  ];
begin
  foreach table_name in array configuration_tables loop
    execute format('drop policy if exists academy_tenant_read on public.%I', table_name);
    execute format(
      'create policy academy_tenant_read on public.%I for select using (
        tenant_id = any(public.academy_current_tenant_ids())
        and public.academy_has_active_role(
          tenant_id,
          array[''institution_admin'', ''dean'', ''registrar'', ''academic_admin'']
        )
      )',
      table_name
    );
    execute format('drop policy if exists academy_tenant_admin_write on public.%I', table_name);
    execute format(
      'create policy academy_tenant_admin_write on public.%I for all using (
        public.academy_has_active_role(tenant_id, array[''institution_admin''])
      ) with check (
        public.academy_has_active_role(tenant_id, array[''institution_admin''])
      )',
      table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
  staff_tables text[] := array[
    'academy_admin_users',
    'academy_programs',
    'academy_students',
    'academy_faculty',
    'academy_sections',
    'academy_thresholds'
  ];
begin
  foreach table_name in array staff_tables loop
    execute format('drop policy if exists academy_staff_access on public.%I', table_name);
    execute format(
      'create policy academy_staff_access on public.%I for all using (
        public.academy_has_active_role(
          tenant_id,
          array[''institution_admin'', ''dean'', ''registrar'', ''academic_admin'', ''admissions'', ''advisor'']
        )
      ) with check (
        public.academy_has_active_role(
          tenant_id,
          array[''institution_admin'', ''dean'', ''registrar'', ''academic_admin'', ''admissions'', ''advisor'']
        )
      )',
      table_name
    );
  end loop;
end;
$$;

drop policy if exists academy_people_scoped_read on public.academy_people;
create policy academy_people_scoped_read
on public.academy_people
for select
using (
  id = public.academy_current_person_id()
  or public.academy_can_read_student(tenant_id, id)
  or public.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'dean', 'registrar', 'academic_admin', 'admissions', 'advisor', 'faculty', 'teacher', 'professor']
  )
);

drop policy if exists academy_people_staff_write on public.academy_people;
create policy academy_people_staff_write
on public.academy_people
for all
using (
  public.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'admissions']
  )
)
with check (
  public.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'admissions']
  )
);

drop policy if exists academy_student_profiles_scoped_read on public.academy_student_profiles;
create policy academy_student_profiles_scoped_read
on public.academy_student_profiles
for select
using (public.academy_can_read_student(tenant_id, person_id));

drop policy if exists academy_student_profiles_staff_write on public.academy_student_profiles;
create policy academy_student_profiles_staff_write
on public.academy_student_profiles
for all
using (
  public.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'admissions']
  )
)
with check (
  public.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'admissions']
  )
);

drop policy if exists academy_relationships_scoped_read on public.academy_student_relationships;
create policy academy_relationships_scoped_read
on public.academy_student_relationships
for select
using (
  related_person_id = public.academy_current_person_id()
  or public.academy_can_read_student(tenant_id, student_person_id)
);

drop policy if exists academy_relationships_staff_write on public.academy_student_relationships;
create policy academy_relationships_staff_write
on public.academy_student_relationships
for all
using (
  public.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'admissions']
  )
)
with check (
  public.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'admissions']
  )
);

do $$
declare
  table_name text;
  identity_tables text[] := array[
    'academy_person_role_assignments',
    'academy_staff_profiles',
    'academy_account_links'
  ];
begin
  foreach table_name in array identity_tables loop
    execute format('drop policy if exists academy_identity_admin on public.%I', table_name);
    execute format(
      'create policy academy_identity_admin on public.%I for all using (
        public.academy_has_active_role(
          tenant_id,
          array[''institution_admin'', ''registrar'', ''academic_admin'']
        )
      ) with check (
        public.academy_has_active_role(
          tenant_id,
          array[''institution_admin'', ''registrar'', ''academic_admin'']
        )
      )',
      table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
  workflow_tables text[] := array[
    'ai_signals',
    'ai_suggestions',
    'workflows'
  ];
begin
  foreach table_name in array workflow_tables loop
    execute format('drop policy if exists academy_workflow_admin on public.%I', table_name);
    execute format(
      'create policy academy_workflow_admin on public.%I for all using (
        public.academy_has_active_role(tenant_id, array[''academic_admin''])
      ) with check (
        public.academy_has_active_role(tenant_id, array[''academic_admin''])
      )',
      table_name
    );
  end loop;
end;
$$;

drop policy if exists academy_workflow_actions_admin on public.workflow_actions;
create policy academy_workflow_actions_admin
on public.workflow_actions
for all
using (
  exists (
    select 1
    from public.workflows workflow
    where workflow.id = workflow_actions.workflow_id
      and public.academy_has_active_role(workflow.tenant_id, array['academic_admin'])
  )
)
with check (
  exists (
    select 1
    from public.workflows workflow
    where workflow.id = workflow_actions.workflow_id
      and public.academy_has_active_role(workflow.tenant_id, array['academic_admin'])
  )
);

drop policy if exists academy_workflow_feedback_admin on public.workflow_feedback;
create policy academy_workflow_feedback_admin
on public.workflow_feedback
for all
using (
  exists (
    select 1
    from public.workflows workflow
    where workflow.id = workflow_feedback.workflow_id
      and public.academy_has_active_role(workflow.tenant_id, array['academic_admin'])
  )
)
with check (
  exists (
    select 1
    from public.workflows workflow
    where workflow.id = workflow_feedback.workflow_id
      and public.academy_has_active_role(workflow.tenant_id, array['academic_admin'])
  )
);

drop policy if exists academy_audit_admin_read on public.academy_audit_events;
create policy academy_audit_admin_read
on public.academy_audit_events
for select
using (
  public.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'dean', 'registrar', 'academic_admin']
  )
);

drop policy if exists academy_audit_insert on public.academy_audit_events;
create policy academy_audit_insert
on public.academy_audit_events
for insert
with check (
  tenant_id = any(public.academy_current_tenant_ids())
  and actor_person_id = public.academy_current_person_id()
);

revoke update, delete on public.academy_audit_events from authenticated;

do $$
begin
  if to_regclass('public.academy_demo_feedback_rate_limits') is not null then
    revoke all on public.academy_demo_feedback_rate_limits from authenticated;
  end if;
end;
$$;
