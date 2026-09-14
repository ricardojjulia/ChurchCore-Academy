-- Make FK delete behavior explicit (document implicit NO ACTION as explicit RESTRICT)
-- This migration changes no runtime behavior — it makes the FK constraint's on-delete policy
-- self-documenting rather than relying on Postgres's implicit default.

-- Drop existing FK constraints (Postgres auto-generated names)
alter table public.ministry_formation_advisor_assignments
  drop constraint ministry_formation_advisor_assignments_tenant_id_student_person_id_fkey;

alter table public.ministry_formation_advisor_assignments
  drop constraint ministry_formation_advisor_assignments_tenant_id_advisor_person_id_fkey;

alter table public.ministry_formation_advisor_assignments
  drop constraint ministry_formation_advisor_assignments_tenant_id_assigned_by_person_id_fkey;

-- Recreate with explicit on delete restrict
alter table public.ministry_formation_advisor_assignments
  add constraint ministry_formation_advisor_assignments_tenant_id_student_person_id_fkey
  foreign key (tenant_id, student_person_id)
  references public.academy_people (tenant_id, id)
  on delete restrict;

alter table public.ministry_formation_advisor_assignments
  add constraint ministry_formation_advisor_assignments_tenant_id_advisor_person_id_fkey
  foreign key (tenant_id, advisor_person_id)
  references public.academy_people (tenant_id, id)
  on delete restrict;

alter table public.ministry_formation_advisor_assignments
  add constraint ministry_formation_advisor_assignments_tenant_id_assigned_by_person_id_fkey
  foreign key (tenant_id, assigned_by_person_id)
  references public.academy_people (tenant_id, id)
  on delete restrict;
