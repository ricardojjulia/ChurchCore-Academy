-- Fix uuid/text type mismatch in academy_attendance_records
-- See ADR-0032: all person/section FK columns must be text to match the rest of the schema.
-- Tables are empty (unseeded due to this mismatch), so USING cast operates on zero rows.

alter table public.academy_attendance_records
  alter column course_section_id     type text using course_section_id::text,
  alter column student_person_id     type text using student_person_id::text,
  alter column recorded_by_person_id type text using recorded_by_person_id::text;
