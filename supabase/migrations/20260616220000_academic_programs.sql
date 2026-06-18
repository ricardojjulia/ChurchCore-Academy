-- Academic Programs: formal programs of study (degrees, certificates, courses of study)
-- Replaces the stub academy_programs table (text-keyed, no RLS) with a normalized,
-- tenant-scoped, RLS-enforced table that supports all faith-based institution modes.

create table if not exists public.academy_academic_programs (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 text not null,

  -- Identity
  program_code              text not null,
  title                     text not null,
  short_title               text,
  description               text,

  -- Classification
  institution_mode          text not null
    check (institution_mode in (
      'bible_school', 'childrens_school', 'seminary',
      'college', 'university', 'mixed'
    )),
  credential_type           text not null
    check (credential_type in (
      'certificate', 'diploma', 'associate', 'bachelor',
      'master', 'doctorate', 'continuing_education', 'non_credit'
    )),
  grade_band                text
    check (grade_band in (
      'early_childhood', 'elementary', 'middle', 'high_school',
      'undergraduate', 'graduate', 'adult', 'all_ages'
    )),

  -- Subdivision linkage (school, department, campus)
  subdivision_id            uuid,

  -- Academic requirements
  required_credits          numeric(6,2) not null default 0,
  required_clock_hours      numeric(7,2) not null default 0,
  required_competencies     integer not null default 0,

  -- Duration
  typical_duration_periods  integer,

  -- Lifecycle
  status                    text not null default 'active'
    check (status in ('draft', 'active', 'inactive', 'archived')),
  effective_from            date,
  effective_to              date,

  -- Audit
  created_at                timestamptz not null default now(),
  created_by_person_id      uuid,
  updated_at                timestamptz not null default now(),

  -- One program code per tenant
  unique (tenant_id, program_code)
);

-- Tenant isolation via RLS
alter table public.academy_academic_programs enable row level security;
alter table public.academy_academic_programs force row level security;

create policy academy_academic_programs_tenant_isolation
  on public.academy_academic_programs
  using (tenant_id = current_setting('app.academy_tenant_id', true));

-- Lookups: all programs for a tenant, filter by mode/status
create index if not exists academy_academic_programs_tenant_idx
  on public.academy_academic_programs (tenant_id, status, institution_mode);

-- Link program enrollments to the new programs table
-- (non-breaking: existing enrollments have program_id text field, add uuid FK separately)
alter table public.academy_program_enrollments
  add column if not exists academic_program_id uuid
    references public.academy_academic_programs(id) on delete restrict;

create index if not exists academy_program_enrollments_program_idx
  on public.academy_program_enrollments (tenant_id, academic_program_id)
  where academic_program_id is not null;

-- Courses can belong to a program (optional, for curriculum mapping)
alter table public.academy_courses
  add column if not exists academic_program_id uuid
    references public.academy_academic_programs(id) on delete set null;

create index if not exists academy_courses_program_idx
  on public.academy_courses (tenant_id, academic_program_id)
  where academic_program_id is not null;
