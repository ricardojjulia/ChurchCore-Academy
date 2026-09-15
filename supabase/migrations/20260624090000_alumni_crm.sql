-- Alumni CRM and giving module
-- T4-03

create table if not exists academy_alumni_records (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null,
  person_id             uuid not null,
  graduation_year       integer not null,
  degree_earned         text not null,
  program_id            uuid,
  employer              text,
  job_title             text,
  location              text,
  contact_preferences   jsonb not null default '{}',
  status                text not null default 'active' check (
    status in ('active', 'lost_contact', 'deceased')
  ),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (tenant_id, person_id)
);

create index if not exists idx_alumni_records_tenant
  on academy_alumni_records (tenant_id);
create index if not exists idx_alumni_records_graduation_year
  on academy_alumni_records (tenant_id, graduation_year);

create table if not exists academy_giving_records (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null,
  alumni_person_id         uuid not null,
  gift_amount_cents        integer not null check (gift_amount_cents > 0),
  gift_date                date not null,
  gift_type                text not null default 'one_time' check (
    gift_type in ('one_time', 'recurring', 'pledge')
  ),
  fund_designation         text,
  acknowledgment_sent_at   timestamptz,
  notes                    text,
  created_at               timestamptz not null default now()
);

create index if not exists idx_giving_records_tenant
  on academy_giving_records (tenant_id);
create index if not exists idx_giving_records_alumni
  on academy_giving_records (tenant_id, alumni_person_id);

alter table academy_alumni_records enable row level security;
alter table academy_alumni_records force row level security;
alter table academy_giving_records enable row level security;
alter table academy_giving_records force row level security;

create policy alumni_records_tenant_isolation
  on academy_alumni_records
  using (tenant_id = current_setting('app.academy_tenant_id', true)::uuid);

create policy giving_records_tenant_isolation
  on academy_giving_records
  using (tenant_id = current_setting('app.academy_tenant_id', true)::uuid);
