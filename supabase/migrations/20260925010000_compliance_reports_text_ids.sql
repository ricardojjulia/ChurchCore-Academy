-- academy_compliance_reports was created (20260624080000) with uuid tenant_id and
-- generated_by_person_id, but Academy tenant and person ids are text (e.g. 'cca-main',
-- 'person-regina-holt'). Every read and write failed with "invalid input syntax for type uuid",
-- so the table can hold no rows. Convert both columns to text, recreate the tenant-isolation
-- policy with a text comparison, and add the tenant/person foreign keys the rest of the schema
-- uses. See GitHub issue #179.

drop policy if exists compliance_reports_tenant_isolation on public.academy_compliance_reports;

alter table public.academy_compliance_reports
  alter column tenant_id type text using tenant_id::text,
  alter column generated_by_person_id type text using generated_by_person_id::text;

alter table public.academy_compliance_reports
  add constraint academy_compliance_reports_tenant_fk
    foreign key (tenant_id) references public.academy_institution_profiles (tenant_id) on delete cascade,
  add constraint academy_compliance_reports_generated_by_fk
    foreign key (tenant_id, generated_by_person_id) references public.academy_people (tenant_id, id);

create policy compliance_reports_tenant_isolation
  on public.academy_compliance_reports
  using (tenant_id = current_setting('app.academy_tenant_id', true))
  with check (tenant_id = current_setting('app.academy_tenant_id', true));
