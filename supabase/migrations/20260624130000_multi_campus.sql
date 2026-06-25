-- Multi-campus / satellite-site support
-- T4-07

create table if not exists academy_campuses (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  code        text not null,
  name        text not null,
  address     text,
  city        text,
  state       text,
  country     text not null default 'US',
  is_primary  boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, code)
);

create index if not exists idx_campuses_tenant
  on academy_campuses (tenant_id);

-- Optional campus associations on existing tables
-- Using nullable campus_id so existing records are not affected
alter table academy_sections
  add column if not exists campus_id uuid references academy_campuses(id);

alter table academy_staff_members
  add column if not exists campus_id uuid references academy_campuses(id);

alter table academy_students
  add column if not exists primary_campus_id uuid references academy_campuses(id);

create index if not exists idx_sections_campus
  on academy_sections (campus_id)
  where campus_id is not null;

create index if not exists idx_staff_campus
  on academy_staff_members (campus_id)
  where campus_id is not null;

create index if not exists idx_students_campus
  on academy_students (primary_campus_id)
  where primary_campus_id is not null;

alter table academy_campuses enable row level security;
alter table academy_campuses force row level security;

create policy campuses_tenant_isolation
  on academy_campuses
  using (tenant_id = current_setting('app.academy_tenant_id', true)::uuid);
