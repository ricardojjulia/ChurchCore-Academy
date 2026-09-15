# LMS Sandbox Execution Evidence Design

## Goal

Run provider-neutral Moodle and Canvas sandbox readiness checks, persist structured results, and surface those results on `/admin/settings/lms` without enabling production LMS synchronization.

## Scope

This slice adds a deterministic sandbox check runner and evidence result ledger. It records whether an operator-facing sandbox check passed, failed, or was skipped, plus a safe summary and reference. It does not call live Moodle or Canvas APIs, store provider credentials, enqueue production roster sync, or approve production activation.

## Data Model

Add `academy_lms_sandbox_check_results` with tenant-scoped RLS. Each row records provider, check key, status, safe summary, reference, duration, runner person, and timestamps. Rows upsert by `(tenant_id, provider_id, check_key)` so the readiness page can show the latest result for each required check while preserving created/updated timing.

## Execution Model

The runner exposes required checks for Moodle and Canvas:

- `configuration_review`
- `roster_preview`
- `launch_smoke`

The default runner is deterministic and local. It checks Academy readiness inputs already available to the app:

- configuration review passes when the provider has recorded sandbox evidence;
- roster preview passes when at least one roster-eligible section exists;
- launch smoke is skipped until a provider sandbox URL/reference is present in recorded evidence.

This gives operators a real, repeatable readiness run without pretending a live provider API has been validated.

## API And UI

Extend `POST /api/academy/lms/readiness` with `action: "run_sandbox_checks"`. Only same-tenant institution administrators may run checks. Existing read roles can view results.

Extend `GET /api/academy/lms/readiness` and `/admin/settings/lms` to include latest check results. The LMS settings page shows last result status, summary, reference, and run time for each provider, and adds a run button for administrators.

## Safety

Results must not include provider tokens, passwords, client secrets, raw provider payloads, or account URLs with credentials. The runner records only safe summaries and doc-like references. RLS uses `app.academy_tenant_id`.

## Verification

Focused tests cover migration shape, result normalization, repository upsert/list, runner behavior, API authorization and execution, and page source wiring. Final verification uses full tests, lint, build, migration-seed rehearsal, diff whitespace check, and browser smoke on `/admin/settings/lms`.
