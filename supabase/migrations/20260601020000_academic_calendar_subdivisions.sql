create table if not exists academy_calendar_profiles (
  tenant_id text primary key references academy_institution_profiles (tenant_id) on delete cascade,
  calendar_system text not null,
  default_term_structure text not null,
  timezone text not null,
  week_starts_on text not null,
  uses_instructional_days boolean not null default true,
  uses_enrollment_windows boolean not null default true,
  uses_grading_windows boolean not null default true,
  uses_transcript_periods boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists academy_institution_subdivisions (
  id text primary key,
  tenant_id text not null references academy_institution_profiles (tenant_id) on delete cascade,
  parent_subdivision_id text references academy_institution_subdivisions (id) on delete restrict,
  name text not null,
  code text not null,
  subdivision_type text not null,
  institution_mode text,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists academy_academic_years (
  id text primary key,
  tenant_id text not null references academy_institution_profiles (tenant_id) on delete cascade,
  name text not null,
  code text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null,
  calendar_system text not null,
  subdivision_id text references academy_institution_subdivisions (id) on delete restrict,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists academy_academic_periods (
  id text primary key,
  tenant_id text not null references academy_institution_profiles (tenant_id) on delete cascade,
  academic_year_id text not null references academy_academic_years (id) on delete cascade,
  parent_period_id text references academy_academic_periods (id) on delete restrict,
  subdivision_id text references academy_institution_subdivisions (id) on delete restrict,
  name text not null,
  code text not null,
  period_type text not null,
  starts_on date not null,
  ends_on date not null,
  sequence integer not null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists academy_enrollment_windows (
  id text primary key,
  tenant_id text not null references academy_institution_profiles (tenant_id) on delete cascade,
  academic_period_id text not null references academy_academic_periods (id) on delete cascade,
  window_type text not null,
  opens_at timestamptz not null,
  closes_at timestamptz,
  applies_to_subdivision_id text references academy_institution_subdivisions (id) on delete restrict,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists academy_grading_windows (
  id text primary key,
  tenant_id text not null references academy_institution_profiles (tenant_id) on delete cascade,
  academic_period_id text not null references academy_academic_periods (id) on delete cascade,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  grade_posting_policy text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists academy_transcript_periods (
  id text primary key,
  tenant_id text not null references academy_institution_profiles (tenant_id) on delete cascade,
  academic_period_id text not null references academy_academic_periods (id) on delete cascade,
  record_type text not null,
  posting_opens_at timestamptz not null,
  posting_closes_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists academy_academic_years_tenant_subdivision_idx
  on academy_academic_years (tenant_id, subdivision_id, starts_on, ends_on);

create index if not exists academy_academic_periods_tenant_year_idx
  on academy_academic_periods (tenant_id, academic_year_id, sequence);

create index if not exists academy_institution_subdivisions_tenant_type_idx
  on academy_institution_subdivisions (tenant_id, subdivision_type, status);
