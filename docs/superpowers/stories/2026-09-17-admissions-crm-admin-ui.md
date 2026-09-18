# User Story: Admissions CRM Admin UI

**Story ID:** 2026-09-17-admissions-crm-admin-ui
**Date:** 2026-09-17
**Status:** Ready for design spec

**Correction note (2026-09-17, same day):** the first draft of this story assumed role-based
authorization (`AcademyActor.roles`) and that staff could directly edit an inquiry's assignment
and notes via the same PATCH used for status. Direct verification of the actual API routes
(`src/app/api/academy/admissions/inquiries/[id]/route.ts` et al.) found neither is true:
authorization is capability-based (`assertCapability(capabilities, "admissionsWorkflows")` via
`withCapabilityContext`, not a role array check), and there is no backend support at all today
for editing `assignedToPersonId` or `notes` on an inquiry — only `updateInquiryStatus()` exists.
There is also no route or module function to *list* existing drip sequences (only `createDripSequence`
and `triggerDripSequence`), so a sequence, once created, is currently invisible to any UI. The
sections below have been corrected to match verified reality rather than the first-pass assumption.

---

## 1. User Story

As an admissions staff member, I want a pipeline dashboard where I can see inquiries and their assignment/notes at a glance, move them through their lifecycle stages, convert them to applications, and manage and fire drip communication sequences, so that I can nurture prospective students efficiently and never lose a lead due to manual follow-up gaps. (Editing assignment/notes is a near-term follow-on, not this slice — see Out of Scope.)

---

## 2. Acceptance Criteria

### Inquiry Pipeline View

**Happy path:**
- Given I am authenticated as a staff member whose tenant grants the `admissionsWorkflows` capability, in tenant A,
- When I visit `/admin/admissions/inquiries`,
- Then I see a list of all inquiries in tenant A (via `GET /api/academy/admissions/inquiries`), filterable by `status` and `assignedToPersonId` (both already supported by `listInquiries()`).
- Each inquiry shows: firstName, lastName, email, phone, programOfInterest, source, inquiryDate, status, assignedToPersonId (read-only display — see Out of Scope), notes (read-only display — see Out of Scope), convertedToApplicationId, timestamps.
- I can change an inquiry's status via `PATCH /api/academy/admissions/inquiries/[id]` (body: `{status}`), which calls `updateInquiryStatus()`. Valid values: new, contacted, nurturing, applied, enrolled, lost.
- I can convert an inquiry to a full application via a "Convert to Application" action, which calls `POST /api/academy/admissions/inquiries/[id]/convert` with an existing `applicationId`. This endpoint links an *already-created* draft application to the inquiry and sets status to "applied" — it does not create the application itself. The UI must present a way to select an existing draft `AdmissionApplication` for the same tenant (e.g. a search/select over draft applications, filterable by matching email/name to the inquiry as a convenience) rather than assuming one is auto-created. Creating a brand-new person + draft application from an inquiry in one click is explicitly out of scope for v1 (see below) — staff use the existing admissions application-creation flow first, then come back and link it.
- From an inquiry's detail view, I can fire a drip sequence for it via `POST /api/academy/admissions/inquiries/[id]/trigger-drip` (body: `{triggerEvent}`), which calls the existing `triggerDripSequence()`. This is the only way any drip sequence ever actually sends anything today — see the Edge Cases section below.

**Capability rejection:**
- Given I am authenticated as a staff member whose tenant does NOT grant `admissionsWorkflows`,
- When I attempt to load `/admin/admissions/inquiries` or call any inquiry endpoint,
- Then the request is rejected by `assertCapability()` before any inquiry data is read or written.

**Cross-tenant isolation:**
- Given I am authenticated as a capable staff member in tenant B,
- When I visit `/admin/admissions/inquiries`,
- Then I see only inquiries where `tenantId = "B"`, never inquiries from tenant A (enforced by `listInquiries()`'s tenant scoping).
- If I attempt to update or convert an inquiry from tenant A via direct API call,
- Then the request fails with "not found or access denied" (enforced by the existing `tenant_id = $N` predicate in `updateInquiryStatus()`/`convertInquiryToApplication()`).

**Missing data:**
- Given an inquiry has no `assignedToPersonId` or `notes` set,
- Then the UI shows an empty/"Unassigned" state for that field (read-only — see Out of Scope for why editing isn't in v1).

### Drip Sequence Management

**A small, genuinely new (but tiny) backend piece is required here**, called out explicitly:
`listDripSequences()` does not exist in `src/modules/admissions/applicant-crm.ts` today, and
neither does a `GET /api/academy/admissions/drip-sequences` route — only `POST` (create) exists.
Without a list capability, a sequence becomes invisible the moment it's created. This story
includes adding that one new read-only module function + route, following the exact
tenant-scoping and `assertCapability("admissionsWorkflows")` pattern the POST route already uses.
No new schema — `academy_drip_sequences`/`academy_drip_steps` already exist and already support
this query. No edit or deactivate action in v1 (see Out of Scope) — this keeps the new backend
surface to one simple SELECT.

**Happy path:**
- Given I am authenticated as a capable (`admissionsWorkflows`) staff member in tenant A,
- When I visit `/admin/admissions/drip-sequences`,
- Then I see a list of all drip sequences in tenant A, each with its `triggerEvent`, `active` flag, and its steps (`stepNumber`, `delayDays`, `templateKey`, `channel`), via the new list endpoint.
- I can create a new drip sequence by providing: name, triggerEvent (inquiry_received, application_started, application_submitted), and one or more steps, each requiring stepNumber, delayDays, templateKey (must be one of the existing `CommunicationTemplateKey` values — reuse the same `VALID_TEMPLATE_KEYS` validation already in the POST route), and channel (email or in_app only — SMS does not exist as a channel).
- Creating a sequence calls the existing `createDripSequence()` via the existing POST route and returns both the sequence and its steps.

**Capability and role rejection:**
- Given I am authenticated as a staff member without `admissionsWorkflows`,
- When I attempt to view or create a drip sequence,
- Then the request is rejected by `assertCapability()`.
- Given I am authenticated as an `admissions`-role (not `institution_admin`) staff member with the capability enabled,
- When I attempt to create a drip sequence,
- Then the request is rejected — `createDripSequence()` calls `assertInstitutionAdmin()`, which requires `institution_admin` specifically, not just any admissions-staff role. This is stricter than inquiry management (which allows `admissions` OR `institution_admin`). The new `listDripSequences()` function should match this same institution_admin-only gate for consistency with its write counterpart, so the UI should treat drip-sequence viewing as an institution_admin-only screen, not a general admissions-staff one.

**Cross-tenant isolation:**
- Given I am authenticated as a capable staff member in tenant B,
- When I create a drip sequence,
- Then it is created with `tenantId = "B"` and does not appear when tenant A lists sequences (the new list function must scope by `tenant_id`, matching every other query in this module).

**Missing or invalid data:**
- Given I attempt to create a drip sequence with zero steps,
- Then the existing POST route already rejects this ("steps array is required and must not be empty") — no change needed, just surface the error in the UI.
- Given I attempt to create a step with an invalid templateKey or channel,
- Then the existing POST route already rejects this — surface the error in the UI, don't re-implement the validation client-side only.

---

## 3. Edge Cases Worth Thinking About

**Inquiry state transitions:**
- Converting an already-converted inquiry (status = "applied", convertedToApplicationId already set) — the UI should hide/disable the "Convert" action and instead show a link to the already-linked application.
- Changing the status of an inquiry that is already "enrolled" or "lost" back to an earlier stage — allowed by the backend (`updateInquiryStatus()` has no transition guard, unlike `AdmissionApplication`'s state machine), but the UI should show a confirmation before doing so, since it's an unusual action.
- The "Convert" action requires the staff member to already know or find the target `applicationId` — since there's no picker/search endpoint for "list draft applications by tenant" confirmed yet, verify during the design-spec stage whether `GET /api/academy/admissions/applications` (which exists) supports filtering to drafts, and reuse it rather than inventing a new endpoint.

**Drip sequence triggers — confirmed, and now in scope:**
- `triggerDripSequence()` is NOT wired to fire automatically from any lifecycle event (`createInquiry()` included) — it is only ever called from `POST /api/academy/admissions/inquiries/[id]/trigger-drip` (body: `{triggerEvent}`), which already exists and is fully wired (capability-gated, tenant-scoped). Without exposing this in the UI, a sequence created via this story's other screen would be permanently unreachable. **Added to scope:** a "Send drip sequence" action on the inquiry detail view, letting staff pick a triggerEvent and fire it for that inquiry. This is the actual "bulk communication" payoff of this story — surface it, don't skip it.
- Multiple active sequences for the same trigger event — `triggerDripSequence()` schedules messages from all of them, which could result in duplicate communications; the UI should warn if creating a sequence whose triggerEvent already has an existing sequence (v1 has no "active" toggle to deactivate one, so this warning is the only mitigation available).
- A drip step with `delayDays = 0` sends immediately (within the scheduled send window); larger values delay accordingly.
- The UI must validate templateKey/channel against the same allow-lists already hardcoded in the POST route (`VALID_TEMPLATE_KEYS`, `VALID_CHANNELS`) so client-side and server-side validation agree — don't invent a second source of truth.

**Channel constraints:**
- The UI must not offer "sms" as a channel option for drip steps, as `CommunicationChannel` only supports "in_app" | "email" today.

**Read-only fields, explicitly:**
- `assignedToPersonId` and `notes` are displayed but not editable in this story (no backend support exists — see Out of Scope). Don't build a form control that silently no-ops or errors when submitted; simply don't render an editable control for either field.

**Offline PWA behavior:**
- This is an admin feature, not a student PWA feature, so offline behavior is not a concern — the page requires a live connection to load and update inquiries.

---

## 4. Out of Scope

This story explicitly does NOT include:

- **Application fee collection, enrollment e-signature, reference collection, conditional (rule-engine) document requirements** — all separate, larger work packages per the closure plan, each needing genuinely new schema/services, not just UI.
- **Program document requirements and document types admin UI** — `src/app/api/academy/admissions/document-types/route.ts` and `.../programs/[programId]/requirements/route.ts` (+ `[reqId]` DELETE) are fully built (`AdmissionDocumentService`, `DocumentChecklistService`) with zero admin UI today. This is a real, ready-to-build, zero-new-backend follow-on slice, structurally identical to this one — deliberately kept as a separate story/PR so this one stays reviewable, not because it's harder.
- **Editing an inquiry's `assignedToPersonId` or `notes`** — no backend function or route exists for either today (only `updateInquiryStatus()` does). Adding them is a small, real follow-on (a new `assignInquiry()`/`addInquiryNote()` pair, mirroring `updateInquiryStatus()`'s shape) but is new backend work, not "just UI," so it's deliberately excluded from this zero-new-backend-risk slice.
- **One-click "create person + draft application" from an inquiry** — `convertInquiryToApplication()` requires an already-existing `applicationId`; it does not create one. Building that creation flow (which itself needs a Person record, since `AdmissionApplication.applicantPersonId` is required) is a real, separate piece of work, not covered here.
- **SMS as a communication channel** — `CommunicationChannel` does not include "sms" today. This story is scoped to the existing "email" and "in_app" channels only.
- **Public-facing applicant portal** — no changes to `/apply/*` or `/api/public/*`. This is an internal admin-facing feature only.
- **Bulk SMS/email campaigns** (ad-hoc, non-drip, audience-filtered) — a separate, larger work package. This story only covers drip sequences (triggered, templated, delayed messages).
- **Drip sequence editing or deactivation** — v1 is create + list only. Editing steps, renaming a sequence, or toggling `active` all need new backend functions not covered here.
- **Inquiry creation UI** — `POST /api/academy/admissions/inquiries` already exists and supports both authenticated and unauthenticated (public-form-style, via `X-Tenant-Id` header) creation, but no page calls it yet. Building that intake form (public or admin-side "log an inquiry") is a separate, real follow-on — not attempted here. This story is for managing *existing* inquiries only.
- **Conversion funnel analytics** — `getConversionFunnel()` and its route already exist; a dashboard for it is a separate story.

---

## 5. Open Questions

None remaining after direct verification of the actual routes and module functions (see the
correction note at the top). The scope is now: read + status-change + convert for inquiries
(zero new backend), and create + list for drip sequences (one new list function/route, no new
schema). The only implementation decision left is the UI pattern for the inquiry pipeline
(kanban board vs. filterable list vs. tabs by status) — that belongs in the design spec.
