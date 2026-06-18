-- Fix: academy_academic_programs.created_by_person_id was declared uuid but
-- academy_people uses a text primary key (e.g. 'person-regina-holt').
-- Alter the column to text to match the people table PK type.
-- No data migration needed: the column was empty before this fix.

alter table public.academy_academic_programs
  alter column created_by_person_id type text using created_by_person_id::text;
