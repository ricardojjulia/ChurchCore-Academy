create table if not exists academy_admin_users (
  id text primary key,
  tenant_id text not null,
  name text not null,
  title text not null,
  role text not null
);

create table if not exists academy_programs (
  id text primary key,
  tenant_id text not null,
  name text not null,
  credential text not null,
  required_credits integer not null,
  cohort_label text not null
);

create table if not exists academy_students (
  id text primary key,
  tenant_id text not null,
  full_name text not null,
  email text not null,
  enrollment_status text not null,
  application_started_at timestamptz null,
  admitted_at timestamptz null,
  active_term text null,
  program_id text null,
  advisor_user_id text null,
  missing_enrollment_steps jsonb not null default '[]'::jsonb,
  missing_documents jsonb not null default '[]'::jsonb,
  documentation_notes jsonb not null default '[]'::jsonb,
  credits_earned integer not null default 0,
  expected_credits_by_now integer not null default 0,
  transcript_credits integer not null default 0,
  gpa numeric(4,2) null,
  status_flag text not null,
  all_program_courses_completed boolean not null default false,
  graduation_administrative_holds jsonb not null default '[]'::jsonb,
  expected_next_term_registered boolean not null default false,
  transcript_alerts jsonb not null default '[]'::jsonb,
  record_alerts jsonb not null default '[]'::jsonb
);

create table if not exists academy_faculty (
  id text primary key,
  tenant_id text not null,
  name text not null,
  title text not null,
  assigned_section_ids jsonb not null default '[]'::jsonb,
  advisee_count integer not null default 0
);

create table if not exists academy_sections (
  id text primary key,
  tenant_id text not null,
  code text not null,
  title text not null,
  program_id text not null,
  instructor_faculty_id text null,
  roster_count integer not null default 0,
  roster_capacity integer not null default 0,
  setup_alerts jsonb not null default '[]'::jsonb
);

create table if not exists academy_thresholds (
  tenant_id text primary key,
  incomplete_enrollment_days integer not null,
  graduation_credit_threshold numeric(5,2) not null,
  credit_pace_gap integer not null,
  minimum_gpa numeric(4,2) not null,
  faculty_load_threshold integer not null,
  advisor_student_ratio_threshold integer not null
);

create table if not exists ai_signals (
  id text primary key,
  tenant_id text not null,
  product_area text not null default 'academy',
  entity_type text not null,
  entity_id text not null,
  signal_type text not null,
  signal_value numeric not null,
  signal_window text not null,
  signal_payload_json jsonb not null,
  detected_at timestamptz not null
);

create index if not exists ai_signals_tenant_entity_idx
  on ai_signals (tenant_id, entity_type, entity_id);

create table if not exists ai_suggestions (
  id text primary key,
  tenant_id text not null,
  product_area text not null,
  workflow_type text not null,
  workflow_code text not null,
  entity_type text not null,
  entity_id text not null,
  title text not null,
  summary text not null,
  confidence_score integer not null,
  urgency text not null,
  suggested_actions jsonb not null default '[]'::jsonb,
  explanation_json jsonb not null,
  boundary_note text not null,
  message_draft text null,
  status text not null,
  generated_at timestamptz not null
);

create index if not exists ai_suggestions_tenant_entity_idx
  on ai_suggestions (tenant_id, entity_type, entity_id);

create table if not exists workflows (
  id text primary key,
  tenant_id text not null,
  suggestion_id text null references ai_suggestions(id) on delete set null,
  workflow_type text not null,
  workflow_code text not null,
  owner_user_id text not null,
  assigned_to_user_id text null,
  status text not null,
  due_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null
);

create table if not exists workflow_actions (
  id text primary key,
  workflow_id text not null references workflows(id) on delete cascade,
  action_type text not null,
  action_payload_json jsonb not null,
  status text not null,
  created_at timestamptz not null
);

create table if not exists workflow_feedback (
  id text primary key,
  workflow_id text not null references workflows(id) on delete cascade,
  user_id text not null,
  feedback_type text not null,
  notes text null,
  created_at timestamptz not null
);
