-- Program Curriculum: year-versioned required courses for catalog-year rules.

create unique index if not exists academy_academic_years_tenant_id_idx
  on public.academy_academic_years (tenant_id, id);

create table if not exists public.academy_program_curriculum_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete restrict,
  academic_program_id uuid not null references public.academy_academic_programs(id) on delete cascade,
  academic_year_id text not null,
  course_id text not null,
  requirement_type text not null default 'required'
    check (requirement_type in ('required', 'elective', 'practicum', 'capstone')),
  requirement_group text not null default 'core',
  sequence integer not null check (sequence > 0),
  credits numeric(6,2) not null default 0 check (credits >= 0),
  minimum_grade text,
  notes text,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, academic_program_id, academic_year_id, course_id),
  foreign key (tenant_id, academic_year_id)
    references public.academy_academic_years (tenant_id, id) on delete restrict,
  foreign key (tenant_id, course_id)
    references public.academy_courses (tenant_id, id) on delete restrict
);

create index if not exists academy_program_curriculum_program_year_idx
  on public.academy_program_curriculum_requirements (
    tenant_id, academic_program_id, academic_year_id, status, sequence
  );

create index if not exists academy_program_curriculum_course_idx
  on public.academy_program_curriculum_requirements (tenant_id, course_id)
  where status = 'active';

alter table public.academy_program_curriculum_requirements enable row level security;
alter table public.academy_program_curriculum_requirements force row level security;

drop policy if exists academy_program_curriculum_requirements_tenant_isolation
on public.academy_program_curriculum_requirements;

create policy academy_program_curriculum_requirements_tenant_isolation
on public.academy_program_curriculum_requirements
using (tenant_id = current_setting('app.academy_tenant_id', true))
with check (tenant_id = current_setting('app.academy_tenant_id', true));
