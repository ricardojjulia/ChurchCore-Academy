create table if not exists academy_people (
  id text primary key,
  tenant_id text not null references academy_institution_profiles(tenant_id) on delete cascade,
  display_name text not null,
  given_name text,
  family_name text,
  preferred_name text,
  email text,
  phone text,
  date_of_birth date,
  person_status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists academy_people_tenant_email_idx
  on academy_people (tenant_id, lower(email))
  where email is not null;

create index if not exists academy_people_tenant_status_idx
  on academy_people (tenant_id, person_status, display_name);

create table if not exists academy_person_role_assignments (
  id text primary key,
  tenant_id text not null references academy_institution_profiles(tenant_id) on delete cascade,
  person_id text not null references academy_people(id) on delete cascade,
  role text not null,
  scope_type text not null,
  scope_id text,
  status text not null,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_role_assignments_tenant_person_idx
  on academy_person_role_assignments (tenant_id, person_id, role, status);

create index if not exists academy_role_assignments_tenant_scope_idx
  on academy_person_role_assignments (tenant_id, scope_type, scope_id, role, status);

create table if not exists academy_student_profiles (
  id text primary key,
  tenant_id text not null references academy_institution_profiles(tenant_id) on delete cascade,
  person_id text not null references academy_people(id) on delete cascade,
  student_number text not null,
  student_type text not null,
  enrollment_status text not null,
  primary_subdivision_id text,
  grade_band_subdivision_id text,
  program_id text,
  advisor_person_id text references academy_people(id) on delete set null,
  guardian_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists academy_student_profiles_tenant_number_idx
  on academy_student_profiles (tenant_id, student_number);

create index if not exists academy_student_profiles_tenant_person_idx
  on academy_student_profiles (tenant_id, person_id, enrollment_status);

create table if not exists academy_staff_profiles (
  id text primary key,
  tenant_id text not null references academy_institution_profiles(tenant_id) on delete cascade,
  person_id text not null references academy_people(id) on delete cascade,
  staff_number text not null,
  title text not null,
  primary_role text not null,
  primary_subdivision_id text,
  employment_status text not null,
  load_policy text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists academy_staff_profiles_tenant_number_idx
  on academy_staff_profiles (tenant_id, staff_number);

create index if not exists academy_staff_profiles_tenant_person_idx
  on academy_staff_profiles (tenant_id, person_id, employment_status);

create table if not exists academy_student_relationships (
  id text primary key,
  tenant_id text not null references academy_institution_profiles(tenant_id) on delete cascade,
  student_person_id text not null references academy_people(id) on delete cascade,
  related_person_id text not null references academy_people(id) on delete cascade,
  relationship_type text not null,
  authority text not null,
  visibility text not null,
  status text not null,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_student_relationships_tenant_student_idx
  on academy_student_relationships (tenant_id, student_person_id, relationship_type, status);

create index if not exists academy_student_relationships_tenant_related_idx
  on academy_student_relationships (tenant_id, related_person_id, relationship_type, status);

create table if not exists academy_account_links (
  id text primary key,
  tenant_id text not null references academy_institution_profiles(tenant_id) on delete cascade,
  person_id text not null references academy_people(id) on delete cascade,
  provider text not null,
  external_subject text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists academy_account_links_tenant_provider_subject_idx
  on academy_account_links (tenant_id, provider, external_subject);

create index if not exists academy_account_links_tenant_person_idx
  on academy_account_links (tenant_id, person_id, provider, status);
