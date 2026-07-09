create unique index if not exists academy_academic_programs_tenant_id_unique
  on public.academy_academic_programs(tenant_id, id);

create table if not exists public.academy_student_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete restrict,
  academic_year_id text not null,
  academic_program_id uuid,
  name text not null,
  code text not null,
  group_type text not null check (group_type in ('cohort', 'graduating_class', 'program_cohort')),
  status text not null default 'active' check (status in ('active', 'archived')),
  description text,
  created_by_person_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code),
  foreign key (tenant_id, academic_year_id)
    references public.academy_academic_years(tenant_id, id) on delete restrict,
  foreign key (tenant_id, academic_program_id)
    references public.academy_academic_programs(tenant_id, id) on delete restrict,
  foreign key (tenant_id, created_by_person_id)
    references public.academy_people(tenant_id, id) on delete restrict,
  check (group_type != 'program_cohort' or academic_program_id is not null)
);

create table if not exists public.academy_student_group_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete restrict,
  student_group_id uuid not null,
  student_profile_id text not null,
  student_person_id text not null,
  started_on date not null default current_date,
  ended_on date,
  added_by_person_id text not null,
  ended_by_person_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, student_group_id)
    references public.academy_student_groups(tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_profile_id)
    references public.academy_student_profiles(tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id)
    references public.academy_people(tenant_id, id) on delete restrict,
  foreign key (tenant_id, added_by_person_id)
    references public.academy_people(tenant_id, id) on delete restrict,
  foreign key (tenant_id, ended_by_person_id)
    references public.academy_people(tenant_id, id) on delete restrict,
  check (ended_on is null or ended_on >= started_on)
);

create index if not exists academy_student_groups_year_idx
  on public.academy_student_groups(tenant_id, academic_year_id, status, name);

create unique index if not exists academy_student_group_memberships_one_active_idx
  on public.academy_student_group_memberships(tenant_id, student_group_id, student_profile_id)
  where ended_on is null;

create index if not exists academy_student_group_memberships_student_idx
  on public.academy_student_group_memberships(tenant_id, student_profile_id, started_on desc);

alter table public.academy_student_groups enable row level security;
alter table public.academy_student_groups force row level security;
alter table public.academy_student_group_memberships enable row level security;
alter table public.academy_student_group_memberships force row level security;

create policy academy_student_groups_tenant_isolation
on public.academy_student_groups
using (tenant_id = current_setting('app.academy_tenant_id', true))
with check (tenant_id = current_setting('app.academy_tenant_id', true));

create policy academy_student_group_memberships_tenant_isolation
on public.academy_student_group_memberships
using (tenant_id = current_setting('app.academy_tenant_id', true))
with check (tenant_id = current_setting('app.academy_tenant_id', true));
