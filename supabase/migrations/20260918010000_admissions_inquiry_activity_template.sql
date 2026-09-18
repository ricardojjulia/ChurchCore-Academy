-- Adds the admissions_inquiry_activity template key, used by the admissions drip-sequence
-- feature (PR #135) to notify admissions staff about inquiry activity. Every other admissions
-- template in academy_communication_messages is worded as a direct, second-person message to
-- the applicant/student ("{{studentName}}, your application..."), which is wrong for this
-- feature's only reachable audience: admissions staff, not the inquiry itself (an Inquiry has
-- no Person record yet, so there is no student/guardian recipient to address). Found via live
-- verification, tracked in src/modules/communications/service.ts's template registry -- this
-- migration keeps the DB check constraint in sync with that TypeScript union, following the
-- same pattern as the award_letter_ready/award_letter_updated addition in
-- 20260623060000_aid_award_letter.sql.

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
    'admissions_inquiry_activity'
  ));
