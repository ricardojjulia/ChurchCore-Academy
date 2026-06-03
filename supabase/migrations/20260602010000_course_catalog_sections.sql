create table if not exists academy_course_catalog_profiles (
  tenant_id text primary key references academy_institution_profiles (tenant_id) on delete cascade,
  default_course_record_type text not null,
  default_duration_unit text not null,
  supports_credits boolean not null default false,
  supports_clock_hours boolean not null default false,
  supports_competencies boolean not null default false,
  supports_narrative_evaluation boolean not null default false,
  supports_grade_levels boolean not null default false,
  supports_lms_mapping boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists academy_courses (
  id text primary key,
  tenant_id text not null references academy_institution_profiles (tenant_id) on delete cascade,
  code text not null,
  title text not null,
  description text not null,
  course_type text not null,
  course_level text not null,
  record_type text not null,
  default_duration jsonb not null,
  default_credits numeric,
  default_clock_hours numeric,
  default_competency_set_id text,
  owning_subdivision_id text references academy_institution_subdivisions (id) on delete restrict,
  grade_band_subdivision_id text references academy_institution_subdivisions (id) on delete restrict,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists academy_course_sections (
  id text primary key,
  tenant_id text not null references academy_institution_profiles (tenant_id) on delete cascade,
  course_id text not null references academy_courses (id) on delete cascade,
  academic_year_id text not null references academy_academic_years (id) on delete restrict,
  academic_period_id text not null references academy_academic_periods (id) on delete restrict,
  subdivision_id text references academy_institution_subdivisions (id) on delete restrict,
  section_code text not null,
  title_override text,
  delivery_mode text not null,
  schedule_pattern text,
  capacity integer,
  status text not null,
  primary_instructor_role text not null,
  primary_instructor_id text,
  assistant_instructor_ids jsonb not null default '[]'::jsonb,
  lms_mapping_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists academy_course_prerequisites (
  id text primary key,
  tenant_id text not null references academy_institution_profiles (tenant_id) on delete cascade,
  course_id text not null references academy_courses (id) on delete cascade,
  required_course_id text not null references academy_courses (id) on delete restrict,
  requirement_type text not null,
  minimum_grade_rule_id text,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists academy_course_lms_mappings (
  id text primary key,
  tenant_id text not null references academy_institution_profiles (tenant_id) on delete cascade,
  course_id text references academy_courses (id) on delete cascade,
  section_id text references academy_course_sections (id) on delete cascade,
  provider text not null,
  mapping_status text not null,
  external_course_key text,
  external_section_key text,
  sync_policy text not null,
  last_reviewed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists academy_courses_tenant_code_idx
  on academy_courses (tenant_id, code, status);

create index if not exists academy_courses_tenant_subdivision_idx
  on academy_courses (tenant_id, owning_subdivision_id, course_type, status);

create index if not exists academy_course_sections_tenant_period_idx
  on academy_course_sections (tenant_id, academic_period_id, status);

create index if not exists academy_course_sections_tenant_course_idx
  on academy_course_sections (tenant_id, course_id, section_code);

create index if not exists academy_course_prerequisites_tenant_course_idx
  on academy_course_prerequisites (tenant_id, course_id);

create index if not exists academy_course_lms_mappings_tenant_status_idx
  on academy_course_lms_mappings (tenant_id, mapping_status, provider);
