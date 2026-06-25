-- Denomination membership tracking
create table if not exists public.academy_denomination_memberships (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete cascade,
  person_id text not null references public.academy_people(id) on delete cascade,
  denomination_name text not null,
  local_church_name text,
  membership_number text,
  membership_status text not null check (membership_status in ('active','inactive','transferred','unknown')),
  membership_date date,
  transfer_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_denomination_memberships_tenant_person_idx
  on public.academy_denomination_memberships (tenant_id, person_id);

create index if not exists academy_denomination_memberships_tenant_denomination_idx
  on public.academy_denomination_memberships (tenant_id, denomination_name);

alter table public.academy_denomination_memberships enable row level security;
alter table public.academy_denomination_memberships force row level security;

create policy "tenant_isolation_denomination_memberships" on public.academy_denomination_memberships
  using (tenant_id = current_setting('app.academy_tenant_id', true));

-- Ordination record tracking
create table if not exists public.academy_ordination_records (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references public.academy_institution_profiles(tenant_id) on delete cascade,
  person_id text not null references public.academy_people(id) on delete cascade,
  ordination_type text not null check (ordination_type in ('deacon','elder','minister','bishop','pastor','evangelist','other')),
  ordaining_body text not null,
  ordination_date date not null,
  ordination_status text not null check (ordination_status in ('active','revoked','retired','suspended')),
  credentials_number text,
  renewal_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_ordination_records_tenant_person_idx
  on public.academy_ordination_records (tenant_id, person_id);

alter table public.academy_ordination_records enable row level security;
alter table public.academy_ordination_records force row level security;

create policy "tenant_isolation_ordination_records" on public.academy_ordination_records
  using (tenant_id = current_setting('app.academy_tenant_id', true));
