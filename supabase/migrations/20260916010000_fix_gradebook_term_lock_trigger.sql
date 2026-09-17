-- Fix check_academic_period_is_not_completed() for academy_gradebook_records.
--
-- The function's academy_gradebook_records branch has read `WHERE cs.id =
-- NEW.course_section_id` since it was first written (20260626180000_add_term_lock_triggers.sql)
-- and was carried forward unchanged by 20260627000000_make_period_relations_mandatory.sql (which
-- only fixed the period_id UUID -> TEXT type mismatch, for all branches, but didn't touch this
-- branch's join). academy_gradebook_records has never had a course_section_id column — it
-- resolves to a section only indirectly, via assignment_id -> academy_gradebook_assignments.section_id.
-- Every INSERT/UPDATE on academy_gradebook_records has failed outright since the first of those
-- two migrations, with "record "new" has no field "course_section_id"" — meaning every writer of
-- this table (submitGradeAction(), and the older POST /api/academy/gradebook/records ->
-- GradebookPostgresRepository.gradeSubmission path) has never successfully run. Found via the
-- daily checkup's full 11-step walkthrough while wiring a UI to submitGradeAction for the first
-- time.
--
-- Migrations are append-only (CLAUDE.md) — this replaces the function via CREATE OR REPLACE
-- rather than editing either original migration file. Every other branch (registrations,
-- billing ledger entries, payment intents) and the TEXT-typed period_id from the 20260627
-- migration are carried forward unchanged.
--
-- assignment.section_id is nullable (module-based assignments may have no section); if it's
-- NULL, period_id resolves to NULL, and the function's existing "IF period_id IS NOT NULL"
-- guard already skips the completed-period check in that case — same fail-open behavior as
-- every other unresolvable case this function already has.
CREATE OR REPLACE FUNCTION check_academic_period_is_not_completed()
RETURNS TRIGGER AS $$
DECLARE
  period_status TEXT;
  period_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'academy_course_section_registrations' THEN
    SELECT cs.academic_period_id INTO period_id
    FROM academy_course_sections cs
    WHERE cs.id = NEW.course_section_id;
  ELSIF TG_TABLE_NAME = 'academy_gradebook_records' THEN
    SELECT cs.academic_period_id INTO period_id
    FROM academy_gradebook_assignments ga
    JOIN academy_course_sections cs
      ON cs.id = ga.section_id AND cs.tenant_id = ga.tenant_id
    WHERE ga.id = NEW.assignment_id AND ga.tenant_id = NEW.tenant_id;
  ELSIF TG_TABLE_NAME = 'academy_billing_ledger_entries' THEN
    period_id := NEW.academic_period_id;
  ELSIF TG_TABLE_NAME = 'academy_payment_intents' THEN
    period_id := NEW.academic_period_id;
  ELSE
    RAISE EXCEPTION 'Unsupported table for term-lock trigger: %', TG_TABLE_NAME;
  END IF;

  IF period_id IS NOT NULL THEN
    SELECT status INTO period_status
    FROM academy_academic_periods
    WHERE id = period_id;

    IF period_status = 'completed' THEN
      RAISE EXCEPTION 'Cannot modify records in a completed academic period (ID: %)', period_id
        USING ERRCODE = 'read_only_sql_transaction';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
