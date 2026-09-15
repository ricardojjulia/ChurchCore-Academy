-- Guardian FERPA restriction — T3-03
-- Adds ferpa_restricted flag to student relationships to allow granular access control
-- for guardian portal access to student records per FERPA compliance requirements.

alter table public.academy_student_relationships
  add column if not exists ferpa_restricted boolean not null default false;

comment on column public.academy_student_relationships.ferpa_restricted is
  'When true, the related person cannot access student records via guardian portal. Set by admin/registrar for FERPA compliance.';
