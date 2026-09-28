-- Adds a manual bulk email template key for the P1 ad-hoc bulk email workflow.
-- The workflow still queues through academy_communication_messages and the existing
-- provider boundary; it does not add SMS or a parallel delivery path.

alter table public.academy_communication_messages
  drop constraint if exists academy_communication_messages_template_key_check;

alter table public.academy_communication_messages
  add constraint academy_communication_messages_template_key_check
  check (template_key in (
    'admissions_decision',
    'registration_confirmation',
    'transcript_update',
    'billing_account_update',
    'grade_release',
    'attendance_concern',
    'workflow_assignment',
    'application_received',
    'award_letter_ready',
    'award_letter_updated',
    'admissions_inquiry_activity',
    'manual_bulk_email'
  ));
