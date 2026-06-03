create table if not exists academy_grading_profiles (
  tenant_id text primary key references academy_institution_profiles (tenant_id) on delete cascade,
  default_evaluation_type text not null,
  default_official_record_type text not null,
  supports_gpa boolean not null default false,
  supports_credits boolean not null default false,
  supports_clock_hours boolean not null default false,
  supports_competencies boolean not null default false,
  supports_narrative_evaluation boolean not null default false,
  supports_promotion boolean not null default false,
  supports_graduation_audit boolean not null default false,
  grade_release_policy text not null,
  guardian_visibility_policy text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists academy_evaluation_scales (
  id text primary key,
  tenant_id text not null references academy_institution_profiles (tenant_id) on delete cascade,
  name text not null,
  scale_type text not null,
  applies_to_record_type text not null,
  narrative_required boolean,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists academy_evaluation_scale_bands (
  id text primary key,
  tenant_id text not null references academy_institution_profiles (tenant_id) on delete cascade,
  scale_id text not null references academy_evaluation_scales (id) on delete cascade,
  label text not null,
  minimum_value numeric,
  maximum_value numeric,
  grade_points numeric,
  is_passing boolean not null default false,
  is_completion boolean not null default false,
  official_record_value text not null,
  sequence integer not null
);

create table if not exists academy_evaluation_rule_sets (
  id text primary key,
  tenant_id text not null references academy_institution_profiles (tenant_id) on delete cascade,
  course_id text not null references academy_courses (id) on delete cascade,
  section_id text references academy_course_sections (id) on delete cascade,
  evaluation_type text not null,
  scale_id text not null references academy_evaluation_scales (id) on delete restrict,
  record_type text not null,
  gpa_policy text not null,
  credit_policy text not null,
  clock_hour_policy text not null,
  competency_policy text not null,
  narrative_policy text not null,
  posting_policy text not null,
  lms_grade_return_policy text not null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists academy_official_record_rules (
  id text primary key,
  tenant_id text not null references academy_institution_profiles (tenant_id) on delete cascade,
  record_type text not null,
  applies_to_institution_mode text not null,
  posting_authority text not null,
  release_policy text not null,
  included_in_transcript boolean not null default false,
  included_in_progress_report boolean not null default false,
  included_in_completion_record boolean not null default false,
  included_in_promotion boolean not null default false,
  included_in_graduation_audit boolean not null default false,
  status text not null
);

create table if not exists academy_academic_standing_rules (
  id text primary key,
  tenant_id text not null references academy_institution_profiles (tenant_id) on delete cascade,
  name text not null,
  standing_type text not null,
  applies_to_institution_mode text not null,
  minimum_gpa numeric,
  minimum_credits_earned numeric,
  minimum_clock_hours numeric,
  required_competencies jsonb not null default '[]'::jsonb,
  required_completion_records jsonb not null default '[]'::jsonb,
  promotion_criteria text,
  graduation_criteria text,
  status text not null
);

create index if not exists academy_evaluation_scales_tenant_type_idx
  on academy_evaluation_scales (tenant_id, scale_type, status);

create index if not exists academy_evaluation_scale_bands_tenant_scale_idx
  on academy_evaluation_scale_bands (tenant_id, scale_id, sequence);

create index if not exists academy_evaluation_rule_sets_tenant_course_idx
  on academy_evaluation_rule_sets (tenant_id, course_id, section_id, status);

create index if not exists academy_evaluation_rule_sets_tenant_record_idx
  on academy_evaluation_rule_sets (tenant_id, record_type, evaluation_type, status);

create index if not exists academy_official_record_rules_tenant_record_idx
  on academy_official_record_rules (tenant_id, record_type, applies_to_institution_mode, status);

create index if not exists academy_academic_standing_rules_tenant_type_idx
  on academy_academic_standing_rules (tenant_id, standing_type, applies_to_institution_mode, status);
