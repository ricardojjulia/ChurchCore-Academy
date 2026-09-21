-- Follow-up to 20260920120000_application_document_checklist_waiver.sql.
-- That migration allowed status = 'waived' but did not require the audit fields
-- that make a waiver valid — waived_by_person_id, waived_at, and waiver_note could
-- all remain null, or waiver_note could be blank. The service layer enforces this
-- for the one code path that exists today, but nothing stopped another writer from
-- creating an invalid waiver record directly. Enforce it at the database level.

alter table public.academy_application_document_items
  add constraint academy_application_document_items_waiver_requires_audit
  check (
    status <> 'waived'
    or (
      waived_by_person_id is not null
      and waived_at is not null
      and waiver_note is not null
      and length(trim(waiver_note)) > 0
    )
  );
