-- Fix: academy_academic_programs.subdivision_id was declared uuid but
-- academy_institution_subdivisions uses a text primary key (e.g. 'branch-bible-school').
-- Alter the column to text so the FK reference and seed data work correctly.
-- No data migration needed: the column was empty before this fix.

alter table public.academy_academic_programs
  alter column subdivision_id type text using subdivision_id::text;

-- Re-add the FK constraint referencing the text PK on academy_institution_subdivisions.
-- Drop the old constraint first (if it was created pointing at a uuid column).
alter table public.academy_academic_programs
  drop constraint if exists academy_academic_programs_subdivision_id_fkey;

alter table public.academy_academic_programs
  add constraint academy_academic_programs_subdivision_id_fkey
  foreign key (subdivision_id)
  references public.academy_institution_subdivisions (id)
  on delete set null;
