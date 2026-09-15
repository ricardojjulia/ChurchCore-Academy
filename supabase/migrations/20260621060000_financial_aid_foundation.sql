create table if not exists public.academy_aid_packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete restrict,
  student_person_id text not null,
  aid_year text not null,
  status text not null default 'draft' check (status in ('draft', 'offered', 'accepted', 'cancelled')),
  created_by_person_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, student_person_id, aid_year),
  foreign key (tenant_id, student_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, created_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

alter table public.academy_aid_packages
  add constraint academy_aid_packages_tenant_id_id_unique unique (tenant_id, id);

create table if not exists public.academy_aid_awards (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete restrict,
  package_id uuid not null,
  student_person_id text not null,
  award_type text not null check (award_type in ('scholarship', 'grant', 'discount', 'sponsorship')),
  source_type text not null check (source_type in ('institutional', 'denominational', 'mission', 'church')),
  status text not null default 'offered' check (status in ('offered', 'accepted', 'declined', 'cancelled')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD',
  description text not null,
  created_by_person_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, package_id)
    references public.academy_aid_packages (tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, created_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

alter table public.academy_aid_awards
  add constraint academy_aid_awards_tenant_id_id_unique unique (tenant_id, id);

alter table public.academy_billing_ledger_entries
  add constraint academy_billing_ledger_entries_tenant_id_id_unique unique (tenant_id, id);

create table if not exists public.academy_aid_disbursements (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete restrict,
  award_id uuid not null,
  student_person_id text not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'posted', 'cancelled')),
  scheduled_on date not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD',
  ledger_entry_id uuid,
  posted_by_person_id text,
  posted_at timestamptz,
  idempotency_key text not null,
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, award_id)
    references public.academy_aid_awards (tenant_id, id) on delete restrict,
  foreign key (tenant_id, student_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, ledger_entry_id)
    references public.academy_billing_ledger_entries (tenant_id, id) on delete restrict,
  foreign key (tenant_id, posted_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

create table if not exists public.academy_aid_holds (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete restrict,
  student_person_id text not null,
  hold_type text not null check (hold_type in ('documentation', 'sap_review', 'aid_review', 'federal_aid_disabled')),
  status text not null default 'active' check (status in ('active', 'released')),
  reason text not null,
  created_by_person_id text not null,
  created_at timestamptz not null default now(),
  released_by_person_id text,
  released_at timestamptz,
  foreign key (tenant_id, student_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, created_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, released_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

create index if not exists academy_aid_packages_student_idx
  on public.academy_aid_packages (tenant_id, student_person_id, aid_year desc);
create index if not exists academy_aid_awards_package_idx
  on public.academy_aid_awards (tenant_id, package_id);
create index if not exists academy_aid_disbursements_student_idx
  on public.academy_aid_disbursements (tenant_id, student_person_id, scheduled_on desc);
create index if not exists academy_aid_holds_student_idx
  on public.academy_aid_holds (tenant_id, student_person_id)
  where status = 'active';

create or replace function public.academy_touch_financial_aid_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists academy_aid_packages_touch_updated_at on public.academy_aid_packages;
create trigger academy_aid_packages_touch_updated_at
before update on public.academy_aid_packages
for each row execute function public.academy_touch_financial_aid_updated_at();

drop trigger if exists academy_aid_awards_touch_updated_at on public.academy_aid_awards;
create trigger academy_aid_awards_touch_updated_at
before update on public.academy_aid_awards
for each row execute function public.academy_touch_financial_aid_updated_at();

alter table public.academy_aid_packages enable row level security;
alter table public.academy_aid_packages force row level security;
alter table public.academy_aid_awards enable row level security;
alter table public.academy_aid_awards force row level security;
alter table public.academy_aid_disbursements enable row level security;
alter table public.academy_aid_disbursements force row level security;
alter table public.academy_aid_holds enable row level security;
alter table public.academy_aid_holds force row level security;

revoke all on public.academy_aid_packages from anon;
revoke all on public.academy_aid_awards from anon;
revoke all on public.academy_aid_disbursements from anon;
revoke all on public.academy_aid_holds from anon;

grant select, insert, update on public.academy_aid_packages to authenticated;
grant select, insert, update on public.academy_aid_awards to authenticated;
grant select, insert, update on public.academy_aid_disbursements to authenticated;
grant select, insert, update on public.academy_aid_holds to authenticated;

drop policy if exists academy_aid_packages_read on public.academy_aid_packages;
create policy academy_aid_packages_read
on public.academy_aid_packages
for select
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and (
    student_person_id = academy_private.academy_current_person_id()
    or academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'registrar', 'academic_admin', 'dean']
    )
  )
);

drop policy if exists academy_aid_packages_admin_write on public.academy_aid_packages;
create policy academy_aid_packages_admin_write
on public.academy_aid_packages
for all
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean']
  )
)
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean']
  )
);

drop policy if exists academy_aid_awards_read on public.academy_aid_awards;
create policy academy_aid_awards_read
on public.academy_aid_awards
for select
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and (
    student_person_id = academy_private.academy_current_person_id()
    or academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'registrar', 'academic_admin', 'dean']
    )
  )
);

drop policy if exists academy_aid_awards_admin_write on public.academy_aid_awards;
create policy academy_aid_awards_admin_write
on public.academy_aid_awards
for all
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean']
  )
)
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean']
  )
);

drop policy if exists academy_aid_disbursements_read on public.academy_aid_disbursements;
create policy academy_aid_disbursements_read
on public.academy_aid_disbursements
for select
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and (
    student_person_id = academy_private.academy_current_person_id()
    or academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'registrar', 'academic_admin', 'dean']
    )
  )
);

drop policy if exists academy_aid_disbursements_admin_write on public.academy_aid_disbursements;
create policy academy_aid_disbursements_admin_write
on public.academy_aid_disbursements
for all
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean']
  )
)
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean']
  )
);

drop policy if exists academy_aid_holds_read on public.academy_aid_holds;
create policy academy_aid_holds_read
on public.academy_aid_holds
for select
using (
  tenant_id = any(academy_private.academy_current_tenant_ids())
  and (
    student_person_id = academy_private.academy_current_person_id()
    or academy_private.academy_has_active_role(
      tenant_id,
      array['institution_admin', 'registrar', 'academic_admin', 'dean']
    )
  )
);

drop policy if exists academy_aid_holds_admin_write on public.academy_aid_holds;
create policy academy_aid_holds_admin_write
on public.academy_aid_holds
for all
using (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean']
  )
)
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean']
  )
);
