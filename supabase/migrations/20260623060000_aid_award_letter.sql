alter table public.academy_aid_packages
  add column if not exists accepted_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists decision_by_person_id text,
  add column if not exists acceptance_deadline timestamptz,
  add column if not exists award_letter_storage_path text,
  add column if not exists letter_status text default 'not_generated'
    check (letter_status in ('not_generated', 'generated', 'sent'));

-- add award_letter_ready template to communications constraint
alter table public.academy_communications
  drop constraint if exists academy_communications_template_key_check;

alter table public.academy_communications
  add constraint academy_communications_template_key_check
  check (template_key in (
    'admissions_decision',
    'registration_confirmation',
    'transcript_update',
    'billing_account_update',
    'grade_release',
    'attendance_concern',
    'workflow_assignment',
    'application_received',
    'award_letter_ready'
  ));
