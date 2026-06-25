-- ================================================================
-- ADD GPA TO STUDENT PROFILES
-- ChurchCore Academy | T2-06 GPA Calculation Engine
--
-- Add cumulative GPA column to academy_student_profiles.
-- This column is updated atomically during grade posting.
-- ================================================================

alter table public.academy_student_profiles
add column if not exists gpa numeric(4,2);

comment on column public.academy_student_profiles.gpa is
  'Cumulative GPA computed from official gradebook records. Updated atomically during grade posting.';

create index if not exists academy_student_profiles_gpa_idx
  on public.academy_student_profiles (tenant_id, gpa)
  where gpa is not null;
