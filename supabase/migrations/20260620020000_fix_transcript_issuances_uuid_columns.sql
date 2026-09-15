-- Fix uuid/text type mismatch in academy_transcript_issuances
-- See ADR-0032: all person FK columns must be text to match the rest of the schema.
-- Tables are empty (unseeded due to this mismatch), so USING cast operates on zero rows.

alter table public.academy_transcript_issuances
  alter column student_person_id     type text using student_person_id::text,
  alter column issued_by_person_id   type text using issued_by_person_id::text,
  alter column revoked_by_person_id  type text using revoked_by_person_id::text;
