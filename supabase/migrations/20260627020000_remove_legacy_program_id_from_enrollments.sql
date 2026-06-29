-- Migration: Remove legacy program_id from program enrollments.
-- The academic_program_id column is the correct replacement. This
-- legacy column has a NOT NULL constraint that breaks newer seed scripts.

alter table public.academy_program_enrollments
  drop column if exists program_id;