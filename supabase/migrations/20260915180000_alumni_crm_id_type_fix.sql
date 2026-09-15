-- Fixes a real schema bug in the alumni CRM tables, found via live browser testing: every
-- id/tenant_id/person_id column in academy_alumni_records and academy_giving_records was
-- declared `uuid`, but every tenant_id and person_id in this application is a plain text
-- value (e.g. 'cca-main', 'person-lena-rivera') — the established convention throughout this
-- schema (see academy_people, academy_denomination_memberships, academy_covenant_records).
-- Any query comparing these columns against a real tenant_id/person_id failed outright with
-- "operator does not exist: text = uuid", and the RLS policies' `::uuid` cast on
-- current_setting('app.academy_tenant_id', true) (itself a text GUC) would fail the same way.
-- Both tables were empty (never successfully written to, for the same reason), so this is a
-- pure schema correction with no data to migrate.
--
-- Per CLAUDE.md, migrations are append-only — 20260624090000_alumni_crm.sql is not edited.

-- Policies must be dropped before altering the column types they reference.
drop policy if exists alumni_records_tenant_isolation on academy_alumni_records;
drop policy if exists giving_records_tenant_isolation on academy_giving_records;

alter table academy_alumni_records drop constraint if exists academy_alumni_records_tenant_id_person_id_key;

alter table academy_alumni_records
  alter column id type text using id::text,
  alter column id drop default,
  alter column id set default gen_random_uuid()::text,
  alter column tenant_id type text using tenant_id::text,
  alter column person_id type text using person_id::text,
  alter column program_id type text using program_id::text;

alter table academy_alumni_records
  add constraint academy_alumni_records_tenant_id_fkey
    foreign key (tenant_id) references academy_institution_profiles(tenant_id) on delete cascade,
  add constraint academy_alumni_records_person_id_fkey
    foreign key (person_id) references academy_people(id) on delete cascade,
  add constraint academy_alumni_records_tenant_id_person_id_key
    unique (tenant_id, person_id);

alter table academy_giving_records
  alter column id type text using id::text,
  alter column id drop default,
  alter column id set default gen_random_uuid()::text,
  alter column tenant_id type text using tenant_id::text,
  alter column alumni_person_id type text using alumni_person_id::text;

-- alumni_person_id intentionally references academy_people directly, not
-- academy_alumni_records — the approved story allows recording a gift from a donor who
-- doesn't (yet, or ever) have an alumni record of their own.
alter table academy_giving_records
  add constraint academy_giving_records_tenant_id_fkey
    foreign key (tenant_id) references academy_institution_profiles(tenant_id) on delete cascade,
  add constraint academy_giving_records_alumni_person_id_fkey
    foreign key (alumni_person_id) references academy_people(id) on delete cascade;

create policy alumni_records_tenant_isolation
  on academy_alumni_records
  using (tenant_id = current_setting('app.academy_tenant_id', true));

create policy giving_records_tenant_isolation
  on academy_giving_records
  using (tenant_id = current_setting('app.academy_tenant_id', true));
