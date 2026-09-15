-- Migration: Add database-level triggers to enforce term-lock policy.
-- This provides a defense-in-depth measure as recommended in ADR-0050.

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION check_academic_period_is_not_completed()
RETURNS TRIGGER AS $$
DECLARE
  period_status TEXT;
  period_id UUID;
BEGIN
  -- Determine the academic_period_id from the table being modified.
  -- This needs to be adapted for each table's specific schema.
  IF TG_TABLE_NAME = 'academy_course_section_registrations' THEN
    SELECT cs.academic_period_id INTO period_id
    FROM academy_course_sections cs
    WHERE cs.id = NEW.course_section_id;
  ELSIF TG_TABLE_NAME = 'academy_gradebook_records' THEN
    SELECT cs.academic_period_id INTO period_id
    FROM academy_course_sections cs
    WHERE cs.id = NEW.course_section_id;
  ELSE
    -- This function is intended for specific tables.
    -- Raise an error if used on an unexpected table.
    RAISE EXCEPTION 'Unsupported table for term-lock trigger: %', TG_TABLE_NAME;
  END IF;

  -- Fetch the status of the academic period
  SELECT status INTO period_status
  FROM academy_academic_periods
  WHERE id = period_id;

  -- If the period is completed, prevent the operation
  IF period_status = 'completed' THEN
    RAISE EXCEPTION 'Cannot modify records in a completed academic period (ID: %)', period_id
      USING ERRCODE = 'read_only_sql_transaction'; -- Using a standard error code
  END IF;

  -- If the period is not completed, allow the operation
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Apply the trigger to relevant tables
CREATE TRIGGER enforce_term_lock_on_registrations
BEFORE INSERT OR UPDATE ON academy_course_section_registrations
FOR EACH ROW EXECUTE FUNCTION check_academic_period_is_not_completed();

CREATE TRIGGER enforce_term_lock_on_gradebook
BEFORE INSERT OR UPDATE ON academy_gradebook_records
FOR EACH ROW EXECUTE FUNCTION check_academic_period_is_not_completed();