-- academy_attendance_consecutive_tracking was created (20260625012000) with uuid columns for
-- course_section_id and student_person_id, but Academy section and person ids are text (for
-- example "demo-multi-section-algebra", "person-lena-rivera"). Every insert or update therefore
-- failed with "invalid input syntax for type uuid", so the table never held a row, and that
-- failure aborted the attendance transaction it ran in (found 2026-10-08).
--
-- Change both columns to text, matching academy_course_sections.id and academy_people.id.
-- uuid -> text is lossless for any existing value; the unique constraint and indexes are kept and
-- rebuilt by the type change. There are no foreign keys on these columns.

alter table public.academy_attendance_consecutive_tracking
  alter column course_section_id type text using course_section_id::text,
  alter column student_person_id type text using student_person_id::text;
