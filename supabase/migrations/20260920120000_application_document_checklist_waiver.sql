-- ADR-0072: Add waiver support to the application document checklist.
-- The checklist (academy_application_document_items, from
-- 20260623040000_application_document_checklist.sql) is the canonical
-- per-program document tracking system. This migration adds the one
-- capability it was missing relative to the superseded ADR-0048 design:
-- an auditable staff waiver with a mandatory note.

alter table public.academy_application_document_items
  drop constraint academy_application_document_items_status_check;

alter table public.academy_application_document_items
  add constraint academy_application_document_items_status_check
  check (status in ('pending', 'uploaded', 'reviewed', 'resubmission_required', 'waived'));

alter table public.academy_application_document_items
  add column waived_by_person_id text,
  add column waived_at timestamptz,
  add column waiver_note text;
