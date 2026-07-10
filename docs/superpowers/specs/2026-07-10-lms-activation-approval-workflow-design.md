# LMS Activation Approval Workflow Design

## Goal

Add a governed LMS production activation request workflow that requires recorded sandbox evidence and passed sandbox checks before activation can be requested or approved.

## Scope

This slice creates a tenant-scoped activation approval ledger and exposes request/approval actions from `/admin/settings/lms`. It does not enable live LMS roster sync, store provider secrets, mutate institution capability flags, or call Moodle/Canvas APIs.

## Data Model

Add `academy_lms_activation_requests` with tenant-scoped RLS. Each row records provider, request status, safe summary, evidence snapshot, requester/approver, timestamps, and optional approval note. Only the latest open request per `(tenant_id, provider_id)` is allowed by a partial unique index.

Statuses:

- `requested`
- `approved`
- `rejected`

## Eligibility

A provider is eligible for activation request when:

- at least one recorded sandbox evidence item exists for that provider;
- all latest sandbox check results for that provider are `passed`;
- the required check keys are present: `configuration_review`, `roster_preview`, and `launch_smoke`.

This intentionally means a skipped launch smoke blocks approval.

## API And UI

Extend `POST /api/academy/lms/readiness`:

- `request_activation`: creates or refreshes a request if eligibility passes.
- `approve_activation`: approves an existing requested activation.
- `reject_activation`: rejects an existing requested activation with a safe note.

Extend `GET /api/academy/lms/readiness` and `/admin/settings/lms` to display the latest activation request status per provider.

## Safety

Activation requests store only safe summaries and references. Validation rejects token, secret, password, client secret, access token, refresh token, and raw provider payload shaped text. RLS uses `app.academy_tenant_id`.

## Verification

Focused tests cover migration shape, eligibility rules, repository mutations, API authorization/actions, and page source wiring. Full verification uses `npm test`, lint, build, local migration apply, migration-seed rehearsal, diff check, and browser smoke.
