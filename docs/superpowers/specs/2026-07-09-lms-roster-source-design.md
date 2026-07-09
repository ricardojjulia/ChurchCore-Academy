# LMS Roster Source Design

## Goal

Build the first LMS activation bridge from real Academy data: an administrator can choose a real course section and preview the Moodle or Canvas roster-sync plan derived from Academy section enrollments.

## Scope

This slice connects existing academic-loop data to the existing provider-neutral LMS contract. It does not make live Moodle or Canvas network calls, store provider secrets, or claim production activation. The output remains an evidence-gated sync plan that can be reviewed before execution.

## Approach

Add a small `lms-roster-source` module that reads one tenant-scoped course section, primary instructor, course metadata, academic period, and course-section registrations. It maps Academy registration statuses into LMS roster states:

- `registered`, `pending_confirmation`, and `completed` become included students.
- `registered` and `pending_confirmation` become `active`.
- `completed` becomes `completed`.
- `withdrawn` becomes `withdrawn` only when the registration exists in the section roster history.
- `waitlisted` is excluded from the provider roster.

The module then calls the existing `buildLmsRosterSyncPlanPayload` contract path with derived `instructorPersonIds`, `studentPersonIds`, `enrollmentStates`, and a deterministic idempotency key.

## UI

Extend `/admin/settings/lms` with a compact roster preview panel. The panel lists sync-eligible sections and lets the operator preview the provider operations for the selected section. The preview shows provider, section, roster counts, operation status, and safe provider-operation summaries. It does not expose student names, provider secrets, or raw provider payloads.

## Authorization And Safety

The API uses session actor resolution, capability context for tenant-scoped database access, and the existing LMS contract admin authorization. Because this route only previews a plan and does not execute provider calls, it does not require the live `lmsRosterSync` capability; no-LMS tenants receive the existing unsupported provider plan instead of a hard block. All data queries are tenant-scoped. Cross-tenant section access returns a safe not-found style error. The route returns safe messages and redacted operation metadata only.

## Testing

Tests cover:

- Deriving roster input from real section/registration rows.
- Excluding waitlisted registrations from provider rosters.
- Preserving withdrawn/completed states for historical provider reconciliation.
- Rejecting cross-tenant section access before a plan is built.
- API payloads do not require manual student id entry and do not leak secrets or raw provider fields.

Browser verification should prove an admin can open `/admin/settings/lms`, preview a real section roster plan, and see a safe result without a 404 or runtime error.
