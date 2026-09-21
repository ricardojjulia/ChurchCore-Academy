# ADR-0072 — Application Document Checklist: Schema Reconciliation and Waiver Support

**Date:** 2026-09-20
**Status:** Accepted
**Deciders:** Ricardo Julia (sole approver)
**Supersedes:** ADR-0048 (data model only — the checklist requirement and workflow goals of ADR-0048 remain in force)

> **2026-09-21:** The decision-gate gap noted below is closed. `canAdvanceToDecision` was added to
> `DocumentChecklistService` and wired into the admissions decision route (`accepted` decisions
> only — declining doesn't depend on document completeness). Closing it surfaced a second,
> previously undiscovered gap: `snapshotChecklistForApplication` (which turns a program's document
> requirements into per-application checklist items) had never been called from either
> application-submission path, so every submitted application carried zero checklist items
> regardless of its program's actual requirements — the decision gate would have been a no-op
> against real data. Both submission paths (`PublicApplicationService.submitPublicApplication`
> and `AdmissionsService.submit` via its route) now snapshot the checklist on submission.
> Applications submitted before this fix will not retroactively get checklist items — treated as
> a known, low-risk limitation given this repo's single-tenant demo deployment, not backfilled.

---

## Context

Two independent, unreconciled implementations of the application document checklist existed in
this repository at the same time:

1. **The checklist model** (`academy_program_document_requirements` /
   `academy_application_document_items`, migration `20260623040000`) — requirements scoped
   per program, applicant upload, staff review (`reviewed` / `resubmission_required` with an
   officer note). Shipped in PR #142 and #143, wired to `/admin/programs/[id]` (program
   requirements) and `/admin/people/applicants/[id]` (applicant checklist, review actions), and
   to the public `/apply/status` upload flow. Fully tested.

2. **The ADR-0048 model** (`academy_document_types` / `academy_application_documents`,
   migrations `20260625030000` and `20260625040000`) — a tenant-wide, reusable document-type
   registry with a formal `waived` status, waiver audit trail, and stronger database-level
   constraints (an enum type, a check constraint tying status to the required columns, and
   role-based RLS). Partially implemented: `createDocumentType` / `listActiveDocumentTypes`
   shipped live in PR #142 via `/admin/admissions/document-types`, but the per-application
   document lifecycle (upload, confirm, receive, waive, download, and the decision-gate check)
   was never finished. A branch (`feat/adr-0048-document-api-routes`) attempting to finish it
   produced two PRs (#145, #146) that both got stuck on a TypeScript build failure and were
   closed without merging.

Because `academy_document_types` was never connected to the checklist that applicants and staff
actually use, `/admin/admissions/document-types` was a live dead end: staff could define a
document type there and it would have zero effect on any program's checklist or any
application's status.

Neither model is a strict superset of the other. The checklist model has the scoping real
multi-program institutions need (a seminary and an undergraduate program can require different
documents) and is shipped, tested, and live. The ADR-0048 model has better data integrity (a
real status enum, a check constraint, role-based RLS) and one workflow capability the checklist
model lacked: an auditable waiver with a mandatory note, called out in ADR-0048's own
"Consequences" section as an accreditation record-keeping requirement.

---

## Decision

### 1. The checklist model is canonical

`academy_program_document_requirements` / `academy_application_document_items` is the system of
record for application document tracking. No further work will build out the ADR-0048 route
layer (the confirm/receive/waive/download routes and decision-gate check originally planned as
Prompts B–F in that branch's `IMPLEMENT.md`).

### 2. Remove the disconnected registry UI and code

Removed entirely, since it never reached the live checklist:

- `/admin/admissions/document-types` page and `CreateDocumentTypeForm`
- `/api/academy/admissions/document-types` route
- `AdmissionDocumentService` and the `DocumentRepository` interface (`document-service.ts`)
- The document-type/document-record methods on `PostgresAdmissionsRepository` and the
  corresponding types (`DocumentType`, `CreateDocumentTypeInput`, `ApplicationDocument`,
  `ApplicationDocumentStatus`, `UploadUrlRequest`, `UploadUrlResponse`, `WaiveDocumentInput`,
  `ChecklistCompletionStatus`, `DocumentChecklistItem`)
- The unmerged `applications/[id]/documents/upload-url` staff/session route from the stuck
  branch
- The nav item and role-gating plumbing (`canViewDocumentTypes`) wiring the removed page into
  `admin-shell.tsx` / `admin-capability-context.tsx` / `admin/layout.tsx`

The `academy_document_types` and `academy_application_documents` tables (and the
`academy_application_document_status` enum) are left in place, unused. Migrations are
append-only in this repository, and dropping them destroys any rows already created through the
now-removed admin page for no functional benefit — see "Consequences" below.

### 3. Port the one missing capability: waiver

Added to the checklist model (migration `20260920120000`):

- `academy_application_document_items.status` now accepts `waived` in addition to `pending`,
  `uploaded`, `reviewed`, `resubmission_required`.
- New columns: `waived_by_person_id`, `waived_at`, `waiver_note`.
- `DocumentChecklistService.waiveDocumentItem(actor, { documentItemId, waiverNote })` — staff-only
  (same role set as `reviewDocumentItem`), mandatory non-empty note, tenant-checked.
- `PATCH /api/academy/admissions/applications/[id]/documents/[itemId]` gained a `"waive"` action
  alongside the existing `"confirm_upload"`, `"review"`, and `"download_url"` actions.
- `getApplicationChecklist`'s completion percentage now counts `waived` items as satisfied,
  alongside `reviewed`.
- Admin UI (`ApplicationTab.tsx`) gained a "Waive" action and a mandatory-note dialog, mirroring
  the existing "Review" action.

---

## Consequences

- One admin surface, one schema, one route family for application documents — no more silent
  dead end where creating a "document type" does nothing.
- The waiver capability ADR-0048 wanted is now available on the model that's actually live,
  without a rewrite of shipped, tested code.
- `academy_document_types` / `academy_application_documents` remain in the schema as unused,
  orphaned tables. This is deliberate schema debt, not an oversight: dropping them requires
  confirming no tenant has live data in them, which was out of scope for this reconciliation.
  A follow-up migration to drop them is a reasonable future cleanup once that's confirmed.
- Program-level document type reuse (defining "Pastoral Reference Letter" once and attaching it
  to multiple programs) is not supported by the checklist model — each program requirement is a
  freeform label. This was already true before this ADR; it is not a regression introduced here.
- ~~The decision-gate check (blocking an admissions decision when required documents are
  incomplete) still does not exist under either model.~~ Closed 2026-09-21 — see the update
  note above.

---

## Alternatives Considered

**Migrate the checklist model onto the ADR-0048 schema:** Rejected. Would require adding
program-scoping to `academy_document_types` (a schema change to already-unused tables),
migrating existing `academy_program_document_requirements` data, and rewriting the admin and
applicant UI and every route that depends on the checklist model today. High risk and effort for
no user-facing benefit beyond the constraints already re-created here via the migration in
Decision §3.

**Leave both models in place, disambiguate by use case:** Rejected. They model the same
concept (what documents does this application need, and what's their status) for the same
actors (applicants, admissions staff). Keeping both would mean every future document-related
change has to consider which schema it applies to, indefinitely.

**Drop the orphaned tables now:** Deferred, not rejected. `/admin/admissions/document-types` was
live from PR #142 (merged 2026-09-19) until this ADR, so a real tenant could plausibly have rows
in `academy_document_types`. This repository currently runs a single tenant against a local/demo
Supabase instance (see project memory), so the risk is low, but confirming that and executing
the drop is left as an explicit follow-up rather than folded silently into this change.

---

## Related

- ADR-0048 — Application Document Checklist and Admissions Completion Workflow (superseded by
  this ADR for its data model; its checklist/waiver requirements are carried forward here)
