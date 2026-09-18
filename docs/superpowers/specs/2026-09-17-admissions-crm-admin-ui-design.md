# Design Spec: Admissions CRM Admin UI

**Date:** 2026-09-17
**Story:** `docs/superpowers/stories/2026-09-17-admissions-crm-admin-ui.md`
**Status:** Ready for implementation
**Phase:** Admissions CRM Completion (per 2026-09-13 competitive closure plan)

---

## Data model changes

**None.** Zero new schema. All necessary tables already exist:

- `academy_inquiries` — created by existing `createInquiry()`, queried by existing `listInquiries()`
- `academy_drip_sequences` — created by existing `createDripSequence()`
- `academy_drip_steps` — created by existing `createDripSequence()`
- `academy_admission_applications` — queried for the "Convert to Application" picker

The one genuinely new backend piece is a single new module function: `listDripSequences(actor, database): Promise<{ sequence: DripSequence; steps: DripStep[] }[]>` in `src/modules/admissions/applicant-crm.ts`, which performs a straightforward tenant-scoped SELECT from the existing tables. No migration required. It should call `assertInstitutionAdmin(actor, actor.tenantId)` — the same gate `createDripSequence()` already uses — not the broader `assertAdmissionsStaff()` used for inquiries, so viewing and creating drip sequences share one consistent, stricter (institution_admin-only) gate.

---

## Business logic flow

### Inquiry pipeline management

1. Staff member with `admissionsWorkflows` capability visits `/admin/admissions/inquiries`.
2. Page calls `GET /api/academy/admissions/inquiries` (already exists, already capability-gated).
3. Route resolves actor via `resolveAcademyActorFromSession`, then calls `withCapabilityContext(actor, ...)` which:
   - Fetches the institution's capability set
   - Calls `assertCapability(capabilities, "admissionsWorkflows")` — throws `CapabilityDisabledError` if disabled, which `handleApi` maps to HTTP 451 with `{available: false, capability, reason}` (confirmed in `src/app/api/academy/api-utils.ts`)
   - If enabled: continues
4. Calls `listInquiries(actor, { status, assignedToPersonId }, database)` which:
   - Asserts `actor.roles` includes `institution_admin` or `admissions` (via `assertAdmissionsStaff()`, confirmed in `applicant-crm.ts` line 119-128)
   - Scopes by `tenant_id = $actor.tenantId`
   - Applies optional `status` and/or `assignedToPersonId` filters if provided in query params
5. Page renders list with filterable UI.

**Status change:**
1. Staff clicks "Change status" → client calls `PATCH /api/academy/admissions/inquiries/[id]` with `{status}` (already exists).
2. Route calls `updateInquiryStatus(actor, id, status, database)` which asserts admissions-staff role, updates where `tenant_id = $actor.tenantId AND id = $id` (tenant isolation via predicate), with no state-transition guard (unlike `AdmissionApplication`'s state machine — any status can follow any other).
3. Returns updated inquiry.

**Convert to application:**
1. Staff clicks "Convert to Application" → UI shows search/picker for draft applications.
2. Picker calls `GET /api/academy/admissions/applications?status=draft` — **requires a small, additive API enhancement** (see API changes below).
3. Staff selects an existing draft application → client calls `POST /api/academy/admissions/inquiries/[id]/convert` with `{applicationId}` (already exists).
4. Route calls `convertInquiryToApplication(actor, inquiryId, applicationId, database)`, confirmed in `applicant-crm.ts` lines 289-322: updates inquiry `status = 'applied'`, sets `converted_to_application_id`, records a conversion event in `academy_conversion_events`, tenant-scoped by predicate.
5. Returns updated inquiry.

**Trigger drip sequence:**
1. Staff opens inquiry detail view, clicks "Send drip sequence" → selects `triggerEvent` (inquiry_received | application_started | application_submitted).
2. Client calls `POST /api/academy/admissions/inquiries/[id]/trigger-drip` with `{triggerEvent}` (already exists, confirmed fully wired: capability-gated, tenant-scoped).
3. Route calls `triggerDripSequence(actor, inquiryId, triggerEvent, database, communicationsService)`, which finds all active sequences for that trigger event in-tenant and schedules a communication per step.
4. Returns the scheduling result.

### Drip sequence management

**List sequences (new):**
1. Staff (institution_admin) visits `/admin/admissions/drip-sequences`.
2. Page calls `GET /api/academy/admissions/drip-sequences` — **new GET handler on the existing route file** (only POST exists today).
3. Route resolves actor, asserts capability, calls the new `listDripSequences(actor, database)`:
   ```sql
   select * from academy_drip_sequences where tenant_id = $1 order by created_at desc;
   -- then, per sequence:
   select * from academy_drip_steps where tenant_id = $1 and sequence_id = $2 order by step_number asc;
   ```
4. Page renders list with trigger event, active flag, step count/detail.

**Create sequence (existing, unchanged):**
1. Staff fills form: name, triggerEvent, steps (stepNumber, delayDays, templateKey, channel).
2. Client calls the existing `POST /api/academy/admissions/drip-sequences`.
3. Route validates templateKey/channel against its own hardcoded allow-lists (`VALID_TEMPLATE_KEYS`, `VALID_CHANNELS` — confirmed in the route file) before calling `createDripSequence()`, which asserts `institution_admin` and inserts sequence + step rows tenant-scoped.

---

## API changes

### New: `GET /api/academy/admissions/drip-sequences`

Add a GET handler to the existing route file (`src/app/api/academy/admissions/drip-sequences/route.ts`, which today only exports `POST`).

**Response:**
```json
{
  "sequences": [
    {
      "sequence": { "id": "...", "tenantId": "...", "name": "...", "triggerEvent": "inquiry_received", "active": true, "createdAt": "...", "updatedAt": "..." },
      "steps": [
        { "id": "...", "stepNumber": 1, "delayDays": 0, "templateKey": "application_received", "channel": "email" }
      ]
    }
  ],
  "count": 1
}
```

**Auth:** `resolveAcademyActorFromSession` → `withCapabilityContext` → `assertCapability(capabilities, "admissionsWorkflows")` → `listDripSequences()` (which itself asserts `institution_admin`, matching `createDripSequence()`'s gate).

**Error codes:** 401 unauthenticated, 451 capability disabled, 403 role forbidden.

### Small enhancement: `GET /api/academy/admissions/applications` — expose `?status=`

The repository's list method already supports filtering by status; the route just doesn't extract the query param today. Add:
```typescript
const status = new URL(request.url).searchParams.get("status") ?? undefined;
const applications = await repository.list(actor.tenantId, {
  applicantPersonId: staffView ? undefined : actor.userId,
  status: status as AdmissionApplicationStatus | undefined,
});
```
This lets the "Convert to Application" picker call `?status=draft` and reuse this endpoint rather than inventing a new one. Verify the repository's filter is parameterized (no injection risk) before relying on it as-is — read `src/modules/admissions/postgres-repository.ts`'s `list()` implementation directly during implementation to confirm the exact filter shape, since this spec's author did not paste that code verbatim.

---

## Frontend changes

### New: `/admin/admissions/inquiries` (list view)

Follow the established capability-gated admin list pattern used by `/admin/alumni/page.tsx` and `/admin/denomination/page.tsx` (i.e. whichever page shipped in PR #114/#116 — read one of them directly as the template before writing this page, don't reinvent the structure):

- `<AdminShell>` wrapper with eyebrow/title/subtitle
- Server-side fetch: resolve actor, `withCapabilityContext` → `assertCapability("admissionsWorkflows")` → `listInquiries()`; catch `CapabilityDisabledError` and render `<CapabilityGhostPage capability="Admissions Workflows" .../>` instead (component confirmed to exist at `src/components/ui/CapabilityGhostPage.tsx`, already used this exact way in `admin/alumni/page.tsx` and `admin/formation/page.tsx`)
- Filter controls (status, assignedToPersonId) as a GET form / searchParams-driven page
- `<Table>` of inquiries with a status `<Badge>`, link to each inquiry's detail page
- Export a role constant (e.g. `INQUIRY_PIPELINE_ROLES = ["institution_admin", "admissions"]`) for the sidebar nav gate, matching the pattern used for other admissions-adjacent nav entries

### New: `/admin/admissions/inquiries/[id]` (detail view)

- Read-only display of all inquiry fields, including `assignedToPersonId` and `notes` (no edit controls for either — the backend doesn't support editing them; don't build inputs for fields with no way to save)
- Status-change control (client component, `"use client"`, submits `PATCH .../inquiries/[id]`)
- Convert-to-application flow:
  - If `convertedToApplicationId` is set: show a link to the linked application, no convert action
  - Else: a picker over `GET /api/academy/admissions/applications?status=draft` (convenience-filter client-side by matching name/email to the inquiry), submitting the chosen `applicationId` to `POST .../inquiries/[id]/convert`
- "Send drip sequence" control: a `triggerEvent` select, submitting to `POST .../inquiries/[id]/trigger-drip`; show the scheduling result (e.g. "Scheduled N messages") via the existing toast/notification convention used elsewhere in admin pages

### New: `/admin/admissions/drip-sequences` (list + create)

- Institution-admin-gated (stricter than the inquiries pages — see role note above)
- List view over the new GET endpoint: name, triggerEvent, active, step count, expandable step detail
- Create form (client component): name, triggerEvent select, repeatable step fieldset (stepNumber, delayDays, templateKey select constrained to `VALID_TEMPLATE_KEYS`, channel select constrained to `email`/`in_app` only — no SMS option, ever, since the type doesn't support it)
- If the sequence being created shares a `triggerEvent` with an existing sequence already in the list, show an inline warning ("another active sequence already uses this trigger — both will fire") before submit; don't block it, since there's no deactivation mechanism in v1 to resolve the conflict with
- Zero-steps is already rejected server-side; surface that error, don't re-validate it differently client-side

### Sidebar navigation

Add "Inquiries" (role: `institution_admin`/`admissions`) and "Drip Sequences" (role: `institution_admin` only) entries under the Admissions nav section, gated the same way every other admin nav entry in this codebase is gated post-2026-09-17's third nav-gating bug fix (PR #128) — compute the gate server-side from the same role list the destination page itself enforces, don't hand-duplicate a looser check.

---

## Test plan

Per CLAUDE.md: every new/changed function needs success, rejection, and cross-tenant cases; full-dependency data setup (no raw inserts bypassing real module functions); no PII in test failure output.

**`listDripSequences()` (new function) — `src/modules/admissions/__tests__/applicant-crm.test.ts`:**
1. Success: institution_admin actor, sequences created via `createDripSequence()` in the same tenant, returns them with their steps, ordered newest-first.
2. Cross-tenant: sequences exist in tenant A; institution_admin actor in tenant B sees none of them.
3. Role rejection: an `admissions`-role (non-institution_admin) actor is rejected, matching `createDripSequence()`'s own gate.
4. Empty state: no sequences in tenant → empty array, not an error.

**New `GET /api/academy/admissions/drip-sequences` route:**
1. Success (200, capability enabled, institution_admin).
2. Capability disabled → 451 with the standard `{available:false,...}` body.
3. Unauthenticated → 401.
4. Non-institution_admin, capability enabled → 403.

**Applications `?status=draft` enhancement:**
1. Only draft applications returned when the filter is set; existing behavior (all applications the actor can see) unchanged when omitted.
2. Cross-tenant isolation already covered by the repository's existing tenant scoping — add a case confirming the new filter doesn't bypass it.

**Frontend / browser verification (not unit-testable, must be done live per CLAUDE.md Design Principle 6):**
1. Inquiry list loads, filters work, status change persists, convert-to-application links a real draft application and flips status to "applied."
2. Drip sequence create + list round-trip; trigger-drip from an inquiry actually schedules communications (verify via the communications module's own data, not just a 200 response).
3. Capability-disabled tenant sees the ghost page, not a raw error.
4. Cross-tenant: constructing a URL for another tenant's inquiry ID returns "not found," not a leaked record.
5. An `admissions`-role (non-institution_admin) account can use the inquiries pages but is correctly blocked from the drip-sequences page.

---

## Risks

- **Authorization is two-layered by design here** (route-level capability check via `assertCapability`, module-level role check via `assertAdmissionsStaff`/`assertInstitutionAdmin`) — this is more defense-in-depth than most other modules in this codebase use, but it's the existing, correct pattern for this module specifically (added when capabilities were introduced, per ADR references in the codebase). Don't "simplify" it to one layer during implementation; both checks are load-bearing.
- **`listDripSequences()` gating choice:** this spec recommends institution_admin-only (matching `createDripSequence`), which is stricter than inquiry management. If that reads as surprising in review, it's a deliberate consistency call, not an oversight — flag it in the PR description so a reviewer doesn't assume it's a bug.
- **The applications `?status=draft` filter is new API surface**, even though small. Confirm the repository's `list()` filter shape directly against `src/modules/admissions/postgres-repository.ts` during implementation — this spec describes the expected shape but the exact parameter name/type should be verified against the real function signature, not assumed from this document alone.
- **No automatic drip trigger exists.** `triggerDripSequence()` only ever fires via the manual UI action being built here. If the product expectation was "sequences fire automatically when an inquiry is created," that expectation isn't met by this slice or by anything already in the codebase — flag this to the user as a known limitation, not something this PR is expected to close.
