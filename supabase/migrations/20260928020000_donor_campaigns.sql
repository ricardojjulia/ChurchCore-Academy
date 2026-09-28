-- P1 donor campaign management for Alumni & Giving.
-- Campaigns are tenant scoped, auditable, and linked to giving records without
-- replacing the existing free-text fund designation workflow.

create table if not exists academy_donor_campaigns (
  id                    text primary key default gen_random_uuid()::text,
  tenant_id             text not null,
  name                  text not null,
  fund_designation      text not null,
  goal_amount_cents     integer not null check (goal_amount_cents > 0),
  starts_on             date,
  ends_on               date,
  status                text not null default 'planned' check (
    status in ('planned', 'active', 'paused', 'completed')
  ),
  description           text,
  created_by_person_id  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint academy_donor_campaigns_date_order_check
    check (starts_on is null or ends_on is null or ends_on >= starts_on),
  constraint academy_donor_campaigns_tenant_id_fkey
    foreign key (tenant_id) references academy_institution_profiles(tenant_id) on delete cascade,
  constraint academy_donor_campaigns_created_by_fkey
    foreign key (tenant_id, created_by_person_id) references academy_people(tenant_id, id),
  constraint academy_donor_campaigns_tenant_id_id_key
    unique (tenant_id, id),
  constraint academy_donor_campaigns_tenant_fund_designation_key
    unique (tenant_id, fund_designation)
);

create index if not exists idx_donor_campaigns_tenant_status
  on academy_donor_campaigns (tenant_id, status);

alter table academy_donor_campaigns enable row level security;
alter table academy_donor_campaigns force row level security;

create policy donor_campaigns_tenant_isolation
  on academy_donor_campaigns
  using (tenant_id = current_setting('app.academy_tenant_id', true));

alter table academy_giving_records
  add column if not exists donor_campaign_id text;

alter table academy_giving_records
  add constraint academy_giving_records_tenant_campaign_fkey
    foreign key (tenant_id, donor_campaign_id)
    references academy_donor_campaigns(tenant_id, id);

create index if not exists idx_giving_records_campaign
  on academy_giving_records (tenant_id, donor_campaign_id);
