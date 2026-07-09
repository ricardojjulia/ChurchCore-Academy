# LMS Sandbox Evidence Ledger Design

## Goal

Persist LMS sandbox validation evidence so `/admin/settings/lms` readiness is driven by tenant data instead of static pending placeholders.

## Scope

This slice records Moodle and Canvas sandbox evidence references. It does not store provider secrets, call Moodle or Canvas, enqueue live sync jobs, or mark production activation approved. It only gives institution administrators an auditable place to record validation evidence and lets the readiness model consume it.

## Data Model

Add `academy_lms_sandbox_evidence` with tenant-scoped RLS. Each row records provider, evidence label, status, reference, notes, recorder, and timestamps. The write path is append/update by `(tenant_id, provider_id, evidence_label)` so the readiness UI shows the latest evidence per required provider item without losing audit timestamps.

## API And UI

Extend `POST /api/academy/lms/readiness` with `action: "record_sandbox_evidence"`. Only same-tenant institution administrators may write evidence. Existing read roles may still view readiness.

Extend `/admin/settings/lms` with a compact evidence form per provider. The form captures status, reference, and notes, then refreshes the page after a successful save. The displayed readiness cards use persisted evidence when present.

## Safety

Evidence references are treated as operational metadata, not provider credentials. Validation rejects secret-shaped text such as tokens, passwords, client secrets, and raw provider payloads. RLS uses the existing `app.academy_tenant_id` session setting.

## Verification

Focused tests cover migration shape, repository mapping, API authorization, secret rejection, readiness model integration, and page source wiring. Final verification uses the repo gate plus browser smoke on `/admin/settings/lms`.
