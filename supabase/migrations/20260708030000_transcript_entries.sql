-- Immutable course-level transcript snapshots created from completed enrollment
-- and registrar-posted grade facts.

create table if not exists public.academy_transcript_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete restrict,
  student_profile_id text not null,
  student_person_id text not null,
  program_enrollment_id uuid not null,
  course_section_registration_id uuid not null,
  academic_program_id uuid not null,
  catalog_academic_year_id text not null,
  academic_period_id text not null,
  academic_period_name text not null,
  course_section_id text not null,
  course_id text not null,
  course_code text not null,
  course_title text not null,
  credits_earned numeric(6,2) not null default 0 check (credits_earned >= 0),
  final_letter_grade text,
  final_percentage numeric(5,2),
  gpa_points numeric(4,2),
  is_passing boolean not null,
  source_grade_record_id uuid not null,
  posted_at timestamptz not null default now(),
  posted_by_person_id text not null,
  unique (tenant_id, id),
  unique (tenant_id, course_section_registration_id),
  foreign key (tenant_id, student_profile_id)
    references public.academy_student_profiles(tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id)
    references public.academy_people(tenant_id, id) on delete restrict,
  foreign key (tenant_id, program_enrollment_id)
    references public.academy_program_enrollments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, course_section_registration_id)
    references public.academy_course_section_registrations(tenant_id, id) on delete restrict,
  foreign key (tenant_id, catalog_academic_year_id)
    references public.academy_academic_years(tenant_id, id) on delete restrict,
  foreign key (tenant_id, academic_period_id)
    references public.academy_academic_periods(tenant_id, id) on delete restrict,
  foreign key (tenant_id, course_section_id)
    references public.academy_course_sections(tenant_id, id) on delete restrict,
  foreign key (tenant_id, course_id)
    references public.academy_courses(tenant_id, id) on delete restrict,
  foreign key (tenant_id, source_grade_record_id)
    references public.academy_gradebook_records(tenant_id, id) on delete restrict,
  foreign key (tenant_id, posted_by_person_id)
    references public.academy_people(tenant_id, id) on delete restrict
);

create index if not exists academy_transcript_entries_student_idx
  on public.academy_transcript_entries(tenant_id, student_person_id, posted_at desc);

create table if not exists public.academy_transcript_entry_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete restrict,
  transcript_entry_id uuid not null,
  actor_person_id text not null,
  event_type text not null check (event_type in ('posted')),
  reason text not null,
  occurred_at timestamptz not null default now(),
  foreign key (tenant_id, transcript_entry_id)
    references public.academy_transcript_entries(tenant_id, id) on delete restrict,
  foreign key (tenant_id, actor_person_id)
    references public.academy_people(tenant_id, id) on delete restrict
);

create or replace function public.academy_reject_transcript_entry_mutation()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  raise exception 'Transcript entries are immutable.';
end;
$$;

create or replace function public.academy_reject_transcript_entry_event_mutation()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  raise exception 'Transcript entry events are immutable.';
end;
$$;

create trigger academy_transcript_entries_immutable
before update or delete on public.academy_transcript_entries
for each row execute function public.academy_reject_transcript_entry_mutation();

create trigger academy_transcript_entry_events_immutable
before update or delete on public.academy_transcript_entry_events
for each row execute function public.academy_reject_transcript_entry_event_mutation();

alter table public.academy_transcript_entries enable row level security;
alter table public.academy_transcript_entries force row level security;
alter table public.academy_transcript_entry_events enable row level security;
alter table public.academy_transcript_entry_events force row level security;

create policy academy_transcript_entries_tenant_isolation
on public.academy_transcript_entries
using (tenant_id = current_setting('app.academy_tenant_id', true))
with check (tenant_id = current_setting('app.academy_tenant_id', true));

create policy academy_transcript_entry_events_tenant_isolation
on public.academy_transcript_entry_events
using (tenant_id = current_setting('app.academy_tenant_id', true))
with check (tenant_id = current_setting('app.academy_tenant_id', true));

revoke update, delete on public.academy_transcript_entries from authenticated;
revoke update, delete on public.academy_transcript_entry_events from authenticated;
