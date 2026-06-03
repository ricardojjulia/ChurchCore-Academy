create table if not exists academy_institution_profiles (
  tenant_id text primary key,
  institution_name text not null,
  legal_name text not null,
  primary_mode text not null,
  supported_modes jsonb not null default '[]'::jsonb,
  operating_rules jsonb not null,
  capabilities jsonb not null,
  lms_preference jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists academy_institution_profiles_updated_at_idx
  on academy_institution_profiles (updated_at desc);
