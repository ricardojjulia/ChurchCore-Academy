-- ================================================================
-- GRADEBOOK DOMAIN -- PHASE 1 SCHEMA
-- ChurchCore Academy | ADR-2025-009
--
-- Repo compatibility note:
-- ADR-2025-009 names generic tables such as grading_scales,
-- assignments, assignment_submissions, grade_records, and
-- course_grade_summaries. ChurchCore Academy already uses a
-- tenant-scoped Academy schema, so these are implemented as
-- academy_gradebook_* tables with the same domain boundaries.
--
-- SECURITY LEAD MANDATE:
-- service_role bypasses all RLS policies below. Any server process
-- using service_role must perform manual authorization checks.
-- Never expose the service_role key client-side.
-- ================================================================

create unique index if not exists academy_courses_tenant_id_gradebook_idx
  on public.academy_courses (tenant_id, id);

create unique index if not exists academy_course_sections_tenant_id_gradebook_idx
  on public.academy_course_sections (tenant_id, id);

create unique index if not exists academy_people_tenant_id_gradebook_idx
  on public.academy_people (tenant_id, id);

create unique index if not exists academy_program_enrollments_tenant_id_gradebook_idx
  on public.academy_program_enrollments (tenant_id, id);

create unique index if not exists academy_course_section_registrations_tenant_id_gradebook_idx
  on public.academy_course_section_registrations (tenant_id, id);

create table if not exists public.academy_gradebook_scales (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete restrict,
  name text not null,
  scale_type text not null check (scale_type in ('percentage', 'points', 'letter', 'pass_fail')),
  is_default boolean not null default false,
  created_by_person_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, created_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

create table if not exists public.academy_gradebook_scale_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete restrict,
  scale_id uuid not null,
  letter_grade text,
  min_percentage numeric(5,2) not null,
  max_percentage numeric(5,2) not null,
  gpa_points numeric(4,2),
  label text,
  unique (tenant_id, id),
  foreign key (tenant_id, scale_id)
    references public.academy_gradebook_scales (tenant_id, id) on delete cascade,
  check (min_percentage <= max_percentage)
);

create table if not exists public.academy_gradebook_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete restrict,
  course_id text not null,
  section_id text,
  module_id text,
  created_by_person_id text not null,
  title text not null,
  description text,
  assignment_type text not null check (
    assignment_type in ('essay', 'quiz', 'project', 'participation', 'attendance', 'practical', 'reflection')
  ),
  max_points numeric(8,2) not null check (max_points > 0),
  weight numeric(5,4) not null default 1.0,
  due_date timestamptz,
  is_published boolean not null default false,
  grading_scale_id uuid,
  sensitivity_tier text not null default 'standard'
    check (sensitivity_tier in ('standard', 'elevated', 'pastoral')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, course_id)
    references public.academy_courses (tenant_id, id) on delete restrict,
  foreign key (tenant_id, section_id)
    references public.academy_course_sections (tenant_id, id) on delete restrict,
  foreign key (tenant_id, created_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, grading_scale_id)
    references public.academy_gradebook_scales (tenant_id, id) on delete set null
);

create table if not exists public.academy_gradebook_submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete restrict,
  assignment_id uuid not null,
  learner_person_id text not null,
  submitted_at timestamptz not null default now(),
  content text,
  file_urls text[],
  status text not null default 'submitted'
    check (status in ('draft', 'submitted', 'graded', 'returned', 'resubmitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, assignment_id, learner_person_id),
  foreign key (tenant_id, assignment_id)
    references public.academy_gradebook_assignments (tenant_id, id) on delete restrict,
  foreign key (tenant_id, learner_person_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

comment on table public.academy_gradebook_submissions is
  'ADR-2025-009: is_late is computed at query time by joining assignments.due_date; no stored generated column.';

create table if not exists public.academy_gradebook_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete restrict,
  submission_id uuid not null,
  assignment_id uuid not null,
  learner_person_id text not null,
  graded_by_person_id text not null,
  points_earned numeric(8,2),
  max_points numeric(8,2) not null check (max_points > 0),
  percentage numeric(5,2) generated always as (
    (points_earned / nullif(max_points, 0)) * 100
  ) stored,
  letter_grade text,
  is_passing boolean,
  is_overridden boolean not null default false,
  original_points numeric(8,2),
  override_reason text,
  override_at timestamptz,
  override_by_person_id text,
  instructor_feedback text,
  sensitivity_tier text not null default 'standard'
    check (sensitivity_tier in ('standard', 'elevated', 'pastoral')),
  ai_suggested_points numeric(8,2),
  ai_suggestion_model text,
  ai_suggestion_at timestamptz,
  ai_accepted boolean,
  graded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, submission_id),
  foreign key (tenant_id, submission_id)
    references public.academy_gradebook_submissions (tenant_id, id) on delete restrict,
  foreign key (tenant_id, assignment_id)
    references public.academy_gradebook_assignments (tenant_id, id) on delete restrict,
  foreign key (tenant_id, learner_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, graded_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, override_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

comment on column public.academy_gradebook_records.ai_suggested_points is
  'Phase 2 hook only. Must remain null in Phase 1 writes.';
comment on column public.academy_gradebook_records.ai_accepted is
  'Phase 2 hook only. Null means no AI involved in Phase 1.';

create table if not exists public.academy_gradebook_course_summaries (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete restrict,
  course_id text not null,
  learner_person_id text not null,
  enrollment_id uuid not null,
  final_percentage numeric(5,2),
  final_letter_grade text,
  final_gpa_points numeric(4,2),
  is_passing boolean,
  academic_standing text check (
    academic_standing in ('good_standing', 'academic_warning', 'academic_probation', 'honors', 'incomplete')
  ),
  is_overridden boolean not null default false,
  original_grade text,
  override_reason text,
  override_by_person_id text,
  override_at timestamptz,
  sensitivity_tier text not null default 'standard'
    check (sensitivity_tier in ('standard', 'elevated', 'pastoral')),
  calculated_at timestamptz not null default now(),
  calculation_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, enrollment_id),
  foreign key (tenant_id, course_id)
    references public.academy_courses (tenant_id, id) on delete restrict,
  foreign key (tenant_id, learner_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, enrollment_id)
    references public.academy_program_enrollments (tenant_id, id) on delete restrict,
  foreign key (tenant_id, override_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

comment on table public.academy_gradebook_course_summaries is
  'ADR-2025-009: ai_narrative_id FK is deferred to Phase 2; do not add the column or FK in Phase 1.';

create table if not exists public.academy_gradebook_override_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete restrict,
  grade_record_id uuid,
  summary_id uuid,
  overridden_by_person_id text not null,
  override_type text not null check (override_type in ('assignment_grade', 'final_grade')),
  previous_value jsonb not null,
  new_value jsonb not null,
  reason text not null,
  override_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, grade_record_id)
    references public.academy_gradebook_records (tenant_id, id) on delete restrict,
  foreign key (tenant_id, summary_id)
    references public.academy_gradebook_course_summaries (tenant_id, id) on delete restrict,
  foreign key (tenant_id, overridden_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  check (
    (override_type = 'assignment_grade' and grade_record_id is not null and summary_id is null)
    or (override_type = 'final_grade' and summary_id is not null and grade_record_id is null)
  )
);

create index if not exists academy_gradebook_assignments_tenant_course_idx
  on public.academy_gradebook_assignments (tenant_id, course_id, section_id, is_published);

create index if not exists academy_gradebook_submissions_assignment_idx
  on public.academy_gradebook_submissions (tenant_id, assignment_id, status);

create index if not exists academy_gradebook_records_learner_idx
  on public.academy_gradebook_records (tenant_id, learner_person_id, graded_at desc);

create index if not exists academy_gradebook_summaries_learner_idx
  on public.academy_gradebook_course_summaries (tenant_id, learner_person_id, calculated_at desc);

create index if not exists academy_gradebook_override_audit_grade_idx
  on public.academy_gradebook_override_audit (tenant_id, grade_record_id, override_at desc);

create or replace function public.academy_reject_gradebook_override_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception
    'academy_gradebook_override_audit is append-only. UPDATE and DELETE operations are not permitted. [ChurchCore Academy -- ADR-2025-009]';
end;
$$;

drop trigger if exists academy_gradebook_override_audit_immutable
  on public.academy_gradebook_override_audit;

create trigger academy_gradebook_override_audit_immutable
before update or delete on public.academy_gradebook_override_audit
for each row execute function public.academy_reject_gradebook_override_audit_mutation();

create or replace function academy_private.academy_audit_pastoral_gradebook_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, academy_private
as $$
begin
  if new.sensitivity_tier = 'pastoral' then
    insert into public.academy_audit_events (
      tenant_id,
      actor_person_id,
      actor_external_subject,
      action,
      entity_type,
      entity_id,
      result_status,
      redacted_metadata
    ) values (
      new.tenant_id,
      academy_private.academy_current_person_id(),
      academy_private.academy_current_external_subject(),
      tg_op,
      tg_table_name,
      new.id::text,
      'success',
      jsonb_build_object('sensitivity_tier', 'pastoral')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists academy_gradebook_records_pastoral_audit
  on public.academy_gradebook_records;

create trigger academy_gradebook_records_pastoral_audit
after insert or update on public.academy_gradebook_records
for each row execute function academy_private.academy_audit_pastoral_gradebook_write();

drop trigger if exists academy_gradebook_summaries_pastoral_audit
  on public.academy_gradebook_course_summaries;

create trigger academy_gradebook_summaries_pastoral_audit
after insert or update on public.academy_gradebook_course_summaries
for each row execute function academy_private.academy_audit_pastoral_gradebook_write();

alter table public.academy_gradebook_scales enable row level security;
alter table public.academy_gradebook_scales force row level security;
revoke all on public.academy_gradebook_scales from anon;

alter table public.academy_gradebook_scale_entries enable row level security;
alter table public.academy_gradebook_scale_entries force row level security;
revoke all on public.academy_gradebook_scale_entries from anon;

alter table public.academy_gradebook_assignments enable row level security;
alter table public.academy_gradebook_assignments force row level security;
revoke all on public.academy_gradebook_assignments from anon;

alter table public.academy_gradebook_submissions enable row level security;
alter table public.academy_gradebook_submissions force row level security;
revoke all on public.academy_gradebook_submissions from anon;

alter table public.academy_gradebook_records enable row level security;
alter table public.academy_gradebook_records force row level security;
revoke all on public.academy_gradebook_records from anon;

alter table public.academy_gradebook_course_summaries enable row level security;
alter table public.academy_gradebook_course_summaries force row level security;
revoke all on public.academy_gradebook_course_summaries from anon;

alter table public.academy_gradebook_override_audit enable row level security;
alter table public.academy_gradebook_override_audit force row level security;
revoke all on public.academy_gradebook_override_audit from anon;

grant select, insert, update on public.academy_gradebook_scales to authenticated;
grant select, insert, update on public.academy_gradebook_scale_entries to authenticated;
grant select, insert, update on public.academy_gradebook_assignments to authenticated;
grant select, insert, update on public.academy_gradebook_submissions to authenticated;
grant select, insert, update on public.academy_gradebook_records to authenticated;
grant select, insert, update on public.academy_gradebook_course_summaries to authenticated;
grant select, insert on public.academy_gradebook_override_audit to authenticated;
revoke update, delete on public.academy_gradebook_override_audit from authenticated;

-- Assignment delivery layer policies.
drop policy if exists academy_gradebook_assignments_staff_read on public.academy_gradebook_assignments;
create policy academy_gradebook_assignments_staff_read
on public.academy_gradebook_assignments
for select
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and (
    academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'dean', 'registrar', 'academic_admin']
    )
    or exists (
      select 1
      from public.academy_course_sections section
      where section.tenant_id = academy_gradebook_assignments.tenant_id
        and section.course_id = academy_gradebook_assignments.course_id
        and (
          section.primary_instructor_id = academy_private.academy_current_person_id()
          or section.assistant_instructor_ids ? academy_private.academy_current_person_id()
        )
    )
  )
);

drop policy if exists academy_gradebook_assignments_staff_write on public.academy_gradebook_assignments;
create policy academy_gradebook_assignments_staff_write
on public.academy_gradebook_assignments
for all
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'dean', 'registrar', 'academic_admin', 'faculty', 'teacher', 'professor']
  )
)
with check (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and created_by_person_id = academy_private.academy_current_person_id()
);

drop policy if exists academy_gradebook_submissions_learner_read on public.academy_gradebook_submissions;
create policy academy_gradebook_submissions_learner_read
on public.academy_gradebook_submissions
for select
using (
  learner_person_id = academy_private.academy_current_person_id()
  or academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'dean', 'registrar', 'academic_admin', 'advisor', 'faculty', 'teacher', 'professor']
  )
);

drop policy if exists academy_gradebook_submissions_learner_insert on public.academy_gradebook_submissions;
create policy academy_gradebook_submissions_learner_insert
on public.academy_gradebook_submissions
for insert
with check (
  learner_person_id = academy_private.academy_current_person_id()
  and tenant_id = any(academy_private.academy_current_tenant_ids())
);

-- SIS record-layer policies.
drop policy if exists academy_gradebook_records_learner_read on public.academy_gradebook_records;
create policy academy_gradebook_records_learner_read
on public.academy_gradebook_records
for select
using (
  learner_person_id = academy_private.academy_current_person_id()
  or academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'dean', 'registrar', 'academic_admin', 'advisor', 'faculty', 'teacher', 'professor']
  )
);

drop policy if exists academy_gradebook_records_staff_write on public.academy_gradebook_records;
create policy academy_gradebook_records_staff_write
on public.academy_gradebook_records
for all
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'dean', 'registrar', 'academic_admin', 'faculty', 'teacher', 'professor']
  )
)
with check (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and (
    graded_by_person_id = academy_private.academy_current_person_id()
    or override_by_person_id = academy_private.academy_current_person_id()
    or academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'dean', 'registrar', 'academic_admin']
    )
  )
);

drop policy if exists academy_gradebook_summaries_learner_read on public.academy_gradebook_course_summaries;
create policy academy_gradebook_summaries_learner_read
on public.academy_gradebook_course_summaries
for select
using (
  learner_person_id = academy_private.academy_current_person_id()
  or academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'dean', 'registrar', 'academic_admin', 'advisor', 'faculty', 'teacher', 'professor']
  )
);

drop policy if exists academy_gradebook_summaries_staff_write on public.academy_gradebook_course_summaries;
create policy academy_gradebook_summaries_staff_write
on public.academy_gradebook_course_summaries
for all
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'dean', 'registrar', 'academic_admin']
  )
)
with check (
  tenant_id = any(academy_private.academy_current_tenant_ids())
);

drop policy if exists academy_gradebook_override_audit_read on public.academy_gradebook_override_audit;
create policy academy_gradebook_override_audit_read
on public.academy_gradebook_override_audit
for select
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'dean', 'registrar', 'academic_admin', 'faculty', 'teacher', 'professor']
  )
);

drop policy if exists academy_gradebook_override_audit_insert on public.academy_gradebook_override_audit;
create policy academy_gradebook_override_audit_insert
on public.academy_gradebook_override_audit
for insert
with check (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and overridden_by_person_id = academy_private.academy_current_person_id()
);

drop policy if exists academy_gradebook_scale_read on public.academy_gradebook_scales;
create policy academy_gradebook_scale_read
on public.academy_gradebook_scales
for select
using (tenant_id = any(academy_private.academy_current_tenant_ids()));

drop policy if exists academy_gradebook_scale_write on public.academy_gradebook_scales;
create policy academy_gradebook_scale_write
on public.academy_gradebook_scales
for all
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'dean', 'registrar', 'academic_admin']
  )
)
with check (tenant_id = any(academy_private.academy_current_tenant_ids()));

drop policy if exists academy_gradebook_scale_entries_read on public.academy_gradebook_scale_entries;
create policy academy_gradebook_scale_entries_read
on public.academy_gradebook_scale_entries
for select
using (tenant_id = any(academy_private.academy_current_tenant_ids()));

drop policy if exists academy_gradebook_scale_entries_write on public.academy_gradebook_scale_entries;
create policy academy_gradebook_scale_entries_write
on public.academy_gradebook_scale_entries
for all
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'dean', 'registrar', 'academic_admin']
  )
)
with check (tenant_id = any(academy_private.academy_current_tenant_ids()));
