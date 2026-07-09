-- Student Program Membership: manual assignment of a student's canonical
-- academic program and catalog year.

alter table public.academy_program_enrollments
  alter column source_application_id drop not null,
  add column if not exists catalog_academic_year_id text;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'academy_program_enrollments_catalog_year_fk'
  ) then
    alter table public.academy_program_enrollments
      add constraint academy_program_enrollments_catalog_year_fk
      foreign key (tenant_id, catalog_academic_year_id)
      references public.academy_academic_years (tenant_id, id) on delete restrict;
  end if;
end
$$;

create unique index if not exists academy_program_enrollments_one_active_student_idx
  on public.academy_program_enrollments (tenant_id, student_profile_id)
  where status = 'active';

create index if not exists academy_program_enrollments_student_program_status_idx
  on public.academy_program_enrollments (
    tenant_id, student_profile_id, academic_program_id, status
  );
