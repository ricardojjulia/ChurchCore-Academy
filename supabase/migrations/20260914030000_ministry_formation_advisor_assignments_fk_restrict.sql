-- Make FK delete behavior explicit (document implicit NO ACTION as explicit RESTRICT)
-- This migration changes no runtime behavior — it makes the FK constraint's on-delete policy
-- self-documenting rather than relying on Postgres's implicit default.

-- Drop existing FK constraints (Postgres auto-generated names, truncated to 63 bytes)
alter table public.ministry_formation_advisor_assignments
  drop constraint ministry_formation_advisor_ass_tenant_id_student_person_id_fkey;

alter table public.ministry_formation_advisor_assignments
  drop constraint ministry_formation_advisor_ass_tenant_id_advisor_person_id_fkey;

alter table public.ministry_formation_advisor_assignments
  drop constraint ministry_formation_advisor_as_tenant_id_assigned_by_person_fkey;

-- Recreate with explicit on delete restrict (using shorter names to avoid truncation)
alter table public.ministry_formation_advisor_assignments
  add constraint mf_advisor_assign_student_fkey
  foreign key (tenant_id, student_person_id)
  references public.academy_people (tenant_id, id)
  on delete restrict;

alter table public.ministry_formation_advisor_assignments
  add constraint mf_advisor_assign_advisor_fkey
  foreign key (tenant_id, advisor_person_id)
  references public.academy_people (tenant_id, id)
  on delete restrict;

alter table public.ministry_formation_advisor_assignments
  add constraint mf_advisor_assign_assigned_by_fkey
  foreign key (tenant_id, assigned_by_person_id)
  references public.academy_people (tenant_id, id)
  on delete restrict;
