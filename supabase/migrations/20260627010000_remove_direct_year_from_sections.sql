-- Migration: Remove direct academic_year_id column from course sections.
-- Course sections are child objects of AcademicPeriod, which already has an academic_year_id relation.
-- This enforces the temporal hierarchy by resolving the Academic Year transitively.

ALTER TABLE public.academy_course_sections DROP COLUMN IF EXISTS academic_year_id;
