-- Migration: Make academic period relationships mandatory for billing and payment intents
-- Also updates trigger checking to support text period IDs.

-- 1. Fix check_academic_period_is_not_completed to support TEXT period IDs and new tables
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
    FROM academy_course_sections cs
    WHERE cs.id = NEW.course_section_id;
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

-- 2. Add columns to academy_billing_ledger_entries
ALTER TABLE public.academy_billing_ledger_entries ADD COLUMN IF NOT EXISTS academic_period_id TEXT;

-- Seed period assignments dynamically for existing entries based on posted_at date
UPDATE public.academy_billing_ledger_entries le
SET academic_period_id = (
  SELECT id FROM public.academy_academic_periods p
  WHERE p.tenant_id = le.tenant_id
    AND le.posted_at::date >= p.starts_on
    AND le.posted_at::date <= p.ends_on
  ORDER BY p.starts_on ASC
  LIMIT 1
)
WHERE academic_period_id IS NULL;

-- Fallback to the first active period of the tenant if none matched the date
UPDATE public.academy_billing_ledger_entries le
SET academic_period_id = (
  SELECT id FROM public.academy_academic_periods p
  WHERE p.tenant_id = le.tenant_id
    AND p.status = 'active'
  LIMIT 1
)
WHERE academic_period_id IS NULL;

-- Set column to NOT NULL and add foreign key constraint
ALTER TABLE public.academy_billing_ledger_entries ALTER COLUMN academic_period_id SET NOT NULL;
ALTER TABLE public.academy_billing_ledger_entries
  ADD CONSTRAINT fk_academy_billing_ledger_entries_period
  FOREIGN KEY (academic_period_id)
  REFERENCES public.academy_academic_periods (id) ON DELETE RESTRICT;

-- 3. Add columns to academy_payment_intents
ALTER TABLE public.academy_payment_intents ADD COLUMN IF NOT EXISTS academic_period_id TEXT;

-- Seed period assignments dynamically for existing payment intents
UPDATE public.academy_payment_intents pi
SET academic_period_id = (
  SELECT id FROM public.academy_academic_periods p
  WHERE p.tenant_id = pi.tenant_id
    AND pi.created_at::date >= p.starts_on
    AND pi.created_at::date <= p.ends_on
  ORDER BY p.starts_on ASC
  LIMIT 1
)
WHERE academic_period_id IS NULL;

UPDATE public.academy_payment_intents pi
SET academic_period_id = (
  SELECT id FROM public.academy_academic_periods p
  WHERE p.tenant_id = pi.tenant_id
    AND p.status = 'active'
  LIMIT 1
)
WHERE academic_period_id IS NULL;

ALTER TABLE public.academy_payment_intents ALTER COLUMN academic_period_id SET NOT NULL;
ALTER TABLE public.academy_payment_intents
  ADD CONSTRAINT fk_academy_payment_intents_period
  FOREIGN KEY (academic_period_id)
  REFERENCES public.academy_academic_periods (id) ON DELETE RESTRICT;

-- 4. Add active_period_id reference to academy_student_profiles
ALTER TABLE public.academy_student_profiles ADD COLUMN IF NOT EXISTS active_period_id TEXT;
ALTER TABLE public.academy_student_profiles
  ADD CONSTRAINT fk_academy_student_profiles_active_period
  FOREIGN KEY (active_period_id)
  REFERENCES public.academy_academic_periods (id) ON DELETE SET NULL;

-- Populate active_period_id for existing students using registrations subquery
UPDATE public.academy_student_profiles sp
SET active_period_id = (
  SELECT pr.academic_period_id
  FROM public.academy_period_registrations pr
  WHERE pr.tenant_id = sp.tenant_id
    AND pr.student_profile_id = sp.id
    AND pr.status = 'registered'
  ORDER BY pr.registered_at DESC
  LIMIT 1
);

-- 5. Add foreign key to academy_tuition_schedules term_id referencing academy_academic_periods
ALTER TABLE public.academy_tuition_schedules
  ADD CONSTRAINT fk_academy_tuition_schedules_period
  FOREIGN KEY (term_id)
  REFERENCES public.academy_academic_periods (id) ON DELETE RESTRICT;

-- 6. Attach triggers to enforce closure lockdown policy
CREATE TRIGGER enforce_term_lock_on_billing_ledgers
BEFORE INSERT OR UPDATE ON public.academy_billing_ledger_entries
FOR EACH ROW EXECUTE FUNCTION check_academic_period_is_not_completed();

CREATE TRIGGER enforce_term_lock_on_payment_intents
BEFORE INSERT OR UPDATE ON public.academy_payment_intents
FOR EACH ROW EXECUTE FUNCTION check_academic_period_is_not_completed();

-- 7. Rename active_term to active_period_id in academy_students
ALTER TABLE public.academy_students RENAME COLUMN active_term TO active_period_id;

