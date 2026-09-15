create table if not exists public.academy_student_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete restrict,
  student_person_id text not null,
  account_status text not null default 'active' check (account_status in ('active', 'hold', 'closed')),
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, student_person_id),
  foreign key (tenant_id, student_person_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

create table if not exists public.academy_billing_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete restrict,
  student_person_id text not null,
  entry_type text not null check (entry_type in ('charge', 'credit', 'payment', 'refund', 'void')),
  amount_cents integer not null check (amount_cents <> 0),
  currency text not null default 'USD',
  description text not null,
  source_type text not null check (source_type in ('manual', 'registration', 'payment', 'refund', 'aid')),
  source_id text,
  posted_by_person_id text not null,
  posted_at timestamptz not null default now(),
  idempotency_key text not null,
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, student_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, posted_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

create table if not exists public.academy_payment_intents (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.academy_institution_profiles (tenant_id) on delete restrict,
  student_person_id text not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD',
  provider text not null check (provider in ('manual', 'stripe')),
  status text not null default 'requires_action' check (status in ('requires_action', 'posted', 'voided', 'failed')),
  provider_reference text,
  created_by_person_id text not null,
  created_at timestamptz not null default now(),
  idempotency_key text not null,
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, student_person_id)
    references public.academy_people (tenant_id, id) on delete restrict,
  foreign key (tenant_id, created_by_person_id)
    references public.academy_people (tenant_id, id) on delete restrict
);

create index if not exists academy_billing_ledger_student_idx
  on public.academy_billing_ledger_entries (tenant_id, student_person_id, posted_at desc);

create index if not exists academy_payment_intents_student_idx
  on public.academy_payment_intents (tenant_id, student_person_id, created_at desc);

create or replace function public.academy_touch_student_account_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists academy_student_accounts_touch_updated_at
  on public.academy_student_accounts;

create trigger academy_student_accounts_touch_updated_at
before update on public.academy_student_accounts
for each row execute function public.academy_touch_student_account_updated_at();

create or replace function public.academy_reject_billing_ledger_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Billing ledger entries are immutable.';
end;
$$;

drop trigger if exists academy_billing_ledger_entries_immutable
  on public.academy_billing_ledger_entries;

create trigger academy_billing_ledger_entries_immutable
before update or delete on public.academy_billing_ledger_entries
for each row execute function public.academy_reject_billing_ledger_mutation();

alter table public.academy_student_accounts enable row level security;
alter table public.academy_student_accounts force row level security;
alter table public.academy_billing_ledger_entries enable row level security;
alter table public.academy_billing_ledger_entries force row level security;
alter table public.academy_payment_intents enable row level security;
alter table public.academy_payment_intents force row level security;

revoke all on public.academy_student_accounts from anon;
revoke all on public.academy_billing_ledger_entries from anon;
revoke all on public.academy_payment_intents from anon;

grant select, insert, update on public.academy_student_accounts to authenticated;
grant select, insert on public.academy_billing_ledger_entries to authenticated;
grant select, insert, update on public.academy_payment_intents to authenticated;
revoke update, delete on public.academy_billing_ledger_entries from authenticated;

drop policy if exists academy_student_accounts_read on public.academy_student_accounts;
create policy academy_student_accounts_read
on public.academy_student_accounts
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

drop policy if exists academy_student_accounts_admin_write on public.academy_student_accounts;
create policy academy_student_accounts_admin_write
on public.academy_student_accounts
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

drop policy if exists academy_billing_ledger_entries_read on public.academy_billing_ledger_entries;
create policy academy_billing_ledger_entries_read
on public.academy_billing_ledger_entries
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

drop policy if exists academy_billing_ledger_entries_insert on public.academy_billing_ledger_entries;
create policy academy_billing_ledger_entries_insert
on public.academy_billing_ledger_entries
for insert
with check (
  academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean']
  )
);

drop policy if exists academy_payment_intents_read on public.academy_payment_intents;
create policy academy_payment_intents_read
on public.academy_payment_intents
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

drop policy if exists academy_payment_intents_insert on public.academy_payment_intents;
create policy academy_payment_intents_insert
on public.academy_payment_intents
for insert
with check (
  student_person_id = academy_private.academy_current_person_id()
  or academy_private.academy_has_active_role(
    tenant_id,
    array['institution_admin', 'registrar', 'academic_admin', 'dean']
  )
);
