-- ChurchCore Academy - Covenant Record Migration
-- ADR-0063: Covenant Record Spiritual Profile Model
-- Date: 2026-07-01

create table if not exists academy_covenant_records (
  id text primary key,
  tenant_id text not null references academy_institution_profiles(tenant_id) on delete cascade,
  person_id text not null references academy_people(id) on delete cascade,
  covenant_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists academy_covenant_records_tenant_person_idx
  on academy_covenant_records (tenant_id, person_id);

-- Enable RLS
alter table academy_covenant_records enable row level security;
alter table academy_covenant_records force row level security;
